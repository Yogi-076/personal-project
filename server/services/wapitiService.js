const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const WafBypass = require('../utils/wafBypass');

class WapitiService {
    constructor() {
        this.wapitiPath = this.detectWapitiPath();
        this.scanProgress = new Map();
        this.scanLogs = new Map(); // Store logs for each scan
        this.activeProcesses = new Map(); // Store active child processes
    }

    detectWapitiPath() {
        // 1. Try finding it in the PATH
        try {
            const systemPath = execSync(process.platform === 'win32' ? 'where wapiti' : 'which wapiti', { stdio: 'pipe' }).toString().trim().split('\n')[0];
            if (systemPath) return systemPath.trim();
        } catch (e) {
            // Ignore error
        }

        // 2. Try common locations or user provided override
        const commonPaths = [
            path.join(__dirname, '../../wapiti-master/wapiti-master/bin/wapiti'), // Local source
            'C:\\Users\\yogi\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python311\\Scripts\\wapiti.exe',
            'C:\\Python311\\Scripts\\wapiti.exe',
            process.env.WAPITI_PATH
        ];

        for (const p of commonPaths) {
            if (p && require('fs').existsSync(p)) return p;
        }

        // 3. Fallback to just 'wapiti' and hope it works or fail gracefully
        return 'wapiti';
    }

    async scan(target, options = {}, scanId) {
        try {
            this.scanProgress.set(scanId, 0);
            this.scanLogs.set(scanId, []);

            this.addLog(scanId, `Starting security analysis for ${target}`);
            this.addLog(scanId, `Using Wapiti binary: ${this.wapitiPath}`);

            // Clear Wapiti's session cache to prevent stale cache crashes
            await this._clearWapitiCache(target, scanId);

            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'wapiti-'));
            const outputFile = path.join(tempDir, 'report.json');

            const scanArgs = [
                '-u', target,
                '-f', 'json',
                '-o', outputFile,
                '--scope', 'domain',
                '--level', '2'
            ];

            // Add authentication if provided
            if (options.authSession) {
                this.addLog(scanId, '🔐 Using authenticated session');

                const cookieValue = options.authSession.cookieHeader?.replace('Cookie: ', '') || '';
                if (cookieValue) {
                    scanArgs.push('--header', `Cookie: ${cookieValue}`);
                    this.addLog(scanId, `Injected ${cookieValue.split(';').length} cookies via header`);
                }

                if (options.authSession.jwtHeader) {
                    scanArgs.push('--header', options.authSession.jwtHeader);
                    this.addLog(scanId, '🔑 Injected JWT Authorization header');
                }
            }

            if (options.fullModules) {
                scanArgs.push('-m', 'all,-takeover');
                this.addLog(scanId, '🚀 FULL MODULES MODE: Using all modules (-m all,-takeover) — Skipping "takeover" to prevent engine hang');
            } else if (options.modules) {
                scanArgs.push('-m', options.modules);
            }

            // WAF Bypass: inject random real-browser User-Agent and reduce detection profile
            if (options.wafBypass) {
                const wafBypass = new WafBypass();
                const ua = wafBypass.getRandomUA();
                scanArgs.push('--header', `User-Agent: ${ua}`);
                this.addLog(scanId, '🛡️ WAF Bypass Mode: ENABLED — Rotating User-Agent per scan');
                this.addLog(scanId, `🕵️ UA: ${ua.substring(0, 50)}...`);
            }

            let spawnCmd = '';
            let spawnArgs = [];
            let spawnCwd = process.cwd();

            if (this.wapitiPath.endsWith('.py') || (this.wapitiPath.includes('bin') && !this.wapitiPath.endsWith('.exe'))) {
                spawnCmd = 'python';
                spawnArgs = [path.basename(this.wapitiPath), ...scanArgs];
                spawnCwd = path.dirname(this.wapitiPath);
            } else if (this.wapitiPath === 'wapiti') {
                spawnCmd = 'wapiti';
                spawnArgs = scanArgs;
            } else {
                spawnCmd = this.wapitiPath;
                spawnArgs = scanArgs;
            }

            return new Promise((resolve, reject) => {
                this.addLog(scanId, `Executing DAST Scan...`);

                const child = spawn(spawnCmd, spawnArgs, {
                    cwd: spawnCwd,
                    shell: false,
                    env: process.env
                });

                // Track process for potential cancellation
                this.activeProcesses.set(scanId, {
                    child,
                    resolve,
                    reject,
                    isStopped: false,
                    tempDir
                });

                // Configurable timeout (Default: 120 mins for Full Modules, else 60 mins)
                const defaultTimeout = options.fullModules ? 7200000 : 3600000;
                const timeoutDuration = parseInt(process.env.SCAN_TIMEOUT) || defaultTimeout;
                const timeout = setTimeout(() => {
                    this.addLog(scanId, `⏱️ Scan reached maximum execution time of ${timeoutDuration / 60000} minutes.`);
                    this.addLog(scanId, '🛑 Terminating security engine and generating partial report from current findings...');

                    // Emulate a graceful user termination instead of a hard crash
                    const processData = this.activeProcesses.get(scanId);
                    if (processData) processData.isStopped = true;

                    try { child.kill(); } catch (e) { }

                    // Don't reject — return empty vulns so the ReportTransformer handles the live logs
                    this.activeProcesses.delete(scanId);
                    resolve({ vulnerabilities: [] });
                }, timeoutDuration);

                let stderr = '';

                child.stdout.on('data', (data) => {
                    const output = data.toString();
                    this.addLog(scanId, output.trim());
                    this.updateProgress(scanId, output);
                });

                child.stderr.on('data', (data) => {
                    const out = data.toString();
                    stderr += out;
                    // Only log meaningful stderr, not progress bars
                    const trimmed = out.trim();
                    if (trimmed && !trimmed.startsWith('\r') && trimmed.length > 5) {
                        this.addLog(scanId, trimmed);
                    }
                });

                child.on('error', (err) => {
                    clearTimeout(timeout);
                    this.addLog(scanId, `ERROR: ${err.message}`);

                    if (err.message.includes('ENOENT') || err.message.includes('not found')) {
                        reject(new Error('Wapiti not found. Please install it via `pip install wapiti3` or ensure it is in PATH.'));
                    } else if (err.message.includes('PermissionError') || err.message.includes('WinError 32')) {
                        // Known SQLite lock issue on Windows when forcefully closing — suppress
                        this.addLog(scanId, `⚠️ Engine interrupted: Database locked (safe to ignore)`);
                        resolve({ vulnerabilities: [] });
                    } else {
                        reject(err);
                    }
                });

                child.on('close', async (code) => {
                    clearTimeout(timeout);

                    // ═══ KEY FIX: Try to read report EVEN on non-zero exit ═══
                    // Wapiti often crashes mid-scan (module error, cache issue, network timeout)
                    // but still writes a valid partial report before dying
                    try {
                        await new Promise(r => setTimeout(r, 2000)); // Wait for file lock release

                        const reportExists = require('fs').existsSync(outputFile);

                        if (reportExists) {
                            const res = await fs.readFile(outputFile, 'utf8');
                            const parsed = JSON.parse(res);

                            if (code !== 0 && !this.activeProcesses.get(scanId)?.isStopped) {
                                this.addLog(scanId, `⚠️ Scanner exited with code ${code} but produced ${res.length} byte report — using partial results`);
                            } else {
                                this.addLog(scanId, `✅ Scan completed successfully (${res.length} bytes)`);
                            }

                            this.scanProgress.set(scanId, 100);
                            this.addLog(scanId, 'Results parsed successfully.');

                            // Cleanup temp files
                            try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { }

                            this.activeProcesses.delete(scanId);
                            resolve(parsed);
                        } else if (this.activeProcesses.get(scanId)?.isStopped) {
                            this.activeProcesses.delete(scanId);
                            resolve({ vulnerabilities: [] });
                        } else if (code !== 0) {
                            // Check if crash was just a known Windows lock issue during async SQLite flush
                            const errorMsg = stderr || `Exit code ${code}`;
                            if (errorMsg.includes('PermissionError') && errorMsg.includes('WinError 32')) {
                                this.addLog(scanId, `⚠️ Warning: Engine cache locked by OS. Parsing live feed instead.`);
                                try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { }
                                this.activeProcesses.delete(scanId);
                                return resolve({ vulnerabilities: [] }); // Soft resolve because logs exist
                            }

                            // No report AND non-zero exit = real failure
                            this.addLog(scanId, `❌ Scan failed with code ${code}, no report generated`);

                            if (errorMsg.includes('not recognized') || errorMsg.includes('not found') || errorMsg.includes('ENOENT')) {
                                reject(new Error('Wapiti not found. Please install it via `pip install wapiti3` or ensure it is in PATH.'));
                            } else {
                                // Provide a clean error, not raw Python traceback
                                const cleanError = this._extractCleanError(errorMsg);
                                reject(new Error(`Scan failed: ${cleanError}`));
                            }
                        } else {
                            // Exit 0 but no report = shouldn't happen, but handle it
                            reject(new Error('Scan completed but no report was generated. Target may be unreachable.'));
                        }
                    } catch (e) {
                        this.addLog(scanId, `Result processing error: ${e.message}`);
                        reject(e);
                    }
                });
            });
        } catch (error) {
            console.error('Scan error:', error);
            throw error;
        }
    }

    /**
     * Stop a running scan gracefully
     */
    async stopScan(scanId) {
        const processData = this.activeProcesses.get(scanId);
        if (!processData) {
            throw new Error(`No active process found for scan ${scanId}`);
        }

        processData.isStopped = true;
        this.addLog(scanId, '🛑 Stopping engine and parsing cached findings...');

        return new Promise((resolve) => {
            // Listen for the close event on our end to ensure clean cleanup
            processData.child.on('close', () => {
                // Wait for the ReportTransformer inside index.js to handle the logs
                const ReportTransformer = require('../utils/reportTransformer');
                const partialResults = ReportTransformer.transform(this.scanLogs.get(scanId) || []);
                resolve(partialResults);
            });

            // Send SIGTERM to kill it quickly
            try { processData.child.kill(); } catch (e) { }
        });
    }

    /**
     * Clear Wapiti's session cache for a target to prevent stale data crashes
     */
    async _clearWapitiCache(target, scanId) {
        try {
            const homeDir = os.homedir();
            const wapitiCacheDirs = [
                path.join(homeDir, '.wapiti', 'scans'),
                path.join(homeDir, '.wapiti', 'generated_report'),
            ];

            for (const dir of wapitiCacheDirs) {
                if (require('fs').existsSync(dir)) {
                    const hostname = new URL(target).hostname.replace(/\./g, '_');
                    const files = await fs.readdir(dir);
                    for (const file of files) {
                        if (file.includes(hostname) || file.includes('_domain_')) {
                            const filePath = path.join(dir, file);
                            try {
                                const stat = await fs.stat(filePath);
                                if (stat.isDirectory()) {
                                    await fs.rm(filePath, { recursive: true, force: true });
                                } else {
                                    await fs.unlink(filePath);
                                }
                                this.addLog(scanId, `🗑️ Cleared stale cache: ${file}`);
                            } catch (e) { /* ignore individual file errors */ }
                        }
                    }
                }
            }
        } catch (e) {
            // Non-fatal: cache clearing failure shouldn't block scan
            console.warn(`[WapitiService] Cache clear warning: ${e.message}`);
        }
    }

    /**
     * Extract a human-readable error from Python traceback
     */
    _extractCleanError(rawError) {
        // Try to find the last meaningful error line
        const lines = rawError.split('\n').filter(l => l.trim());

        // Look for common Python error patterns
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.match(/^(Error|Exception|TypeError|ValueError|ConnectionError|TimeoutError|HTTPError|SSLError|OSError)/i)) {
                return line.substring(0, 200);
            }
            if (line.match(/^(requests\.exceptions|urllib3\.exceptions|httpx\.|aiohttp\.)/)) {
                return line.substring(0, 200);
            }
        }

        // If no specific error found, use last non-empty line
        const lastLine = lines[lines.length - 1] || '';
        return lastLine.substring(0, 200) || 'Unknown error';
    }

    addLog(scanId, message) {
        if (!message) return;

        // Whitelabeling: Filter out Wapiti branding
        if (message.includes('/\\') || message.includes('__') || message.includes('wapiti-scanner') || message.trim() === 'Wapiti') {
            return;
        }

        // Replace Wapiti name
        message = message.replace(/Wapiti/g, "VAPT Engine").replace(/wapiti/g, "VAPT Engine");

        const logs = this.scanLogs.get(scanId) || [];
        logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (logs.length > 100) logs.shift();
        this.scanLogs.set(scanId, logs);
        console.log(`[Scan ${scanId}] ${message}`);
    }

    updateProgress(scanId, output) {
        const currentProgress = this.scanProgress.get(scanId) || 0;
        if (output.includes('Exploring')) {
            this.scanProgress.set(scanId, Math.min(currentProgress + 2, 40));
        } else if (output.includes('Attacking')) {
            this.scanProgress.set(scanId, Math.max(40, Math.min(currentProgress + 5, 90)));
        } else if (output.includes('Generating')) {
            this.scanProgress.set(scanId, 95);
        }
    }

    getProgress(scanId) {
        return {
            progress: this.scanProgress.get(scanId) || 0,
            logs: this.scanLogs.get(scanId) || []
        };
    }
}

module.exports = WapitiService;

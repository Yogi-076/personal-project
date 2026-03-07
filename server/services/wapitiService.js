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
        // Auto-patch the system Wapiti crawler.py to handle TldBadUrl
        this._patchSystemWapiti();
        // Self-heal: restore corrupted system wapitiCore/main/wapiti.py from local clean copy
        this._healWapitiCore();
    }

    /**
     * Self-healing: copies the local clean wapitiCore/main/wapiti.py to the system path
     * if the system version has been corrupted (IndentationError etc.).
     * Non-fatal: silently skips if not on Linux, no write permissions, or already healthy.
     */
    _healWapitiCore() {
        if (process.platform === 'win32') return;
        try {
            const fss = require('fs');
            const localWapitiPy = path.join(__dirname, '../../wapiti-master/wapiti-master/wapitiCore/main/wapiti.py');
            if (!fss.existsSync(localWapitiPy)) return;

            // Find the system wapitiCore path via python3
            let sysCorePath = null;
            try {
                const result = require('child_process').execSync(
                    'python3 -c "import wapitiCore, os; print(os.path.dirname(os.path.abspath(wapitiCore.__file__)))"',
                    { stdio: 'pipe', timeout: 5000 }
                );
                sysCorePath = result.toString().trim();
            } catch (e) {
                // wapitiCore might not be importable at all — that's OK
                return;
            }

            if (!sysCorePath) return;
            const sysWapitiPy = path.join(sysCorePath, 'main', 'wapiti.py');
            if (!fss.existsSync(sysWapitiPy)) return;

            // Check if system file is healthy by trying a syntax check
            try {
                require('child_process').execSync(
                    `python3 -m py_compile "${sysWapitiPy}"`,
                    { stdio: 'pipe', timeout: 5000 }
                );
                // Syntax OK — no need to heal
                return;
            } catch (e) {
                // Syntax error found — heal it
                console.log('[WapitiService] Detected corrupted system wapitiCore/main/wapiti.py. Restoring from local clean copy...');
            }

            // Copy local clean version to system path
            fss.copyFileSync(localWapitiPy, sysWapitiPy);

            // Also clear any .pyc cache for this file
            const pycDir = path.join(sysCorePath, 'main', '__pycache__');
            if (fss.existsSync(pycDir)) {
                const caches = fss.readdirSync(pycDir).filter(f => f.startsWith('wapiti.'));
                caches.forEach(f => { try { fss.unlinkSync(path.join(pycDir, f)); } catch (e) { } });
            }

            console.log('[WapitiService] ✅ wapitiCore/main/wapiti.py restored successfully from local clean copy.');
        } catch (e) {
            // Non-fatal
            console.warn('[WapitiService] _healWapitiCore skipped:', (e.message || '').substring(0, 120));
        }
    }

    /**
     * Self-healing patch: runs patch_vps_wapiti.py to fix TldBadUrl crash
     * in the system Wapiti crawler.py on the VPS.
     * Non-fatal: silently skips if not on Linux or no write permissions.
     */
    _patchSystemWapiti() {
        if (process.platform === 'win32') return;
        const patchScript = path.join(__dirname, '../../patch_vps_wapiti.py');
        if (!require('fs').existsSync(patchScript)) return;
        try {
            const result = require('child_process').execSync(
                `python3 "${patchScript}"`,
                { stdio: 'pipe', timeout: 15000 }
            );
            const out = result.toString().trim();
            if (out) console.log('[WapitiService] Crawler patch:', out);
        } catch (e) {
            // Non-fatal: VPS may need sudo for system paths
            const errMsg = (e.stderr?.toString() || e.message || '').substring(0, 120);
            if (errMsg) console.warn('[WapitiService] Crawler patch skipped:', errMsg);
        }
    }

    detectWapitiPath() {
        // 1. Try local patched source first
        const localPath = path.join(__dirname, '../../wapiti-master/wapiti-master/bin/wapiti');
        if (require('fs').existsSync(localPath)) {
            return localPath;
        }

        // 2. Try finding it in the PATH
        try {
            const systemPath = execSync(process.platform === 'win32' ? 'where wapiti' : 'which wapiti', { stdio: 'pipe' }).toString().trim().split('\n')[0];
            if (systemPath) return systemPath.trim();
        } catch (e) {
            // Ignore error
        }

        // 3. Try common locations or user provided override
        const commonPaths = [
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

            // Fix for SPA scanning: Wapiti fails when URL has a fragment (/#/)
            let cleanTarget = target.split('#')[0];

            // Ensure URL has a scheme to prevent tld library parsing errors in Python
            if (!/^https?:\/\//i.test(cleanTarget)) {
                cleanTarget = `http://${cleanTarget}`;
                this.addLog(scanId, `⚠️ Target URL missing scheme. Auto-corrected to: ${cleanTarget}`);
            }

            const scanArgs = [
                '-u', cleanTarget,
                '-f', 'json',
                '-o', outputFile,
                '--scope', 'domain',
                '--level', '2',
                '--flush-session',
                '-d', '5',
                '--verbose', '1'
            ];

            // SPA Mode via pre-crawled URLs
            if (options.urlsFile) {
                scanArgs.push('-s', options.urlsFile);
                this.addLog(scanId, `🌐 SPA Support ENABLED: Ingesting pre-crawled Katana URLs`);
            }

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
                const specModules = "backup,brute_login_form,buster,cms,crlf,csrf,exec,file,htaccess,htp,ldap,log4shell,methods,network_device,nikto,permanentxss,redirect,shellshock,spring4shell,sql,ssl,ssrf,timesql,upload,wapp,wp_enum,xss,xxe";
                scanArgs.push('-m', specModules);
                this.addLog(scanId, `🚀 DETAILED SCAN MODE: Using modules (-m ${specModules}) with depth (-d 5)`);
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

                console.log("SPAWN DEBUG:", { spawnCmd, spawnArgs, spawnCwd });
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
                    // Only log meaningful stderr, not progress bars or harmless Python 3.12+ warnings
                    const trimmed = out.trim();
                    if (trimmed
                        && !trimmed.startsWith('\r')
                        && trimmed.length > 5
                        && !trimmed.includes('SyntaxWarning: invalid escape sequence')
                        && !trimmed.includes('<string>:1: SyntaxWarning')) {
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
                            // Try to parse findings from whatever logs we have so far
                            const partialFindings = this.parseFindingsFromLogs(this.scanLogs.get(scanId) || []);
                            resolve({ vulnerabilities: partialFindings });
                        } else if (code !== 0) {
                            // Check if crash was just a known Windows lock issue during async SQLite flush
                            const errorMsg = stderr || `Exit code ${code}`;
                            if (errorMsg.includes('PermissionError') && errorMsg.includes('WinError 32')) {
                                this.addLog(scanId, `⚠️ Warning: Engine cache locked by OS. Parsing live feed instead.`);
                                try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { }
                                this.activeProcesses.delete(scanId);

                                const partialFindings = this.parseFindingsFromLogs(this.scanLogs.get(scanId) || []);
                                return resolve({ vulnerabilities: partialFindings }); // Soft resolve because logs exist
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
            // No active process — return empty results gracefully
            return { findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } };
        }

        processData.isStopped = true;
        this.addLog(scanId, '🛑 Stopping engine and parsing cached findings...');

        return new Promise((resolve) => {
            // Listen for the close event to allow clean cleanup
            processData.child.on('close', () => {
                // Return empty results - the ReportTransformer will be called from scan.js
                // with the actual JSON report file if it exists. Returning empty here is safe
                // because scan.js will read the partial report from disk in the close handler.
                resolve({ findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });
            });

            // Send SIGTERM to kill it
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
        const lines = rawError.split('\n').filter(l => l.trim());

        // Check for specific known errors first and map to friendly messages
        if (rawError.includes('TldBadUrl') || rawError.includes('Is not a valid URL')) {
            return 'The target URL or a discovered link is not a valid URL. Try using the full URL including http:// (e.g., http://example.com).';
        }
        if (rawError.includes('ENOENT') || rawError.includes('not found') || rawError.includes('No such file')) {
            return 'VAPT Engine binary not found. Ensure the scanner is installed on the server.';
        }
        if (rawError.includes('ConnectionRefused') || rawError.includes('Connection refused')) {
            return 'Target refused the connection. Ensure the target is online and accessible.';
        }
        if (rawError.includes('TimeoutError') || rawError.includes('timed out') || rawError.includes('connect timeout')) {
            return 'Scan timed out. Target may be slow or unreachable. Try scanning a specific page instead of the root.';
        }
        if (rawError.includes('SSLError') || rawError.includes('SSL')) {
            return 'SSL certificate error. The target may have an invalid or self-signed certificate.';
        }
        if (rawError.includes('PermissionError')) {
            return 'Permission error on server. Scanner may not have write access to temp directory.';
        }
        if (rawError.includes('MemoryError')) {
            return 'Scanner ran out of memory. Try using Quick Scan mode with fewer modules.';
        }
        if (rawError.includes('MaxRetryError') || rawError.includes('Max retries')) {
            return 'Could not reach target after multiple retries. Target may be down or blocking scanner.';
        }
        if (rawError.includes('SyntaxWarning')) {
            // This is a non-fatal Python warning, not the actual error
            const realError = lines.find(l => l.match(/^(tld\.|Error|Exception|urlparse|requests)/i));
            if (realError) return realError.substring(0, 200);
        }

        // Look for clean Python exception line
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line.match(/^(Error|Exception|TypeError|ValueError|ConnectionError|TimeoutError|HTTPError|SSLError|OSError|tld\.)/i)) {
                return line.substring(0, 200);
            }
        }

        const lastLine = lines[lines.length - 1] || '';
        return lastLine.substring(0, 200) || 'Unknown error occurred during scan.';
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
        if (output.includes('Exploring') || output.includes('crawling') || output.includes('found')) {
            this.scanProgress.set(scanId, Math.min(currentProgress + 2, 40));
        } else if (output.includes('Attacking') || output.includes('Launching module') || output.includes('Checking')) {
            this.scanProgress.set(scanId, Math.max(40, Math.min(currentProgress + 5, 90)));
        } else if (output.includes('Generating') || output.includes('Saving')) {
            this.scanProgress.set(scanId, 95);
        }
    }

    getProgress(scanId) {
        return {
            progress: this.scanProgress.get(scanId) || 0,
            logs: this.scanLogs.get(scanId) || []
        };
    }

    /**
     * Fallback mechanism to extract vulnerabilities from console logs
     * if the scan was interrupted before generating the JSON report.
     */
    parseFindingsFromLogs(logs) {
        const vulnerabilities = {};
        let currentFinding = null;
        let isCollectingRequest = false;
        let requestLines = [];

        for (let i = 0; i < logs.length; i++) {
            const line = logs[i];
            const cleanLine = line.replace(/^\[.*?\]\s*/, '').trim();

            if (cleanLine === '---') {
                if (currentFinding) {
                    // Close out the previous finding and save the request
                    if (requestLines.length > 0) {
                        currentFinding.http_request = requestLines.join('\n');
                    }

                    if (!vulnerabilities[currentFinding.type]) {
                        vulnerabilities[currentFinding.type] = [];
                    }
                    vulnerabilities[currentFinding.type].push(currentFinding);
                }

                // Start expecting a new finding on the next lines
                currentFinding = null;
                isCollectingRequest = false;
                requestLines = [];

                // The next line after '---' usually describes the vulnerability
                if (i + 1 < logs.length) {
                    const nextLineMatch = logs[i + 1].replace(/^\[.*?\]\s*/, '').trim();
                    if (nextLineMatch && nextLineMatch !== '---' && !nextLineMatch.startsWith('Evil request:')) {
                        // Example: "Blind SQL vulnerability in http://target.com/page via injection in the parameter id"
                        let type = "Unknown Vulnerability";
                        if (nextLineMatch.includes(" vulnerability in ")) {
                            type = nextLineMatch.split(" vulnerability in ")[0].trim();
                        } else if (nextLineMatch.includes(" found in ")) {
                            type = nextLineMatch.split(" found in ")[0].trim();
                        } else if (nextLineMatch.includes(" for URL ")) {
                            type = nextLineMatch.split(" for URL ")[0].trim();
                        } else if (nextLineMatch.includes("CSP is not set") || nextLineMatch.includes("CSP")) {
                            type = "Content Security Policy (CSP) Not Configured";
                        } else if (nextLineMatch.includes("Lack of anti CSRF token")) {
                            type = "Cross-Site Request Forgery (CSRF)";
                        } else if (!nextLineMatch.includes("http")) { // If it's a short descriptive text
                            type = nextLineMatch;
                        }

                        let pathMatch = "unknown";
                        let parameter = "";

                        const urlMatchRegex = /(http[s]?:\/\/[^\s]+)/;
                        const urlMatch = nextLineMatch.match(urlMatchRegex);
                        if (urlMatch && urlMatch[1]) {
                            try {
                                const parsedUrl = new URL(urlMatch[1]);
                                pathMatch = parsedUrl.pathname + parsedUrl.search;
                            } catch (e) {
                                pathMatch = urlMatch[1];
                            }
                        }

                        if (nextLineMatch.includes("parameter ")) {
                            parameter = nextLineMatch.split("parameter ")[1].trim();
                        }

                        currentFinding = {
                            type: type,
                            info: nextLineMatch,
                            path: pathMatch,
                            parameter: parameter,
                            level: 2, // Default assume medium
                            http_request: ""
                        };
                    }
                }
            } else if (cleanLine === 'Evil request:') {
                isCollectingRequest = true;
            } else if (isCollectingRequest && currentFinding) {
                requestLines.push(cleanLine);
            }
        }

        // Catch the last one if log ended without final '---'
        if (currentFinding && isCollectingRequest && requestLines.length > 0) {
            currentFinding.http_request = requestLines.join('\n');
            if (!vulnerabilities[currentFinding.type]) {
                vulnerabilities[currentFinding.type] = [];
            }
            vulnerabilities[currentFinding.type].push(currentFinding);
        }

        // Return an empty array if nothing found so the transformer doesn't crash
        if (Object.keys(vulnerabilities).length === 0) return [];

        return vulnerabilities;
    }
}

module.exports = WapitiService;

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * ArsenalService - Manages background execution of Arsenal Core pipelines.
 * Captures logs and tracks status so frontend can reconnect.
 */
class ArsenalService {
    constructor() {
        this.activeScans = new Map();
        this.baseDir = path.join(__dirname, '..', '..');
        this.outputDirRoot = path.join(this.baseDir, 'arsenal_output');

        if (!fs.existsSync(this.outputDirRoot)) {
            fs.mkdirSync(this.outputDirRoot, { recursive: true });
        }
    }

    /**
     * Helper to strip ANSI terminal color codes from process output
     */
    stripAnsi(str) {
        return str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '').replace(/\x1B\[[0-9;]*m/g, '');
    }

    /**
     * Starts a new Arsenal pipeline scan
     */
    startScan(url, options = {}) {
        const scanId = uuidv4();
        const domain = new URL(url).hostname;
        const outputDir = path.join(this.outputDirRoot, domain);
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const depth = options.depth || 3;
        const threads = options.threads || 10;
        const highCookie = options.highCookie;
        const lowCookie = options.lowCookie;

        const args = ['arsenal-core/main.py', '-u', url, '-d', depth.toString(), '-t', threads.toString(), '-o', outputDir];
        if (highCookie && lowCookie) {
            args.push('--high-cookie', highCookie, '--low-cookie', lowCookie);
        }

        console.log(`[ArsenalService] Starting scan ${scanId} for ${url}`);

        const child = spawn('python', args, {
            cwd: this.baseDir,
            env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });

        const scanData = {
            id: scanId,
            url,
            status: 'running',
            startTime: new Date().toISOString(),
            logs: ['[SYS] Initializing Arsenal Pipeline...', '[SYS] Scan ID: ' + scanId],
            report: null,
            process: child,
            outputDir: outputDir
        };

        child.stdout.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                const clean = this.stripAnsi(line).trim();
                if (clean) scanData.logs.push(clean);
            });
        });

        child.stderr.on('data', (data) => {
            data.toString().split('\n').forEach(line => {
                const clean = this.stripAnsi(line).trim();
                if (clean) scanData.logs.push(clean);
            });
        });

        child.on('close', (code) => {
            console.log(`[ArsenalService] Scan ${scanId} finished with code ${code}`);
            scanData.status = code === 0 ? 'completed' : 'failed';
            scanData.endTime = new Date().toISOString();
            scanData.process = null;

            // Load report if exists
            const reportPath = path.join(outputDir, 'arsenal_report.json');
            if (fs.existsSync(reportPath)) {
                try {
                    scanData.report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
                } catch (e) {
                    console.error('[ArsenalService] Error parsing report:', e);
                }
            }
        });

        this.activeScans.set(scanId, scanData);
        return scanId;
    }

    /**
     * Gets current status and logs for a scan
     */
    getScanStatus(scanId) {
        const scan = this.activeScans.get(scanId);
        if (!scan) return null;

        return {
            id: scan.id,
            url: scan.url,
            status: scan.status,
            startTime: scan.startTime,
            endTime: scan.endTime,
            logs: scan.logs,
            report: scan.report
        };
    }

    /**
     * Stops a running scan
     */
    stopScan(scanId) {
        const scan = this.activeScans.get(scanId);
        if (scan && scan.process) {
            scan.process.kill();
            scan.status = 'stopped';
            scan.logs.push('[!] Scan stopped by user.');
            return true;
        }
        return false;
    }

    /**
     * Get all active (or recent) scans for recovery
     */
    getAllScans() {
        return Array.from(this.activeScans.values()).map(s => ({
            id: s.id,
            url: s.url,
            status: s.status,
            startTime: s.startTime
        }));
    }
}

module.exports = ArsenalService;

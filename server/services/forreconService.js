const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ForreconService {
    constructor() {
        this.activeScans = new Map();
        this.resultsDir = path.join(__dirname, '../data/forrecon_results');

        // Ensure results directory exists
        if (!fs.existsSync(this.resultsDir)) {
            fs.mkdirSync(this.resultsDir, { recursive: true });
        }
    }

    startScan(targetUrl, options = {}) {
        const scanId = uuidv4();
        const threads = options.threads || 50;
        const safeMode = options.safeMode || false;
        const wordlist = options.wordlist || path.join(__dirname, '../wordlists/common.txt');
        const outputFile = path.join(this.resultsDir, `${scanId}.jsonl`);

        // Check if wordlist exists
        if (!fs.existsSync(wordlist)) {
            throw new Error(`Wordlist not found: ${wordlist}`);
        }

        // Use compiled binary for stability and performance
        // If binary doesn't exist, fall back to go run (or just error out)
        const binaryPath = path.join(__dirname, '../tools/forrecon/forrecon.exe');
        let cmd = binaryPath;
        let args = [
            '-url', targetUrl,
            '-w', wordlist,
            '-threads', threads.toString(),
            '-o', outputFile
        ];

        if (safeMode) {
            args.push('-safe');
        }

        console.log(`[Forrecon] Starting scan ${scanId} on ${targetUrl}`);

        const childProcess = spawn(cmd, args, {
            cwd: path.join(__dirname, '../tools/forrecon'),
            env: { ...process.env }
        });

        const scanData = {
            id: scanId,
            target: targetUrl,
            status: 'running',
            startTime: new Date().toISOString(),
            process: childProcess,
            logs: [],
            outputFile: outputFile
        };

        // Capture stdout/stderr for logs
        childProcess.stdout.on('data', (data) => {
            const line = data.toString().trim();
            if (line) {
                scanData.logs.push({ type: 'info', message: line, time: new Date().toISOString() });
            }
        });

        childProcess.stderr.on('data', (data) => {
            const line = data.toString().trim();
            if (line) {
                scanData.logs.push({ type: 'error', message: line, time: new Date().toISOString() });
            }
        });

        // Capture spawn errors (e.g., binary not found)
        childProcess.on('error', (err) => {
            console.error(`[Forrecon] Failed to start process: ${err.message}`);
            scanData.logs.push({ type: 'error', message: `Startup Error: ${err.message}`, time: new Date().toISOString() });
            scanData.status = 'failed';
        });

        childProcess.on('close', (code) => {
            console.log(`[Forrecon] Scan ${scanId} finished with code ${code}`);
            if (scanData.status !== 'failed') {
                scanData.status = code === 0 ? 'completed' : 'failed';
            }
            scanData.endTime = new Date().toISOString();
            scanData.process = null; // Clear process reference
        });

        this.activeScans.set(scanId, scanData);
        return scanId;
    }

    getScanStatus(scanId) {
        const scan = this.activeScans.get(scanId);
        if (!scan) return null;

        // Read results file if it exists to get findings
        let findings = [];
        if (fs.existsSync(scan.outputFile)) {
            try {
                const fileContent = fs.readFileSync(scan.outputFile, 'utf8');
                const lines = fileContent.split('\n');
                findings = lines
                    .filter(line => line.trim())
                    .map(line => {
                        try { return JSON.parse(line); } catch (e) { return null; }
                    })
                    .filter(f => f !== null);
            } catch (err) {
                console.error(`Error reading results for ${scanId}:`, err);
            }
        }

        return {
            id: scan.id,
            target: scan.target,
            status: scan.status,
            startTime: scan.startTime,
            endTime: scan.endTime,
            logs: scan.logs,
            findings: findings
        };
    }

    stopScan(scanId) {
        const scan = this.activeScans.get(scanId);
        if (scan && scan.process) {
            scan.process.kill();
            scan.status = 'stopped';
            scan.logs.push({ type: 'warning', message: 'Scan stopped by user', time: new Date().toISOString() });
            return true;
        }
        return false;
    }

    getWordlists() {
        try {
            const files = fs.readdirSync(path.join(__dirname, '../wordlists'));
            return files.filter(f => f.endsWith('.txt')).map(f => ({
                name: f,
                path: path.join(__dirname, '../wordlists', f),
                size: fs.statSync(path.join(__dirname, '../wordlists', f)).size
            }));
        } catch (e) {
            console.error("Error listing wordlists:", e);
            return [];
        }
    }

    generateReport(scanId) {
        const scan = this.getScanStatus(scanId);
        if (!scan) throw new Error("Scan not found");

        const statusDefinitions = {
            200: "OK - The request succeeded. The resource exists.",
            201: "Created - The request succeeded and a new resource was created.",
            204: "No Content - The server successfully processed the request and is not returning any content.",
            301: "Moved Permanently - The URL of the requested resource has been changed permanently.",
            302: "Found - The URL of the requested resource has been changed temporarily.",
            307: "Temporary Redirect - The request should be repeated with another URI.",
            400: "Bad Request - The server could not understand the request due to invalid syntax.",
            401: "Unauthorized - The client must authenticate itself to get the requested response.",
            403: "Forbidden - The client does not have access rights to the content.",
            404: "Not Found - The server can not find the requested resource.",
            405: "Method Not Allowed - The request method is known by the server but is not supported by the target resource.",
            500: "Internal Server Error - The server has encountered a situation it does not know how to handle.",
            502: "Bad Gateway - The server got an invalid response while working as a gateway.",
            503: "Service Unavailable - The server is not ready to handle the request."
        };

        const findings = scan.findings || [];
        const byStatus = {};

        findings.forEach(f => {
            if (!byStatus[f.status]) byStatus[f.status] = [];
            byStatus[f.status].push(f);
        });

        let report = `================================================================================
FORRECON-ALPHA SCAN REPORT
================================================================================
Target      : ${scan.target}
Scan ID     : ${scan.id}
Date        : ${new Date().toLocaleString()}
Total Findings: ${findings.length}
================================================================================

[ EXECUTIVE SUMMARY ]
`;

        Object.keys(byStatus).sort().forEach(status => {
            report += `Status ${status}: ${byStatus[status].length} findings\n`;
        });

        report += `\n================================================================================\n[ DETAILED FINDINGS ]\n`;

        Object.keys(byStatus).sort().forEach(status => {
            const definition = statusDefinitions[status] || "Unknown Status Code";
            report += `\n--- Status ${status} (${definition}) ---\n`;
            byStatus[status].forEach(f => {
                let line = `[${f.status}] ${f.url}`;
                if (f.redirect) line += ` -> ${f.redirect}`;
                if (f.waf_detected) line += ` [WAF: ${f.waf_detected}]`;
                line += ` (Size: ${f.length}b)`;
                report += `${line}\n`;
            });
        });

        report += `\n================================================================================\n[ STATUS CODE LEGEND ]\n`;
        Object.keys(statusDefinitions).forEach(code => {
            report += `${code}: ${statusDefinitions[code]}\n`;
        });

        report += `\nGenerated by VAPT Framework - Forrecon-Alpha`;

        return report;
    }
}

module.exports = ForreconService;

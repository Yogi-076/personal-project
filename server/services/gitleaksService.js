const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

/**
 * GitleaksService - Orchestrates secret scanning in Git repositories.
 * Since the official gitleaks binary might not be present, we use a hybrid approach:
 * 1. Clone the repository to a temporary location.
 * 2. Run a custom regex-based scanner (or gitleaks if available).
 */
class GitleaksService {
    constructor() {
        this.activeScans = new Map();
        this.baseDir = path.join(__dirname, '..', '..');
        this.tempDir = path.join(this.baseDir, 'temp_scans');

        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }

        this.rules = [
            { name: 'AWS Access Key', regex: /(?:access_key|aws_access_key_id|aws_secret_access_key)\s*[:=]\s*['"]?([A-Za-z0-9/+=]{20,40})['"]?/i, severity: 'Critical' },
            { name: 'Github Personal Access Token', regex: /ghp_[a-zA-Z0-9]{36}/, severity: 'Critical' },
            { name: 'Generic API Key', regex: /(?:api_key|apikey|secret_key|api_secret)\s*[:=]\s*['"]?([a-f0-9]{32,64})['"]?/i, severity: 'High' },
            { name: 'Google API Key', regex: /AIza[0-9A-Za-z-_]{35}/, severity: 'High' },
            { name: 'Firebase API Key', regex: /AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}/, severity: 'High' },
            { name: 'Private Key', regex: /-----BEGIN (?:RSA|OPENSSH|DSA|EC) PRIVATE KEY-----/, severity: 'Critical' },
            { name: 'Discord Bot Token', regex: /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/, severity: 'High' },
            { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[a-zA-Z0-9]{24}/, severity: 'High' },
            { name: 'Stripe API Key', regex: /sk_test_[0-9a-zA-Z]{24}/, severity: 'High' }
        ];
    }

    /**
     * Starts a new Gitleaks scan
     */
    async startScan(repoUrl) {
        const scanId = uuidv4();
        const repoName = repoUrl.split('/').pop().replace('.git', '');
        const targetPath = path.join(this.tempDir, `${scanId}_${repoName}`);

        const scanData = {
            id: scanId,
            url: repoUrl,
            status: 'cloning',
            startTime: new Date().toISOString(),
            logs: [`[SYS] Initializing Gitleaks Scan for: ${repoUrl}`, `[SYS] Scan ID: ${scanId}`],
            findings: [],
            progress: 10
        };

        this.activeScans.set(scanId, scanData);

        // Run clone in background
        this.runCloneAndScan(scanId, repoUrl, targetPath);

        return scanId;
    }

    async runCloneAndScan(scanId, repoUrl, targetPath) {
        const scan = this.activeScans.get(scanId);
        if (!scan) return;

        try {
            scan.logs.push(`[GIT] Cloning repository to ${targetPath}...`);
            const clone = spawn('git', ['-c', 'core.longpaths=true', 'clone', '--depth', '1', repoUrl, targetPath], { shell: true });

            clone.stdout.on('data', (d) => scan.logs.push(d.toString().trim()));
            clone.stderr.on('data', (d) => scan.logs.push(d.toString().trim()));

            clone.on('close', async (code) => {
                if (code !== 0) {
                    scan.status = 'failed';
                    scan.logs.push(`[ERROR] Git clone failed with exit code ${code}`);
                    return;
                }

                scan.status = 'scanning';
                scan.progress = 40;
                scan.logs.push('[SCAN] Clone successful. Starting deep secret analysis...');

                try {
                    await this.performRecursiveScan(scanId, targetPath);
                    scan.status = 'completed';
                    scan.progress = 100;
                    scan.logs.push('[SCAN] Analysis completed successfully.');
                    scan.endTime = new Date().toISOString();
                } catch (e) {
                    scan.status = 'failed';
                    scan.logs.push(`[ERROR] Scan process failed: ${e.message}`);
                } finally {
                    // Cleanup temp files (optional, maybe keep for a bit)
                    // fs.rmSync(targetPath, { recursive: true, force: true });
                }
            });

        } catch (e) {
            scan.status = 'failed';
            scan.logs.push(`[ERROR] Execution failed: ${e.message}`);
        }
    }

    async performRecursiveScan(scanId, dir) {
        const scan = this.activeScans.get(scanId);
        const files = this.getAllFiles(dir);
        let processed = 0;

        for (const file of files) {
            processed++;
            // Skip .git folder
            if (file.includes('.git' + path.sep)) continue;
            
            const stats = fs.statSync(file);
            if (stats.size > 1024 * 1024) continue; // Skip files > 1MB

            const content = fs.readFileSync(file, 'utf8');
            this.rules.forEach(rule => {
                const match = content.match(rule.regex);
                if (match) {
                    // Extract line number
                    const lines = content.substring(0, match.index).split('\n');
                    const lineNo = lines.length;
                    
                    scan.findings.push({
                        type: rule.name,
                        severity: rule.severity,
                        file: path.relative(dir, file),
                        line: lineNo,
                        match: match[0].substring(0, 50) + '...', // Mask for security?
                        entropy: this.calculateEntropy(match[0])
                    });
                }
            });

            // Update progress
            scan.progress = 40 + Math.floor((processed / files.length) * 50);
        }
    }

    getAllFiles(dirPath, arrayOfFiles) {
        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];

        files.forEach((file) => {
            const fullPath = path.join(dirPath, file);
            if (fs.statSync(fullPath).isDirectory()) {
                arrayOfFiles = this.getAllFiles(fullPath, arrayOfFiles);
            } else {
                arrayOfFiles.push(fullPath);
            }
        });

        return arrayOfFiles;
    }

    calculateEntropy(str) {
        const len = str.length;
        const freq = {};
        for (let i = 0; i < len; i++) {
            freq[str[i]] = (freq[str[i]] || 0) + 1;
        }
        let entropy = 0;
        for (const char in freq) {
            const p = freq[char] / len;
            entropy -= p * Math.log2(p);
        }
        return entropy.toFixed(2);
    }

    getScanStatus(scanId) {
        return this.activeScans.get(scanId);
    }
}

module.exports = new GitleaksService();

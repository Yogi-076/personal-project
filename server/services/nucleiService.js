const { spawn } = require('child_process');
const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

/**
 * Nuclei Service — CVE & Template-based Vulnerability Scanning
 * Uses ProjectDiscovery's Nuclei for targeted vulnerability detection.
 * Accepts session data from Auth-Bridge for authenticated scanning.
 */
class NucleiService {
    constructor() {
        this.nucleiPath = this.detectPath();
        this.scanProgress = new Map();
        this.scanLogs = new Map();
    }

    detectPath() {
        try {
            const p = execSync(process.platform === 'win32' ? 'where nuclei' : 'which nuclei', { stdio: 'pipe' }).toString().trim().split('\n')[0];
            if (p) return p.trim();
        } catch (e) { /* ignore */ }
        return 'nuclei';
    }

    addLog(scanId, message) {
        if (!this.scanLogs.has(scanId)) this.scanLogs.set(scanId, []);
        const logs = this.scanLogs.get(scanId);
        logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (logs.length > 500) logs.shift();
    }

    /**
     * Scan a target or list of URLs with Nuclei templates.
     * @param {string|string[]} targets - Target URL(s) to scan
     * @param {object} options - Scan configuration
     * @param {object} options.authSession - Auth-Bridge session data
     * @param {string[]} options.tags - Template tags to include (e.g. ['cve', 'sqli', 'xss'])
     * @param {string} options.severity - Min severity filter ('info','low','medium','high','critical')
     * @param {number} options.rateLimit - Requests per second (default: 150)
     * @param {number} options.concurrency - Concurrent templates (default: 25)
     * @param {string} scanId - Unique scan identifier
     * @returns {Promise<object>} Scan results with findings
     */
    async scan(targets, options = {}, scanId) {
        return new Promise(async (resolve, reject) => {
            try {
                this.addLog(scanId, '🔬 Initializing Nuclei vulnerability scanner...');
                this.addLog(scanId, `Binary: ${this.nucleiPath}`);
                this.scanProgress.set(scanId, { progress: 0, findings: [], logs: [] });

                const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nuclei-'));
                const outputFile = path.join(tempDir, 'results.json');

                // Handle list of URLs (from Katana crawl)
                let targetArg;
                if (Array.isArray(targets)) {
                    const listFile = path.join(tempDir, 'targets.txt');
                    await fs.writeFile(listFile, targets.join('\n'));
                    targetArg = ['-l', listFile];
                    this.addLog(scanId, `📋 Scanning ${targets.length} URLs from crawl results`);
                } else {
                    targetArg = ['-u', targets];
                    this.addLog(scanId, `🎯 Target: ${targets}`);
                }

                const args = [
                    ...targetArg,
                    '-jsonl',           // JSON Lines output
                    '-o', outputFile,
                    '-nc',              // No color
                    '-silent',
                    '-rl', String(options.rateLimit || 150),
                    '-c', String(options.concurrency || 25),
                    '-stats',           // Show scan stats
                    '-stats-interval', '10',
                ];

                // Template tags filter
                if (options.tags && options.tags.length > 0) {
                    args.push('-tags', options.tags.join(','));
                    this.addLog(scanId, `🏷️ Tags: ${options.tags.join(', ')}`);
                }

                // Severity filter
                if (options.severity) {
                    args.push('-severity', options.severity);
                    this.addLog(scanId, `⚡ Min Severity: ${options.severity}`);
                } else {
                    args.push('-severity', 'low,medium,high,critical');
                }

                // Template exclusions for stability
                args.push('-etags', 'dos,fuzz');

                // Inject authentication headers
                if (options.authSession) {
                    this.addLog(scanId, '🔐 Injecting authenticated session data');

                    const cookieValue = options.authSession.cookieHeader?.replace('Cookie: ', '') || '';
                    if (cookieValue) {
                        args.push('-H', `Cookie: ${cookieValue}`);
                        this.addLog(scanId, `🍪 Injected ${cookieValue.split(';').length} session cookies`);
                    }

                    if (options.authSession.jwtHeader) {
                        const jwt = options.authSession.jwtHeader.replace('Authorization: ', '');
                        args.push('-H', `Authorization: ${jwt}`);
                        this.addLog(scanId, '🔑 Injected JWT token');
                    }
                }

                this.addLog(scanId, `🚀 Launching Nuclei scan...`);

                const proc = spawn(this.nucleiPath, args, {
                    timeout: (options.timeout || 600) * 1000, // 10 min default
                });

                let findingsCount = 0;

                proc.stderr.on('data', (data) => {
                    const lines = data.toString().split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        const trimmed = line.trim();
                        // Parse Nuclei stats output
                        if (trimmed.includes('templates-loaded') || trimmed.includes('hosts')) {
                            this.addLog(scanId, `📊 ${trimmed}`);
                        }
                        if (trimmed.includes('[')) {
                            // This is likely a finding output
                            findingsCount++;
                            this.addLog(scanId, `🚨 ${trimmed}`);
                        }
                    }

                    // Update progress estimation
                    const progress = Math.min(90, 10 + findingsCount * 2);
                    this.scanProgress.set(scanId, {
                        progress,
                        findings: [],
                        logs: this.scanLogs.get(scanId) || []
                    });
                });

                proc.stdout.on('data', (data) => {
                    // JSON output lines go to stdout with -jsonl
                    const lines = data.toString().split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        try {
                            const finding = JSON.parse(line);
                            if (finding.info) {
                                this.addLog(scanId, `🔴 [${(finding.info.severity || 'info').toUpperCase()}] ${finding.info.name || finding['template-id']}`);
                            }
                        } catch (e) { /* non-json line */ }
                    }
                });

                proc.on('close', async (code) => {
                    this.addLog(scanId, `Nuclei process exited with code ${code}`);

                    // Parse results file
                    let findings = [];
                    try {
                        const content = await fs.readFile(outputFile, 'utf-8');
                        const lines = content.split('\n').filter(l => l.trim());
                        findings = lines.map(line => {
                            try {
                                return JSON.parse(line);
                            } catch (e) { return null; }
                        }).filter(Boolean);
                    } catch (e) {
                        this.addLog(scanId, `⚠️ Could not read results file: ${e.message}`);
                    }

                    // Transform to VajraScan format
                    const transformedFindings = findings.map(f => this.transformFinding(f));

                    const summary = this.buildSummary(transformedFindings);

                    this.addLog(scanId, `✅ Nuclei scan complete. Found ${transformedFindings.length} vulnerabilities.`);
                    this.addLog(scanId, `📊 Critical: ${summary.critical} | High: ${summary.high} | Medium: ${summary.medium} | Low: ${summary.low}`);

                    this.scanProgress.set(scanId, {
                        progress: 100,
                        findings: transformedFindings,
                        logs: this.scanLogs.get(scanId) || []
                    });

                    // Cleanup temp directory
                    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }

                    resolve({
                        findings: transformedFindings,
                        summary,
                        rawCount: findings.length,
                    });
                });

                proc.on('error', (err) => {
                    this.addLog(scanId, `❌ Nuclei error: ${err.message}`);
                    reject(err);
                });

            } catch (err) {
                this.addLog(scanId, `❌ Setup error: ${err.message}`);
                reject(err);
            }
        });
    }

    /**
     * Transform a Nuclei JSON finding into VajraScan format
     */
    transformFinding(nucleiFinding) {
        const info = nucleiFinding.info || {};
        const severityMap = {
            'critical': 'critical',
            'high': 'high',
            'medium': 'medium',
            'low': 'low',
            'info': 'info',
        };

        return {
            name: info.name || nucleiFinding['template-id'] || 'Unknown',
            severity: severityMap[info.severity?.toLowerCase()] || 'info',
            description: info.description || '',
            url: nucleiFinding.host || nucleiFinding['matched-at'] || '',
            matchedAt: nucleiFinding['matched-at'] || '',
            templateId: nucleiFinding['template-id'] || '',
            reference: info.reference || [],
            tags: info.tags || [],
            classification: info.classification || {},
            curl: nucleiFinding['curl-command'] || '',
            extractedResults: nucleiFinding['extracted-results'] || [],
            matcher: nucleiFinding['matcher-name'] || '',
            type: nucleiFinding.type || 'http',
        };
    }

    /**
     * Build summary statistics from findings
     */
    buildSummary(findings) {
        const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        for (const f of findings) {
            summary.total++;
            const sev = f.severity?.toLowerCase() || 'info';
            if (summary.hasOwnProperty(sev)) summary[sev]++;
        }
        return summary;
    }

    getProgress(scanId) {
        const data = this.scanProgress.get(scanId);
        if (!data) return { progress: 0, findings: [], logs: [] };
        return {
            ...data,
            logs: this.scanLogs.get(scanId) || []
        };
    }
}

module.exports = NucleiService;

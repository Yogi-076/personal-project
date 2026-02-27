const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const SAST_RULES = require('./sastRules');

class SastService {
    constructor() {
        this.scanProgress = new Map();
        this.scanLogs = new Map();
    }

    async scan(repoUrl, options = {}, scanId) {
        let tempDir = null;
        try {
            this.addLog(scanId, `Initializing Deep Security Analysis for: ${repoUrl}`);
            this.updateProgress(scanId, 5);

            // Create temp directory for cloning
            tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vapt-sast-'));
            this.addLog(scanId, `Created secure workspace: ${tempDir}`);

            // 1. Clone Repository
            await this.cloneRepository(repoUrl, tempDir, scanId);
            this.updateProgress(scanId, 25);

            // 2. Scan Files
            this.addLog(scanId, 'Starting Deep Code Inspection...');
            const files = await this.getFiles(tempDir);
            this.addLog(scanId, `Analyzing ${files.length} source files...`);

            const findings = await this.analyzeFiles(files, tempDir, scanId);
            this.updateProgress(scanId, 85);

            // 3. Dependency Analysis (Best Effort)
            const depFindings = await this.analyzeDependencies(tempDir, scanId);
            const allFindings = [...findings, ...depFindings];

            this.addLog(scanId, `Analysis complete. Found ${allFindings.length} issues.`);
            this.updateProgress(scanId, 100);

            // Cleanup happens in finally block return
            return {
                summary: {
                    total: allFindings.length,
                    critical: allFindings.filter(f => f.severity === 'critical').length,
                    high: allFindings.filter(f => f.severity === 'high').length,
                    medium: allFindings.filter(f => f.severity === 'medium').length,
                    low: allFindings.filter(f => f.severity === 'low').length,
                    info: allFindings.filter(f => f.severity === 'info').length,
                },
                findings: allFindings
            };

        } catch (error) {
            this.addLog(scanId, `CRITICAL ERROR: ${error.message}`);
            console.error(error);
            // Even on error, try to return what we have or a failure state
            throw error;
        } finally {
            if (tempDir) {
                try {
                    await fs.rm(tempDir, { recursive: true, force: true });
                    this.addLog(scanId, 'Workspace cleaned up.');
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        }
    }

    async analyzeFiles(files, baseDir, scanId) {
        const findings = [];
        let processed = 0;
        const total = files.length;

        for (const file of files) {
            try {
                // Yield to event loop occasionally to prevent blocking
                if (processed % 50 === 0) await new Promise(r => setImmediate(r));
                processed++;

                // Report progress periodically
                if (processed % Math.ceil(total / 10) === 0) {
                    const pct = 25 + Math.floor((processed / total) * 60); // 25 -> 85
                    this.updateProgress(scanId, pct);
                }

                const content = await fs.readFile(file, 'utf8');
                const relPath = path.relative(baseDir, file);

                // Skip huge files
                if (content.length > 500000) continue;
                // Skip minified files (heuristic)
                if (content.length > 1000 && content.split('\n').length < 5) continue;

                const fileFindings = this.scanFileContent(content, relPath, file);
                findings.push(...fileFindings);

            } catch (err) {
                // Ignore read errors (perms, binary, etc)
            }
        }
        return findings;
    }

    scanFileContent(content, relPath, absPath) {
        const findings = [];
        const lines = content.split('\n');

        // Helper to check rules
        const checkRules = (categoryName, rules, defaultExtensions = null) => {
            // Filter rules relevant to this file
            const activeRules = rules.filter(r => {
                // If rule has specific fileRegex, matched against filename/path
                if (r.fileRegex) {
                    return r.fileRegex.test(relPath) || r.fileRegex.test(path.basename(relPath));
                }
                // If category has default extensions and no specific fileRegex, check extension
                if (defaultExtensions) {
                    return defaultExtensions.test(relPath);
                }
                // Otherwise apply to all (e.g., secrets)
                return true;
            });

            activeRules.forEach(rule => {
                let regex;
                if (rule.contextRegex) {
                    regex = new RegExp(rule.contextRegex, 'gmi');
                } else if (rule.regex) {
                    regex = new RegExp(rule.regex, 'gmi');
                } else {
                    return;
                }

                let match;
                // prevent endless loops with global regex checks if logic is flawed, though 'g' flag handles it
                // We use matching with safeguards
                let matchCount = 0;
                while ((match = regex.exec(content)) !== null) {
                    matchCount++;
                    if (matchCount > 50) break; // Limit findings per rule per file to avoid spam

                    const lineIdx = this.getLineNumber(content, match.index);
                    const evidenceLine = lines[lineIdx - 1] ? lines[lineIdx - 1].trim() : match[0];

                    // Skip if purely comment (basic check)
                    if (evidenceLine.startsWith('//') || evidenceLine.startsWith('#') || evidenceLine.startsWith('*')) continue;

                    findings.push({
                        id: uuidv4(),
                        title: rule.name,
                        type: this.mapCategoryToType(categoryName),
                        description: rule.description || rule.name,
                        severity: rule.severity,
                        url: relPath,
                        file: relPath,
                        line: lineIdx,
                        evidence: evidenceLine.substring(0, 200), // Truncate generic evidence
                        match: match[0],
                        impact: 'Potential Security Vulnerability',
                        remediation: rule.remediation || 'Investigate and fix.',
                        cvssScore: this.mapSeverityToCVSS(rule.severity)
                    });
                }
            });
        };

        // 1. Secrets (Run on ALL files usually)
        if (SAST_RULES.secrets) checkRules('secrets', SAST_RULES.secrets);

        // 2. Code (JS/TS/Backends)
        if (SAST_RULES.code) checkRules('code', SAST_RULES.code, /\.(js|ts|jsx|tsx|py|php|java|go|rb|cs)$/i);

        // 3. Crypto (JS/TS/Backends)
        if (SAST_RULES.crypto) checkRules('crypto', SAST_RULES.crypto, /\.(js|ts|jsx|tsx|py|php|java|go|rb|cs)$/i);

        // 4. Infrastructure (Dockerfile, Nginx, K8s yaml)
        if (SAST_RULES.infrastructure) checkRules('infrastructure', SAST_RULES.infrastructure, /\.(dockerfile|yaml|yml|conf|config|tf)$/i);

        // 5. Frontend (JSX, TSX, JS, HTML)
        if (SAST_RULES.frontend) checkRules('frontend', SAST_RULES.frontend, /\.(jsx|tsx|js|ts|html|htm|vue|svelte)$/i);

        return findings;
    }

    mapCategoryToType(cat) {
        const map = {
            secrets: 'Secret Leak',
            code: 'Code Security',
            crypto: 'Cryptographic Issue',
            infrastructure: 'Infrastructure Configuration',
            frontend: 'Client-Side Vulnerability'
        };
        return map[cat] || 'SAST Vulnerability';
    }

    mapSeverityToCVSS(severity) {
        switch (severity.toLowerCase()) {
            case 'critical': return 9.5;
            case 'high': return 8.0;
            case 'medium': return 5.5;
            case 'low': return 3.0;
            default: return 1.0;
        }
    }

    getLineNumber(content, index) {
        return content.substring(0, index).split('\n').length;
    }

    async cloneRepository(url, dest, scanId) {
        return new Promise((resolve, reject) => {
            this.addLog(scanId, `Cloning repository: ${url.trim()}`);
            // Added --depth 1 for speed
            const git = spawn('git', ['clone', '--depth', '1', url.trim(), '.'], {
                cwd: dest,
                shell: true
            });

            git.on('close', (code) => {
                if (code === 0) {
                    this.addLog(scanId, 'Repository cloned successfully.');
                    resolve();
                } else {
                    this.addLog(scanId, `Git clone failed with code ${code}. Checking if manual access possible...`);
                    // If git fails, we fail.
                    reject(new Error(`Git clone failed with code ${code}`));
                }
            });
        });
    }

    async analyzeDependencies(dir, scanId) {
        const findings = [];
        this.addLog(scanId, 'Checking for specific vulnerable dependency configurations...');
        const packageJsonPath = path.join(dir, 'package.json');

        try {
            const content = await fs.readFile(packageJsonPath, 'utf8');
            const pkg = JSON.parse(content);
            const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };

            // Manual check for some known critical packages/versions
            // This is "Pattern Based" SCA, faster than npm audit
            const BAD_PACKAGES = [
                { name: 'serialize-javascript', version: /3\.0\./, issue: 'RCE in serialize-javascript < 3.1.0' },
                { name: 'axios', version: /0\.1[0-9]\./, issue: 'SSRF in old axios versions' }
            ];

            for (const [name, version] of Object.entries(allDeps)) {
                for (const bad of BAD_PACKAGES) {
                    if (name === bad.name && bad.version.test(version)) {
                        findings.push({
                            id: uuidv4(),
                            title: `Vulnerable Dependency: ${name}`,
                            type: 'Dependency',
                            description: bad.issue,
                            severity: 'high',
                            url: 'package.json',
                            file: 'package.json',
                            line: 0,
                            evidence: `${name}: ${version}`,
                            impact: 'Use of library with known vulnerabilities.',
                            remediation: `Upgrade ${name} to latest version.`,
                            cvssScore: 7.5
                        });
                    }
                }
            }
        } catch (e) {
            // No package.json or invalid
        }
        return findings;
    }

    async getFiles(dir) {
        try {
            const dirents = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(dirents.map((dirent) => {
                const res = path.resolve(dir, dirent.name);
                if (dirent.name === '.git' || dirent.name === 'node_modules' || dirent.name === 'dist' || dirent.name === 'build' || dirent.name === 'vendor') return [];
                return dirent.isDirectory() ? this.getFiles(res) : res;
            }));
            return files.flat();
        } catch (e) { return []; }
    }

    addLog(scanId, message) {
        const logs = this.scanLogs.get(scanId) || [];
        logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        // Keep logs size managed
        if (logs.length > 500) logs.splice(0, 100);
        this.scanLogs.set(scanId, logs);
    }

    updateProgress(scanId, value) {
        this.scanProgress.set(scanId, value);
    }

    getProgress(scanId) {
        return {
            progress: this.scanProgress.get(scanId) || 0,
            logs: this.scanLogs.get(scanId) || []
        };
    }
}

module.exports = SastService;

const { spawn, execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');

/**
 * Retire.js Service — Software Composition Analysis (SCA)
 * Detects vulnerable third-party JavaScript libraries via:
 *   1. Filename/URL fingerprinting
 *   2. File content regex matching
 *   3. Hash-based identification
 * Wraps the retire CLI and normalizes output to VajraScan format.
 */
class RetireService {
    constructor() {
        this.retirePath = this.detectPath();
        this.scanProgress = new Map();
        this.scanLogs = new Map();
        this.scanResults = new Map();
    }

    detectPath() {
        try {
            const p = execSync(process.platform === 'win32' ? 'where retire' : 'which retire', { stdio: 'pipe' }).toString().trim().split('\n')[0];
            if (p) return p.trim();
        } catch (e) { /* ignore */ }
        return 'retire';
    }

    addLog(scanId, message) {
        if (!this.scanLogs.has(scanId)) this.scanLogs.set(scanId, []);
        const logs = this.scanLogs.get(scanId);
        logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (logs.length > 500) logs.shift();
    }

    // ═══════════════════════════════════════
    // Deep JS Discovery — finds ALL .js refs
    // ═══════════════════════════════════════

    /**
     * Deep-scan a URL to find all JavaScript file references.
     * Catches: <script src>, RequireJS configs, data-main, inline URL strings,
     * and any .js URL pattern in the full page source.
     */
    async _discoverJSUrls(targetUrl, scanId) {
        this.addLog(scanId, `🌐 Fetching page: ${targetUrl}`);
        const html = await this._httpGet(targetUrl);
        const foundUrls = new Set();

        // 1. <script src="..."> tags (with multiline + any-attribute support)
        const scriptSrcRegex = /<script[^>]+?src\s*=\s*["']([^"']+\.js[^"']*)["']/gi;
        let match;
        while ((match = scriptSrcRegex.exec(html)) !== null) {
            foundUrls.add(match[1]);
        }
        this.addLog(scanId, `🔍 Script src tags: ${foundUrls.size} found`);

        // 2. data-main="..." (RequireJS entry point)
        const dataMainRegex = /data-main\s*=\s*["']([^"']+)["']/gi;
        while ((match = dataMainRegex.exec(html)) !== null) {
            let url = match[1];
            if (!url.endsWith('.js')) url += '.js';
            foundUrls.add(url);
        }

        // 3. All .js URLs found anywhere in the page source (href, inline, JSON configs)
        //    Matches full URL paths ending in .js or .min.js
        const jsUrlRegex = /(?:https?:)?\/\/[^\s"'<>()]+\.(?:min\.)?js(?:\?[^\s"'<>]*)?/gi;
        while ((match = jsUrlRegex.exec(html)) !== null) {
            foundUrls.add(match[0]);
        }

        // 4. Relative JS paths (e.g., /static/.../jquery.js, ./lib/angular.js)
        const relativeJsRegex = /["']((?:\/|\.\.?\/)[^\s"'<>]+\.(?:min\.)?js(?:\?[^\s"']*)?)["']/gi;
        while ((match = relativeJsRegex.exec(html)) !== null) {
            foundUrls.add(match[1]);
        }

        // 5. RequireJS paths config — extract base URLs and module paths
        const requireConfigRegex = /require(?:js)?\.config\s*\(\s*\{([\s\S]*?)\}\s*\)/gi;
        while ((match = requireConfigRegex.exec(html)) !== null) {
            const configBlock = match[1];
            // Extract baseUrl
            const baseUrlMatch = configBlock.match(/baseUrl\s*:\s*["']([^"']+)["']/);
            const baseUrl = baseUrlMatch ? baseUrlMatch[1] : '';
            // Extract path entries
            const pathsRegex = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;
            let pathMatch;
            while ((pathMatch = pathsRegex.exec(configBlock)) !== null) {
                let jsPath = pathMatch[2];
                if (!jsPath.endsWith('.js')) jsPath += '.js';
                if (baseUrl && !jsPath.startsWith('http') && !jsPath.startsWith('//')) {
                    jsPath = baseUrl + '/' + jsPath;
                }
                foundUrls.add(jsPath);
            }
        }

        this.addLog(scanId, `🔍 Total unique JS references discovered: ${foundUrls.size}`);

        // Resolve all URLs to absolute
        const resolvedUrls = [];
        for (const url of foundUrls) {
            try {
                let resolved = url;
                if (url.startsWith('//')) {
                    resolved = 'https:' + url;
                } else if (!url.startsWith('http')) {
                    resolved = new URL(url, targetUrl).href;
                }
                // Filter out data: URIs, very short paths, and non-JS
                if (resolved.startsWith('http') && resolved.includes('.js')) {
                    resolvedUrls.push(resolved);
                }
            } catch (e) { /* skip invalid */ }
        }

        return [...new Set(resolvedUrls)]; // deduplicate
    }

    /**
     * Download JS files from a URL target to a temp directory for scanning.
     * Performs TWO passes:
     *   1. Download all script-src and inline .js URLs from the page
     *   2. Parse downloaded config files (requirejs-config.js, etc.) for module paths → download those too
     */
    async _downloadJSFromURL(targetUrl, destDir, scanId) {
        const jsUrls = await this._discoverJSUrls(targetUrl, scanId);

        if (jsUrls.length === 0) {
            this.addLog(scanId, '⚠️ No JS file references found in page source');
            return 0;
        }

        this.addLog(scanId, `📥 Pass 1: Downloading ${jsUrls.length} JS files...`);
        let downloaded = 0;
        const downloadedFiles = []; // track content for 2nd pass

        for (const jsUrl of jsUrls) {
            try {
                const urlObj = new URL(jsUrl);
                let filename = path.basename(urlObj.pathname) || `script_${downloaded}.js`;
                filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
                if (!filename.endsWith('.js')) filename += '.js';
                const uniqueName = `${downloaded}_${filename}`;
                const content = await this._httpGet(jsUrl);

                if (content.length > 10 && !content.trim().startsWith('<!DOCTYPE') && !content.trim().startsWith('<html')) {
                    const filePath = path.join(destDir, uniqueName);
                    await fs.writeFile(filePath, content);
                    downloaded++;
                    downloadedFiles.push({ url: jsUrl, content, filename: uniqueName });
                    this.addLog(scanId, `  📦 ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
                }
            } catch (e) {
                const basename = jsUrl.split('/').pop() || '';
                if (basename.includes('jquery') || basename.includes('angular') || basename.includes('react') || basename.includes('bootstrap')) {
                    this.addLog(scanId, `⚠️ Failed: ${basename} — ${e.message}`);
                }
            }
        }

        this.addLog(scanId, `✅ Pass 1 complete: ${downloaded}/${jsUrls.length} files`);

        // ═════ PASS 2: Parse downloaded files for RequireJS / dynamic module paths ═════
        const additionalUrls = new Set();

        for (const { url, content, filename } of downloadedFiles) {
            // Look for RequireJS-style configs in any downloaded JS file
            // Matches: require.config({...}), requirejs.config({...}), var config = {...}
            const configPatterns = [
                /require(?:js)?\.config\s*\(\s*(\{[\s\S]*?\})\s*\)/g,
                /var\s+config\s*=\s*(\{[\s\S]*?\});/g,
            ];

            for (const pattern of configPatterns) {
                let configMatch;
                while ((configMatch = pattern.exec(content)) !== null) {
                    const configBlock = configMatch[1];

                    // Extract baseUrl
                    const baseUrlMatch = configBlock.match(/baseUrl\s*:\s*["']([^"']+)["']/);
                    const baseUrl = baseUrlMatch ? baseUrlMatch[1] : '';

                    // Extract ALL quoted path values (covers 'paths', 'map', 'shim', etc.)
                    const pathValueRegex = /["']([^"']+)["']\s*:\s*["']([^"']+)["']/g;
                    let pathMatch;
                    while ((pathMatch = pathValueRegex.exec(configBlock)) !== null) {
                        const moduleName = pathMatch[1];
                        let modulePath = pathMatch[2];

                        // Skip non-path entries (boolean-like, URL = http, etc.)
                        if (modulePath === 'true' || modulePath === 'false' || modulePath.startsWith('http')) continue;

                        // Resolve: baseUrl + modulePath + .js
                        if (!modulePath.endsWith('.js')) modulePath += '.js';
                        let fullUrl;
                        try {
                            if (baseUrl && !modulePath.startsWith('/')) {
                                fullUrl = new URL(baseUrl + '/' + modulePath, url).href;
                            } else {
                                fullUrl = new URL(modulePath, url).href;
                            }
                            if (fullUrl.startsWith('http') && fullUrl.includes('.js')) {
                                additionalUrls.add(fullUrl);
                            }
                        } catch (e) { /* skip */ }
                    }
                }
            }

            // Also find inline .js URLs in downloaded files
            const inlineJsRegex = /(?:https?:)?\/\/[^\s"'<>()]+\.(?:min\.)?js(?:\?[^\s"'<>]*)?/gi;
            let inlineMatch;
            while ((inlineMatch = inlineJsRegex.exec(content)) !== null) {
                let u = inlineMatch[0];
                if (u.startsWith('//')) u = 'https:' + u;
                if (u.startsWith('http')) additionalUrls.add(u);
            }
        }

        // Remove already-downloaded URLs
        const alreadyDownloaded = new Set(jsUrls);
        const newUrls = [...additionalUrls].filter(u => !alreadyDownloaded.has(u));

        if (newUrls.length > 0) {
            // Limit to known important libraries + first N others
            const priorityLibs = ['jquery', 'angular', 'react', 'vue', 'backbone', 'ember', 'lodash', 'underscore', 'moment', 'handlebars', 'mustache', 'knockout'];
            const prioritized = newUrls.filter(u => priorityLibs.some(lib => u.toLowerCase().includes(lib)));
            const others = newUrls.filter(u => !priorityLibs.some(lib => u.toLowerCase().includes(lib))).slice(0, 20);
            const toDownload = [...prioritized, ...others];

            this.addLog(scanId, `🔎 Pass 2: Found ${newUrls.length} additional modules (RequireJS/dynamic)${prioritized.length > 0 ? ` — ${prioritized.length} known libraries` : ''}`);

            for (const jsUrl of toDownload) {
                try {
                    const urlObj = new URL(jsUrl);
                    let filename = path.basename(urlObj.pathname) || `module_${downloaded}.js`;
                    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 100);
                    if (!filename.endsWith('.js')) filename += '.js';
                    const uniqueName = `${downloaded}_${filename}`;
                    const content = await this._httpGet(jsUrl);

                    if (content.length > 10 && !content.trim().startsWith('<!DOCTYPE') && !content.trim().startsWith('<html')) {
                        await fs.writeFile(path.join(destDir, uniqueName), content);
                        downloaded++;
                        this.addLog(scanId, `  📦 ${filename} (${(content.length / 1024).toFixed(1)} KB)`);
                    }
                } catch (e) {
                    // Log failures for priority libs only
                    const basename = jsUrl.split('/').pop() || '';
                    if (priorityLibs.some(lib => basename.toLowerCase().includes(lib))) {
                        this.addLog(scanId, `⚠️ Failed: ${basename} — ${e.message}`);
                    }
                }
            }

            this.addLog(scanId, `✅ Pass 2 complete. Total: ${downloaded} JS files`);
        }

        return downloaded;
    }

    _httpGet(url) {
        return new Promise((resolve, reject) => {
            const client = url.startsWith('https') ? https : http;
            const options = {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'identity', // avoid gzip for simplicity
                },
                timeout: 15000,
            };
            const req = client.get(url, options, (res) => {
                // Follow redirects (up to 5)
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    const redirectUrl = new URL(res.headers.location, url).href;
                    return this._httpGet(redirectUrl).then(resolve).catch(reject);
                }
                if (res.statusCode >= 400) {
                    return reject(new Error(`HTTP ${res.statusCode}`));
                }
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve(data));
                res.on('error', reject);
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        });
    }

    // ═══════════════════════════════════════
    // Core Scan Logic
    // ═══════════════════════════════════════

    /**
     * Run a Retire.js scan against a URL or local directory.
     */
    async scan(target, options = {}, scanId) {
        return new Promise(async (resolve, reject) => {
            try {
                const mode = options.mode || 'url';
                this.addLog(scanId, '📦 Initializing Retire.js SCA scanner...');
                this.addLog(scanId, `Binary: ${this.retirePath}`);
                this.addLog(scanId, `Mode: ${mode.toUpperCase()}`);
                this.addLog(scanId, `🎯 Target: ${target}`);
                this.scanProgress.set(scanId, { progress: 5, status: 'scanning' });

                const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'retire-'));
                const outputFile = path.join(tempDir, 'results.json');
                let scanPath = target;

                if (mode === 'url') {
                    // URL mode: deep-discover & download page JS files, then scan locally
                    const jsDir = path.join(tempDir, 'js_files');
                    await fs.mkdir(jsDir, { recursive: true });
                    this.scanProgress.set(scanId, { progress: 10, status: 'downloading' });

                    const count = await this._downloadJSFromURL(target, jsDir, scanId);
                    if (count === 0) {
                        this.addLog(scanId, '⚠️ No downloadable JS files found. Saving raw HTML for content analysis...');
                        try {
                            const html = await this._httpGet(target);
                            await fs.writeFile(path.join(jsDir, 'page_source.js'), html);
                        } catch (e) { /* ignore */ }
                    }
                    scanPath = jsDir;
                    this.scanProgress.set(scanId, { progress: 35, status: 'scanning' });
                }

                const args = [
                    '--outputformat', 'json',
                    '--outputpath', outputFile,
                    '--path', scanPath,
                ];

                if (mode === 'directory') {
                    const ignoreDirs = options.ignore || ['node_modules', '.git', 'dist', 'build'];
                    for (const dir of ignoreDirs) {
                        args.push('--ignore', dir);
                    }
                    args.push('--node');
                    this.addLog(scanId, `🚫 Ignoring: ${ignoreDirs.join(', ')}`);
                }

                this.addLog(scanId, '🚀 Launching Retire.js analysis...');
                this.scanProgress.set(scanId, { progress: mode === 'url' ? 40 : 15, status: 'scanning' });

                const proc = spawn(this.retirePath, args, {
                    timeout: (options.timeout || 300) * 1000,
                    shell: true,
                });

                let stderrBuffer = '';
                let stdoutBuffer = '';

                proc.stderr.on('data', (data) => {
                    stderrBuffer += data.toString();
                    const lines = data.toString().split('\n').filter(l => l.trim());
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (trimmed.includes('ERROR') || trimmed.includes('error')) {
                            this.addLog(scanId, `⚠️ ${trimmed}`);
                        } else if (trimmed) {
                            this.addLog(scanId, `📋 ${trimmed}`);
                        }
                    }
                    this.scanProgress.set(scanId, { progress: Math.min(85, 40 + stderrBuffer.length / 30), status: 'scanning' });
                });

                proc.stdout.on('data', (data) => {
                    stdoutBuffer += data.toString();
                });

                proc.on('close', async (code) => {
                    // retire exits with code 13 when vulnerabilities are found — this is SUCCESS
                    this.addLog(scanId, `Retire.js exited (code ${code}${code === 13 ? ' — vulns found' : ''})`);

                    let rawFindings = [];
                    try {
                        const content = await fs.readFile(outputFile, 'utf-8');
                        const parsed = JSON.parse(content);
                        // Retire v5 wraps results in { version: ..., data: [...] }
                        if (parsed && parsed.data && Array.isArray(parsed.data)) {
                            rawFindings = parsed.data;
                            this.addLog(scanId, `📄 Parsed ${rawFindings.length} result entries (retire v5 format)`);
                        } else if (Array.isArray(parsed)) {
                            rawFindings = parsed;
                        } else {
                            rawFindings = [parsed];
                        }
                    } catch (e) {
                        try {
                            if (stdoutBuffer.trim()) {
                                const parsed = JSON.parse(stdoutBuffer);
                                if (parsed && parsed.data && Array.isArray(parsed.data)) {
                                    rawFindings = parsed.data;
                                } else if (Array.isArray(parsed)) {
                                    rawFindings = parsed;
                                } else {
                                    rawFindings = [parsed];
                                }
                            }
                        } catch (e2) {
                            if (code === 0) {
                                this.addLog(scanId, '✅ No vulnerable libraries detected in target.');
                            } else {
                                this.addLog(scanId, `⚠️ Could not parse results (code ${code})`);
                            }
                        }
                    }

                    // Transform to VajraScan format
                    const transformedFindings = [];
                    for (const item of rawFindings) {
                        const results = item.results || [];
                        for (const result of results) {
                            const vulns = result.vulnerabilities || [];
                            for (const vuln of vulns) {
                                transformedFindings.push(this.transformFinding(item, result, vuln));
                            }
                        }
                    }

                    const summary = this.buildSummary(transformedFindings);
                    const depTree = this.buildDependencyTree(rawFindings);
                    const sbom = this.generateSBOM(rawFindings, target);

                    this.addLog(scanId, `✅ Scan complete — ${transformedFindings.length} vulnerabilities in ${summary.uniqueLibraries || 0} libraries`);
                    this.addLog(scanId, `📊 Critical: ${summary.critical} | High: ${summary.high} | Medium: ${summary.medium} | Low: ${summary.low}`);

                    const finalResult = {
                        findings: transformedFindings,
                        summary,
                        dependencyTree: depTree,
                        sbom,
                        rawCount: rawFindings.length,
                        target,
                        scanType: 'retire',
                    };

                    this.scanResults.set(scanId, finalResult);
                    this.scanProgress.set(scanId, { progress: 100, status: 'completed' });

                    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
                    resolve(finalResult);
                });

                proc.on('error', (err) => {
                    this.addLog(scanId, `❌ Retire.js error: ${err.message}`);
                    this.scanProgress.set(scanId, { progress: 0, status: 'failed' });
                    reject(err);
                });

            } catch (err) {
                this.addLog(scanId, `❌ Setup error: ${err.message}`);
                this.scanProgress.set(scanId, { progress: 0, status: 'failed' });
                reject(err);
            }
        });
    }

    // ═══════════════════════════════════════
    // Result Transformation
    // ═══════════════════════════════════════

    transformFinding(item, result, vuln) {
        const severityMap = { 'critical': 'critical', 'high': 'high', 'medium': 'medium', 'low': 'low', 'none': 'info' };
        const cves = (vuln.identifiers || {}).CVE || [];
        const ghsas = (vuln.identifiers || {}).githubID || (vuln.identifiers || {}).GHSA || [];
        const summaryText = (vuln.identifiers || {}).summary || vuln.info?.join(', ') || '';

        let severity = 'medium';
        if (vuln.severity) {
            severity = severityMap[vuln.severity.toLowerCase()] || 'medium';
        } else if (cves.length > 0) {
            severity = 'high';
        }

        return {
            name: `${result.component || 'Unknown'} ${result.version || ''}`.trim(),
            severity,
            library: result.component || 'Unknown',
            version: result.version || 'Unknown',
            latestVersion: result.latest || null,
            cves,
            ghsas,
            description: summaryText || `Vulnerable version of ${result.component}`,
            remediation: result.latest
                ? `Update ${result.component} from ${result.version} to ${result.latest}+`
                : `Update ${result.component} to the latest stable version`,
            url: item.file || '',
            detectionMethod: item.file ? 'file' : 'content',
            references: vuln.info || [],
            atOrAbove: vuln.atOrAbove || null,
            below: vuln.below || null,
            parent: item.parent || null,
        };
    }

    buildDependencyTree(rawFindings) {
        const tree = [];
        for (const item of rawFindings) {
            const node = {
                file: item.file || 'Unknown',
                parent: item.parent || null,
                libraries: [],
            };
            for (const result of (item.results || [])) {
                node.libraries.push({
                    name: result.component || 'Unknown',
                    version: result.version || 'Unknown',
                    latest: result.latest || null,
                    vulnerabilities: (result.vulnerabilities || []).length,
                    severity: this._maxSeverity(result.vulnerabilities || []),
                });
            }
            if (node.libraries.length > 0) tree.push(node);
        }
        return tree;
    }

    _maxSeverity(vulns) {
        const order = ['critical', 'high', 'medium', 'low', 'info'];
        let max = 'info';
        for (const v of vulns) {
            const s = (v.severity || 'medium').toLowerCase();
            if (order.indexOf(s) < order.indexOf(max)) max = s;
        }
        return max;
    }

    generateSBOM(rawFindings, target) {
        const components = [];
        const vulnerabilities = [];

        for (const item of rawFindings) {
            for (const result of (item.results || [])) {
                const bomRef = `${result.component}-${result.version}`;
                components.push({
                    type: 'library',
                    'bom-ref': bomRef,
                    name: result.component || 'Unknown',
                    version: result.version || 'Unknown',
                    purl: `pkg:npm/${result.component}@${result.version}`,
                });

                for (const vuln of (result.vulnerabilities || [])) {
                    const cves = (vuln.identifiers || {}).CVE || [];
                    for (const cve of cves) {
                        vulnerabilities.push({
                            id: cve,
                            source: { name: 'Retire.js', url: 'https://retirejs.github.io/retire.js/' },
                            ratings: [{ severity: vuln.severity || 'medium' }],
                            affects: [{ ref: bomRef }],
                            description: (vuln.identifiers || {}).summary || '',
                        });
                    }
                }
            }
        }

        return {
            bomFormat: 'CycloneDX',
            specVersion: '1.5',
            version: 1,
            metadata: {
                timestamp: new Date().toISOString(),
                tools: [{ vendor: 'VajraScan', name: 'Retire.js SCA', version: '1.0.0' }],
                component: { type: 'application', name: target },
            },
            components,
            vulnerabilities,
        };
    }

    buildSummary(findings) {
        const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0, libraries: new Set() };
        for (const f of findings) {
            summary.total++;
            const sev = f.severity?.toLowerCase() || 'info';
            if (summary.hasOwnProperty(sev)) summary[sev]++;
            summary.libraries.add(f.library);
        }
        summary.uniqueLibraries = summary.libraries.size;
        delete summary.libraries;
        return summary;
    }

    getProgress(scanId) {
        const progress = this.scanProgress.get(scanId);
        return {
            progress: progress?.progress || 0,
            status: progress?.status || 'idle',
            logs: this.scanLogs.get(scanId) || [],
        };
    }

    getResults(scanId) {
        return this.scanResults.get(scanId) || null;
    }
}

module.exports = RetireService;

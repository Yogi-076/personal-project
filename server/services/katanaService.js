const { spawn } = require('child_process');
const { execSync } = require('child_process');
const path = require('path');

/**
 * Katana Service — Authenticated Crawling Engine
 * Uses ProjectDiscovery's Katana for deep crawling behind login pages.
 * Accepts session cookies/headers from Auth-Bridge to discover authenticated endpoints.
 */
class KatanaService {
    constructor() {
        this.katanaPath = this.detectPath();
        this.scanProgress = new Map();
        this.scanLogs = new Map();
    }

    detectPath() {
        try {
            const p = execSync(process.platform === 'win32' ? 'where katana' : 'which katana', { stdio: 'pipe' }).toString().trim().split('\n')[0];
            if (p) return p.trim();
        } catch (e) { /* ignore */ }
        return 'katana';
    }

    addLog(scanId, message) {
        if (!this.scanLogs.has(scanId)) this.scanLogs.set(scanId, []);
        const logs = this.scanLogs.get(scanId);
        logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (logs.length > 500) logs.shift();
    }

    /**
     * Crawl a target with optional authentication.
     * @param {string} target - Target URL to crawl
     * @param {object} options - Crawl options
     * @param {object} options.authSession - Auth-Bridge session data (cookies, JWT)
     * @param {number} options.depth - Crawl depth (default: 3)
     * @param {number} options.concurrency - Concurrent threads (default: 10)
     * @param {boolean} options.headless - Use headless browser mode (default: false)
     * @param {string} scanId - Unique scan identifier
     * @returns {Promise<object>} Crawl results with discovered URLs
     */
    async crawl(target, options = {}, scanId) {
        return new Promise((resolve, reject) => {
            this.addLog(scanId, `🕷️ Starting Katana crawl for ${target}`);
            this.addLog(scanId, `Binary: ${this.katanaPath}`);
            this.scanProgress.set(scanId, { progress: 0, urls: [], logs: [] });

            const args = [
                '-u', target,
                '-d', String(options.depth || 3),
                '-c', String(options.concurrency || 10),
                '-silent',
                '-nc',    // No color
                '-jc',    // Crawl JavaScript files
                '-kf', 'all', // Known file discovery
            ];

            // Inject authentication cookies
            if (options.authSession) {
                const cookieValue = options.authSession.cookieHeader?.replace('Cookie: ', '') || '';
                if (cookieValue) {
                    args.push('-H', `Cookie: ${cookieValue}`);
                    this.addLog(scanId, `🔐 Injected ${cookieValue.split(';').length} session cookies`);
                }
                // Inject JWT if available
                if (options.authSession.jwtHeader) {
                    const jwt = options.authSession.jwtHeader.replace('Authorization: ', '');
                    args.push('-H', `Authorization: ${jwt}`);
                    this.addLog(scanId, '🔑 Injected JWT authorization header');
                }
            }

            // Use headless browser mode for JS-heavy apps
            if (options.headless) {
                args.push('-headless');
                this.addLog(scanId, '🌐 Headless browser mode enabled');
            }

            // Scope control
            if (options.scope) {
                args.push('-fs', options.scope); // field scope: dn (domain name)
            }

            this.addLog(scanId, `Command: katana ${args.join(' ')}`);

            const proc = spawn(this.katanaPath, args, {
                timeout: (options.timeout || 300) * 1000, // 5 min default
            });

            const discoveredUrls = new Set();
            let stderr = '';

            proc.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter(l => l.trim());
                for (const url of lines) {
                    const trimmed = url.trim();
                    if (trimmed && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
                        discoveredUrls.add(trimmed);
                    }
                }

                // Update progress estimate
                const count = discoveredUrls.size;
                const progress = Math.min(90, Math.floor(count / 2)); // rough estimate
                this.scanProgress.set(scanId, {
                    progress,
                    urls: [...discoveredUrls],
                    logs: this.scanLogs.get(scanId) || []
                });

                if (count % 10 === 0 && count > 0) {
                    this.addLog(scanId, `📍 Discovered ${count} URLs so far...`);
                }
            });

            proc.stderr.on('data', (data) => {
                stderr += data.toString();
                // Katana logs progress info to stderr
                const lines = data.toString().split('\n').filter(l => l.trim());
                for (const line of lines) {
                    if (line.includes('error') || line.includes('Error')) {
                        this.addLog(scanId, `⚠️ ${line.trim()}`);
                    }
                }
            });

            proc.on('close', (code) => {
                const urls = [...discoveredUrls];
                this.addLog(scanId, `✅ Crawl complete. Discovered ${urls.length} unique URLs.`);

                // Categorize URLs
                const categorized = this.categorizeUrls(urls);
                this.addLog(scanId, `📊 Pages: ${categorized.pages.length} | APIs: ${categorized.apis.length} | Assets: ${categorized.assets.length} | Forms: ${categorized.forms.length}`);

                this.scanProgress.set(scanId, {
                    progress: 100,
                    urls,
                    logs: this.scanLogs.get(scanId) || []
                });

                resolve({
                    success: true,
                    target,
                    totalUrls: urls.length,
                    urls,
                    categorized,
                    exitCode: code
                });
            });

            proc.on('error', (err) => {
                this.addLog(scanId, `❌ Katana error: ${err.message}`);
                reject(err);
            });
        });
    }

    /**
     * Categorize discovered URLs by type
     */
    categorizeUrls(urls) {
        const pages = [];
        const apis = [];
        const assets = [];
        const forms = [];

        const assetExts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.map'];
        const apiPatterns = ['/api/', '/v1/', '/v2/', '/v3/', '/graphql', '/rest/', '/json', '/xml'];
        const formPatterns = ['login', 'signup', 'register', 'contact', 'search', 'upload', 'submit', 'form'];

        for (const url of urls) {
            const lower = url.toLowerCase();

            if (assetExts.some(ext => lower.includes(ext))) {
                assets.push(url);
            } else if (apiPatterns.some(p => lower.includes(p))) {
                apis.push(url);
            } else if (formPatterns.some(p => lower.includes(p))) {
                forms.push(url);
            } else {
                pages.push(url);
            }
        }

        return { pages, apis, assets, forms };
    }

    getProgress(scanId) {
        const data = this.scanProgress.get(scanId);
        if (!data) return { progress: 0, urls: [], logs: [] };
        return {
            ...data,
            logs: this.scanLogs.get(scanId) || []
        };
    }
}

module.exports = KatanaService;

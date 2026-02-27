
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class GobusterService {
    constructor() {
        this.activeScans = new Map();
        // Common paths for directory enumeration
        this.commonPaths = [
            'admin', 'login', 'dashboard', 'api', 'config', 'backup', 'uploads', 'images', 'static',
            'css', 'js', 'assets', 'public', 'private', 'db', 'database', 'test', 'dev', 'staging',
            '.env', '.git', 'wp-admin', 'wp-login.php', 'robots.txt', 'sitemap.xml', 'console',
            'administrator', 'auth', 'user', 'users', 'account', 'register', 'signup', 'signin'
        ];
    }

    startScan(targetUrl, wordlist = 'common') {
        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target: targetUrl,
            status: 'running',
            progress: 0,
            found: [],
            logs: [],
            total: this.commonPaths.length,
            current: 0
        };

        this.activeScans.set(scanId, scan);
        this.runScan(scanId); // Start async

        return scanId;
    }

    async runScan(scanId) {
        const scan = this.activeScans.get(scanId);
        if (!scan) return;

        scan.logs.push(`[${new Date().toISOString()}] Starting enumeration on ${scan.target}`);

        for (const path of this.commonPaths) {
            if (scan.status === 'stopped') break;

            const url = `${scan.target.replace(/\/$/, '')}/${path}`;
            scan.current++;
            scan.progress = Math.round((scan.current / scan.total) * 100);

            try {
                const response = await axios.head(url, {
                    timeout: 2000,
                    validateStatus: () => true
                });

                if (response.status < 400 || response.status === 401 || response.status === 403) {
                    const result = {
                        path: `/${path}`,
                        status: response.status,
                        size: response.headers['content-length'] || 0,
                        url: url
                    };
                    scan.found.push(result);
                    scan.logs.push(`[+] Found: /${path} (Status: ${response.status})`);
                }
            } catch (error) {
                // Ignore connection errors
            }

            // Small delay to prevent flooding
            await new Promise(r => setTimeout(r, 100));
        }

        scan.status = 'completed';
        scan.logs.push(`[${new Date().toISOString()}] Scan finished`);
        this.activeScans.set(scanId, scan); // Update
    }

    stopScan(scanId) {
        const scan = this.activeScans.get(scanId);
        if (scan) {
            scan.status = 'stopped';
            scan.logs.push(`[${new Date().toISOString()}] Scan stopped by user`);
        }
    }

    getScanStatus(scanId) {
        return this.activeScans.get(scanId);
    }
}

module.exports = GobusterService;

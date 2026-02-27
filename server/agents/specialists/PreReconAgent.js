const BaseAgent = require('../core/BaseAgent');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const WafBypass = require('../../utils/wafBypass');

class PreReconAgent extends BaseAgent {
    constructor() {
        super('PreReconAgent', 'RECON');
    }

    async process(task) {
        if (task.type === 'START_PRERECON') {
            const results = await this._runPreRecon(task.payload);
            this.sendResponse(task, results);
        }
    }

    async _runPreRecon(payload) {
        const { target, scanId, wafBypass } = payload;
        this.emitPhase('pre-recon');
        this.log(`🔍 Pre-Recon: scanning ${target}`);

        // WAF Bypass: Generate rotated UA
        let userAgent = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'; // Default to Googlebot for recon (often whitelisted)
        if (wafBypass) {
            const wb = new WafBypass();
            userAgent = wb.getRandomUA();
            this.log(`🛡️ WAF Bypass: Using rotated UA for recon tools: ${userAgent.substring(0, 50)}...`);
        }

        const results = {
            ports: [],
            techStack: [],
            headers: {},
            serverInfo: null,
            subdomains: []
        };

        // 1. Port Scan (nmap)
        try {
            const hostname = new URL(target).hostname;
            this.log('🔌 Running port scan...');
            const { stdout } = await execAsync(`nmap -sV -T4 --top-ports 100 -oG - ${hostname}`, { timeout: 60000 });
            results.ports = this._parseNmapOutput(stdout);
            this.log(`  Found ${results.ports.length} open ports`);
        } catch (e) {
            this.log(`⚠️ Nmap unavailable: ${e.message.substring(0, 80)}`);
        }



        // 3. HTTP Headers Analysis & Tech Fingerprinting (Hybrid GET + Playwright Fallback)
        let reconSuccess = false;
        try {
            this.log('📋 Analyzing HTTP headers & Tech fingerprints...');

            const axiosConfig = {
                headers: { 'User-Agent': userAgent },
                timeout: 15000, // Reduced to 15s to fail-fast to Playwright
                validateStatus: () => true
            };

            // ... Proxy logic (unchanged) ...
            if (payload.proxy) {
                if (payload.proxy.startsWith('socks')) {
                    const { SocksProxyAgent } = require('socks-proxy-agent');
                    axiosConfig.httpsAgent = new SocksProxyAgent(payload.proxy);
                    axiosConfig.httpAgent = new SocksProxyAgent(payload.proxy);
                    this.log(`🔌 Using SOCKS proxy for header analysis`);
                } else if (payload.proxy.startsWith('http')) {
                    try {
                        const proxyUrl = new URL(payload.proxy);
                        axiosConfig.proxy = {
                            protocol: proxyUrl.protocol.replace(':', ''),
                            host: proxyUrl.hostname,
                            port: parseInt(proxyUrl.port) || (proxyUrl.protocol === 'https:' ? 443 : 80),
                            auth: proxyUrl.username ? {
                                username: decodeURIComponent(proxyUrl.username),
                                password: decodeURIComponent(proxyUrl.password)
                            } : undefined
                        };
                    } catch (e) {
                        this.log(`⚠️ Invalid proxy URL: ${payload.proxy}`);
                    }
                }
            }

            // USE GET instead of HEAD
            const response = await axios.get(target, axiosConfig);
            results.headers = response.headers;
            const html = response.data && typeof response.data === 'string' ? response.data : '';
            this._runFingerprinting(html, results);
            reconSuccess = true;
        } catch (e) {
            this.log(`⚠️ Primary Recon (Axios) failed: ${e.message}. Attempting Playwright Fallback...`);

            // SHANNON RESILIENCE: Use Playwright as a real browser fallback
            try {
                const { chromium } = require('playwright');
                const browser = await chromium.launch({ headless: true });
                const context = await browser.newContext({ userAgent });
                const page = await context.newPage();

                const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 30000 });
                if (response) {
                    results.headers = response.headers();
                    const html = await page.content();
                    this._runFingerprinting(html, results);
                    reconSuccess = true;
                    this.log(`✅ Playwright Fallback: Successfully reached target.`);
                }
                await browser.close();
            } catch (pError) {
                const status = pError.response?.status || e.response?.status;
                const msg = pError.message || e.message || '';
                if (msg.toLowerCase().includes('timeout') || msg.toLowerCase().includes('abort')) {
                    this.log(`❌ Network Error: Connection timed out for both Axios and Playwright. The target is likely blocking your IP or requires a proxy.`);
                } else if (status === 403 || status === 401) {
                    this.log(`🛡️ WAF/Auth Alert: Access forbidden (${status}). Use a proxy or rotation.`);
                } else {
                    this.log(`⚠️ Recon failed: ${msg}`);
                }
            }
        }

        results.serverInfo = results.headers['server'] || results.headers['x-powered-by'] || null;
        if (results.serverInfo) this.log(`  Server: ${results.serverInfo}`);

        // 4. Subdomain Enumeration (subfinder)
        try {
            const hostname = new URL(target).hostname;
            this.log('🌐 Enumerating subdomains...');
            const { stdout } = await execAsync(`subfinder -d ${hostname} -silent -timeout 30`, { timeout: 45000 });
            results.subdomains = stdout.split('\n').filter(Boolean).slice(0, 50);
            this.log(`  Found ${results.subdomains.length} subdomains`);
        } catch (e) {
            this.log(`⚠️ Subfinder unavailable: ${e.message.substring(0, 80)}`);
        }

        if (reconSuccess && results.ports.length === 0) {
            const port = target.startsWith('https') ? 443 : 80;
            results.ports.push({ port, service: target.startsWith('https') ? 'https' : 'http' });
            this.log(`  🔌 Smart Port Fallback: Assuming port ${port} is open based on successful HTTP recon`);
        }

        // Check for missing security headers (only if we have headers)
        if (results.headers && Object.keys(results.headers).length > 0) {
            const securityHeaders = ['x-frame-options', 'x-content-type-options', 'strict-transport-security',
                'content-security-policy', 'x-xss-protection'];
            const missing = securityHeaders.filter(h => !results.headers[h.toLowerCase()]);
            if (missing.length > 0) {
                this.log(`  ⚠️ Missing security headers: ${missing.join(', ')}`);
            }
        }

        this.log(`✅ Pre-Recon complete`);
        return results;
    }

    _runFingerprinting(html, results) {
        const techFingerprints = {
            'Cloudflare': /cf-ray|__cfduid|cloudflare/i,
            'Nginx': /server: nginx/i,
            'Apache': /server: apache/i,
            'Express': /x-powered-by: express/i,
            'PHP': /x-powered-by: php/i,
            'Next.js': /x-powered-by: next\.js|__NEXT_DATA__/i,
            'React': /react-root|data-reactid/i,
            'WordPress': /wp-content|wp-includes/i,
            'Drupal': /Drupal\.settings/i,
            'jQuery': /jquery\.min\.js/i,
            'Bootstrap': /bootstrap\.min\.css/i
        };

        const headerStr = JSON.stringify(results.headers);
        for (const [tech, regex] of Object.entries(techFingerprints)) {
            if (regex.test(html) || regex.test(headerStr)) {
                results.techStack.push(tech);
            }
        }
        results.techStack = [...new Set(results.techStack)];
        if (results.techStack.length > 0) {
            this.log(`  🧬 Detected Tech: ${results.techStack.join(', ')}`);
        }
    }

    _parseNmapOutput(stdout) {
        const ports = [];
        const lines = stdout.split('\n');
        for (const line of lines) {
            if (line.startsWith('Host:')) {
                const portMatches = line.matchAll(/(\d+)\/open\/tcp\/\/([^/]*)/g);
                for (const match of portMatches) {
                    ports.push({ port: parseInt(match[1]), service: match[2].trim() });
                }
            }
        }
        return ports;
    }

}

module.exports = new PreReconAgent();

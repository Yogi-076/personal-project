/**
 * Tools Routes — PTK/Arsenal tool endpoints.
 * Covers Aether, Shodan, Tech Stack, Headers, Proxy, Arsenal Pipeline,
 * IaC Pipeline, Selenium, Gobuster, Forrecon, SAST snippet, Retire quick-scan.
 * Mounted at root in index.js.
 */
'use strict';

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;
const https = require('https');
const axios = require('axios');
const { spawn } = require('child_process');
const Wappalyzer = require('wappalyzer');
const { requireModule } = require('../middleware/saasMiddleware');
const registry = require('../services/registry');

const { sovereignShodan, gobusterService, forreconService, arsenalService, gitleaksService } = registry;

// Helper: strip ANSI terminal color codes from process output
const stripAnsi = (str) =>
    str.replace(/\x1B\[[0-9;]*[mGKHF]/g, '').replace(/\x1B\[[0-9;]*m/g, '');

// ── Aether-Core — Robust Passive / Active Recon ───────────────────────────────
router.post('/api/tools/aether/scan', requireModule('recon_aether'), async (req, res) => {
    const { target } = req.body || {};
    const shodanKey = (req.body && req.body.shodanKey) || process.env.SHODAN_API_KEY;
    if (!target) return res.status(400).json({ error: 'Target required' });

    console.log(`[Aether] Scanning target: ${target}`);

    try {
        const domain = target.replace(/(^\w+:|^)\/\//, '').split('/')[0];
        let address;
        try {
            const lookup = await dns.lookup(domain);
            address = lookup.address;
        } catch (e) {
            return res.status(400).json({ error: `Could not resolve domain: ${domain}` });
        }

        let result = { ip: address, location: 'Unknown', org: 'Unknown', ports: [], tech: [], vulns: [] };

        // Shodan (authoritative)
        if (shodanKey) {
            try {
                const shodanRes = await axios.get(
                    `https://api.shodan.io/shodan/host/${address}?key=${shodanKey}&minify=true`,
                    { timeout: 5000 }
                );
                const sData = shodanRes.data;
                result.location = `${sData.city}, ${sData.country_name}`;
                result.org = sData.org || sData.isp;
                result.ports = sData.ports || [];
                result.vulns = sData.vulns || [];
                result.tech = sData.os ? [sData.os] : [];
                if (sData.hostnames && sData.hostnames.length > 0) result.tech.push(...sData.hostnames);
                return res.json(result);
            } catch (shodanError) {
                console.warn('[Aether] Shodan Query Failed:', shodanError.response ? shodanError.response.status : shodanError.message);
            }
        }

        // Fallback: Active Recon
        console.log('[Aether] Falling back to Active Recon...');

        try {
            const geoRes = await axios.get(`http://ip-api.com/json/${address}?fields=status,country,city,org,isp`, { timeout: 3000 });
            if (geoRes.data.status === 'success') {
                result.location = `${geoRes.data.city}, ${geoRes.data.country}`;
                result.org = geoRes.data.org || geoRes.data.isp;
            }
        } catch (e) { console.warn('[Aether] GeoIP failed:', e.message); }

        const commonPorts = [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3000, 3306, 3389, 5432, 6379, 8000, 8008, 8080, 8443, 8888, 9200];
        const checkPort = (port) => new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(1500);
            socket.on('connect', () => { socket.destroy(); resolve(port); });
            socket.on('timeout', () => { socket.destroy(); resolve(null); });
            socket.on('error', () => { socket.destroy(); resolve(null); });
            socket.connect(port, address);
        });

        const portResults = await Promise.all(commonPorts.map(p => checkPort(p)));
        portResults.forEach(p => { if (p) result.ports.push(p); });

        let techSet = new Set(result.tech);
        let vulnsList = [];
        let pageTitle = '';
        const protocols = result.ports.includes(443) ? ['https'] : ['http'];
        if (result.ports.includes(80) && !protocols.includes('http')) protocols.push('http');

        for (const protocol of protocols) {
            try {
                const response = await axios.get(`${protocol}://${domain}`, {
                    timeout: 8000,
                    maxRedirects: 3,
                    validateStatus: () => true,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
                    },
                    httpsAgent: new https.Agent({ rejectUnauthorized: false })
                });

                const headers = response.headers;
                const body = typeof response.data === 'string' ? response.data : '';
                const lowerBody = body.toLowerCase();

                if (headers['server']) techSet.add(`${headers['server']} (Server)`);
                if (headers['x-powered-by']) techSet.add(`${headers['x-powered-by']} (Backend)`);
                if (headers['x-aspnet-version']) techSet.add('ASP.NET');
                if (headers['via']) techSet.add('Proxy/CDN');
                if (headers['x-generator']) techSet.add(headers['x-generator']);

                if (!headers['strict-transport-security'] && protocol === 'https') vulnsList.push('Missing HSTS (Strict-Transport-Security)');
                if (!headers['content-security-policy']) vulnsList.push('Missing Content-Security-Policy (CSP)');
                if (!headers['x-frame-options']) vulnsList.push('Missing X-Frame-Options (Clickjacking Risk)');
                if (headers['set-cookie'] && !JSON.stringify(headers['set-cookie']).includes('Secure')) vulnsList.push("Cookies missing 'Secure' flag");

                const sigs = [
                    ['wp-content', 'WordPress'], ['drupal.settings', 'Drupal'], ['joomla!', 'Joomla'], ['shopify.com', 'Shopify'],
                    ['squarespace', 'Squarespace'], ['wix.com', 'Wix'], ['react', 'React'], ['data-reactid', 'React'],
                    ['vue.js', 'Vue.js'], ['data-v-', 'Vue.js'], ['ng-version', 'Angular'], ['angular', 'Angular'],
                    ['svelte', 'Svelte'], ['next.js', 'Next.js'], ['__next', 'Next.js'], ['nuxt', 'Nuxt.js'],
                    ['backbone.js', 'Backbone.js'], ['jquery', 'jQuery'], ['alpine.js', 'Alpine.js'],
                    ['bootstrap', 'Bootstrap'], ['tailwindcss', 'Tailwind CSS'], ['bulma', 'Bulma'],
                    ['netlify', 'Netlify'], ['vercel', 'Vercel'],
                    ['google-analytics.com', 'Google Analytics'], ['gtag', 'Google Analytics'],
                    ['googletagmanager.com', 'Google Tag Manager'], ['facebook-jssdk', 'Facebook Pixel'], ['hotjar', 'Hotjar']
                ];
                sigs.forEach(([sig, name]) => { if (lowerBody.includes(sig)) techSet.add(name); });

                if (headers['cf-ray'] || headers['server']?.includes('cloudflare')) techSet.add('Cloudflare');
                if (headers['x-azure-ref']) techSet.add('Microsoft Azure');

                const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch?.[1]) pageTitle = titleMatch[1].trim();

                if (response.status < 400) break;
            } catch (e) {
                console.log(`[Aether] ${protocol} probe error: ${e.message}`);
            }
        }

        if (result.org === 'Unknown' || result.org === 'Google LLC') {
            if (pageTitle) result.org = `Hosted: ${pageTitle}`;
        }
        if (pageTitle) techSet.add(`Title: ${pageTitle}`);

        result.tech = Array.from(techSet);
        result.vulns = vulnsList.length > 0 ? vulnsList : ['No immediate misconfigurations found (Active Scan)'];

        res.json(result);

    } catch (globalError) {
        console.error('[Aether] Critical Error:', globalError);
        res.status(500).json({ error: 'Scan aborted: ' + globalError.message });
    }
});

// ── Sovereign-Shodan Endpoints ────────────────────────────────────────────────
router.post('/api/tools/shodan/scan', async (req, res) => {
    const { target } = req.body || {};
    if (!target) return res.status(400).json({ error: 'Target IP required' });
    try {
        const result = await sovereignShodan.scanHost(target);
        res.json(result);
    } catch (error) {
        if (error.response) {
            return res.status(error.response.status).json({ error: error.response.data.error || 'Shodan API Error' });
        }
        res.status(500).json({ error: error.message });
    }
});

router.post('/api/tools/shodan/monitor', async (req, res) => {
    const { cidr } = req.body || {};
    if (!cidr) return res.status(400).json({ error: 'CIDR required' });
    try {
        const result = await sovereignShodan.monitorNetwork(cidr);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ── Tech Stack Analysis (Wappalyzer) ─────────────────────────────────────────
router.post('/api/tools/analyze-stack', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });
    console.log(`[PTK] Analyzing Tech Stack for: ${url}`);
    const wappalyzer = new Wappalyzer({ debug: false, delay: 1000, maxDepth: 1, maxWait: 5000, recursive: false });
    try {
        await wappalyzer.init();
        const site = await wappalyzer.open(url);
        const results = await site.analyze();
        await wappalyzer.destroy();
        res.json(results);
    } catch (error) {
        console.error('[PTK] Wappalyzer Error:', error);
        res.status(500).json({ error: 'Tech stack analysis failed', details: error.message });
        try { await wappalyzer.destroy(); } catch (e) { /* ignore */ }
    }
});

// ── Security Headers Analysis ─────────────────────────────────────────────────
router.post('/api/tools/analyze-headers', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
        const response = await axios.head(url, { timeout: 5000, validateStatus: () => true });
        const headers = {};
        for (const [key, value] of Object.entries(response.headers)) {
            headers[key.toLowerCase()] = { value, present: true };
        }
        const securityHeaders = [
            'strict-transport-security', 'content-security-policy', 'x-frame-options',
            'x-content-type-options', 'referrer-policy', 'permissions-policy', 'x-xss-protection'
        ];
        securityHeaders.forEach(h => { if (!headers[h]) headers[h] = { present: false }; });
        res.json(headers);
    } catch (error) {
        console.error('[PTK] Headers Analysis Error:', error);
        res.status(500).json({ error: 'Headers analysis failed', details: error.message });
    }
});

// ── Request Proxy / Builder ───────────────────────────────────────────────────
router.post('/api/tools/proxy', async (req, res) => {
    const { method, url, headers, body } = req.body || {};
    console.log(`[PTK] Proxying ${method} request to: ${url}`);
    const startTime = Date.now();
    try {
        const response = await axios({
            method: method || 'GET', url, headers: headers || {}, data: body,
            timeout: 10000, validateStatus: () => true, responseType: 'text'
        });
        const duration = Date.now() - startTime;
        const iast = [];
        const respBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        if (respBody.includes('SQL syntax') || respBody.includes('mysql_fetch')) iast.push({ type: 'SQL Injection Proof', description: 'Database error message found in response' });
        if (respBody.includes('<script>alert') || respBody.includes('onerror=')) iast.push({ type: 'Reflected XSS', description: 'Unsanitized script execution detected' });
        if (response.headers['x-powered-by']) iast.push({ type: 'Information Disclosure', description: `Server version leaked: ${response.headers['x-powered-by']}` });
        res.json({ status: response.status, headers: response.headers, data: response.data, duration, iast });
    } catch (error) {
        res.status(502).json({ error: 'Target unreachable', details: error.message });
    }
});

// ── Arsenal Pipeline (Python) ─────────────────────────────────────────────────
router.post('/api/tools/arsenal-pipeline', async (req, res) => {
    const { url, depth = 3, threads = 10, highCookie, lowCookie } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Target URL is required' });

    try {
        const scanId = arsenalService.startScan(url, { depth, threads, highCookie, lowCookie });
        res.json({ scanId, message: 'Arsenal pipeline started' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/api/tools/arsenal-pipeline/status/:scanId', (req, res) => {
    const status = arsenalService.getScanStatus(req.params.scanId);
    if (!status) return res.status(404).json({ error: 'Scan not found' });
    res.json(status);
});

router.post('/api/tools/arsenal-pipeline/stop', (req, res) => {
    const stopped = arsenalService.stopScan(req.body?.scanId);
    if (stopped) res.json({ message: 'Scan stopped' });
    else res.status(400).json({ error: 'Scan not running or not found' });
});

// ── Arsenal Tool Dependency Check ─────────────────────────────────────────────
router.get('/api/tools/arsenal-check-deps', (req, res) => {
    const { spawnSync } = require('child_process');
    const tools = ['katana', 'gau', 'nuclei', 'dalfox', 'qsreplace', 'ffuf', 'gospider'];
    const results = {};
    tools.forEach(tool => {
        try {
            const result = spawnSync('where', [tool], { encoding: 'utf8', timeout: 2000 });
            results[tool] = result.status === 0 && !!result.stdout.trim();
        } catch (e) {
            results[tool] = false;
        }
    });
    res.json({ tools: results, allInstalled: Object.values(results).every(Boolean) });
});

// ── IaC Security Pipeline ─────────────────────────────────────────────────────
router.post('/api/tools/iac-pipeline', async (req, res) => {
    const { url } = req.body || {};
    const domain = url ? new URL(url).hostname.replace(/[^a-zA-Z0-9.-]/g, '_') : 'local-iac';
    const rootDir = path.join(__dirname, '..', '..');
    const outputDir = path.join(rootDir, 'arsenal_output', domain);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

    console.log(`[IAC] Spawning IaC Pipeline for: ${url || 'Local Workspace'}`);

    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Transfer-Encoding', 'chunked');

    const args = ['arsenal-core/main.py', '--phases', '5'];
    if (url) { args.push('-u', url); } else { args.push('--local', '.'); }

    const child = spawn('python', args, { cwd: rootDir, env: { ...process.env, PYTHONUNBUFFERED: '1' } });

    child.stdout.on('data', (data) => {
        data.toString().split('\n').forEach(line => {
            const clean = stripAnsi(line).trim();
            if (clean) { try { res.write(JSON.stringify({ type: 'log', data: clean }) + '\n'); } catch (e) { /* ignore */ } }
        });
    });
    child.stderr.on('data', (data) => {
        data.toString().split('\n').forEach(line => {
            const clean = stripAnsi(line).trim();
            if (clean) { try { res.write(JSON.stringify({ type: 'log', data: clean }) + '\n'); } catch (e) { /* ignore */ } }
        });
    });
    child.on('close', (code) => {
        const reportPath = path.join(outputDir, 'iac_security_report.json');
        let reportData = null;
        if (fs.existsSync(reportPath)) {
            try { reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch (e) { console.error('[IAC] Error parsing report JSON:', e); }
        }
        try { res.write(JSON.stringify({ type: 'done', report: reportData, code }) + '\n'); res.end(); } catch (e) { /* ignore */ }
    });
});

// ── IaC Dependency Check ──────────────────────────────────────────────────────
router.post('/api/tools/iac-check-deps', async (req, res) => {
    const rootDir = path.join(__dirname, '..', '..');
    const child = spawn('python', ['arsenal-core/iac_security_pipeline.py', '--check-deps'], { cwd: rootDir });
    let output = '';
    child.stdout.on('data', (data) => { output += data.toString(); });
    child.on('close', () => {
        try {
            res.json(JSON.parse(output.trim()));
        } catch (e) {
            console.error('[IAC] Dependency check failed:', output);
            res.status(500).json({ error: 'Failed to parse dependency check output' });
        }
    });
});

// ── Browser Automation Scan (Puppeteer) ───────────────────────────────────────
router.post('/api/tools/selenium/scan', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });
    const puppeteer = require('puppeteer');
    console.log(`[PTK] Starting Browser Scan for: ${url}`);
    try {
        const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const page = await browser.newPage();
        const logs = [];
        const findings = [];

        page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
        page.on('pageerror', err => logs.push({ type: 'error', text: err.message }));

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        const csp = await page.evaluate(() => {
            const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta ? meta.getAttribute('content') : null;
        });
        if (!csp) findings.push({ type: 'Missing CSP', description: 'No Content Security Policy detected via Meta tag' });

        const mixedContent = await page.evaluate(() =>
            Array.from(document.querySelectorAll('img')).map(img => img.src).filter(src => src.startsWith('http://'))
        );
        if (mixedContent.length > 0) findings.push({ type: 'Mixed Content', description: `Found ${mixedContent.length} insecure images on an HTTPS page.` });

        await browser.close();
        res.json({ findings, logs });
    } catch (error) {
        console.error('[PTK] Browser Scan Error:', error);
        res.status(500).json({ error: 'Browser scan failed', details: error.message });
    }
});

// ── Gobuster (Directory Enumeration) ─────────────────────────────────────────
router.post('/api/tools/gobuster/start', (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });
    const scanId = gobusterService.startScan(url);
    res.json({ scanId, message: 'Directory scan started' });
});

router.get('/api/tools/gobuster/status/:scanId', (req, res) => {
    const status = gobusterService.getScanStatus(req.params.scanId);
    if (!status) return res.status(404).json({ error: 'Scan not found' });
    res.json(status);
});

router.post('/api/tools/gobuster/stop', (req, res) => {
    gobusterService.stopScan(req.body?.scanId);
    res.json({ message: 'Scan stopped' });
});

// ── Forrecon-Alpha (Web Discovery Engine) ─────────────────────────────────────
router.get('/api/tools/forrecon/wordlists', (req, res) => {
    try { res.json(forreconService.getWordlists()); } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/api/tools/forrecon/report/:scanId', (req, res) => {
    try {
        const report = forreconService.generateReport(req.params.scanId);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=forrecon_report_${req.params.scanId}.txt`);
        res.send(report);
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/api/tools/forrecon/start', (req, res) => {
    const { url, threads, safeMode, wordlist } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });
    try {
        const scanId = forreconService.startScan(url, { threads, safeMode, wordlist });
        res.json({ scanId, message: 'Discovery scan started' });
    } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/api/tools/forrecon/status/:scanId', (req, res) => {
    const status = forreconService.getScanStatus(req.params.scanId);
    if (!status) return res.status(404).json({ error: 'Scan not found' });
    res.json(status);
});

router.post('/api/tools/forrecon/stop', (req, res) => {
    const stopped = forreconService.stopScan(req.body?.scanId);
    if (stopped) res.json({ message: 'Scan stopped' });
    else res.status(400).json({ error: 'Scan not running or not found' });
});

// ── SAST Snippet Analysis ─────────────────────────────────────────────────────
router.post('/api/tools/sast/analyze', (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code snippet required' });

    const patterns = [
        { pattern: /eval\s*\(/, type: 'Dangerous Eval', severity: 'Critical', desc: 'Use of eval() can lead to arbitrary code execution.' },
        { pattern: /innerHTML\s*=/, type: 'XSS Risk', severity: 'High', desc: 'Direct assignment to innerHTML can lead to XSS.' },
        { pattern: /document\.write/, type: 'XSS Risk', severity: 'Medium', desc: 'document.write is discouraged and can be dangerous.' },
        { pattern: /localStorage\.(set|get)Item/, type: 'Insecure Storage', severity: 'Low', desc: 'Sensitive data in localStorage is accessible to XSS.' },
        { pattern: /console\.log/, type: 'Debug Info', severity: 'Info', desc: 'Remove console logs in production.' },
        { pattern: /new\s+Function/, type: 'Dangerous Constructor', severity: 'Critical', desc: 'Function constructor is similar to eval().' },
        { pattern: /dangerouslySetInnerHTML/, type: 'React XSS', severity: 'High', desc: 'React dangerous property usage.' },
        { pattern: /(password|secret|key|token)\s*['"]?:\s*['"][^'"]+['"]/, type: 'Hardcoded Secret', severity: 'High', desc: 'Potential hardcoded secret detected.' }
    ];

    const findings = [];
    patterns.forEach(p => {
        const match = code.match(p.pattern);
        if (match) findings.push({ type: p.type, severity: p.severity, description: p.desc, match: match[0] });
    });

    res.json({ findings });
});

// ── Retire.js Quick Scan ──────────────────────────────────────────────────────
const VULN_DB = {
    'jquery': [{ version: '<3.5.0', id: 'CVE-2020-11022', severity: 'Medium', desc: 'Cross-site scripting in jQuery.htmlPrefilter' }, { version: '<3.5.0', id: 'CVE-2020-11023', severity: 'Medium', desc: 'XSS in jQuery due to regex issues' }],
    'bootstrap': [{ version: '<3.4.1', id: 'CVE-2019-8331', severity: 'Medium', desc: 'XSS in Bootstrap tooltip' }, { version: '<4.3.1', id: 'CVE-2019-8331', severity: 'Medium', desc: 'XSS in Bootstrap tooltip' }],
    'lodash': [{ version: '<4.17.19', id: 'CVE-2020-8203', severity: 'High', desc: 'Prototype Pollution in lodash' }],
    'react': [{ version: '<16.0.0', id: 'CVE-2019-11300', severity: 'Low', desc: 'Prop type validation bypass' }]
};

router.post('/api/tools/retire/scan', (req, res) => {
    const { libName } = req.body || {};
    if (!libName) return res.status(400).json({ error: 'Library name required' });
    const parts = libName.split('@');
    const name = parts[0].toLowerCase();
    const vulns = VULN_DB[name] ? [...VULN_DB[name]] : [];
    res.json({ vulnerabilities: vulns });
});

// ── Clickjacking Checker ──────────────────────────────────────────────────────
router.post('/api/tools/clickjacking/check', async (req, res) => {
    let { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    if (!/^https?:\/\//i.test(url)) {
        url = 'http://' + url;
    }

    try {
        const response = await axios.get(url, {
            timeout: 10000,
            validateStatus: () => true, // Accept all HTTP statuses to read headers
            maxRedirects: 5
        });

        const headers = response.headers;
        const xfo = headers['x-frame-options']?.toLowerCase();
        const csp = headers['content-security-policy']?.toLowerCase();

        let hasFrameAncestors = false;
        let vulnerable = true; // Assume vulnerable until proven otherwise

        if (csp && csp.includes('frame-ancestors')) {
            hasFrameAncestors = true;
            // A well-formed frame-ancestors directive generally protects against clickjacking
            // Even if it allows specific domains, it's not universally vulnerable.
            const directive = csp.split(';').find(d => d.trim().startsWith('frame-ancestors'));
            // If it's literally just 'frame-ancestors *', then it relies on XFO or is vulnerable
            if (directive && !directive.includes('*') || directive.split(/\s+/).length > 2) {
                vulnerable = false;
            }
        }

        if (xfo) {
            if (xfo.includes('deny') || xfo.includes('sameorigin')) {
                vulnerable = false;
            }
        }

        res.json({
            url: url,
            status: response.status,
            vulnerable: vulnerable,
            hasFrameAncestors: hasFrameAncestors,
            headers: {
                'x-frame-options': headers['x-frame-options'] || null,
                'content-security-policy': headers['content-security-policy'] || null,
                'server': headers['server'] || null
            }
        });

    } catch (error) {
        console.error('[Clickjacking] Scan Error:', error.message);
        res.status(502).json({ error: 'Target unreachable', details: error.message });
    }
});

// ── Gitleaks (Secret Scanning) ─────────────────────────────────────────────
router.post('/api/tools/gitleaks/start', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'GitHub Repo URL required' });
    try {
        const scanId = await gitleaksService.startScan(url);
        res.json({ scanId, message: 'Gitleaks scan started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/tools/gitleaks/status/:scanId', (req, res) => {
    const status = gitleaksService.getScanStatus(req.params.scanId);
    if (!status) return res.status(404).json({ error: 'Scan not found' });
    res.json(status);
});

module.exports = router;

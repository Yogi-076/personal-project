/**
 * Scan Routes — All DAST, SAST, Gray-Box, and tool-specific scan endpoints.
 * Covers Wapiti, ZAP, Nuclei, Katana, Retire, AI Hunter, and full GrayBox pipeline.
 * Mounted at root in index.js.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { requireModule } = require('../middleware/saasMiddleware');
const storage = require('../utils/storage');
const ReportTransformer = require('../utils/reportTransformer');
const authBridge = require('../services/authBridge');
const registry = require('../services/registry');

const { wapitiService, zapService, katanaService, nucleiService, retireService, sastService, aiHunter } = registry;

// ── Start Scan (Wapiti / ZAP / AI Hunter / Retire) ───────────────────────────
router.post('/api/scan/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { options = {}, projectId } = req.body || {};
        let target = (req.body.target || '').trim();

        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        // Auto-add scheme if missing (so users can type bare domains like testfire.net)
        if (!/^https?:\/\//i.test(target)) target = `http://${target}`;

        // Validate the normalized URL
        try { new URL(target); } catch (e) { return res.status(400).json({ error: `Invalid target URL: ${target}` }); }

        const scanId = uuidv4();
        const tool = (req.body.options?.tool || req.body.tool || 'wapiti').toLowerCase();
        const proxy = options.proxy || req.body.proxy;
        const fullModules = options.fullModules || req.body.fullModules;
        const spaMode = options.spaMode || req.body.spaMode;

        const scan = {
            id: scanId, projectId, target,
            type: tool === 'zap' ? 'zap' : tool === 'retire' ? 'retire' : 'wapiti',
            status: 'pending', startedAt: new Date().toISOString(), progress: 0, findings: [],
            options: { ...options, proxy, wafBypass: req.body.wafBypass, fullModules, spaMode },
            priority: options.priority || 'medium',
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        };

        await storage.saveScan(scan);

        (async () => {
            let monitorInterval;
            try {
                let toolService;
                const t = (req.body.tool || 'wapiti').toLowerCase();
                if (t === 'zap') toolService = zapService;
                else if (t === 'ai-hunter') toolService = aiHunter;
                else if (t === 'retire') toolService = retireService;
                else toolService = wapitiService;

                monitorInterval = setInterval(async () => {
                    try {
                        const data = toolService.getProgress(scanId);
                        if (data) await storage.updateScan(scanId, { progress: data.progress, logs: data.logs, findings: data.findings, summary: data.summary });
                    } catch (monitorErr) { console.error('[Scan Monitor] Error:', monitorErr.message); }
                }, 5000);

                let results;
                if (t === 'zap') {
                    results = await zapService.scan(target, options, scanId);
                } else {
                    if (options.wafBypass || req.body.wafBypass) console.log(`[Scan] WAF Bypass Mode: ENABLED for ${scanId}`);

                    let urlsFile = null;
                    if (spaMode) {
                        console.log(`[Scan] SPA Mode: ENABLED for ${scanId}. Pre-crawling with Katana...`);
                        try {
                            const katanaResults = await katanaService.crawl(target, { headless: true }, scanId);
                            if (katanaResults.urls && katanaResults.urls.length > 0) {
                                const fs = require('fs').promises;
                                const path = require('path');
                                const os = require('os');
                                const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'katana-urls-'));
                                urlsFile = path.join(tempDir, 'urls.txt');
                                await fs.writeFile(urlsFile, katanaResults.urls.join('\n'), 'utf8');
                                console.log(`[Scan] Katana returned ${katanaResults.urls.length} URLs. Written to ${urlsFile}`);
                            } else {
                                console.log(`[Scan] Katana returned 0 URLs. Falling back to default scanning.`);
                            }
                        } catch (err) {
                            console.error(`[Scan] Katana pre-crawl failed:`, err);
                        }
                    }

                    results = await wapitiService.scan(target, { ...options, wafBypass: req.body.wafBypass, fullModules, urlsFile }, scanId);

                    if (urlsFile) {
                        try {
                            const fs = require('fs').promises;
                            await fs.unlink(urlsFile);
                        } catch (e) { /* ignore */ }
                    }
                }

                clearInterval(monitorInterval);
                const finalResults = (t === 'zap' || t === 'ai-hunter') ? results : ReportTransformer.transform(results);

                await storage.updateScan(scanId, {
                    status: 'completed', completedAt: new Date().toISOString(),
                    findings: finalResults.findings, summary: finalResults.summary,
                    progress: 100, logs: toolService.getProgress(scanId).logs
                });

            } catch (error) {
                if (monitorInterval) clearInterval(monitorInterval);
                console.error('Scan error:', error);
                let errorLogs = [];
                try { errorLogs = (t === 'zap' ? zapService : wapitiService).getProgress(scanId).logs; } catch (e) { /* ignore */ }
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0, logs: errorLogs });
            }
        })();

        res.json({ scanId, message: 'Scan initiated successfully', status: 'pending' });
    } catch (error) {
        console.error('Error starting scan:', error);
        res.status(500).json({ error: 'Failed to start scan' });
    }
});

// ── Stop Scan & Parse Partial Logs ────────────────────────────────────────────
router.post('/api/scan/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const scan = await storage.getScan(id);
        if (!scan) return res.status(404).json({ error: 'Scan not found' });
        if (scan.status === 'completed' || scan.status === 'failed') return res.json({ message: 'Scan already finished', ...scan });

        let partialResults = { findings: [], summary: { total: 0 } };
        const tool = (scan.options?.tool || 'wapiti').toLowerCase();

        if (tool === 'wapiti') {
            console.log(`[Scan ${id}] Received stop signal. Terminating Wapiti...`);
            partialResults = await wapitiService.stopScan(id);
        }

        scan.status = 'completed';
        scan.completedAt = new Date().toISOString();
        scan.findings = partialResults.findings || [];
        scan.summary = partialResults.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        scan.progress = 100;

        try {
            const service = tool === 'zap' ? zapService : wapitiService;
            scan.logs = service.getProgress(id).logs;
        } catch (e) { /* ignore */ }

        await storage.updateScan(id, scan);
        res.json({ message: 'Scan stopped & partial results saved', ...scan });
    } catch (error) {
        console.error(`[Scan ${req.params.id}] Error stopping scan:`, error);
        res.status(500).json({ error: 'Failed to stop scan', details: error.message });
    }
});

// ── Start SAST Code Scan ──────────────────────────────────────────────────────
router.post('/api/scan/sast/start', requireModule('sast_pro'), async (req, res) => {
    try {
        const { repoUrl: rawRepoUrl } = req.body || {};
        const repoUrl = rawRepoUrl?.trim();
        if (!repoUrl || !repoUrl.startsWith('http')) return res.status(400).json({ error: 'Valid Git Repository URL is required' });

        const scanId = uuidv4();
        const scan = {
            id: scanId, target: repoUrl, type: 'sast', status: 'pending',
            startedAt: new Date().toISOString(), progress: 0, findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };
        await storage.saveScan(scan);

        sastService.scan(repoUrl, {}, scanId)
            .then(async results => {
                const p = sastService.getProgress(scanId);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), findings: results.findings, summary: results.summary, progress: 100, logs: p.logs || [] });
                console.log(`[SAST ${scanId}] Saved ${results.findings.length} findings`);
            })
            .catch(async error => {
                const p = sastService.getProgress(scanId);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0, logs: p.logs || [] });
            });

        res.json({ scanId, message: 'Code Analysis Initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting SAST scan:', error);
        res.status(500).json({ error: 'Failed to start code scan' });
    }
});

// ── Get Scan Status ───────────────────────────────────────────────────────────
router.get('/api/scan/status/:scanId', async (req, res) => {
    const { scanId } = req.params;
    const scan = await storage.getScan(scanId);
    if (!scan) return res.status(404).json({ error: 'Scan not found' });

    let progress = 0, logs = [];
    const type = scan.type;

    if (type === 'sast') {
        const d = sastService.getProgress(scanId); progress = d.progress; logs = d.logs;
    } else if (type === 'zap') {
        const d = zapService.getProgress(scanId); progress = d.progress; logs = d.logs;
    } else if (type === 'katana') {
        const d = katanaService.getProgress(scanId); progress = d.progress; logs = d.logs;
    } else if (type === 'nuclei') {
        const d = nucleiService.getProgress(scanId); progress = d.progress; logs = d.logs;
    } else if (type === 'graybox_full') {
        progress = scan.progress || 0; logs = scan.logs || [];
    } else if (type === 'ai-hunter') {
        const s = aiHunter.getStatus(scanId);
        if (s) { progress = s.phase === 'complete' ? 100 : 50; logs = s.logs.map(l => l.message); }
    } else {
        const d = wapitiService.getProgress(scanId); progress = d.progress; logs = d.logs;
    }

    if (progress > scan.progress) { await storage.updateScan(scanId, { progress }); scan.progress = progress; }

    res.json({ id: scan.id, target: scan.target, status: scan.status, progress: scan.progress, logs, startedAt: scan.startedAt, completedAt: scan.completedAt, error: scan.error });
});

// ── Get Scan Results ──────────────────────────────────────────────────────────
router.get('/api/scan/results/:scanId', async (req, res) => {
    const scan = await storage.getScan(req.params.scanId);
    if (!scan) return res.status(404).json({ error: 'Scan not found' });
    res.json(scan);
});

// ── Advanced DAST Scan (All Wapiti Modules) ───────────────────────────────────
router.post('/api/scan/dast/start', requireModule('dast_advanced'), async (req, res) => {
    try {
        const { target } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'dast', status: 'pending', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        wapitiService.scan(target, {}, scanId)
            .then(async wapitiResults => {
                const transformed = ReportTransformer.transform(wapitiResults);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), findings: transformed.findings, summary: transformed.summary, progress: 100 });
            })
            .catch(async error => {
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            });

        res.json({ scanId, message: 'Advanced DAST Attack Initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting DAST scan:', error);
        res.status(500).json({ error: 'Failed to start DAST scan' });
    }
});

// ── OWASP ZAP Scan ────────────────────────────────────────────────────────────
router.post('/api/scan/zap/start', requireModule('dast_advanced'), async (req, res) => {
    try {
        const { target } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'zap', status: 'pending', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        zapService.scan(target, {}, scanId)
            .then(async results => { await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), findings: results.findings, summary: results.summary, progress: 100 }); })
            .catch(async error => { await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 }); });

        res.json({ scanId, message: 'OWASP ZAP Scan Initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting ZAP scan:', error);
        res.status(500).json({ error: 'Failed to start ZAP scan' });
    }
});

// ── AI Hunter Scan ────────────────────────────────────────────────────────────
router.post('/api/scan/ai-hunter/start', async (req, res) => {
    const { target, loginUrl, username, password, selectors, wafBypass, proxy, repoName } = req.body || {};
    if (!target) return res.status(400).json({ error: 'Required: target' });

    try {
        const result = await aiHunter.startHunt({ target, loginUrl: loginUrl || target, username: username || '', password: password || '', selectors, wafBypass, proxy, repoName });
        const scanId = result.scanId;

        await storage.saveScan({ id: scanId, target, type: 'ai-hunter', status: 'running', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        const pollInterval = setInterval(async () => {
            try {
                const status = aiHunter.getStatus(scanId);
                if (!status) { clearInterval(pollInterval); return; }
                if (status.status === 'complete' || status.status === 'error') {
                    clearInterval(pollInterval);
                    const findings = (status.findings || []).map(f => ({
                        name: f.title || f.type || 'AI Finding', severity: (f.severity || 'info').toLowerCase(),
                        description: f.description || '', remediation: f.remediation || '',
                        evidence: f.evidence || '', url: f.endpoint || '', method: f.method || 'GET',
                        type: f.type || 'UNKNOWN', verified: f.verified || false, cvss: f.cvss || 0,
                        poc: f.poc || '', source: 'ai-hunter'
                    }));
                    const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
                    findings.forEach(f => { if (summary.hasOwnProperty(f.severity)) summary[f.severity]++; else summary.info++; });
                    await storage.updateScan(scanId, { status: status.status === 'complete' ? 'completed' : 'failed', completedAt: new Date().toISOString(), progress: status.status === 'complete' ? 100 : 0, findings, summary, report: status.report || null });
                }
            } catch (e) { console.error(`[AI Hunter poll] ${e.message}`); }
        }, 5000);

        res.json(result);
    } catch (error) {
        console.error('Error starting AI Hunt:', error);
        res.status(500).json({ error: error.message });
    }
});

router.get('/api/scan/ai-hunter/status/:scanId', async (req, res) => {
    const memStatus = aiHunter.getStatus(req.params.scanId);
    if (memStatus) return res.json(memStatus);
    try {
        const storedScan = await storage.getScan(req.params.scanId);
        if (storedScan) return res.json({ id: storedScan.id, status: storedScan.status, phase: storedScan.status === 'completed' ? 'complete' : storedScan.status, findings: storedScan.findings || [], logs: storedScan.logs || [], elapsed: 0 });
    } catch (e) { /* ignore */ }
    return res.status(404).json({ error: 'Scan not found' });
});

// ── Authenticated Scan (Gray Box) ─────────────────────────────────────────────
router.post('/api/scan/authenticated/start', requireModule('dast_core'), async (req, res) => {
    try {
        let { target, loginUrl, username, password, selectors, tool, fullModules, spaMode } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });
        if (!loginUrl || !username || !password) return res.status(400).json({ error: 'Authentication credentials are required for Gray Box scanning' });

        // Auto-add scheme if missing
        if (!/^https?:\/\//i.test(target)) target = `http://${target}`;
        if (!/^https?:\/\//i.test(loginUrl)) loginUrl = `http://${loginUrl}`;


        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'authenticated', status: 'authenticating', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        (async () => {
            try {
                console.log(`[Scan ${scanId}] Step 1: Authenticating...`);
                await storage.updateScan(scanId, { status: 'authenticating', progress: 10, logs: ['Initiating browser automation...', 'Navigating to login page...'] });

                const authResult = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true, timeout: 30000 });
                if (!authResult.success) throw new Error(`Authentication failed: ${authResult.error}`);

                await storage.updateScan(scanId, { status: 'scanning', progress: 20, logs: ['Login successful', `Extracted ${authResult.fullCookies.length} session cookies`, authResult.jwtHeader ? 'JWT token captured' : 'No JWT token found', 'Starting authenticated vulnerability scan...'] });

                const selectedTool = (tool || 'wapiti').toLowerCase();
                const toolService = selectedTool === 'zap' ? zapService : wapitiService;
                const scanOptions = { authSession: authResult, fullModules };

                let urlsFile = null;
                if (spaMode && selectedTool === 'wapiti') {
                    console.log(`[Scan ${scanId}] SPA Mode ENABLED. Pre-crawling with Katana...`);
                    try {
                        const katanaResults = await katanaService.crawl(target, { authSession: authResult, headless: true }, scanId);
                        if (katanaResults.urls && katanaResults.urls.length > 0) {
                            const fs = require('fs').promises;
                            const path = require('path');
                            const os = require('os');
                            const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'katana-urls-'));
                            urlsFile = path.join(tempDir, 'urls.txt');
                            await fs.writeFile(urlsFile, katanaResults.urls.join('\n'), 'utf8');
                            scanOptions.urlsFile = urlsFile;
                            console.log(`[Scan ${scanId}] Katana returned ${katanaResults.urls.length} URLs. Written to ${urlsFile}`);
                        } else {
                            console.log(`[Scan ${scanId}] Katana returned 0 URLs. Falling back to default scanning.`);
                        }
                    } catch (err) {
                        console.error(`[Scan ${scanId}] Katana pre-crawl failed:`, err);
                    }
                }

                const monitorInterval = setInterval(async () => {
                    try { const data = toolService.getProgress(scanId); if (data) await storage.updateScan(scanId, { progress: Math.max(20, data.progress), logs: data.logs }); } catch (e) { /* ignore */ }
                }, 5000);

                const results = await toolService.scan(target, scanOptions, scanId);
                clearInterval(monitorInterval);

                if (urlsFile) {
                    try {
                        const fs = require('fs').promises;
                        await fs.unlink(urlsFile);
                    } catch (e) { /* ignore */ }
                }

                const finalResults = selectedTool === 'zap' ? results : ReportTransformer.transform(results);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), findings: finalResults.findings, summary: finalResults.summary, progress: 100, logs: toolService.getProgress(scanId).logs });
                console.log(`[Scan ${scanId}] Authenticated scan completed`);

            } catch (error) {
                console.error(`[Scan ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Authenticated scan initiated', status: 'authenticating' });
    } catch (error) {
        console.error('Error starting authenticated scan:', error);
        res.status(500).json({ error: 'Failed to start authenticated scan', details: error.message });
    }
});

// ── Auth Session Status ───────────────────────────────────────────────────────
router.get('/api/auth/session-status/:scanId', async (req, res) => {
    try {
        const scan = await storage.getScan(req.params.scanId);
        if (!scan) return res.status(404).json({ error: 'Scan not found' });
        res.json({ scanId: req.params.scanId, status: scan.status, progress: scan.progress, isAuthenticated: scan.status !== 'authenticating' && scan.status !== 'failed' });
    } catch (error) {
        console.error('Error getting session status:', error);
        res.status(500).json({ error: 'Failed to get session status' });
    }
});

// ── Katana Crawl ──────────────────────────────────────────────────────────────
router.post('/api/scan/katana/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors, depth, headless } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'katana', status: 'pending', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        (async () => {
            try {
                let authSession = null;
                if (loginUrl && username && password) {
                    await storage.updateScan(scanId, { status: 'authenticating', progress: 5 });
                    authSession = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true });
                    if (!authSession.success) throw new Error(`Auth failed: ${authSession.error}`);
                    await storage.updateScan(scanId, { status: 'crawling', progress: 15 });
                }
                const crawlResult = await katanaService.crawl(target, { authSession, depth: depth || 3, headless: !!headless }, scanId);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), progress: 100, findings: crawlResult.urls.map(url => ({ name: url, severity: 'info', url })), summary: { total: crawlResult.totalUrls, info: crawlResult.totalUrls, critical: 0, high: 0, medium: 0, low: 0 }, logs: katanaService.getProgress(scanId).logs });
            } catch (error) {
                console.error(`[Katana ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Katana crawl initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting Katana crawl:', error);
        res.status(500).json({ error: 'Failed to start Katana crawl' });
    }
});

// ── Nuclei CVE Scan ───────────────────────────────────────────────────────────
router.post('/api/scan/nuclei/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors, tags, severity } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'nuclei', status: 'pending', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        (async () => {
            try {
                let authSession = null;
                if (loginUrl && username && password) {
                    await storage.updateScan(scanId, { status: 'authenticating', progress: 5 });
                    authSession = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true });
                    if (!authSession.success) throw new Error(`Auth failed: ${authSession.error}`);
                    await storage.updateScan(scanId, { status: 'scanning', progress: 15 });
                }
                const results = await nucleiService.scan(target, { authSession, tags: tags || ['cve', 'sqli', 'xss', 'rce', 'lfi', 'ssrf'], severity: severity || 'low,medium,high,critical' }, scanId);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), progress: 100, findings: results.findings, summary: results.summary, logs: nucleiService.getProgress(scanId).logs });
            } catch (error) {
                console.error(`[Nuclei ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Nuclei CVE scan initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting Nuclei scan:', error);
        res.status(500).json({ error: 'Failed to start Nuclei scan' });
    }
});

// ── Retire.js SCA Scan ────────────────────────────────────────────────────────
router.post('/api/scan/retire/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, mode } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target is required' });

        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'retire', status: 'pending', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        (async () => {
            try {
                await storage.updateScan(scanId, { status: 'scanning', progress: 10 });
                const results = await retireService.scan(target, { mode: mode || 'directory' }, scanId);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), progress: 100, findings: results.findings, summary: results.summary, logs: retireService.getProgress(scanId).logs, dependencyTree: results.dependencyTree, sbom: results.sbom });
            } catch (error) {
                console.error(`[Retire ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Retire.js SCA scan initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting Retire.js scan:', error);
        res.status(500).json({ error: 'Failed to start Retire.js scan' });
    }
});

router.get('/api/scan/retire/status/:scanId', (req, res) => { res.json(retireService.getProgress(req.params.scanId)); });
router.get('/api/scan/retire/results/:scanId', (req, res) => {
    const results = retireService.getResults(req.params.scanId);
    if (!results) return res.status(404).json({ error: 'Results not found' });
    res.json(results);
});

// ── Full Gray Box Pipeline: Auth → Katana → Nuclei → Wapiti → Merge ─────────
router.post('/api/scan/graybox/full', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors } = req.body || {};
        if (!target || !loginUrl || !username || !password) return res.status(400).json({ error: 'Target, login URL, and credentials are required for full Gray Box pipeline' });

        const scanId = uuidv4();
        await storage.saveScan({ id: scanId, target, type: 'graybox_full', status: 'authenticating', startedAt: new Date().toISOString(), progress: 0, findings: [], summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 } });

        (async () => {
            const allLogs = [];
            const log = (msg) => allLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
            try {
                log('PHASE 1: Authenticating...');
                await storage.updateScan(scanId, { status: 'authenticating', progress: 5, logs: [...allLogs] });
                const authResult = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true, timeout: 30000 });
                if (!authResult.success) throw new Error(`Authentication failed: ${authResult.error}`);
                log(`Login successful — ${authResult.fullCookies.length} cookies, JWT: ${!!authResult.jwtHeader}`);
                await storage.updateScan(scanId, { status: 'crawling', progress: 15, logs: [...allLogs] });

                log('PHASE 2: Crawling with Katana...');
                const crawlResult = await katanaService.crawl(target, { authSession: authResult, depth: 3 }, scanId + '-crawl');
                const crawledUrls = crawlResult.urls || [];
                log(`Discovered ${crawledUrls.length} URLs | Pages: ${crawlResult.categorized.pages.length} | APIs: ${crawlResult.categorized.apis.length} | Forms: ${crawlResult.categorized.forms.length}`);
                await storage.updateScan(scanId, { status: 'scanning', progress: 35, logs: [...allLogs] });

                log('PHASE 3: Nuclei CVE scanning...');
                const nucleiTargets = crawledUrls.length > 0 ? crawledUrls.slice(0, 200) : [target];
                const nucleiResults = await nucleiService.scan(nucleiTargets, { authSession: authResult, tags: ['cve', 'sqli', 'xss', 'rce', 'lfi', 'ssrf', 'misconfig'], severity: 'low,medium,high,critical' }, scanId + '-nuclei');
                log(`Nuclei found ${nucleiResults.findings.length} vulnerabilities`);
                await storage.updateScan(scanId, { status: 'scanning', progress: 65, logs: [...allLogs] });

                log('PHASE 4: Wapiti deep vulnerability scan...');
                const wapitiResults = await wapitiService.scan(target, { authSession: authResult }, scanId + '-wapiti');
                const wapitiFindings = ReportTransformer.transform(wapitiResults);
                log(`Wapiti found ${wapitiFindings.findings.length} vulnerabilities`);
                await storage.updateScan(scanId, { progress: 90, logs: [...allLogs] });

                log('PHASE 5: Merging results...');
                const allFindings = [
                    ...nucleiResults.findings.map(f => ({ ...f, source: 'nuclei' })),
                    ...wapitiFindings.findings.map(f => ({ ...f, source: 'wapiti' }))
                ];
                const seen = new Set();
                const dedupedFindings = allFindings.filter(f => {
                    const key = `${f.name}|${f.url || f.matchedAt || ''}`.toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key); return true;
                });
                const mergedSummary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
                for (const f of dedupedFindings) {
                    mergedSummary.total++;
                    const sev = (f.severity || 'info').toLowerCase();
                    if (mergedSummary.hasOwnProperty(sev)) mergedSummary[sev]++;
                }

                log(`PIPELINE COMPLETE | URLs: ${crawledUrls.length} | Findings: ${mergedSummary.total} (deduped from ${allFindings.length})`);
                await storage.updateScan(scanId, { status: 'completed', completedAt: new Date().toISOString(), progress: 100, findings: dedupedFindings, summary: mergedSummary, logs: [...allLogs], crawledUrls: crawledUrls.length });

            } catch (error) {
                log(`Pipeline error: ${error.message}`);
                console.error(`[GrayBox Pipeline ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0, logs: [...allLogs] });
            }
        })();

        res.json({ scanId, message: 'Full Gray Box pipeline initiated (Auth → Crawl → CVE Scan → Deep Scan)', status: 'authenticating', phases: ['Authentication', 'Katana Crawl', 'Nuclei CVE Scan', 'Wapiti Deep Scan', 'Result Merge'] });
    } catch (error) {
        console.error('Error starting Gray Box pipeline:', error);
        res.status(500).json({ error: 'Failed to start Gray Box pipeline' });
    }
});

// ── Scan History ──────────────────────────────────────────────────────────────
router.get('/api/scan/history', async (req, res) => {
    const scans = await storage.getAllScans();
    const history = scans.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt)).slice(0, 20);
    res.json(history);
});

router.delete('/api/scan/history', (req, res) => {
    storage.clearScans();
    res.json({ message: 'History cleared' });
});

router.delete('/api/scan/:id', async (req, res) => {
    const success = await storage.deleteScan(req.params.id);
    if (success) res.json({ message: 'Scan deleted' });
    else res.status(404).json({ error: 'Scan not found' });
});

module.exports = router;

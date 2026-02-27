const BaseAgent = require('./core/BaseAgent');
const MessageBus = require('./core/MessageBus');
const { chromium } = require('playwright');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const COORDINATOR_SYSTEM_PROMPT = require('./prompts/CoordinatorPrompt');
const AuditLogger = require('./utils/AuditLogger');
const DastEngine = require('./engines/DastEngine');
const WafBypass = require('../utils/wafBypass');

const SESSIONS_DIR = path.join(__dirname, '..', 'data', 'sessions');
if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const DESTRUCTIVE_BLACKLIST = ['delete', 'remove', 'cancel', 'logout', 'log out', 'sign out', 'unsubscribe', 'deactivate', 'close account', 'terminate', 'destroy', 'erase', 'wipe'];

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

class StrategistAgent extends BaseAgent {
    constructor() {
        super('StrategistAgent', 'COORDINATOR');
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = null;
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    async process(task) {
        if (task.type === 'START_HUNT') {
            this.scanId = task.payload.scanId;
            await this._runAutonomousHunt(task.payload);
        }
    }

    // ═══════════════════════════════════════════
    // MAIN ORCHESTRATOR — Shannon 5-Phase Pipeline
    // ═══════════════════════════════════════════
    async _runAutonomousHunt(options) {
        this.log(`🚀 Shannon Hunt initiated for ${options.target}`);

        // Initialize audit session
        AuditLogger.initSession(this.scanId, options.target);

        let browser, context, page;
        const targetOrigin = new URL(options.target).origin;
        const capturedRequests = [];
        const capturedResponses = [];

        try {
            // ── PHASE 0: PRE-RECON (external tools) ──
            this.emitPhase('pre-recon');
            this.log('🔍 Phase 0: Pre-Reconnaissance (nmap, subfinder, tech-fingerprint)');
            const preReconPromise = this.askAgent('PreReconAgent', 'START_PRERECON', {
                scanId: this.scanId, target: options.target, wafBypass: options.wafBypass, proxy: options.proxy
            }, 120000).catch(e => {
                this.log(`⚠️ Pre-Recon failed/timed out: ${e.message}`);
                return {};
            });

            // ── PHASE 1: RECONNAISSANCE ──
            this.emitPhase('recon');
            this.log('🔍 Phase 1: Reconnaissance');

            const launchArgs = ['--no-sandbox', '--disable-setuid-sandbox'];
            if (options.proxy) launchArgs.push(`--proxy-server=${options.proxy}`);

            // 1a. White-Box: Scan Repository if provided
            let repoContext = '';
            if (options.repoName) {
                this.log(`📂 White-Box: Analyzing source code in 'repos/${options.repoName}'...`);
                repoContext = await this._scanRepository(options.repoName);
            }

            browser = await chromium.launch({ headless: true, args: launchArgs });

            // 1a. Authenticate
            const sessionData = await this._authenticate(browser, options);
            context = sessionData.context;
            page = sessionData.page;

            // 1b. Setup traffic interception
            this._interceptTraffic(page, targetOrigin, capturedRequests, capturedResponses);

            // 1c. Crawl
            this.emitPhase('crawling');
            this.log('🕸️ Phase 1b: Crawling...');
            await this._crawl(page, targetOrigin);

            // ── PHASE 1.5: PTK DAST ENGINE SCANNING ──
            // Feed all captured traffic through PTK's data-driven DAST engine
            this.emitPhase('dast-scanning');
            this.log('🔬 Phase 1.5: PTK DAST Engine — Data-driven vulnerability scan');

            const scanStrategy = options.scanStrategy || 'SMART';
            const dastEngine = new DastEngine({
                scanStrategy,
                maxRequestsPerSecond: options.rateLimit || 10,
                concurrency: options.concurrency || 3,
                runCve: options.runCve !== false,
                scanPolicy: options.scanPolicy || 'ACTIVE',
                wafBypass: options.wafBypass, // Enable DAST Engine WAF bypass mechanism
                onFinding: (finding) => {
                    MessageBus.publish('DAST_FINDING', 'DastEngine', 'AIHunterService', {
                        scanId: this.scanId,
                        finding
                    }, 'HIGH');
                },
                onProgress: (progress) => {
                    MessageBus.publish('DAST_PROGRESS', 'DastEngine', 'AIHunterService', {
                        scanId: this.scanId,
                        stats: progress.stats,
                        type: progress.type
                    }, 'LOW');
                }
            });

            const moduleSummary = dastEngine.getModuleNames();
            this.log(`📦 DAST Engine loaded: ${moduleSummary.length} modules, ${moduleSummary.reduce((s, m) => s + m.attackCount, 0)} attacks (${scanStrategy} strategy)`);

            // Feed each captured request into the DAST engine
            let dastRequestsScanned = 0;
            const dastPromises = [];
            for (const req of capturedRequests) {
                dastPromises.push(
                    dastEngine.scanRequest(req).then(result => {
                        dastRequestsScanned++;
                        if (result.findings?.length) {
                            this.log(`🎯 DAST found ${result.findings.length} vulns in ${req.method} ${new URL(req.url).pathname}`);
                        }
                    }).catch(err => {
                        this.log(`⚠️ DAST scan error on ${req.url}: ${err.message}`);
                    })
                );
            }
            await Promise.all(dastPromises);

            const dastReport = dastEngine.getReport();
            this.log(`📊 DAST Engine complete: ${dastReport.stats.findingsCount} findings (${dastReport.stats.high}H/${dastReport.stats.medium}M/${dastReport.stats.low}L) from ${dastRequestsScanned} requests`);

            // Store DAST report for later merging
            AuditLogger.logAgent(this.scanId, options.target, 'DastEngine', JSON.stringify(dastReport.stats));

            // ── PHASE 2: VULNERABILITY ANALYSIS (AI Planning) ──
            this.emitPhase('planning');
            this.log('🧠 Phase 2: AI-Driven Vulnerability Analysis');

            // Collect Pre-Recon results
            const preReconData = await preReconPromise || {};

            const cookies = await context.cookies();
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            const reconData = {
                endpoints: this._deduplicateEndpoints(capturedRequests).slice(0, 50),
                responses: capturedResponses.slice(0, 20).map(r => ({
                    url: r.url, status: r.status,
                    bodyPreview: r.body.substring(0, 300)
                })),
                cookies: cookies.map(c => ({ name: c.name, secure: c.secure, httpOnly: c.httpOnly })),
                techStack: preReconData.techStack || [],
                ports: preReconData.ports || [],
                subdomains: preReconData.subdomains || [],
                serverInfo: preReconData.serverInfo || null
            };

            // Fallback: If no endpoints captured (e.g. WAF blocked crawling), add the target itself
            if (reconData.endpoints.length === 0) {
                this.log('⚠️ No endpoints captured. Adding target URL as fallback for AI planning.');
                reconData.endpoints.push({
                    url: options.target,
                    method: 'GET',
                    headers: {},
                    postData: null
                });
            }

            const plan = await this._aiGeneratePlan(reconData, options.target, repoContext);

            // ── PHASE 2.5: IDOR CANDIDATE INJECTION ──
            if (options.userBSession) {
                const idorCandidates = this._identifyIdorCandidates(capturedRequests);
                if (idorCandidates.length > 0) {
                    this.log(`🕵️ Detected ${idorCandidates.length} IDOR candidates — dispatching to IdorAgent`);
                    if (!plan.execution_plan) plan.execution_plan = [];
                    idorCandidates.forEach(ep => {
                        plan.execution_plan.push({
                            agent: 'IdorAgent', priority: 'HIGH',
                            payload: {
                                objective: `Test IDOR on ${ep.url}`,
                                url: ep.url,
                                originalMethod: ep.method,
                                userASession: cookieString,
                                userBSession: options.userBSession,
                            }
                        });
                    });
                }
            }

            // ── PHASE 3: EXPLOITATION (Dispatch to Agents) ──
            this.emitPhase('attacking');
            this.log('⚔️ Phase 3: Exploitation — Dispatching to agents');

            if (plan && plan.execution_plan && plan.execution_plan.length > 0) {
                this.log(`📋 Dispatching ${plan.execution_plan.length} tasks`);
                for (const task of plan.execution_plan) {
                    // Enrich payload with session data
                    task.payload.cookies = task.payload.cookies || cookieString;
                    task.payload.scanId = this.scanId;

                    // Safety check
                    const objective = (task.payload.objective || '').toLowerCase();
                    if (DESTRUCTIVE_BLACKLIST.some(b => objective.includes(b))) {
                        this.log(`🛡️ Blocked destructive task: ${task.payload.objective}`);
                        continue;
                    }

                    this.sendMessage('TASK_ASSIGNED', task.agent, task.payload, task.priority || 'MEDIUM');
                    this.log(`  → ${task.agent}: ${task.payload.objective}`);
                }
            } else {
                this.log('⚠️ AI generated no tasks. Attack surface may be minimal.');
            }

            // Phase 4 (Reporting) is triggered by aiHunterService when all agents complete

        } catch (err) {
            this.log(`❌ Strategist Error: ${err.message}`);
        } finally {
            if (browser) await browser.close();
        }
    }

    // ═══════════════════════════════════════════
    // PHASE 1 HELPERS
    // ═══════════════════════════════════════════
    async _authenticate(browser, options) {
        const sessionFile = path.join(SESSIONS_DIR, `${Buffer.from(options.target).toString('base64').substring(0, 20)}.json`);
        let context, page;

        // Determine User-Agent
        let userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        if (options.wafBypass) {
            const wb = new WafBypass();
            userAgent = wb.getRandomUA();
            this.log(`🛡️ WAF Bypass: Crawling with UA: ${userAgent.substring(0, 50)}...`);
        }

        // Try saved session
        if (fs.existsSync(sessionFile)) {
            this.log('📂 Loading saved session...');
            const state = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            context = await browser.newContext({
                ignoreHTTPSErrors: true,
                storageState: state,
                userAgent
            });
            page = await context.newPage();
            await page.goto(options.target, { waitUntil: 'networkidle', timeout: 20000 });
            if (!page.url().includes('login')) {
                this.log('✅ Session restored');
                return { context, page };
            }
            this.log('⚠️ Session expired, re-authenticating...');
            await context.close();
        }

        // Fresh context
        context = await browser.newContext({
            ignoreHTTPSErrors: true,
            userAgent
        });
        page = await context.newPage();

        // Login
        if (options.username && options.password) {
            try {
                await page.goto(options.loginUrl || options.target, { waitUntil: 'networkidle', timeout: 30000 });
                const userField = await this._findField(page, 'username');
                const passField = await this._findField(page, 'password');
                const submitBtn = await this._findButton(page);

                if (userField && passField && submitBtn) {
                    await userField.click(); await userField.type(options.username, { delay: 30 });
                    await passField.click(); await passField.type(options.password, { delay: 30 });
                    await page.waitForTimeout(500);
                    await Promise.race([
                        Promise.all([page.waitForNavigation({ timeout: 15000 }).catch(() => null), submitBtn.click()]),
                        page.waitForTimeout(15000)
                    ]);
                    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
                }

                const state = await context.storageState();
                fs.writeFileSync(sessionFile, JSON.stringify(state));
                this.log('✅ Authenticated & session saved');
            } catch (e) {
                this.log(`⚠️ Auth attempt finished: ${e.message}`);
            }
        } else {
            try {
                await page.goto(options.target, { waitUntil: 'domcontentloaded', timeout: 60000 });
            } catch (e) {
                if (e.message.includes('Timeout')) {
                    this.log(`❌ Navigation timed out (60s). Site is too slow or blocking headless browser.`);
                } else if (e.message.includes('ERR_CONNECTION_TIMED_OUT')) {
                    this.log(`❌ Network Error: Connection timed out. Check firewall/VPN.`);
                } else {
                    this.log(`⚠️ Navigation to ${options.target} failed: ${e.message}`);
                }
                // Proceed anyway, might be partial load or WAF block
            }
        }

        return { context, page };
    }

    _interceptTraffic(page, targetOrigin, capturedRequests, capturedResponses) {
        page.on('request', req => {
            const url = req.url();
            if (this._isApiRequest(url)) {
                capturedRequests.push({
                    url, method: req.method(),
                    headers: req.headers(),
                    postData: req.postData() || null,
                    resourceType: req.resourceType()
                });
            }
        });

        page.on('response', async res => {
            const url = res.url();
            if (this._isApiRequest(url)) {
                try {
                    const body = await res.text().catch(() => '');
                    capturedResponses.push({
                        url, status: res.status(),
                        headers: res.headers(),
                        body: body.substring(0, 5000),
                        contentType: res.headers()['content-type'] || ''
                    });
                } catch (e) { }
            }
        });
    }

    async _crawl(page, targetOrigin) {
        const visitedUrls = new Set([page.url()]);
        const urlQueue = [];
        await this._extractLinks(page, targetOrigin, visitedUrls, urlQueue, 0);

        let pagesVisited = 0;
        const maxPages = 30;
        while (urlQueue.length > 0 && pagesVisited < maxPages) {
            const { url: nextUrl, depth } = urlQueue.shift();
            if (depth > 3 || visitedUrls.has(nextUrl)) continue;
            visitedUrls.add(nextUrl);
            try {
                await page.goto(nextUrl, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => { });
                pagesVisited++;
                await this._extractLinks(page, targetOrigin, visitedUrls, urlQueue, depth + 1);
            } catch (e) { }
        }
        this.log(`📊 Crawled ${pagesVisited} pages, captured ${visitedUrls.size} URLs`);
    }

    // ═══════════════════════════════════════════
    // PHASE 2 HELPERS
    // ═══════════════════════════════════════════
    async _aiGeneratePlan(reconData, target, repoContext = '') {
        if (!this.genAI) {
            this.log('⚠️ No API key — generating offline plan');
            return this._offlinePlan(reconData);
        }

        let prompt = `RECON DATA from ${target}:\n${JSON.stringify(reconData, null, 2)}\n\n`;
        if (repoContext) {
            prompt += `SOURCE CODE ANALYSIS (White-Box Insights):\n${repoContext}\n\n`;
        }
        prompt += `Analyze and generate a comprehensive execution plan.`;

        // Try each model with smart quota detection
        for (const modelName of MODELS_TO_TRY) {
            try {
                this.log(`📡 Strategist connected to ${modelName} (online)`);
                const model = this.genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent(prompt + COORDINATOR_SYSTEM_PROMPT);
                const response = await result.response;
                const text = response.text();

                const plan = this._extractJson(text);
                if (plan && plan.execution_plan && plan.execution_plan.length > 0) {
                    return plan;
                }
                this.log(`⚠️ AI returned empty plan for ${modelName}`);
            } catch (e) {
                const errMsg = e.message || '';
                this.log(`⚠️ Model ${modelName} failed: ${errMsg.substring(0, 100)}`);
            }
        }

        this.log('⚠️ AI planning failed or empty — engaging deterministic fallback');
        return this._offlinePlan(reconData);
    }

    _offlinePlan(reconData) {
        const plan = { thoughts: 'Deterministic fallback — enforcing proactive probing', execution_plan: [] };

        // Ensure we have at least the target URL
        const endpoints = reconData.endpoints.length > 0 ? reconData.endpoints : [{ url: reconData.target, method: 'GET' }];

        for (const ep of endpoints) {
            const baseUrl = ep.url.split('?')[0];

            // 1. Baseline Fuzzing: Always test root/endpoints for XSS/SQLi even if no params
            plan.execution_plan.push({
                agent: 'XssAgent', priority: 'HIGH',
                payload: { url: ep.url, method: ep.method, params: this._parseParams(ep.url), objective: `Proactive XSS probe: ${baseUrl}` }
            });

            plan.execution_plan.push({
                agent: 'SqlInjectionAgent', priority: 'HIGH',
                payload: { url: ep.url, method: ep.method, params: this._parseParams(ep.url), objective: `Proactive SQLi probe: ${baseUrl}` }
            });

            // 2. Auth & Admin Probing: Always look for hidden panels
            plan.execution_plan.push({
                agent: 'AuthBypassAgent', priority: 'MEDIUM',
                payload: { url: ep.url, method: ep.method, params: this._parseParams(ep.url), objective: `Discovery: check for /admin, /config, /api on ${baseUrl}` }
            });

            // 3. SSRF for URL-like indicators
            if (ep.url.includes('url=') || ep.url.includes('link=') || ep.url.includes('src=')) {
                plan.execution_plan.push({
                    agent: 'SsrfAgent', priority: 'HIGH',
                    payload: { url: ep.url, method: ep.method, params: this._parseParams(ep.url), objective: `SSRF probe: ${baseUrl}` }
                });
            }
        }

        // De-duplicate if target was in endpoints
        return plan;
    }

    // ═══════════════════════════════════════════
    // UTILITY METHODS
    // ═══════════════════════════════════════════
    async _scanRepository(repoName) {
        const repoPath = path.resolve(__dirname, '..', '..', 'repos', repoName);
        this.log(`🔍 Checking repo path: ${repoPath}`);
        if (!fs.existsSync(repoPath)) {
            this.log(`⚠️ Repo directory '${repoName}' not found in ./repos/`);
            return 'Repository folder missing.';
        }

        try {
            const files = this._listAllFiles(repoPath);
            let context = `File Structure:\n${files.slice(0, 50).join('\n')}\n`;

            // Read key files
            const keyFiles = ['package.json', 'README.md', 'routes.js', 'app.js', 'index.js', 'server.js'];
            for (const keyFile of keyFiles) {
                const fullPath = path.join(repoPath, keyFile);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf8');
                    context += `\n--- ${keyFile} ---\n${content.substring(0, 2000)}\n`;
                }
            }
            return context;
        } catch (e) {
            this.log(`⚠️ Repo analysis failed: ${e.message}`);
            return 'Analysis error.';
        }
    }

    _listAllFiles(dir, baseDir = dir) {
        let results = [];
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                if (!file.includes('node_modules') && !file.includes('.git')) {
                    results = results.concat(this._listAllFiles(fullPath, baseDir));
                }
            } else {
                results.push(path.relative(baseDir, fullPath));
            }
        });
        return results;
    }

    _extractJson(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            this.log(`⚠️ JSON extraction failed: ${e.message}`);
        }
        return null;
    }

    _isApiRequest(url) {
        return url.includes('/api/') || url.includes('/v1/') || url.includes('/v2/') ||
            url.includes('.json') || url.includes('/graphql') || url.includes('/action') ||
            url.includes('/rest/');
    }

    _identifyIdorCandidates(requests) {
        return requests.filter(req => {
            const url = req.url;
            const hasNumericId = /\/\d+(\?|\/|$)/.test(url);
            const hasUuid = /\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-/.test(url);
            const hasIdParam = /[?&](id|user_id|account_id|order_id)=\d+/.test(url);
            const interestingMethod = ['GET', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
            return interestingMethod && (hasNumericId || hasUuid || hasIdParam);
        });
    }

    _deduplicateEndpoints(requests) {
        const seen = new Set();
        return requests.filter(req => {
            const key = `${req.method}:${req.url.split('?')[0]}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    _parseParams(url) {
        try {
            const urlObj = new URL(url);
            const params = {};
            urlObj.searchParams.forEach((val, key) => { params[key] = val; });
            return params;
        } catch { return {}; }
    }

    async _extractLinks(page, targetOrigin, visitedUrls, queue, depth) {
        try {
            const links = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('a[href]')).map(a => a.href);
            });
            for (const href of links) {
                try {
                    const url = new URL(href, targetOrigin);
                    if (url.origin === targetOrigin && !visitedUrls.has(url.href)) {
                        queue.push({ url: url.href, depth });
                    }
                } catch (e) { }
            }
        } catch (e) { }
    }

    async _findField(page, type) {
        const selectors = type === 'password'
            ? ['input[type="password"]']
            : ['input[type="email"]', 'input[name="username"]', 'input[name="email"]', 'input[type="text"]'];
        for (const sel of selectors) {
            const el = page.locator(sel).first();
            if (await el.isVisible().catch(() => false)) return el;
        }
        return null;
    }

    async _findButton(page) {
        const selectors = ['button[type="submit"]', 'input[type="submit"]', 'form button'];
        for (const sel of selectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible().catch(() => false)) return el;
            } catch (e) { }
        }
        return null;
    }
}

module.exports = new StrategistAgent();

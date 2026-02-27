/**
 * DastEngine.js — Server-side port of PTK's dastEngine.js
 * 
 * Drives data-driven DAST scanning using JSON module definitions,
 * per-param atomic attack generation, JSONLogic validation,
 * scan strategies (FAST/SMART/COMPREHENSIVE), rate limiting,
 * and scan result envelopes.
 * 
 * Ported from: pentestkit_ref/src/ptk/background/dast/dastEngine.js
 * HTTP execution: Axios (replaces browser fetch)
 */

const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { DastModule, attackId, attackParamId } = require('./DastModule');
const WafBypass = require('../../utils/wafBypass');

// ── Scan Strategy Configurations ──
const DEFAULT_SCAN_STRATEGY = 'SMART';
const SCAN_STRATEGY_CONFIGS = {
    FAST: {
        strategy: 'FAST',
        atomic: true,
        stopOnFirstFinding: true,
        dedupeScope: 'url-module'
    },
    SMART: {
        strategy: 'SMART',
        atomic: false,
        stopOnFirstFinding: true,
        dedupeScope: 'url-param-module'
    },
    COMPREHENSIVE: {
        strategy: 'COMPREHENSIVE',
        atomic: false,
        stopOnFirstFinding: false,
        dedupeScope: null
    }
};

// ── Axios instance (skip TLS verification for pentest targets) ──
const httpClient = axios.create({
    timeout: 15000,
    maxRedirects: 5,
    validateStatus: () => true, // Accept all HTTP status codes
    httpsAgent: new https.Agent({ rejectUnauthorized: false })
    // User-Agent is now set per-request via WAF bypass rotation
});

class DastEngine {
    /**
     * @param {Object} settings
     * @param {number} settings.maxRequestsPerSecond - Rate limit (default 10)
     * @param {number} settings.concurrency - Parallel attack tasks (default 3)
     * @param {string} settings.scanStrategy - FAST | SMART | COMPREHENSIVE
     * @param {boolean} settings.runCve - Include CVE modules
     * @param {string} settings.scanPolicy - ACTIVE | PASSIVE | RECON
     * @param {Function} settings.onFinding - Callback when finding discovered
     * @param {Function} settings.onProgress - Callback for progress updates
     */
    constructor(settings = {}) {
        this.settings = settings;
        this.maxRequestsPerSecond = settings.maxRequestsPerSecond || 10;
        this.concurrency = settings.concurrency || 3;
        this.onFinding = settings.onFinding || (() => { });
        this.onProgress = settings.onProgress || (() => { });

        const requestedStrategy = settings.scanStrategy || DEFAULT_SCAN_STRATEGY;
        this.strategyConfig = this._resolveStrategyConfig(requestedStrategy);
        this.scanStats = this._createStrategyStats(this.strategyConfig.strategy);

        // WAF Bypass
        this.wafBypassEnabled = !!settings.wafBypass;
        this._wafBypass = this.wafBypassEnabled ? new WafBypass() : null;
        if (this.wafBypassEnabled) {
            console.log('[DAST Engine] 🛡️ WAF Bypass Mode: ENABLED');
        }

        // State
        this._modules = [];
        this._modulesLoaded = false;
        this._fingerprintSet = new Set();
        this._uniqueAttackSuccess = new Set();
        this._passiveUniqueFindingKeys = new Set();
        this._strategyFindingKeys = new Set();

        // Rate limiter
        this.tokens = this.maxRequestsPerSecond;
        this.lastRefill = Date.now();
        this.tokenRefillInterval = 1000;

        // Scan result envelope
        this.scanResult = this._createScanResult();

        // Load modules
        this._loadModules(settings);
    }

    // ═══════════════════════════════════════════
    // Module Loading
    // ═══════════════════════════════════════════

    _loadModules(settings = {}) {
        const rulesDir = path.join(__dirname, 'rules');
        const policy = String(settings.scanPolicy || 'ACTIVE').toUpperCase();

        try {
            const baseJson = JSON.parse(fs.readFileSync(path.join(rulesDir, 'dast_modules.json'), 'utf8'));
            let moduleDefs = Array.isArray(baseJson.modules) ? baseJson.modules : [];

            // Optionally merge CVE modules
            if (settings.runCve) {
                try {
                    const cveJson = JSON.parse(fs.readFileSync(path.join(rulesDir, 'dast_modules_cve.json'), 'utf8'));
                    const cveModules = Array.isArray(cveJson.modules) ? cveJson.modules : [];
                    moduleDefs = this._mergeModuleDefinitions(moduleDefs, cveModules);
                } catch (e) {
                    console.warn('[DAST Engine] CVE modules not found, skipping');
                }
            }

            // Policy filter
            if (policy === 'RECON' || policy === 'PASSIVE' || policy === 'RECONNAISSANCE') {
                moduleDefs = moduleDefs.filter(m => (m?.type || '').toLowerCase() === 'passive');
            }

            this._modules = moduleDefs.map(m => new DastModule(m));
            this._modulesLoaded = true;
            console.log(`[DAST Engine] Loaded ${this._modules.length} attack modules (policy: ${policy}, strategy: ${this.strategyConfig.strategy})`);
        } catch (e) {
            console.error('[DAST Engine] Failed to load modules:', e.message);
            this._modules = [];
        }
    }

    _mergeModuleDefinitions(base = [], extra = []) {
        const merged = base.slice();
        const idIndex = new Map();
        merged.forEach((mod, idx) => { if (mod?.id) idIndex.set(mod.id, idx); });
        extra.forEach(mod => {
            if (!mod) return;
            if (mod.id && idIndex.has(mod.id)) merged[idIndex.get(mod.id)] = mod;
            else {
                if (mod?.id) idIndex.set(mod.id, merged.length);
                merged.push(mod);
            }
        });
        return merged;
    }

    // ═══════════════════════════════════════════
    // Scan Result Envelope
    // ═══════════════════════════════════════════

    _createScanResult() {
        return {
            engine: 'DAST',
            version: '1.0',
            scanId: crypto.randomUUID(),
            host: null,
            startedAt: new Date().toISOString(),
            finishedAt: null,
            settings: { scanStrategy: this.strategyConfig?.strategy || DEFAULT_SCAN_STRATEGY },
            stats: { high: 0, medium: 0, low: 0, info: 0, attacksCount: 0, findingsCount: 0 },
            scanStats: this._createStrategyStats(this.strategyConfig?.strategy),
            findings: [],
            requests: []
        };
    }

    // ═══════════════════════════════════════════
    // Raw Request Parsing (Playwright → PTK schema)
    // ═══════════════════════════════════════════

    /**
     * Convert a Playwright intercepted request into PTK schema format.
     * @param {Object} intercepted - { method, url, headers, postData }
     * @returns {Object} PTK schema { request: { method, url, headers[], queryParams[], body, cookies } }
     */
    parseInterceptedRequest(intercepted) {
        const urlObj = new URL(intercepted.url);
        const headers = [];
        if (intercepted.headers) {
            for (const [name, value] of Object.entries(intercepted.headers)) {
                headers.push({ name, value });
            }
        }

        const queryParams = [];
        urlObj.searchParams.forEach((value, name) => {
            queryParams.push({ name, value });
        });

        const body = {};
        if (intercepted.postData) {
            const ct = (intercepted.headers?.['content-type'] || intercepted.headers?.['Content-Type'] || '').toLowerCase();
            if (ct.includes('application/json')) {
                try { body.json = JSON.parse(intercepted.postData); } catch { /* ignore */ }
                body.text = intercepted.postData;
            } else if (ct.includes('application/x-www-form-urlencoded')) {
                body.params = [];
                const sp = new URLSearchParams(intercepted.postData);
                sp.forEach((value, name) => { body.params.push({ name, value }); });
                body.text = intercepted.postData;
            } else {
                body.text = intercepted.postData;
            }
        }

        return {
            request: {
                method: (intercepted.method || 'GET').toUpperCase(),
                url: intercepted.url,
                baseUrl: urlObj.origin,
                headers,
                queryParams,
                body: Object.keys(body).length ? body : undefined,
                cookies: this._parseCookiesFromHeaders(headers)
            }
        };
    }

    _parseCookiesFromHeaders(headers) {
        const cookieHeader = headers.find(h => (h.name || '').toLowerCase() === 'cookie');
        if (!cookieHeader) return [];
        return cookieHeader.value.split(';').map(part => {
            const eq = part.indexOf('=');
            if (eq === -1) return null;
            return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
        }).filter(Boolean);
    }

    // ═══════════════════════════════════════════
    // HTTP Execution (Axios-based, replaces browser fetch)
    // ═══════════════════════════════════════════

    async executeOriginal(schema) {
        try {
            const result = await this._sendRequest(schema);
            return {
                request: {
                    ...schema.request,
                    raw: this._schemaToRaw(schema)
                },
                response: result
            };
        } catch (e) {
            console.error('[DAST Engine] executeOriginal failed:', e.message);
            return null;
        }
    }

    async activeAttack(schema) {
        try {
            const result = await this._sendRequest(schema);
            return {
                ...schema,
                request: {
                    ...schema.request,
                    raw: this._schemaToRaw(schema)
                },
                response: result,
                statusCode: result.statusCode,
                length: result.body?.length || 0,
                timeMs: result.timeMs
            };
        } catch (e) {
            return null;
        }
    }

    async _sendRequest(schema) {
        // Wait for rate limit token
        await this._waitForToken();

        const req = schema.request;
        const headersObj = {};
        (req.headers || []).forEach(h => { headersObj[h.name] = h.value; });

        // ── WAF Bypass: Apply evasion headers and jitter ──
        if (this._wafBypass) {
            const bypassHeaders = this._wafBypass.getRandomHeaders(req.url);
            // Apply bypass headers (don't override explicitly set headers)
            for (const [key, value] of Object.entries(bypassHeaders)) {
                if (!headersObj[key] && !headersObj[key.toLowerCase()]) {
                    headersObj[key] = value;
                }
            }
            // Adaptive jitter delay
            const delay = this._wafBypass.getAdaptiveDelay();
            await this._wafBypass.applyJitter(delay.min, delay.max);
        } else {
            // Default UA when WAF bypass is off
            if (!headersObj['User-Agent'] && !headersObj['user-agent']) {
                headersObj['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
            }
        }

        let data = undefined;
        if (req.body) {
            if (req.body.json) data = req.body.json;
            else if (req.body.text) data = req.body.text;
            else if (req.body.params) {
                const sp = new URLSearchParams();
                req.body.params.forEach(p => sp.append(p.name, p.value));
                data = sp.toString();
                if (!headersObj['Content-Type'] && !headersObj['content-type']) {
                    headersObj['Content-Type'] = 'application/x-www-form-urlencoded';
                }
            }
        }

        const startTime = Date.now();
        const response = await httpClient({
            method: req.method || 'GET',
            url: req.url,
            headers: headersObj,
            data
        });

        const result = {
            statusCode: response.status,
            headers: response.headers,
            body: typeof response.data === 'string' ? response.data : JSON.stringify(response.data),
            timeMs: Date.now() - startTime,
            length: typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length
        };

        // ── WAF detection on response ──
        if (this._wafBypass) {
            const waf = this._wafBypass.detectWaf(result);
            if (waf && this._wafBypass._blockedCount === 1) {
                console.log(`[DAST Engine] ⚠️ WAF detected: ${waf} — adapting evasion strategy`);
            }
        }

        return result;
    }

    _schemaToRaw(schema) {
        const req = schema.request;
        const urlObj = new URL(req.url);
        const requestLine = `${req.method} ${urlObj.pathname}${urlObj.search} HTTP/1.1`;
        const headers = (req.headers || []).map(h => `${h.name}: ${h.value}`).join('\r\n');
        let raw = `${requestLine}\r\nHost: ${urlObj.host}\r\n${headers}\r\n\r\n`;
        if (req.body?.text) raw += req.body.text;
        return raw;
    }

    // ═══════════════════════════════════════════
    // Rate Limiter (Token Bucket)
    // ═══════════════════════════════════════════

    _canSendRequest() {
        const now = Date.now();
        if (now - this.lastRefill > this.tokenRefillInterval) {
            this.tokens = this.maxRequestsPerSecond;
            this.lastRefill = now;
        }
        if (this.tokens > 0) {
            this.tokens--;
            return true;
        }
        return false;
    }

    async _waitForToken() {
        while (!this._canSendRequest()) {
            await new Promise(r => setTimeout(r, 20));
        }
    }

    // ═══════════════════════════════════════════
    // Fingerprinting & Deduplication
    // ═══════════════════════════════════════════

    _fingerprint(intercepted) {
        try {
            const urlObj = new URL(intercepted.url);
            const method = (intercepted.method || 'GET').toUpperCase();
            const queryNames = new Set();
            urlObj.searchParams.forEach((_, key) => queryNames.add(key.toLowerCase()));
            const querySig = Array.from(queryNames).sort().join('&');
            return `${method}|${urlObj.host}|${urlObj.pathname}|${querySig}`;
        } catch {
            return '';
        }
    }

    isDuplicate(intercepted) {
        const fp = this._fingerprint(intercepted);
        if (!fp) return true;
        if (this._fingerprintSet.has(fp)) return true;
        this._fingerprintSet.add(fp);
        return false;
    }

    // ═══════════════════════════════════════════
    // Attack Plan Builder (core PTK logic)
    // ═══════════════════════════════════════════

    /**
     * Build attack plan for a given request.
     * @param {Object} schema - PTK request schema (from parseInterceptedRequest)
     * @returns {Object|null} Attack plan { id, schema, original, tasks[] }
     */
    async buildAttackPlan(schema) {
        if (!this._modulesLoaded) return null;

        const original = await this.executeOriginal(schema);
        if (!original) return null;

        const planFingerprint = this._fingerprint(schema.request);
        const plan = {
            id: attackId(),
            schema,
            original,
            tasks: [],
            fingerprint: planFingerprint
        };

        for (const module of this._modules) {
            if (!Array.isArray(module.attacks)) continue;

            const moduleSupportsAtomic = this._moduleSupportsAtomic(module);

            for (const attackDef of module.attacks) {
                const attack = module.prepareAttack(attackDef);

                // Check pre-conditions
                if (attack.condition && module.async !== false) {
                    const _a = { metadata: Object.assign({}, attack, module.metadata) };
                    if (!module.validateAttackConditions(_a, original)) continue;
                }

                if (module.type === 'active') {
                    const attackMode = this._shouldUseBulkAttack(moduleSupportsAtomic) ? { mode: 'bulk' } : undefined;
                    const attackRequests = module.buildAttacks(schema, attack, attackMode);

                    for (const req of attackRequests) {
                        // Enrich with module metadata
                        req.metadata = Object.assign({}, req.metadata || {}, module.metadata, attack);

                        const task = {
                            id: attackId(),
                            type: 'active',
                            module,
                            moduleId: module.id,
                            moduleName: module.name,
                            moduleAsync: module.async !== false,
                            attack,
                            attackKey: attack.id || attack.name || `${module.id}:${attackId()}`,
                            payload: req,
                            order: plan.tasks.length
                        };
                        plan.tasks.push(task);
                    }
                } else if (module.type === 'passive') {
                    const passivePayload = { metadata: Object.assign({}, attack, module.metadata) };
                    const task = {
                        id: attackId(),
                        type: 'passive',
                        module,
                        moduleId: module.id,
                        moduleName: module.name,
                        moduleAsync: module.async !== false,
                        attack,
                        attackKey: attack.id || attack.name || `${module.id}:${attackId()}`,
                        payload: passivePayload,
                        order: plan.tasks.length
                    };
                    plan.tasks.push(task);
                }
            }
        }

        return plan;
    }

    // ═══════════════════════════════════════════
    // Task Execution
    // ═══════════════════════════════════════════

    /**
     * Execute all tasks in an attack plan.
     * @param {Object} plan - from buildAttackPlan()
     * @returns {Object[]} Array of findings
     */
    async executePlan(plan) {
        if (!plan || !plan.tasks.length) return [];

        const findings = [];
        const concurrency = Math.max(1, this.concurrency);
        const tasks = [...plan.tasks];
        const workers = new Set();

        const launch = () => {
            const task = tasks.shift();
            if (!task) return null;
            const runner = (async () => {
                try {
                    const result = await this._runTask(task, plan.original);
                    if (result) findings.push(result);
                } catch (err) {
                    console.error(`[DAST] Task failed: ${task.moduleName}/${task.attackKey}`, err.message);
                }
            })();
            workers.add(runner);
            runner.finally(() => workers.delete(runner));
            return runner;
        };

        while (tasks.length || workers.size) {
            while (workers.size < concurrency && tasks.length) launch();
            if (workers.size) await Promise.race(workers);
        }
        await Promise.all(workers);

        return findings;
    }

    async _runTask(task, original) {
        // Strategy dedup
        if (this._shouldSkipDueToStrategy(task)) return null;

        this.scanStats.totalJobsExecuted++;

        if (task.type === 'active') {
            const executed = await this.activeAttack(task.payload);
            if (!executed) return null;

            // Validate using JSONLogic rules
            if (task.attack.validation) {
                const result = task.module.validateAttack(executed, original);
                const combined = Object.assign(executed, result);

                if (combined.success) {
                    const finding = this._buildFinding(combined, task, original);
                    this._recordFinding(finding);
                    return finding;
                }
            }
        } else if (task.type === 'passive') {
            const result = task.module.validateAttack(task.payload, original);
            if (result.success) {
                const combined = Object.assign({}, task.payload, result);
                combined.request = original?.request || null;
                combined.response = original?.response || null;
                const finding = this._buildFinding(combined, task, original);
                this._recordFinding(finding);
                return finding;
            }
        }

        return null;
    }

    // ═══════════════════════════════════════════
    // Finding Builder
    // ═══════════════════════════════════════════

    _buildFinding(result, task, original) {
        const meta = task.module.metadata || {};
        const attacked = result.metadata?.attacked || {};
        return {
            id: crypto.randomUUID(),
            engine: 'DAST',
            moduleId: task.moduleId,
            moduleName: task.moduleName,
            attackId: task.attack?.id,
            attackName: task.attack?.name,
            severity: (meta.severity || 'medium').toLowerCase(),
            category: meta.category || 'unknown',
            vulnId: meta.vulnId || task.moduleId,
            description: meta.description || '',
            recommendation: meta.recommendation || '',
            owasp: meta.owasp || [],
            cwe: meta.cwe || [],
            tags: meta.tags || [],
            links: meta.links || {},
            proof: result.proof || '',
            success: true,
            request: {
                method: result.request?.method || original?.request?.method,
                url: result.request?.url || original?.request?.url,
                raw: result.request?.raw || null
            },
            response: {
                statusCode: result.response?.statusCode || result.statusCode,
                body: (result.response?.body || '').substring(0, 2000), // Truncate for storage
                timeMs: result.response?.timeMs || result.timeMs
            },
            attacked: {
                location: attacked.location || 'unknown',
                name: attacked.name || '',
                payload: attacked.after || result.metadata?.payload || ''
            },
            timestamp: new Date().toISOString()
        };
    }

    _recordFinding(finding) {
        if (!finding) return;

        // Update stats
        const sev = finding.severity;
        if (sev === 'high' || sev === 'critical') this.scanResult.stats.high++;
        else if (sev === 'medium') this.scanResult.stats.medium++;
        else if (sev === 'low') this.scanResult.stats.low++;
        else this.scanResult.stats.info++;
        this.scanResult.stats.findingsCount++;

        this.scanResult.findings.push(finding);

        // Callback
        this.onFinding(finding);
        this.onProgress({
            type: 'finding',
            stats: { ...this.scanResult.stats },
            scanStats: { ...this.scanStats }
        });
    }

    // ═══════════════════════════════════════════
    // Strategy Helpers
    // ═══════════════════════════════════════════

    _resolveStrategyConfig(value) {
        const key = typeof value === 'string' ? value.toUpperCase() : DEFAULT_SCAN_STRATEGY;
        return Object.assign({}, SCAN_STRATEGY_CONFIGS[key] || SCAN_STRATEGY_CONFIGS[DEFAULT_SCAN_STRATEGY]);
    }

    _createStrategyStats(strategy) {
        return {
            strategy: strategy || DEFAULT_SCAN_STRATEGY,
            totalJobsPlanned: 0,
            totalJobsExecuted: 0,
            skippedDueToStrategy: 0
        };
    }

    _moduleSupportsAtomic(module) {
        if (typeof module.supportsAtomic === 'boolean') return module.supportsAtomic;
        if (typeof module.atomic === 'boolean') return module.atomic;
        if (typeof module.metadata?.supportsAtomic === 'boolean') return module.metadata.supportsAtomic;
        return true;
    }

    _shouldUseBulkAttack(moduleSupportsAtomic) {
        return Boolean(this.strategyConfig?.atomic && moduleSupportsAtomic);
    }

    _shouldSkipDueToStrategy(task) {
        if (!this.strategyConfig.stopOnFirstFinding) return false;
        const scope = this.strategyConfig.dedupeScope;
        if (!scope) return false;

        const moduleId = task.moduleId || task.moduleName || 'module';
        let key;
        if (scope === 'url-module') {
            key = `${moduleId}`;
        } else if (scope === 'url-param-module') {
            const param = task.payload?.metadata?.attacked?.name || '';
            key = `${moduleId}|${param}`;
        } else {
            return false;
        }

        if (this._strategyFindingKeys.has(key)) {
            this.scanStats.skippedDueToStrategy++;
            return true;
        }
        return false;
    }

    _recordStrategyFinding(task) {
        const moduleId = task.moduleId || task.moduleName || 'module';
        const param = task.payload?.metadata?.attacked?.name || '';
        this._strategyFindingKeys.add(`${moduleId}`);
        this._strategyFindingKeys.add(`${moduleId}|${param}`);
    }

    // ═══════════════════════════════════════════
    // Public API — Full Scan Workflow
    // ═══════════════════════════════════════════

    /**
     * Scan a single intercepted request end-to-end.
     * @param {Object} intercepted - { method, url, headers, postData }
     * @returns {Object} { findings[], stats }
     */
    async scanRequest(intercepted) {
        if (this.isDuplicate(intercepted)) {
            return { findings: [], stats: { ...this.scanResult.stats }, skipped: true };
        }

        const schema = this.parseInterceptedRequest(intercepted);
        const plan = await this.buildAttackPlan(schema);
        if (!plan) {
            return { findings: [], stats: { ...this.scanResult.stats }, error: 'Failed to build attack plan' };
        }

        this.scanStats.totalJobsPlanned += plan.tasks.length;
        this.onProgress({
            type: 'plan_built',
            url: intercepted.url,
            method: intercepted.method,
            taskCount: plan.tasks.length,
            modules: [...new Set(plan.tasks.map(t => t.moduleName))]
        });

        const findings = await this.executePlan(plan);
        this.scanResult.stats.attacksCount += plan.tasks.length;

        // Record strategy finding keys for stop-on-first
        for (const f of findings) {
            const task = plan.tasks.find(t => t.attackKey === f.attackId);
            if (task) this._recordStrategyFinding(task);
        }

        return {
            findings,
            stats: { ...this.scanResult.stats },
            planSize: plan.tasks.length
        };
    }

    /**
     * Get the final scan report.
     */
    getReport() {
        this.scanResult.finishedAt = new Date().toISOString();
        this.scanResult.scanStats = { ...this.scanStats };
        return this.scanResult;
    }

    /**
     * Get loaded module names for diagnostics.
     */
    getModuleNames() {
        return this._modules.map(m => ({ id: m.id, name: m.name, type: m.type, attackCount: (m.attacks || []).length }));
    }

    /**
     * Reset engine state for a new scan.
     */
    reset() {
        this._fingerprintSet.clear();
        this._uniqueAttackSuccess.clear();
        this._passiveUniqueFindingKeys.clear();
        this._strategyFindingKeys.clear();
        this.scanStats = this._createStrategyStats(this.strategyConfig.strategy);
        this.scanResult = this._createScanResult();
        this.tokens = this.maxRequestsPerSecond;
        this.lastRefill = Date.now();
    }
}

module.exports = DastEngine;

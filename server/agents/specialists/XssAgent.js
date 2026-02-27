const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');
const PAYLOADS = require('../utils/Payloads');

class XssAgent extends BaseAgent {
    constructor() {
        super('XssAgent', 'SPECIALIST');
    }

    async process(task) {
        if (task.type === 'TASK_ASSIGNED') {
            await this.executeAttack(task.payload);
            this.emitComplete();
        }
    }

    async executeAttack(payload) {
        this.log(`💉 Testing XSS: ${payload.url}`);
        const attackVectors = PAYLOADS.xss;

        for (const vector of attackVectors) {
            try {
                const attackUrl = this._buildAttackUrl(payload, vector);
                const response = await this._sendRequest(attackUrl, payload.method, payload.headers, payload.body, payload.cookies);

                // 1. Reflected XSS — payload appears in response
                if (response.body.includes(vector)) {
                    this.verifyAndEmit(
                        {
                            type: 'XSS', severity: 'HIGH', title: 'Reflected XSS Detected',
                            description: `Payload reflected unescaped: ${vector.substring(0, 60)}`, endpoint: payload.url, payload: vector
                        },
                        { method: 'error_reflection', evidence: this._extractContext(response.body, vector) }
                    );
                    continue;
                }

                // 2. DOM XSS indicators — check if dangerous sinks are present
                if (this._hasDomXssIndicators(response.body)) {
                    this.verifyAndEmit(
                        {
                            type: 'XSS', severity: 'MEDIUM', title: 'Potential DOM XSS',
                            description: 'Response contains dangerous DOM sinks', endpoint: payload.url, payload: 'DOM sink detected'
                        },
                        { method: 'dom_sink', evidence: this._extractDomSinks(response.body) }
                    );
                }

                // 3. WAF Bypass Loop
                if (response.status === 403 || response.status === 406) {
                    this.log(`⚠️ WAF blocked XSS: "${vector.substring(0, 30)}..." — requesting mutations`);
                    try {
                        const mutationResult = await this.askAgent('PayloadMutator', 'REQUEST_MUTATION', {
                            payload: vector,
                            errorResponse: response.body,
                            errorStatus: response.status,
                            vulnerabilityType: 'XSS'
                        }, 20000);

                        for (const mutated of (mutationResult.mutations || [])) {
                            const mutUrl = this._buildAttackUrl(payload, mutated);
                            const mutResp = await this._sendRequest(mutUrl, payload.method, payload.headers, payload.body, payload.cookies);

                            if (mutResp.body.includes(mutated) || mutResp.body.includes('alert') || mutResp.body.includes('onerror')) {
                                this.verifyAndEmit(
                                    {
                                        type: 'XSS', severity: 'HIGH', title: 'XSS (WAF Bypassed)',
                                        description: `WAF bypassed: ${mutated.substring(0, 60)}`, endpoint: payload.url, payload: mutated
                                    },
                                    { method: 'error_reflection', evidence: mutResp.body.substring(0, 300) }
                                );
                                break;
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

    _buildAttackUrl(payload, vector) {
        if (payload.method === 'GET' && payload.params) {
            const urlObj = new URL(payload.url);
            for (const [key, val] of Object.entries(payload.params)) {
                urlObj.searchParams.set(key, val + vector);
            }
            return urlObj.toString();
        }
        return payload.url;
    }

    _hasDomXssIndicators(body) {
        const sinks = ['innerHTML', 'outerHTML', 'document.write', 'eval(', '.html(', 'dangerouslySetInnerHTML'];
        return sinks.some(s => body.includes(s));
    }

    _extractDomSinks(body) {
        const sinks = ['innerHTML', 'outerHTML', 'document.write', 'eval(', '.html('];
        const found = sinks.filter(s => body.includes(s));
        return `Sinks found: ${found.join(', ')}`;
    }

    _extractContext(body, vector) {
        const idx = body.indexOf(vector);
        const start = Math.max(0, idx - 50);
        const end = Math.min(body.length, idx + vector.length + 50);
        return `...${body.substring(start, end)}...`;
    }

    async _sendRequest(url, method, headers, data, cookies) {
        try {
            const config = {
                url, method: method || 'GET',
                headers: { ...headers, ...(cookies ? { Cookie: cookies } : {}) },
                data, timeout: 8000,
                validateStatus: () => true
            };
            const resp = await axios(config);
            return { status: resp.status, body: typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data) };
        } catch (e) {
            return { status: 0, body: e.message };
        }
    }
}

module.exports = new XssAgent();

const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');
const PAYLOADS = require('../utils/Payloads');

class SqlInjectionAgent extends BaseAgent {
    constructor() {
        super('SqlInjectionAgent', 'SPECIALIST');
        this.SQL_ERROR_PATTERNS = [
            /sql syntax/i, /mysql_fetch/i, /ORA-\d{5}/i, /pg_query/i,
            /SQLite3::query/i, /microsoft sql native client/i,
            /ODBC SQL Server Driver/i, /unclosed quotation mark/i,
            /quoted string not properly terminated/i, /syntax error/i,
            /SQL command not properly ended/i, /column.*not found/i,
            /table.*doesn't exist/i, /no such column/i
        ];
    }

    async process(task) {
        if (task.type === 'TASK_ASSIGNED') {
            await this.executeAttack(task.payload);
            this.emitComplete();
        }
    }

    async executeAttack(payload) {
        this.log(`💉 Testing SQLi: ${payload.url}`);

        // SHANNON ACCURACY: Determing baseline latency to avoid timing false positives
        let baseline = 0;
        try {
            const start = Date.now();
            await this._sendRequest(payload.url, payload.method, payload.headers, payload.body, payload.cookies);
            baseline = Date.now() - start;
            this.log(`  Baseline latency: ${baseline}ms`);
        } catch (e) {
            this.log(`⚠️ Baseline check failed, assuming 0ms.`);
        }

        const attackVectors = PAYLOADS.sqli;

        for (const vector of attackVectors) {
            try {
                const attackUrl = this._buildAttackUrl(payload, vector);
                const response = await this._sendRequest(attackUrl, payload.method, payload.headers, payload.body, payload.cookies);

                // 1. Check for SQL error reflection (Error-Based)
                if (this._hasSqlError(response.body)) {
                    this.verifyAndEmit(
                        {
                            type: 'SQL_INJECTION', severity: 'CRITICAL', title: 'Error-Based SQL Injection',
                            description: `SQL error reflected with payload: ${vector}`, endpoint: payload.url, payload: vector
                        },
                        { method: 'error_reflection', evidence: response.body.substring(0, 300) }
                    );
                    continue;
                }

                // 2. Check for Time-Based Blind SQLi
                if (vector.includes('SLEEP') || vector.includes('WAITFOR') || vector.includes('pg_sleep')) {
                    const start = Date.now();
                    await this._sendRequest(attackUrl, payload.method, payload.headers, payload.body, payload.cookies);
                    const elapsed = Date.now() - start;

                    const delta = elapsed - baseline;
                    if (delta >= 4000) {
                        this.verifyAndEmit(
                            {
                                type: 'SQL_INJECTION', severity: 'HIGH', title: 'Time-Based Blind SQL Injection',
                                description: `Response delayed ${delta}ms above baseline with payload: ${vector}`, endpoint: payload.url, payload: vector
                            },
                            { method: 'timing', evidence: `Baseline: ${baseline}ms, Elapsed: ${elapsed}ms, Delta: ${delta}ms` }
                        );
                        continue;
                    }
                }

                // 3. WAF Bypass Loop (403/406)
                if (response.status === 403 || response.status === 406) {
                    this.log(`⚠️ WAF blocked: "${vector.substring(0, 30)}..." — requesting mutations`);
                    try {
                        const mutationResult = await this.askAgent('PayloadMutator', 'REQUEST_MUTATION', {
                            payload: vector,
                            errorResponse: response.body,
                            errorStatus: response.status,
                            vulnerabilityType: 'SQL Injection'
                        }, 20000);

                        for (const mutated of (mutationResult.mutations || [])) {
                            const mutUrl = this._buildAttackUrl(payload, mutated);
                            const mutResp = await this._sendRequest(mutUrl, payload.method, payload.headers, payload.body, payload.cookies);

                            if (this._hasSqlError(mutResp.body)) {
                                this.verifyAndEmit(
                                    {
                                        type: 'SQL_INJECTION', severity: 'CRITICAL', title: 'SQL Injection (WAF Bypassed)',
                                        description: `WAF bypassed with mutated payload: ${mutated}`, endpoint: payload.url, payload: mutated
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
            for (const [key] of Object.entries(payload.params)) {
                urlObj.searchParams.set(key, vector);
            }
            return urlObj.toString();
        }
        return payload.url;
    }

    _hasSqlError(body) {
        return this.SQL_ERROR_PATTERNS.some(pattern => pattern.test(body));
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

module.exports = new SqlInjectionAgent();

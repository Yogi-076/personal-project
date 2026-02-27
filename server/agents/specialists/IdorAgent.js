const BaseAgent = require('../core/BaseAgent');
const axios = require('axios');

class IdorAgent extends BaseAgent {
    constructor() {
        super('IdorAgent', 'SPECIALIST');
    }

    async process(task) {
        if (task.type === 'TASK_ASSIGNED') {
            await this.executeAttack(task.payload);
            this.emitComplete();
        }
    }

    async executeAttack(payload) {
        const { url, originalMethod, userASession, userBSession } = payload;

        if (!userBSession) {
            this.log(`⏭️ Skipping IDOR check for ${url}: No User B session provided`);
            return;
        }

        this.log(`🕵️ Testing IDOR (A↔B): ${url}`);

        try {
            // Step 1: Request as User A (baseline)
            const respA = await this._sendRequest(url, originalMethod || 'GET', payload.headers, payload.body, userASession);

            if (respA.status < 200 || respA.status >= 300) {
                this.log(`⚠️ User A cannot access ${url} (${respA.status}), skipping`);
                return;
            }

            // Step 2: Replay exact same request as User B
            const respB = await this._sendRequest(url, originalMethod || 'GET', payload.headers, payload.body, userBSession);

            // Step 3: Analyze
            if (respB.status >= 200 && respB.status < 300) {
                const similarity = this._structuralSimilarity(respA.body, respB.body);

                if (similarity > 0.5) {
                    // User B got similar data to User A → IDOR confirmed
                    this.verifyAndEmit(
                        {
                            type: 'IDOR', severity: 'HIGH', title: 'IDOR / BOLA — Cross-User Data Access',
                            description: `User B accessed User A's resource (${Math.round(similarity * 100)}% match)`, endpoint: url, payload: 'Session Replay (User B)'
                        },
                        { method: 'session_replay', evidence: `A status: ${respA.status}, B status: ${respB.status}\nA body: ${respA.body.substring(0, 200)}\nB body: ${respB.body.substring(0, 200)}` }
                    );
                } else {
                    this.log(`⚠️ User B got 200 but different data (${Math.round(similarity * 100)}% similarity) — possible false positive`);
                }
            } else if (respB.status === 401 || respB.status === 403) {
                this.log(`✅ Properly blocked: User B → ${respB.status}`);
            } else {
                this.log(`ℹ️ User B got ${respB.status} on ${url}`);
            }

        } catch (error) {
            this.log(`❌ IDOR test error: ${error.message}`);
        }
    }

    _structuralSimilarity(bodyA, bodyB) {
        // JSON key-based structural comparison
        try {
            const keysA = this._extractKeys(JSON.parse(bodyA));
            const keysB = this._extractKeys(JSON.parse(bodyB));

            const allKeys = new Set([...keysA, ...keysB]);
            const shared = [...allKeys].filter(k => keysA.has(k) && keysB.has(k));

            return allKeys.size > 0 ? shared.length / allKeys.size : 0;
        } catch {
            // Fallback to length-based comparison for non-JSON
            const maxLen = Math.max(bodyA.length, bodyB.length);
            if (maxLen === 0) return 1;
            return 1 - (Math.abs(bodyA.length - bodyB.length) / maxLen);
        }
    }

    _extractKeys(obj, prefix = '') {
        const keys = new Set();
        if (typeof obj === 'object' && obj !== null) {
            for (const key of Object.keys(obj)) {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                keys.add(fullKey);
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    for (const subKey of this._extractKeys(obj[key], fullKey)) {
                        keys.add(subKey);
                    }
                }
            }
        }
        return keys;
    }

    async _sendRequest(url, method, headers, data, cookies) {
        try {
            const config = {
                url, method,
                headers: { ...headers, Cookie: cookies },
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

module.exports = new IdorAgent();

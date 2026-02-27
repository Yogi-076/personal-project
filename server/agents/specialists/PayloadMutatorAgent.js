const BaseAgent = require('../core/BaseAgent');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class PayloadMutatorAgent extends BaseAgent {
    constructor() {
        super('PayloadMutator', 'SUPPORT');
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = null;
        this.modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    async process(task) {
        if (task.type === 'REQUEST_MUTATION') {
            await this._handleMutationRequest(task);
        }
    }

    async _handleMutationRequest(message) {
        const { payload: blockedPayload, errorResponse, errorStatus, vulnerabilityType } = message.payload;
        this.log(`🧬 Mutation requested for ${vulnerabilityType}: "${String(blockedPayload).substring(0, 40)}..."`);

        try {
            const mutations = await this._generateMutations(blockedPayload, errorResponse, errorStatus, vulnerabilityType);
            this.sendResponse(message, { mutations, success: true });
            this.log(`✅ Generated ${mutations.length} mutations`);
        } catch (error) {
            this.log(`❌ Mutation failed: ${error.message}`);
            this.sendResponse(message, { mutations: [], success: false, error: error.message });
        }
    }

    async _generateMutations(blockedPayload, wafResponse, statusCode, vulnType) {
        if (!this.genAI) {
            return this._offlineMutations(blockedPayload, vulnType);
        }

        const prompt = `You are a WAF bypass specialist. A security testing payload was blocked.\n\nBLOCKED PAYLOAD: ${blockedPayload}\nWAF RESPONSE STATUS: ${statusCode}\nWAF RESPONSE BODY: ${String(wafResponse).substring(0, 500)}\nVULNERABILITY TYPE: ${vulnType}\n\nGenerate exactly 3 alternative payloads that achieve the same goal but evade the WAF.\nUse techniques: encoding, case-mixing, comment insertion, string concatenation, alternative syntax.\n\nRespond ONLY with a JSON array of 3 strings. No explanation.\nExample: ["payload1", "payload2", "payload3"]`;

        for (const modelName of this.modelsToTry) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const model = this.genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(prompt);
                    const text = result.response.text();
                    this.log(`📡 PayloadMutator connected to ${modelName} (online)`);
                    const match = text.match(/\[[\s\S]*?\]/);
                    if (match) return JSON.parse(match[0]);
                    break; // Got response but no match, try next model
                } catch (e) {
                    const errMsg = e.message || '';
                    const isQuotaExhausted = errMsg.includes('limit: 0') || errMsg.includes('billing') || (errMsg.includes('quota') && errMsg.includes('exceeded') && !errMsg.includes('per_minute'));
                    if (isQuotaExhausted) {
                        this.log(`🔋 API quota exhausted — using offline mutations`);
                        return this._offlineMutations(blockedPayload, vulnType);
                    }
                    const isRateLimit = errMsg.includes('429') || errMsg.includes('rate') || errMsg.includes('retry');
                    if (isRateLimit && attempt < 2) {
                        const delay = (attempt + 1) * 15000;
                        this.log(`⏳ Rate limited on ${modelName}, retrying in ${delay / 1000}s...`);
                        await new Promise(r => setTimeout(r, delay));
                        continue;
                    }
                    this.log(`⚠️ ${modelName} failed: ${errMsg.substring(0, 150)}`);
                    break;
                }
            }
        }

        return this._offlineMutations(blockedPayload, vulnType);
    }

    _offlineMutations(payload, vulnType) {
        // Deterministic fallback mutations
        const mutations = [];

        if (vulnType === 'SQL Injection') {
            mutations.push(payload.replace(/OR/gi, '/*!OR*/'));
            mutations.push(payload.replace(/'/g, '%27').replace(/ /g, '/**/'));
            mutations.push(payload.replace(/SELECT/gi, 'SeLeCt').replace(/UNION/gi, 'UnIoN'));
        } else if (vulnType === 'XSS') {
            mutations.push(payload.replace(/alert/g, 'confirm'));
            mutations.push(payload.replace(/</g, '%3C').replace(/>/g, '%3E'));
            mutations.push(payload.replace(/script/gi, 'ScRiPt'));
        } else {
            mutations.push(encodeURIComponent(payload));
            mutations.push(payload.split('').join('/**/'));
            mutations.push(payload.replace(/ /g, '+'));
        }

        return mutations;
    }
}

module.exports = new PayloadMutatorAgent();

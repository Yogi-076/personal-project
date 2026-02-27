const MessageBus = require('./MessageBus');
const { v4: uuidv4 } = require('uuid');

class BaseAgent {
    constructor(name, role) {
        this.id = uuidv4();
        this.name = name;
        this.role = role;
        this.status = 'idle';
        this.scanId = null;
        this._pendingRequests = new Map();
        this._setupListeners();
    }

    _setupListeners() {
        MessageBus.subscribe('*', (message) => {
            if (message.target === this.name || message.target === 'BROADCAST') {
                if (message.requestId && this._pendingRequests.has(message.requestId)) {
                    const { resolve, timer } = this._pendingRequests.get(message.requestId);
                    clearTimeout(timer);
                    resolve(message.payload);
                    this._pendingRequests.delete(message.requestId);
                } else {
                    this.execute(message);
                }
            }
        });
    }

    async handleMessage(message) {
        // Override in subclasses
    }

    sendMessage(type, target, payload, priority = 'MEDIUM') {
        MessageBus.publish(type, this.name, target, payload, priority);
    }

    sendResponse(originalMessage, payload) {
        MessageBus.publish(
            `RESPONSE_${originalMessage.type}`,
            this.name,
            originalMessage.source,
            payload,
            'HIGH',
            originalMessage.requestId
        );
    }

    async askAgent(targetAgent, type, payload, timeoutMs = 15000) {
        const requestId = uuidv4();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this._pendingRequests.delete(requestId);
                reject(new Error(`Timeout waiting for ${targetAgent}`));
            }, timeoutMs);
            this._pendingRequests.set(requestId, { resolve, reject, timer });
            MessageBus.publish(type, this.name, targetAgent, payload, 'HIGH', requestId);
        });
    }

    emitPhase(phase) {
        this.sendMessage('PHASE_UPDATE', 'System', { scanId: this.scanId, phase });
    }

    emitFinding(finding) {
        this.sendMessage('FINDING_DETECTED', 'Strategist', {
            ...finding,
            scanId: this.scanId,
            detectedBy: this.name,
            timestamp: new Date().toISOString()
        }, 'HIGH');
    }

    /**
     * Shannon "No Exploit, No Report" gate.
     * Only emits a finding if concrete exploit proof is provided.
     * @param {object} hypothesis - { type, severity, title, description, endpoint }
     * @param {object} proof - { method: 'error_reflection'|'timing'|'data_leak'|'session_replay'|'status_diff', evidence: string, raw: any }
     */
    verifyAndEmit(hypothesis, proof) {
        if (!proof || !proof.evidence || !proof.method) {
            this.log(`🚫 Hypothesis rejected (no proof): ${hypothesis.title}`);
            return false;
        }
        this.emitFinding({
            ...hypothesis,
            proof_method: proof.method,
            evidence: proof.evidence,
            verified: true
        });
        this.log(`✅ Exploit verified [${proof.method}]: ${hypothesis.title}`);
        return true;
    }

    emitComplete() {
        this.sendMessage('AGENT_COMPLETE', 'System', {
            agent: this.name,
            scanId: this.scanId
        });
    }

    log(message) {
        this.sendMessage('LOG_INFO', 'System', { message, scanId: this.scanId });
        console.log(`[${this.name}] ${message}`);
    }

    async execute(task) {
        this.status = 'working';
        this.scanId = task.payload?.scanId || this.scanId;
        try {
            await this.process(task);
            this.status = 'idle';
        } catch (error) {
            this.status = 'error';
            this.log(`Error: ${error.message}`);
            this.sendMessage('AGENT_ERROR', 'Strategist', { error: error.message, scanId: this.scanId });
        }
    }

    async process(task) {
        throw new Error('process() must be implemented by subclass');
    }
}

module.exports = BaseAgent;

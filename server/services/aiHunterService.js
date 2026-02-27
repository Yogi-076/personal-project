// server/services/aiHunterService.js
// SHANNON MAS — AGENT SWARM ORCHESTRATOR & STATE MANAGER
// Integrates PTK DAST Engine for data-driven scanning + AI agents for intelligent exploitation

const { v4: uuidv4 } = require('uuid');
const MessageBus = require('../agents/core/MessageBus');
const AuditLogger = require('../agents/utils/AuditLogger');
const DastEngine = require('../agents/engines/DastEngine');

// Initialize Agents (importing causes them to register on MessageBus)
const StrategistAgent = require('../agents/StrategistAgent');
const SqlInjectionAgent = require('../agents/specialists/SqlInjectionAgent');
const XssAgent = require('../agents/specialists/XssAgent');
const AuthBypassAgent = require('../agents/specialists/AuthBypassAgent');
const PayloadMutatorAgent = require('../agents/specialists/PayloadMutatorAgent');
const IdorAgent = require('../agents/specialists/IdorAgent');
const SsrfAgent = require('../agents/specialists/SsrfAgent');
const CommandInjectionAgent = require('../agents/specialists/CommandInjectionAgent');
const PreReconAgent = require('../agents/specialists/PreReconAgent');
const ReportingAgent = require('../agents/ReportingAgent');

// Agent registry for completion tracking
const EXPLOITATION_AGENTS = ['SqlInjectionAgent', 'XssAgent', 'AuthBypassAgent', 'IdorAgent', 'SsrfAgent', 'CommandInjectionAgent'];

class AIHunterService {
    constructor() {
        this.scans = new Map();
        this._setupListeners();
    }

    _setupListeners() {
        MessageBus.subscribe('*', (msg) => {
            // Log capture
            if (msg.type === 'LOG_INFO' && msg.payload.scanId) {
                this._addLog(msg.payload.scanId, msg.source, msg.payload.message);
                // Audit: write to disk
                const scan = this.scans.get(msg.payload.scanId);
                if (scan) AuditLogger.logAgent(msg.payload.scanId, scan.target, msg.source, msg.payload.message);
            }

            // Finding capture
            if (msg.type === 'FINDING_DETECTED' && msg.payload.scanId) {
                this._addFinding(msg.payload.scanId, msg.payload);
                const scan = this.scans.get(msg.payload.scanId);
                if (scan) AuditLogger.logFinding(msg.payload.scanId, scan.target, msg.payload);
            }

            // Phase updates from agents
            if (msg.type === 'PHASE_UPDATE' && msg.payload.scanId) {
                const scan = this.scans.get(msg.payload.scanId);
                if (scan) scan.phase = msg.payload.phase;
            }

            // Agent completion tracking
            if (msg.type === 'AGENT_COMPLETE' && msg.payload.scanId) {
                this._onAgentComplete(msg.payload.scanId, msg.payload.agent);
            }

            // Report ready
            if (msg.type === 'REPORT_READY' && msg.payload.scanId) {
                this._onReportReady(msg.payload.scanId, msg.payload);
            }

            // DAST Engine findings (from PTK data-driven scanner)
            if (msg.type === 'DAST_FINDING' && msg.payload.scanId) {
                this._addFinding(msg.payload.scanId, msg.payload.finding);
                const scan = this.scans.get(msg.payload.scanId);
                if (scan) AuditLogger.logFinding(msg.payload.scanId, scan.target, msg.payload.finding);
                this._addLog(msg.payload.scanId, 'DastEngine', `🎯 ${msg.payload.finding.moduleName}: ${msg.payload.finding.attackName} [${msg.payload.finding.severity.toUpperCase()}]`);
            }

            // DAST Engine progress
            if (msg.type === 'DAST_PROGRESS' && msg.payload.scanId) {
                const scan = this.scans.get(msg.payload.scanId);
                if (scan) scan.dastStats = msg.payload.stats;
            }
        });
    }

    _onAgentComplete(scanId, agentName) {
        const scan = this.scans.get(scanId);
        if (!scan) return;

        scan.completedAgents.add(agentName);
        this._addLog(scanId, agentName, `✅ ${agentName} completed`);

        // Check if all exploitation agents are done
        const allDone = EXPLOITATION_AGENTS.every(a => scan.completedAgents.has(a));
        if (allDone) {
            this._addLog(scanId, 'System', '⚔️ All agents completed — generating report');
            scan.phase = 'reporting';

            // Trigger Phase 4: Reporting
            MessageBus.publish('GENERATE_REPORT', 'System', 'ReportingAgent', {
                scanId,
                findings: scan.findings,
                target: scan.target,
                elapsed: Math.round((Date.now() - scan.startTime) / 1000)
            }, 'HIGH');
        }
    }

    _onReportReady(scanId, data) {
        const scan = this.scans.get(scanId);
        if (!scan) return;

        scan.report = data.report;
        scan.status = 'complete';
        scan.phase = 'complete';
        this._addLog(scanId, 'ReportingAgent', `📝 Report generated: ${data.findingsCount} findings`);

        // Audit: save report + finalize session
        AuditLogger.saveReport(scanId, scan.target, data.report);
        AuditLogger.finalizeSession(scanId, scan.target, {
            findings: scan.findings.length,
            elapsed: Math.round((Date.now() - scan.startTime) / 1000)
        });
    }

    // Blocking scan method for index.js runScan loop
    async scan(target, options = {}, scanId) {
        if (!scanId) scanId = uuidv4().substring(0, 8);
        await this.startHunt({ ...options, target, scanId });

        return new Promise((resolve, reject) => {
            const maxWait = 300000; // 5 min timeout
            const startTime = Date.now();

            const check = setInterval(() => {
                const s = this.scans.get(scanId);
                if (!s) { clearInterval(check); reject(new Error('Scan lost')); return; }

                if (s.status === 'complete') {
                    clearInterval(check);
                    resolve({
                        findings: s.findings,
                        report: s.report,
                        summary: this.getProgress(scanId).summary
                    });
                }
                if (s.status === 'error' || s.status === 'failed') {
                    clearInterval(check);
                    reject(new Error(s.error || 'Scan failed'));
                }
                if (Date.now() - startTime > maxWait) {
                    clearInterval(check);
                    s.status = 'complete'; // Force complete with partial results
                    resolve({
                        findings: s.findings,
                        report: s.report || 'Report generation timed out.',
                        summary: this.getProgress(scanId).summary
                    });
                }
            }, 3000);
        });
    }

    // API: Start a new hunt
    async startHunt(options) {
        const scanId = options.scanId || uuidv4().substring(0, 8);
        const scan = {
            id: scanId,
            target: options.target,
            status: 'running',
            phase: 'initializing',
            logs: [],
            findings: [],
            report: null,
            completedAgents: new Set(),
            startTime: Date.now()
        };
        this.scans.set(scanId, scan);

        // Dispatch to Strategist
        StrategistAgent.process({
            type: 'START_HUNT',
            payload: { ...options, target: options.target, scanId, proxy: options.proxy, repoName: options.repoName }
        });

        this._addLog(scanId, 'System', '🚀 Shannon MAS deployed. Strategist analyzing target...');
        return { scanId, status: 'running' };
    }

    getProgress(scanId) {
        const status = this.getStatus(scanId);
        if (!status) return null;

        const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        status.findings.forEach(f => {
            const sev = (f.severity || 'info').toLowerCase();
            if (summary[sev] !== undefined) summary[sev]++;
        });

        const phaseProgress = {
            'initializing': 5,
            'recon': 15,
            'authenticating': 20,
            'crawling': 30,
            'planning': 45,
            'attacking': 65,
            'reporting': 90,
            'complete': 100
        };

        return {
            status: status.status,
            progress: phaseProgress[status.phase] || 0,
            logs: status.logs,
            findings: status.findings,
            report: status.report,
            summary
        };
    }

    // API: Get status for frontend
    getStatus(scanId) {
        const scan = this.scans.get(scanId);
        if (!scan) return null;
        return {
            id: scan.id,
            status: scan.status,
            phase: scan.phase,
            findings: scan.findings,
            logs: scan.logs,
            report: scan.report,
            elapsed: Math.round((Date.now() - scan.startTime) / 1000)
        };
    }

    _addLog(scanId, source, message) {
        const scan = this.scans.get(scanId);
        if (scan) {
            scan.logs.push({
                timestamp: new Date().toISOString(),
                source, message
            });
        }
    }

    _addFinding(scanId, finding) {
        const scan = this.scans.get(scanId);
        if (scan) {
            scan.findings.push(finding);
        }
    }
}

module.exports = new AIHunterService();

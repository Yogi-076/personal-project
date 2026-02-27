const BaseAgent = require('./core/BaseAgent');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODELS_TO_TRY = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'];

class ReportingAgent extends BaseAgent {
    constructor() {
        super('ReportingAgent', 'REPORTING');
        this.apiKey = process.env.GEMINI_API_KEY;
        this.model = null;
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
        }
    }

    async process(task) {
        if (task.type === 'GENERATE_REPORT') {
            await this._generateReport(task.payload);
        }
    }

    async _generateReport(payload) {
        const { findings, target, scanId, elapsed } = payload;
        this.log(`📝 Generating pentester-grade report for ${target}...`);

        const report = await this._buildReport(findings, target, scanId, elapsed);

        this.sendMessage('REPORT_READY', 'System', {
            scanId, report, target,
            findingsCount: findings.length,
            timestamp: new Date().toISOString()
        }, 'HIGH');

        this.log(`✅ Report generated: ${findings.length} findings documented`);
    }

    async _buildReport(findings, target, scanId, elapsed) {
        // Try AI-enhanced report
        if (this.genAI && findings.length > 0) {
            try {
                const aiReport = await this._aiEnhancedReport(findings, target, elapsed);
                if (aiReport) return aiReport;
            } catch (e) {
                this.log(`⚠️ AI report generation failed, using template: ${e.message}`);
            }
        }

        // Fallback: template-based report
        return this._templateReport(findings, target, scanId, elapsed);
    }

    async _aiEnhancedReport(findings, target, elapsed) {
        const prompt = `You are a senior pentester writing a professional security assessment report.\n\nTARGET: ${target}\nTEST DURATION: ${elapsed}s\nFINDINGS: ${JSON.stringify(findings, null, 2)}\n\nGenerate a PROFESSIONAL markdown report with these sections:\n1. **Executive Summary** — 2-3 sentence overview\n2. **Findings Table** — Severity, Type, Endpoint, Description\n3. **Detailed Findings** — For each finding: Description, Evidence, Impact, Remediation\n4. **Remediation Priority Matrix** — Ordered by risk\n\nUse the "No Exploit, No Report" principle: every finding has proven evidence.\nFormat in clean markdown. Be concise but comprehensive.`;

        for (const modelName of MODELS_TO_TRY) {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    const model = this.genAI.getGenerativeModel({ model: modelName });
                    const result = await model.generateContent(prompt);
                    this.log(`📡 ReportingAgent connected to ${modelName} (online)`);
                    return result.response.text();
                } catch (e) {
                    const errMsg = e.message || '';
                    const isQuotaExhausted = errMsg.includes('limit: 0') || errMsg.includes('billing') || (errMsg.includes('quota') && errMsg.includes('exceeded') && !errMsg.includes('per_minute'));
                    if (isQuotaExhausted) {
                        this.log(`🔋 API quota exhausted — using template report`);
                        return null;
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
        return null; // fallback to template
    }

    _templateReport(findings, target, scanId, elapsed) {
        const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
        findings.forEach(f => {
            const sev = (f.severity || 'INFO').toUpperCase();
            if (severity[sev] !== undefined) severity[sev]++;
        });

        let report = `# 🔒 Security Assessment Report

**Target:** ${target}
**Scan ID:** ${scanId}
**Duration:** ${elapsed}s
**Date:** ${new Date().toISOString().split('T')[0]}
**Engine:** Shannon MAS v2.0

---

## Executive Summary

| Severity | Count |
|----------|-------|
| 🔴 Critical | ${severity.CRITICAL} |
| 🟠 High | ${severity.HIGH} |
| 🟡 Medium | ${severity.MEDIUM} |
| 🔵 Low | ${severity.LOW} |
| ⚪ Info | ${severity.INFO} |
| **Total** | **${findings.length}** |

---

## Findings

`;
        if (findings.length === 0) {
            report += `No exploitable vulnerabilities were confirmed during this assessment.\n`;
        } else {
            report += `| # | Severity | Type | Endpoint | Description |\n`;
            report += `|---|----------|------|----------|-------------|\n`;
            findings.forEach((f, i) => {
                report += `| ${i + 1} | ${f.severity} | ${f.type} | \`${(f.endpoint || '').substring(0, 50)}\` | ${(f.title || f.description || '').substring(0, 80)} |\n`;
            });

            report += `\n---\n\n## Detailed Findings\n\n`;
            findings.forEach((f, i) => {
                report += `### ${i + 1}. ${f.title || f.type}\n\n`;
                report += `- **Severity:** ${f.severity}\n`;
                report += `- **Type:** ${f.type}\n`;
                report += `- **Endpoint:** \`${f.endpoint}\`\n`;
                report += `- **Description:** ${f.description}\n`;
                if (f.evidence) report += `- **Evidence:** \`${f.evidence.substring(0, 300)}\`\n`;
                if (f.payload) report += `- **Payload:** \`${String(f.payload).substring(0, 200)}\`\n`;
                report += `\n`;
            });
        }

        report += `---\n\n*Report generated by Shannon MAS Engine*\n`;
        return report;
    }
}

module.exports = new ReportingAgent();

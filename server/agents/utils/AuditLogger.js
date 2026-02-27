// AuditLogger — Shannon-aligned crash-safe, append-only logging
const fs = require('fs');
const path = require('path');

class AuditLogger {
    constructor() {
        this.baseDir = path.join(__dirname, '..', '..', 'data', 'audit-logs');
        this._ensureDir(this.baseDir);
    }

    /**
     * Initialize a scan session directory
     */
    initSession(scanId, target) {
        const hostname = this._extractHostname(target);
        const sessionDir = path.join(this.baseDir, `${hostname}_${scanId}`);
        this._ensureDir(sessionDir);
        this._ensureDir(path.join(sessionDir, 'agents'));
        this._ensureDir(path.join(sessionDir, 'deliverables'));

        // Write session metadata
        const session = {
            scanId, target, hostname,
            startedAt: new Date().toISOString(),
            status: 'running'
        };
        fs.writeFileSync(
            path.join(sessionDir, 'session.json'),
            JSON.stringify(session, null, 2)
        );

        return sessionDir;
    }

    /**
     * Append a log entry for a specific agent (crash-safe, append-only)
     */
    logAgent(scanId, target, agentName, message) {
        const hostname = this._extractHostname(target);
        const sessionDir = path.join(this.baseDir, `${hostname}_${scanId}`);
        const agentFile = path.join(sessionDir, 'agents', `${agentName}.log`);

        const entry = `[${new Date().toISOString()}] ${message}\n`;
        try {
            fs.appendFileSync(agentFile, entry);
        } catch (e) {
            // Silently fail if dir doesn't exist yet
        }
    }

    /**
     * Save a finding to the session
     */
    logFinding(scanId, target, finding) {
        const hostname = this._extractHostname(target);
        const sessionDir = path.join(this.baseDir, `${hostname}_${scanId}`);
        const findingsFile = path.join(sessionDir, 'findings.jsonl');

        const entry = JSON.stringify({
            ...finding,
            loggedAt: new Date().toISOString()
        }) + '\n';

        try {
            fs.appendFileSync(findingsFile, entry);
        } catch (e) { /* silent */ }
    }

    /**
     * Save the final report
     */
    saveReport(scanId, target, report) {
        const hostname = this._extractHostname(target);
        const sessionDir = path.join(this.baseDir, `${hostname}_${scanId}`);
        const reportFile = path.join(sessionDir, 'deliverables', 'security_assessment_report.md');

        try {
            fs.writeFileSync(reportFile, report);
        } catch (e) { /* silent */ }
    }

    /**
     * Finalize session
     */
    finalizeSession(scanId, target, summary) {
        const hostname = this._extractHostname(target);
        const sessionFile = path.join(this.baseDir, `${hostname}_${scanId}`, 'session.json');

        try {
            const session = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
            session.status = 'complete';
            session.completedAt = new Date().toISOString();
            session.summary = summary;
            fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
        } catch (e) { /* silent */ }
    }

    _extractHostname(target) {
        try { return new URL(target).hostname.replace(/[^a-zA-Z0-9.-]/g, '_'); }
        catch { return 'unknown'; }
    }

    _ensureDir(dir) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

module.exports = new AuditLogger();

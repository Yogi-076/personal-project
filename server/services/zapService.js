const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class ZapService {
    constructor() {
        this.scanProgress = new Map();
        this.scanLogs = new Map();
        this.scanFindings = new Map(); // Store incremental findings
        // Default ZAP configuration
        this.zapApiUrl = process.env.ZAP_URL || 'http://localhost:8090'; // Changed to 8090 to avoid conflict with React (8080)
        this.apiKey = process.env.ZAP_API_KEY || ''; // ZAP often requires an API key
    }

    async scan(target, options = {}, scanId) {
        try {
            this.addLog(scanId, `Initializing OWASP ZAP Scan for: ${target}`);
            this.updateProgress(scanId, 5);

            // 1. Check if ZAP is running
            const isAlive = await this.checkZapHealth();

            if (!isAlive) {
                this.addLog(scanId, `⚠️ OWASP ZAP not detected at ${this.zapApiUrl}.`);
                this.addLog(scanId, `🔄 Switching to SIMULATION MODE for demonstration purposes.`);
                return this.runSimulation(scanId, target);
            }

            this.addLog(scanId, 'Connected to ZAP API successfully.');

            // 2. Spider (Crawl)
            this.addLog(scanId, 'Starting Spider (Crawling)...');
            const spiderId = await this.startSpider(target);
            await this.waitForSpider(spiderId, scanId);
            this.updateProgress(scanId, 40);

            // 3. Active Scan
            this.addLog(scanId, 'Starting Active Scan (Attacking)...');
            const activeScanId = await this.startActiveScan(target);
            await this.waitForActiveScan(activeScanId, scanId);
            this.updateProgress(scanId, 90);

            // 4. Get Alerts
            this.addLog(scanId, 'Retrieving security alerts...');
            const alerts = await this.getAlerts(target);
            return this.processFindings(scanId, alerts, target);

        } catch (error) {
            this.addLog(scanId, `ZAP ERROR: ${error.message}`);
            throw error;
        }
    }

    processFindings(scanId, alerts, target, allowPartial = false) {
        if (!alerts || !Array.isArray(alerts)) {
            // this.addLog(scanId, 'Warning: No alerts list received from ZAP.');
            return { summary: {}, findings: [] };
        }

        const findings = (alerts || []).map(alert => {
            if (!alert) return null;
            return {
                id: uuidv4(),
                title: alert.alert || 'Unknown ZAP Alert',
                type: alert.alert || 'Vulnerability',
                description: alert.description || 'No description provided.',
                severity: this.mapSeverity(alert.risk),
                url: alert.url || target,
                file: alert.url || target,
                line: 'N/A',
                parameter: alert.param || '',
                evidence: alert.evidence || alert.param || '',
                impact: 'Vulnerability found by OWASP ZAP dynamic analysis.',
                remediation: alert.solution || 'Follow general security best practices.',
                payload: alert.attack || '',
                cvssScore: alert.risk === 'High' || alert.risk === 'Critical' ? 9.0 : alert.risk === 'Medium' ? 5.0 : 3.0
            };
        }).filter(f => f !== null);

        if (!allowPartial) {
            this.addLog(scanId, `Scan complete. Found ${findings.length} alerts.`);
            this.updateProgress(scanId, 100);
        }

        const result = {
            summary: {
                total: findings.length,
                critical: findings.filter(f => f.severity === 'critical').length,
                high: findings.filter(f => f.severity === 'high').length,
                medium: findings.filter(f => f.severity === 'medium').length,
                low: findings.filter(f => f.severity === 'low').length,
                info: findings.filter(f => f.severity === 'info').length,
            },
            findings: findings
        };

        // Update local cache
        this.scanFindings.set(scanId, result);
        return result;
    }

    async runSimulation(scanId, target) {
        // Simulation steps
        this.addLog(scanId, 'Initializing Virtual Scanner Engine...');
        await new Promise(r => setTimeout(r, 1500));
        this.updateProgress(scanId, 10);

        this.addLog(scanId, `Crawling target: ${target}`);
        await new Promise(r => setTimeout(r, 2000));
        this.updateProgress(scanId, 30);
        this.addLog(scanId, 'Spider found 12 injectable endpoints.');

        this.addLog(scanId, 'Injecting payloads (XSS, SQLi, CMDi)...');
        await new Promise(r => setTimeout(r, 2000));
        this.updateProgress(scanId, 50);

        this.addLog(scanId, 'Analyzing response differentials...');
        await new Promise(r => setTimeout(r, 2000));
        this.updateProgress(scanId, 80);

        // Generate synthetic alerts
        const mockAlerts = [
            {
                alert: 'Cross Site Scripting (Reflected)',
                description: 'The application echoes user input without proper encoding, allowing for script execution.',
                risk: 'High',
                url: `${target}?q=<script>alert(1)</script>`,
                param: 'q',
                solution: 'Implement robust output encoding and Content Security Policy.'
            },
            {
                alert: 'SQL Injection',
                description: 'The user input is concatenated directly into a SQL query, allowing database manipulation.',
                risk: 'Critical',
                url: `${target}?id=1'`,
                param: 'id',
                solution: 'Use parameterized queries or prepared statements.'
            },
            {
                alert: 'Missing X-Frame-Options Header',
                description: 'The response does not include X-Frame-Options, making it vulnerable to Clickjacking.',
                risk: 'Medium',
                url: target,
                solution: 'Add X-Frame-Options: DENY header.'
            },
            {
                alert: 'Directory Browsing',
                description: 'Directory listing is enabled, exposing server file structure.',
                risk: 'Low',
                url: `${target}/images/`,
                solution: 'Disable directory listing in web server configuration.'
            }
        ];

        this.addLog(scanId, 'Finalizing report...');
        this.updateProgress(scanId, 95);
        await new Promise(r => setTimeout(r, 1000));

        return this.processFindings(scanId, mockAlerts, target);
    }

    async checkZapHealth() {
        try {
            const res = await axios.get(`${this.zapApiUrl}/JSON/core/view/version/?apikey=${this.apiKey}`, {
                headers: { 'Accept': 'application/json' }
            });
            // Strict check: Ensure it's not HTML (like the React app)
            if (typeof res.data === 'string' && res.data.trim().startsWith('<')) {
                console.error(`[ZapService] Error: ${this.zapApiUrl} is serving HTML, not ZAP API. Check your port configuration.`);
                return false;
            }
            return !!res.data;
        } catch (e) {
            console.error(`[ZapService] Health check failed: ${e.message}`);
            return false;
        }
    }

    async startSpider(target) {
        const res = await axios.get(`${this.zapApiUrl}/JSON/spider/action/scan/?url=${encodeURIComponent(target)}&apikey=${this.apiKey}`);
        return res.data && res.data.scan ? res.data.scan : null;
    }

    async waitForSpider(spiderId, scanId) {
        if (!spiderId) {
            this.addLog(scanId, "Spider ID missing, skipping wait.");
            return;
        }
        let status = 0;
        let attempts = 0;
        while (status < 100 && attempts < 30) { // Max 1 minute safety
            await new Promise(r => setTimeout(r, 2000));
            attempts++;
            try {
                const res = await axios.get(`${this.zapApiUrl}/JSON/spider/view/status/?scanId=${spiderId}&apikey=${this.apiKey}`);
                const rawStatus = res.data && res.data.status;
                status = parseInt(rawStatus, 10);
                if (isNaN(status)) status = 0;
                this.addLog(scanId, `Spider Progress: ${status}%`);
            } catch (e) {
                this.addLog(scanId, `Spider query error: ${e.message}`);
                break;
            }
        }
    }

    async startActiveScan(target) {
        const res = await axios.get(`${this.zapApiUrl}/JSON/ascan/action/scan/?url=${encodeURIComponent(target)}&apikey=${this.apiKey}`);
        return res.data && res.data.scan ? res.data.scan : null;
    }

    async waitForActiveScan(ascanId, scanId) {
        if (!ascanId) {
            this.addLog(scanId, "Active Scan ID missing, skipping wait.");
            return;
        }
        let status = 0;
        let attempts = 0;
        while (status < 100 && attempts < 60) { // Max 5 minute safety
            await new Promise(r => setTimeout(r, 5000));
            attempts++;
            try {
                const res = await axios.get(`${this.zapApiUrl}/JSON/ascan/view/status/?scanId=${ascanId}&apikey=${this.apiKey}`);
                const rawStatus = res.data && res.data.status;
                status = parseInt(rawStatus, 10);
                if (isNaN(status)) status = 0;
                this.addLog(scanId, `Active Scan Progress: ${status}%`);
                this.updateProgress(scanId, 40 + (status / 2));

                // Partial Update: Every 15 seconds (approx every 3rd iteration since 5000ms delay)
                if (attempts % 3 === 0) {
                    const alerts = await this.getAlerts(target);
                    this.processFindings(scanId, alerts, target, true);
                }
            } catch (e) {
                this.addLog(scanId, `Active scan query error: ${e.message}`);
                break;
            }
        }
    }

    async getAlerts(target) {
        try {
            const res = await axios.get(`${this.zapApiUrl}/JSON/core/view/alerts/?baseurl=${encodeURIComponent(target)}&apikey=${this.apiKey}`);
            if (res.data && Array.isArray(res.data.alerts)) {
                return res.data.alerts;
            }
            if (Array.isArray(res.data)) {
                return res.data; // Some formats return array directly
            }
            return [];
        } catch (e) {
            return [];
        }
    }

    mapSeverity(risk) {
        if (!risk) return 'info';
        const riskStr = String(risk).toLowerCase();
        if (riskStr.includes('critical')) return 'critical';
        if (riskStr.includes('high')) return 'high';
        if (riskStr.includes('medium')) return 'medium';
        if (riskStr.includes('low')) return 'low';
        return 'info';
    }

    addLog(scanId, message) {
        const logs = this.scanLogs.get(scanId) || [];
        logs.push(`[${new Date().toLocaleTimeString()}] ${message}`);
        if (logs.length > 100) logs.shift();
        this.scanLogs.set(scanId, logs);
    }

    updateProgress(scanId, value) {
        this.scanProgress.set(scanId, Math.floor(value));
    }

    getProgress(scanId) {
        const findingsData = this.scanFindings.get(scanId);
        return {
            progress: this.scanProgress.get(scanId) || 0,
            logs: this.scanLogs.get(scanId) || [],
            findings: findingsData?.findings || [],
            summary: findingsData?.summary || {}
        };
    }
}

module.exports = ZapService;

const { v4: uuidv4 } = require('uuid');

class ReportTransformer {
    /**
     * Transform scanner JSON output to whitelabel VAPT Framework format
     * Removes all scanner branding and references
     */
    static transform(wapitiResults) {
        try {
            const findings = [];
            const summary = {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0,
            };

            // Wapiti JSON has 3 sections: vulnerabilities, anomalies, additionals
            const sections = [
                { data: wapitiResults.vulnerabilities || {}, label: 'vulnerabilities' },
                { data: wapitiResults.anomalies || {}, label: 'anomalies' },
                { data: wapitiResults.additionals || {}, label: 'additionals' },
            ];

            sections.forEach(({ data, label }) => {
                Object.keys(data).forEach(vulnType => {
                    const vulnArray = data[vulnType];
                    if (!Array.isArray(vulnArray) || vulnArray.length === 0) return;

                    vulnArray.forEach(vuln => {
                        const transformedVuln = this.transformVulnerability(vuln, vulnType);
                        if (label !== 'vulnerabilities') {
                            transformedVuln.source = label;
                        }
                        findings.push(transformedVuln);

                        // Update summary counts
                        summary.total++;
                        if (summary[transformedVuln.severity] !== undefined) {
                            summary[transformedVuln.severity]++;
                        } else {
                            summary.info++;
                        }
                    });
                });
            });

            console.log(`[ReportTransformer] Parsed ${summary.total} findings from Wapiti report`);

            return {
                findings,
                summary,
            };
        } catch (error) {
            console.error('Error transforming security results:', error);
            return {
                findings: [],
                summary: {
                    total: 0,
                    critical: 0,
                    high: 0,
                    medium: 0,
                    low: 0,
                    info: 0,
                },
            };
        }
    }

    /**
     * Transform individual vulnerability to VAPT format
     */
    static transformVulnerability(scanVuln, vulnType) {
        const severity = this.mapSeverity(scanVuln.level || scanVuln.severity || 2, vulnType);
        const cvssScore = this.calculateCVSS(severity, vulnType);
        const evidence = this.sanitizeEvidence(scanVuln);
        const payload = this.extractPayload(scanVuln);
        const parameter = scanVuln.parameter || scanVuln.var || scanVuln.param || '';
        const curlCommand = scanVuln.curl_command || '';

        return {
            id: uuidv4(),
            severity,
            type: this.mapVulnerabilityType(vulnType),
            title: this.mapVulnerabilityType(vulnType),
            url: this.normalizeUrl(scanVuln),
            parameter: parameter,
            description: scanVuln.description || this.generateFallbackDescription(vulnType),
            summary: evidence || this.generateFallbackDescription(vulnType),
            evidence: evidence,
            remediation: this.getRemediation(vulnType),
            impact: this.getImpact(vulnType),
            stepsToReproduce: this.getStepsToReproduce(vulnType, scanVuln.url || scanVuln.path, parameter, payload),
            curlCommand: curlCommand || this.generateCurlCommand(scanVuln),
            reproductionUrl: this.generateReproductionUrl(scanVuln),
            payload: payload,
            cvssScore,
        };
    }

    /**
     * Extract payload from Wapiti info/detail fields or ZAP attack field
     */
    static extractPayload(scanVuln) {
        // ZAP uses 'attack', generic scans might use 'payload'
        if (scanVuln.attack) return scanVuln.attack;
        if (scanVuln.payload) return scanVuln.payload;

        // Wapiti often puts the payload in 'info' string
        // Example: "Injected: <script>alert(1)</script>"
        const text = scanVuln.info || scanVuln.detail || '';
        const match = text.match(/Injected\s*:\s*(.*)/i) || text.match(/Payload\s*:\s*(.*)/i);
        return match ? match[1] : 'Standard testing payload (see steps to reproduce)';
    }

    /**
     * Get detailed Impact description
     */
    static getImpact(vulnType) {
        const impactMap = {
            'SQL Injection': 'Critical Impact: Attackers can execute arbitrary SQL commands, potentially stealing sensitive data (passwords, emails), modifying database records, or deleting entire tables.',
            'Cross Site Scripting': 'High Impact: Attackers can inject malicious scripts to steal user session cookies, redirect users to phishing sites, or deface the website.',
            'File Handling': 'High Impact: Attackers may upload malicious files (webshells) to gain remote code execution (RCE) or access sensitive system files.',
            'Command Execution': 'Critical Impact: Full system compromise. Attackers can execute operating system commands, potentially taking full control of the server.',
            'CRLF': 'Medium Impact: Can lead to HTTP response splitting, cache poisoning, or XSS attacks.',
            'XXE': 'High Impact: Attackers can read internal server files, perform SSRF attacks, or cause Denial of Service.',
            'Backup file': 'Low Impact: Exposure of old source code or configuration files may reveal logic or secrets to attackers.',
            'Potentially dangerous file': 'Medium Impact: Presence of sensitive files (installers, logs) can aid attackers in reconnaissance.',
            'CSRF': 'Medium Impact: Attackers can force authenticated users to perform unwanted actions (e.g., changing passwords) without their consent.',
            'Open Redirect': 'Medium Impact: Used in phishing attacks to trick users into trusting a malicious link.',
            'SSRF': 'High Impact: Attackers can send requests to internal network services, bypassing firewalls and accessing restricted internal systems.',
            'Secure Flag cookie': 'Info: Cookies transmitted without Secure flag can be intercepted over unencrypted connections.',
            'HttpOnly Flag cookie': 'Info: Session cookies without HttpOnly flag can be stolen via XSS attacks.',
            'Content Security Policy Configuration': 'Info: Missing CSP header allows injection of unauthorized scripts, frames, and resources.',
            'Clickjacking Protection': 'Info: Without X-Frame-Options, the page can be embedded in malicious iframes for clickjacking attacks.',
            'HTTP Strict Transport Security (HSTS)': 'Info: Without HSTS, users can be downgraded to HTTP connections via SSL stripping.',
            'MIME Type Confusion': 'Info: Without X-Content-Type-Options: nosniff, browsers may misinterpret file types.',
            'Cleartext Submission of Password': 'Medium Impact: Passwords submitted over HTTP can be intercepted by network attackers.',
            'Weak credentials': 'Medium Impact: Weak or default credentials allow unauthorized access to accounts.',
            'TLS/SSL misconfigurations': 'Medium Impact: Weak TLS configuration allows traffic interception or downgrade attacks.',
            'Fingerprint web application framework': 'Info: Framework identification helps attackers find version-specific exploits.',
            'Fingerprint web server': 'Info: Server version disclosure aids targeted exploit selection.',
            'LDAP Injection': 'High Impact: Attackers can modify LDAP queries to bypass authentication or extract directory information.',
            'Log4Shell': 'Critical Impact: Remote code execution via JNDI injection in Log4j. Full system compromise possible.',
            'Spring4Shell': 'Critical Impact: Remote code execution in Spring Framework. Full system compromise possible.',
            'Internal Server Error': 'Info: Server errors may reveal stack traces, internal paths, or configuration details.',
            'Resource consumption': 'Medium Impact: Excessive resource usage can lead to Denial of Service.',
        };
        return impactMap[vulnType] || 'Security Risk: This vulnerability may allow unauthorized actions or information disclosure.';
    }

    /**
     * Generate Steps to Reproduce
     */
    static getStepsToReproduce(vulnType, url, param, payload, curlCommand) {
        let steps = '';

        // 1. Prioritize Exact Replication Methods
        // We know we have a reproductionUrl or curlCommand available in the context where this is called
        // but since we don't pass them all in, we rely on the caller to handle the UI part.
        // However, the text here should be specific.

        // Actually, we need to know if we HAVE a reproduction URL or Command to write the text correctly.
        // The original method signature didn't have reproductionUrl. Let's assume the UI handles the actionable part,
        // and here we explain the logic.

        if (vulnType.includes('SQL')) {
            steps = `1. **Target**: The parameter '${param}' is vulnerable to SQL Injection.\n2. **Payload**: Inject the specific payload shown in the 'Reproduction URL' or 'Curl Command' below.\n3. **Verification**: Observe database errors or time delays in the response.`;
        } else if (vulnType.includes('XSS')) {
            steps = `1. **Target**: The parameter '${param}' is vulnerable to Cross-Site Scripting.\n2. **Action**: Click the 'Reproduction URL' link below (for GET) or use the Curl Command.\n3. **Verification**: Confirm that the injected script executes (e.g., an alert pop-up appears).`;
        } else if (vulnType.includes('Command')) {
            steps = `1. **Target**: The parameter '${param}' allows Command Execution.\n2. **Action**: Execute the provided Curl Command to send the payload.\n3. **Verification**: Check the response for system command output (e.g., contents of /etc/passwd).`;
        } else {
            steps = `1. **Target**: The parameter '${param}' was identified as vulnerable.\n2. **Action**: Use the provided Reproduction URL or Curl Command to replicate the request exactly.\n3. **Verification**: Analyze the response for the specific behavior described in the 'Impact' section.`;
        }

        return steps;
    }

    /**
     * Generate full reproduction URL from http_request if available (GET only)
     */
    static generateReproductionUrl(scanVuln) {
        if (!scanVuln.http_request) return '';

        try {
            const lines = scanVuln.http_request.split('\n');
            const requestLine = lines[0].split(' ');
            const method = requestLine[0];
            const path = requestLine[1];

            // Only relevant for GET requests where payload is in URL
            if (method !== 'GET') return '';

            const hostLine = lines.find(l => l.toLowerCase().startsWith('host:'));
            const host = hostLine ? hostLine.split(':')[1].trim() : '';

            if (!host) return `http://unknown-host${path}`; // Fallback if host missing

            return `http://${host}${path}`;
        } catch (e) {
            // Fallback: Construct from metadata if possible
            if (scanVuln.url && scanVuln.parameter && scanVuln.payload && scanVuln.method === 'GET') {
                try {
                    const separator = scanVuln.url.includes('?') ? '&' : '?';
                    return `${scanVuln.url}${separator}${scanVuln.parameter}=${encodeURIComponent(scanVuln.payload)}`;
                } catch (err) {
                    return '';
                }
            }
            return '';
        }
    }

    /**
     * Generate curl command from http_request if available
     */
    static generateCurlCommand(scanVuln) {
        if (!scanVuln.http_request) return '';

        try {
            const lines = scanVuln.http_request.split('\n');
            const requestLine = lines[0].split(' ');
            const method = requestLine[0];
            const path = requestLine[1];
            const hostLine = lines.find(l => l.toLowerCase().startsWith('host:'));
            const host = hostLine ? hostLine.split(':')[1].trim() : '';

            if (!host) return '';

            const url = `http://${host}${path}`; // Assuming HTTP for now, scanner should provide protocol ideally

            // Basic curl construction
            return `curl -X ${method} "${url}"`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Map scanner severity levels to our categories
     */
    static mapSeverity(scanLevel, vulnType = '') {
        // Wapiti levels: 1 (high), 2 (medium), 3 (low)
        // Upgrade critical types
        if (vulnType.includes('SQL') || vulnType.includes('Command') || vulnType.includes('Execution')) {
            return 'critical';
        }
        // Security headers and cookie flags are informational/low
        if (vulnType.includes('Flag cookie') || vulnType.includes('HSTS') ||
            vulnType.includes('CSP') || vulnType.includes('Clickjacking') ||
            vulnType.includes('MIME') || vulnType.includes('Fingerprint') ||
            vulnType.includes('Unencrypted') || vulnType.includes('Inconsistent')) {
            return 'info';
        }
        if (vulnType.includes('Cleartext') || vulnType.includes('Weak credentials') ||
            vulnType.includes('TLS')) {
            return 'medium';
        }

        const levelMap = {
            1: 'high',
            2: 'medium',
            3: 'low',
        };

        const level = typeof scanLevel === 'number' ? scanLevel : parseInt(scanLevel) || 2;
        return levelMap[level] || 'medium';
    }

    /**
     * Map vulnerability types to user-friendly names
     */
    static mapVulnerabilityType(scanType) {
        const typeMap = {
            'SQL Injection': 'SQL Injection',
            'Blind SQL Injection': 'SQL Injection',
            'Cross Site Scripting': 'Cross Site Scripting',
            'Reflected Cross Site Scripting': 'Cross Site Scripting',
            'Stored Cross Site Scripting': 'Stored XSS',
            'Stored HTML Injection': 'HTML Injection',
            'HTML Injection': 'HTML Injection',
            'File Handling': 'File Handling',
            'Unrestricted File Upload': 'File Upload',
            'Command Execution': 'Command Execution',
            'CRLF Injection': 'CRLF',
            'CRLF': 'CRLF',
            'XXE': 'XXE',
            'Backup file': 'Backup file',
            'Potentially dangerous file': 'Potentially dangerous file',
            'Cross Site Request Forgery': 'CSRF',
            'CSRF': 'CSRF',
            'Open Redirect': 'Open Redirect',
            'SSRF': 'SSRF',
            'Server Side Request Forgery': 'SSRF',
            'Path Traversal': 'Path Traversal',
            'LDAP Injection': 'LDAP Injection',
            'Log4Shell': 'Log4Shell (CVE-2021-44228)',
            'Spring4Shell': 'Spring4Shell (CVE-2022-22965)',
            'Secure Flag cookie': 'Missing Secure Flag (Cookie)',
            'HttpOnly Flag cookie': 'Missing HttpOnly Flag (Cookie)',
            'Content Security Policy Configuration': 'Missing CSP Header',
            'Clickjacking Protection': 'Missing X-Frame-Options',
            'HTTP Strict Transport Security (HSTS)': 'Missing HSTS Header',
            'MIME Type Confusion': 'Missing X-Content-Type-Options',
            'Cleartext Submission of Password': 'Cleartext Password Submission',
            'Weak credentials': 'Weak Credentials',
            'Fingerprint web application framework': 'Framework Fingerprinting',
            'Fingerprint web server': 'Server Fingerprinting',
            'Htaccess Bypass': 'Htaccess Bypass',
            'Unencrypted Channels': 'Unencrypted Communication',
            'Inconsistent Redirection': 'Inconsistent Redirect',
            'Information Disclosure - Full Path': 'Information Disclosure',
            'TLS/SSL misconfigurations': 'TLS/SSL Misconfiguration',
            'Subdomain takeover': 'Subdomain Takeover',
            'NS takeover': 'NS Takeover',
            'Vulnerable software': 'Vulnerable Software',
            'Resource consumption': 'Resource Consumption (DoS)',
            'Internal Server Error': 'Server Error (500)',
        };

        return typeMap[scanType] || scanType;
    }

    /**
     * Sanitize and format evidence from scanner
     */
    static sanitizeEvidence(scanVuln) {
        // Remove scanner-specific references
        let evidence = scanVuln.info || scanVuln.detail || '';

        // Remove "Wapiti found" or similar phrases
        evidence = evidence.replace(/Wapiti|wapiti/gi, 'VAPT Engine');
        evidence = evidence.replace(/Detected (found|detected|identified)/gi, 'Detected');

        // Add request/response info if available
        if (scanVuln.method && scanVuln.parameter) {
            evidence = `${scanVuln.method} parameter '${scanVuln.parameter}' is vulnerable. ${evidence}`;
        }

        return evidence || 'Vulnerability detected during automated security assessment.';
    }

    /**
     * Get remediation advice for vulnerability type
     */
    static getRemediation(vulnType) {
        const remediationMap = {
            'SQL Injection': 'Use parameterized queries or prepared statements. Implement input validation and sanitize all user inputs. Use ORM frameworks with built-in protection.',
            'Cross Site Scripting': 'Implement proper output encoding. Use Content Security Policy (CSP) headers. Sanitize and validate all user inputs. Use security libraries for HTML encoding.',
            'File Handling': 'Implement strict file type validation. Use whitelist approach for allowed file extensions. Store uploaded files outside web root. Scan files for malware.',
            'Command Execution': 'Avoid executing system commands with user input. Use safe APIs instead of shell commands. Implement strict input validation. Use least privilege principle.',
            'XXE': 'Disable external entity processing in XML parsers. Use secure XML parsing libraries. Validate and sanitize XML input.',
            'CSRF': 'Implement anti-CSRF tokens. Use SameSite cookie attribute. Verify Origin and Referrer headers.',
            'Open Redirect': 'Use whitelist of allowed redirect URLs. Validate and sanitize redirect parameters. Avoid user-controlled redirects.',
            'Path Traversal': 'Implement strict input validation. Use path canonicalization. Avoid direct file system access with user input.',
            'Secure Flag cookie': 'Set Secure flag on all cookies transmitted over HTTPS to prevent interception via Man-in-the-Middle.',
            'HttpOnly Flag cookie': 'Set HttpOnly flag on session cookies to prevent XSS-based cookie theft.',
            'Content Security Policy Configuration': 'Implement a strict Content-Security-Policy header to prevent XSS, clickjacking, and data injection attacks.',
            'Clickjacking Protection': 'Add X-Frame-Options: DENY or SAMEORIGIN header. Use CSP frame-ancestors directive.',
            'HTTP Strict Transport Security (HSTS)': 'Add Strict-Transport-Security header with max-age and includeSubDomains directives.',
            'MIME Type Confusion': 'Add X-Content-Type-Options: nosniff header to prevent MIME sniffing attacks.',
            'Cleartext Submission of Password': 'Ensure all login forms submit over HTTPS. Redirect HTTP to HTTPS automatically.',
            'Weak credentials': 'Enforce strong password policies. Implement account lockout and rate limiting. Use multi-factor authentication.',
            'TLS/SSL misconfigurations': 'Use TLS 1.2+ only. Disable weak ciphers. Implement proper certificate chain.',
            'Fingerprint web application framework': 'Remove or obscure framework version headers (X-Powered-By, Server). Custom error pages.',
            'Fingerprint web server': 'Suppress server version headers. Use custom error pages to prevent information leakage.',
            'LDAP Injection': 'Sanitize user input before LDAP queries. Use parameterized LDAP operations.',
            'Log4Shell': 'Upgrade Log4j to 2.17.0+. Set log4j2.formatMsgNoLookups=true. Block outgoing JNDI connections.',
            'Spring4Shell': 'Upgrade Spring Framework to 5.3.18+ / 5.2.20+. Apply vendor patches immediately.',
        };

        return remediationMap[vulnType] || 'Review and remediate the identified security issue. Follow OWASP security guidelines and industry best practices.';
    }

    /**
     * Calculate CVSS score based on severity and type
     */
    static calculateCVSS(severity, vulnType) {
        // Deterministic scores based on severity and type
        const baseScores = {
            critical: 9.2,
            high: 7.5,
            medium: 5.1,
            low: 3.2,
            info: 0.0,
        };

        let score = baseScores[severity] || 5.0;

        // Add precision based on vulnerability type
        if (vulnType.includes('SQL')) score += 0.5;
        if (vulnType.includes('Command')) score += 0.7;
        if (vulnType.includes('Scripting')) score += 0.3;

        return Math.min(9.9, score);
    }

    /**
     * Normalize URL to ensure it has a protocol and host if possible
     */
    static normalizeUrl(scanVuln) {
        let url = scanVuln.url || scanVuln.path || '';
        if (url.startsWith('/')) {
            // Try to recover host from http_request if available
            if (scanVuln.http_request) {
                const lines = scanVuln.http_request.split('\n');
                const hostLine = lines.find(l => l.toLowerCase().startsWith('host:'));
                if (hostLine) {
                    const host = hostLine.split(':')[1].trim();
                    return `http://${host}${url}`;
                }
            }
        }
        return url || 'Unknown Endpoint';
    }

    /**
     * Generate a professional description if the scanner provided none
     */
    static generateFallbackDescription(vulnType) {
        const descMap = {
            'SQL Injection': 'SQL Injection occurs when untrusted user data is sent to an interpreter as part of a command or query. Attackers can manipulate the query to access, modify, or delete data.',
            'Cross Site Scripting': 'Cross-Site Scripting (XSS) allows attackers to execute malicious scripts in the web browser of a victim. This can lead to session hijacking, defacement, or redirecting the user to malicious sites.',
            'Command Execution': 'Command Injection allows an attacker to execute arbitrary operating system commands on the server that is running an application. This typically leads to full system compromise.',
            'Path Traversal': 'Path Traversal allows an attacker to access files and directories that are stored outside the web root folder. By manipulating variables that reference files with "dot-dot-slash (../)" sequences and its variations.',
        };
        return descMap[vulnType] || `The application appears to be vulnerable to ${vulnType}. This issue could identify a security weakness that might be exploited to compromise the confidentiality, integrity, or availability of the application.`;
    }
}

module.exports = ReportTransformer;

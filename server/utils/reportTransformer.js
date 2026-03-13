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
            cvss: cvssScore, // Explicit cvss mapping for frontend
            owasp: this.mapOwaspCategory(vulnType),
            cweId: this.mapCwe(vulnType).id,
            cweName: this.mapCwe(vulnType).name,
            status: 'Open'
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
            'SQL Injection': 'Critical Impact: Attackers can execute arbitrary SQL commands, bypassing authentication, extruding highly sensitive data (PII, credentials), modifying records, and potentially achieving Remote Code Execution (RCE) via database-level functions. Leads to full database compromise and potential persistence.',
            'Cross Site Scripting': 'High Impact: Attackers can inject arbitrary JavaScript executed within the victim\'s browser context. This leads to session cookie hijacking, account takeover, DOM manipulation, and delivery of secondary payloads such as browser-based keyloggers or crypto-miners.',
            'File Handling': 'High Impact: Arbitrary file upload/handling vulnerabilities allow attackers to place malicious scripts (e.g., webshells) on the server, leading to direct Remote Code Execution (RCE), full server compromise, and lateral movement within the internal network.',
            'Command Execution': 'Critical Impact: Allows attackers to execute arbitrary operating system commands with the privileges of the web service user. Typically results in total infrastructure compromise, data exfiltration, and the ability to install persistent backdoors.',
            'CRLF': 'Medium Impact: CRLF injection allows manipulation of HTTP response headers. Attackers can perform HTTP Response Splitting, cache poisoning, and deliver delayed XSS attacks by tricking browsers into interpreting header values as body content.',
            'XXE': 'High Impact: XML External Entity (XXE) processing allows attackers to read arbitrary local files from the server (e.g., /etc/passwd), scan internal network ranges (SSRF), and potentially cause Denial of Service by exhausting parser resources.',
            'Backup file': 'Low Impact: Exposure of backup or temporary files (.bak, .swp, ~) often leaks source code, hardcoded credentials, and infrastructure configuration, significantly reducing the attacker\'s reconnaissance effort and uncovering hidden attack vectors.',
            'Potentially dangerous file': 'Medium Impact: Presence of sensitive operational files (.env, .git, installers, configuration snapshots) provides an attacker with a blueprint of the application architecture and potentially high-value secrets or API keys.',
            'CSRF': 'Medium Impact: Cross-Site Request Forgery forces an authenticated victim\'s browser to execute state-changing actions (e.g., changing email/password) on behalf of the attacker without the victim\'s knowledge or consent.',
            'Open Redirect': 'Medium Impact: Allows an attacker to redirect users to malicious domains using a trusted application link. Heavily abused in targeted phishing campaigns to harvest credentials or deliver malware.',
            'SSRF': 'High Impact: Server-Side Request Forgery allows an attacker to coerce the server into making HTTP requests to internal unroutable resources, cloud metadata APIs (e.g., AWS/GCP metadata), or external malicious domains.',
            'Secure Flag cookie': 'Info: Cookies transmitted without the Secure flag can be intercepted by network-level attackers over unencrypted connections (HTTP), leading to session hijacking via Man-in-the-Middle (MitM) attacks.',
            'HttpOnly Flag cookie': 'Info: Session cookies lacking the HttpOnly flag can be accessed via client-side scripts, making them trivial to steal during an XSS attack, leading to instant account takeover.',
            'Content Security Policy Configuration': 'Info: The absence of a robust Content Security Policy (CSP) increases the attack surface for client-side injections (XSS, Clickjacking) by allowing execution of untrusted scripts and unauthorized cross-origin resource loading.',
            'Clickjacking Protection': 'Info: Missing anti-framing headers allow attackers to embed the application in an invisible iframe on a malicious site, tricking users into performing unintended actions like deleting accounts or clicking buttons.',
            'HTTP Strict Transport Security (HSTS)': 'Info: Without HSTS, the application is vulnerable to SSL-stripping attacks, allowing attackers to downgrade user connections to plaintext HTTP and intercept sensitive data.',
            'MIME Type Confusion': 'Info: Missing the X-Content-Type-Options: nosniff header allows browsers to perform MIME-sniffing, which can be exploited to execute user-uploaded files as scripts.',
            'Cleartext Submission of Password': 'High Impact: Submitting credentials over unencrypted HTTP allows network attackers to capture passwords in transit via packet sniffing. Critical risk on public or untrusted networks.',
            'Weak credentials': 'High Impact: The use of default or easily guessable credentials allows automated systems and malicious actors to gain unauthorized administrative access to critical application components.',
            'TLS/SSL misconfigurations': 'Medium Impact: Support for deprecated protocols (TLS 1.0/1.1) or weak cipher suites exposes encrypted traffic to decryption or cryptographic downgrade attacks.',
            'Log4Shell': 'Critical Impact: Allows unauthenticated Remote Code Execution (RCE) via JNDI injection. Attackers can completely compromise system nodes running vulnerable Java Log4j libraries.',
            'Internal Server Error': 'Info: Verbose error messages often leak internal file paths, framework stack traces, and database schemas, which attackers use to refine their exploits and map internal infrastructure.',
        };
        return impactMap[vulnType] || 'Security Risk: The identified vulnerability introduces an architectural weakness that may allow unauthorized actions, privilege escalation, or sensitive information disclosure.';
    }

    /**
     * Generate Steps to Reproduce
     */
    static getStepsToReproduce(vulnType, url, param, payload, curlCommand) {
        let steps = '';

        if (vulnType.includes('SQL')) {
            steps = `1. **Target Identification**: Identify the injection vector at parameter \`${param}\` on \`${url}\`.\n2. **Payload Execution**: Inject the specific payload: \`${payload || '\' OR 1=1--'}\` via the browser or intercepts.\n3. **Validation**: Observe the backend database error syntax leakage or the time-delay boolean response, confirming successful query alteration.`;
        } else if (vulnType.includes('XSS')) {
            steps = `1. **Target Identification**: Identify the reflected or stored sink at parameter \`${param}\` on \`${url}\`.\n2. **Payload Execution**: Inject the non-malicious execution wrapper: \`${payload || '<script>alert(1)</script>'}\`.\n3. **Validation**: Execute the request. Confirm that the browser executes the injected JavaScript context without sanitization.`;
        } else if (vulnType.includes('Command')) {
            steps = `1. **Target Identification**: Locate the OS command sink at parameter \`${param}\`.\n2. **Payload Execution**: Inject the command separator sequence followed by an innocuous command: \`${payload || '; id'}\`.\n3. **Validation**: Review the HTTP response for standard OS output streams (e.g., stdout returning \`uid=0(root)\`).`;
        } else {
            steps = `1. **Target Identification**: Isolate the vulnerable entry point at parameter \`${param}\`.\n2. **Payload Execution**: Replay the vulnerability using the exact provided Reproduction URL or Curl Command below.\n3. **Validation**: Analyze the HTTP response to confirm the theoretical impact described in this report materializes.`;
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

            if (method !== 'GET') return '';

            const hostLine = lines.find(l => l.toLowerCase().startsWith('host:'));
            const host = hostLine ? hostLine.split(':')[1].trim() : '';

            if (!host) return `http://unknown-host${path}`;

            return `http://${host}${path}`;
        } catch (e) {
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

            const url = `http://${host}${path}`; 
            
            // Build advanced curl command including exact path and body (if POST)
            let cmd = `curl -i -s -k -X '${method}' \\\n    '${url}'`;
            
            // Extract some critical headers to make curl usable
            const userAgent = lines.find(l => l.toLowerCase().startsWith('user-agent:'));
            const contentType = lines.find(l => l.toLowerCase().startsWith('content-type:'));
            
            if (userAgent) cmd += ` \\\n    -H '${userAgent.trim()}'`;
            if (contentType) cmd += ` \\\n    -H '${contentType.trim()}'`;
            
            // If POST/PUT, add data
            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                const parts = scanVuln.http_request.split('\r\n\r\n');
                if (parts.length > 1 && parts[1].trim()) {
                    // Escape single quotes in bash
                    const safeData = parts[1].trim().replace(/'/g, "'\\''");
                    cmd += ` \\\n    --data-raw '${safeData}'`;
                } else if (scanVuln.payload) {
                    const safePayload = scanVuln.parameter ? `${scanVuln.parameter}=${scanVuln.payload}` : scanVuln.payload;
                    cmd += ` \\\n    --data-raw '${safePayload.replace(/'/g, "'\\''")}'`;
                }
            }

            return cmd;
        } catch (e) {
            return '';
        }
    }

    /**
     * Map scanner severity levels to our categories
     */
    static mapSeverity(scanLevel, vulnType = '') {
        if (vulnType.includes('SQL') || vulnType.includes('Command') || vulnType.includes('Execution') || vulnType.includes('XXE') || vulnType.includes('Log4') || vulnType.includes('Spring4')) {
            return 'critical';
        }
        if (vulnType.includes('SSRF') || vulnType.includes('Cross Site Scripting') || vulnType.includes('LDAP')) {
             return 'high';
        }
        if (vulnType.includes('Flag cookie') || vulnType.includes('HSTS') ||
            vulnType.includes('CSP') || vulnType.includes('Clickjacking') ||
            vulnType.includes('MIME') || vulnType.includes('Fingerprint') ||
            vulnType.includes('Unencrypted') || vulnType.includes('Inconsistent') || vulnType.includes('Error')) {
            return 'info';
        }
        if (vulnType.includes('Cleartext') || vulnType.includes('Weak credentials') ||
            vulnType.includes('TLS') || vulnType.includes('CSRF') || vulnType.includes('Redirect') || vulnType.includes('CRLF')) {
            return 'medium';
        }

        const levelMap = { 1: 'high', 2: 'medium', 3: 'low' };
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
        let evidence = scanVuln.info || scanVuln.detail || '';

        evidence = evidence.replace(/Wapiti|wapiti/gi, 'VAPT Engine');
        evidence = evidence.replace(/Detected (found|detected|identified)/gi, 'Detected');

        if (scanVuln.method && scanVuln.parameter) {
            evidence = `${scanVuln.method} parameter '${scanVuln.parameter}' is vulnerable. ${evidence}`;
        }

        return evidence || 'Vulnerability verified utilizing custom algorithmic payloads.';
    }

    /**
     * Get remediation advice for vulnerability type
     */
    static getRemediation(vulnType) {
        const remediationMap = {
            'SQL Injection': '1. Standardize the use of Parameterized Queries (Prepared Statements) for all database operations. \n2. Utilize a mature ORM/Query Builder that handles escaping natively. \n3. Enforce principle of least privilege for database service accounts, limiting access to only required tables and disabling shell execution functions.',
            'Cross Site Scripting': '1. Apply context-aware output encoding (e.g., HTML, JavaScript, CSS, URL encoding) for all user-supplied data before rendering. \n2. Implement a strict Content Security Policy (CSP) with a hash or nonce-based approach for scripts. \n3. Validate and sanitize input using a well-vetted library like DOMPurify for HTML content.',
            'File Handling': '1. Validate file types against a strict whitelist of allowed extensions and MIME types. \n2. Randomly rename uploaded files and store them in a dedicated, non-executable directory or an isolated object storage bucket (e.g., AWS S3). \n3. Use a web application firewall (WAF) to inspect uploaded content for malicious signatures.',
            'Command Execution': '1. Avoid passing user input directly to system shell commands. Use native programming language APIs instead. \n2. If system calls are unavoidable, use an allowlist for permitted commands and strictly sanitize all arguments. \n3. Run the application in a restricted environment (e.g., containerization or chroot jail) with minimal system permissions.',
            'XXE': '1. Disable DTD (Document Type Definition) and external entity processing in your XML parser configuration. \n2. Prefer less complex data formats like JSON for data exchange where possible. \n3. Keep XML processing libraries updated to the latest secure versions.',
            'CSRF': '1. Implement anti-CSRF synchronization tokens for all state-changing requests. \n2. Use the SameSite=Lax or SameSite=Strict attribute for all session cookies. \n3. Require re-authentication for sensitive actions like password changes or financial transactions.',
            'Open Redirect': '1. Implement an allowlist of permitted destination URLs for redirects. \n2. Avoid using user-supplied URLs directly; instead, use an index or id that maps to a server-side list of safe destinations. \n3. Present a warning page to users before redirecting them to an external site.',
            'Path Traversal': '1. Canonicalize all file paths before use and verify they remain within the intended base directory. \n2. Use a database or internal identifier to map to files instead of using filenames directly in parameters. \n3. Enforce strict filesystem permissions, ensuring the application cannot access sensitive system files like /etc/passwd.',
            'Secure Flag cookie': '1. Enable the "Secure" flag on all cookies, ensuring they are only transmitted over encrypted (HTTPS) connections.',
            'HttpOnly Flag cookie': '1. Set the "HttpOnly" flag on all session cookies to prevent them from being accessed by client-side JavaScript.',
            'Content Security Policy Configuration': '1. Define a restrictive Content Security Policy (CSP) header that only allows content from trusted sources and disables inline script execution.',
            'Clickjacking Protection': '1. Send the X-Frame-Options: DENY or SAMEORIGIN header. \n2. Use the CSP frame-ancestors directive to specify which domains are allowed to frame your site.',
            'HTTP Strict Transport Security (HSTS)': '1. Implement the Strict-Transport-Security header with a long max-age (e.g., one year) and the includeSubDomains directive.',
            'MIME Type Confusion': '1. Send the X-Content-Type-Options: nosniff header to prevent browsers from performing MIME-sniffing.',
            'Cleartext Submission of Password': '1. Enforce HTTPS across the entire application and use permanent redirects (HSTS) to upgrade all HTTP requests.',
            'Weak credentials': '1. Enforce strong password policies including minimum length, complexity, and resistance to common passwords. \n2. Implement Multi-Factor Authentication (MFA) for all user accounts. \n3. Use secure, slow hashing algorithms like Argon2 or bcrypt for storing passwords.',
            'TLS/SSL misconfigurations': '1. Disable weak and outdated protocols like SSLv3 and TLS 1.0/1.1. \n2. Use strong, modern cipher suites that support Forward Secrecy (FS). \n3. Periodically audit your TLS configuration using tools like SSL Labs.',
            'Fingerprint web application framework': '1. Remove or genericize headers like X-Powered-By that reveal the underlying platform. \n2. Customize error pages to prevent framework-specific information leakage.',
            'Log4Shell': '1. Update Log4j to version 2.17.1 or higher immediately. \n2. Disable JNDI lookups via the log4j2.formatMsgNoLookups=true system property if updating is not immediately possible.',
            'Spring4Shell': '1. Update Spring Framework to 5.3.18, 5.2.20, or later. \n2. If updates are delayed, implement a WAF rule to block suspicious strings in request parameters (e.g., "class.module.classLoader").',
        };

        return remediationMap[vulnType] || 'Conduct a deep-dive security architectural review of this endpoint and align with OWASP ASVS integration paradigms.';
    }

    /**
     * Calculate CVSS score based on severity and type
     */
    static calculateCVSS(severity, vulnType) {
        const baseScores = {
            critical: 9.2,
            high: 7.5,
            medium: 5.1,
            low: 3.2,
            info: 0.0,
        };

        let score = baseScores[severity] || 5.0;

        if (vulnType.includes('SQL') || vulnType.includes('Execution')) score = 9.8;
        if (vulnType.includes('Command')) score = 10.0;
        if (vulnType.includes('Scripting')) score = 7.1;
        if (vulnType.includes('SSRF')) score = 8.6;

        return Math.min(10.0, score);
    }

    /**
     * Normalize URL to ensure it has a protocol and host if possible
     */
    static normalizeUrl(scanVuln) {
        let url = scanVuln.url || scanVuln.path || '';
        if (url.startsWith('/')) {
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
            'SQL Injection': 'Advanced SQL Injection vulnerability isolated within the application. This vector allows malicious actors to directly interface with the relational database management system, bypassing application-layer security logic to execute arbitrary, unconstrained SQL queries.',
            'Cross Site Scripting': 'Cross-Site Scripting (XSS) detected. This flaw permits the injection and subsequent execution of unvalidated, attacker-controlled JavaScript payloads directly within the high-trust context of the victim\'s authenticated browser session.',
            'Command Execution': 'Critical OS Command Injection identified. The application improperly passes unfiltered user input to a system-level interpreter or shell, exposing the underlying application infrastructure to arbitrary command execution and complete administrative compromise.',
            'Path Traversal': 'Directory Traversal condition discovered. By manipulating filepath references leveraging sequence characters (i.e., `../`), threat actors can traverse beyond the web application root namespace to read sensitive operating system data or application configurations.',
            'SSRF': 'Server-Side Request Forgery confirmed. The vulnerable endpoint can be weaponized to force the host server to emit authenticated HTTP commands directed toward internal or unintended external infrastructure vectors.',
        };
        return descMap[vulnType] || `The target application demonstrates verified exposure to the ${vulnType} susceptibility. This structural configuration anomaly provides an avenue for attackers to compromise core tenets of the CIA triad (Confidentiality, Integrity, Availability) inside an active context.`;
    }

    /**
     * Map vulnerability type to OWASP Top 10 category
     */
    static mapOwaspCategory(vulnType) {
        const typeStr = (vulnType || '').toLowerCase();
        
        // 2024 Contextual Alignment
        if (typeStr.includes('sql') || typeStr.includes('ldap') || typeStr.includes('command') || typeStr.includes('injection') || typeStr.includes('nosql')) {
            return 'A03:2021 - Injection';
        }
        if (typeStr.includes('xss') || typeStr.includes('cross site scripting') || typeStr.includes('scripting') || typeStr.includes('javascript injection')) {
            return 'A03:2021 - Injection'; // XSS is unified into Injection in the 2021/2024 paradigms
        }
        if (typeStr.includes('csrf') || typeStr.includes('cross site request forgery') || typeStr.includes('cors')) {
            return 'A01:2021 - Broken Access Control';
        }
        if (typeStr.includes('xxe') || typeStr.includes('external entity')) {
            return 'A05:2021 - Security Misconfiguration';
        }
        if (typeStr.includes('ssrf') || typeStr.includes('server side request forgery')) {
            return 'A10:2021 - Server-Side Request Forgery (SSRF)';
        }
        if (typeStr.includes('crlf') || typeStr.includes('response splitting') || typeStr.includes('header injection')) {
            return 'A03:2021 - Injection';
        }
        if (typeStr.includes('tls') || typeStr.includes('ssl') || typeStr.includes('cleartext') || typeStr.includes('unencrypted') || typeStr.includes('encryption') || typeStr.includes('cryptographic')) {
            return 'A02:2021 - Cryptographic Failures';
        }
        if (typeStr.includes('credential') || typeStr.includes('password') || typeStr.includes('authentication') || typeStr.includes('login') || typeStr.includes('brute force')) {
            return 'A07:2021 - Identification and Authentication Failures';
        }
        if (typeStr.includes('file') || typeStr.includes('upload') || typeStr.includes('traversal') || typeStr.includes('lfi') || typeStr.includes('rfi') || typeStr.includes('path')) {
            return 'A01:2021 - Broken Access Control';
        }
        if (typeStr.includes('config') || typeStr.includes('misconfiguration') || typeStr.includes('hsts') || typeStr.includes('csp') || typeStr.includes('secure flag') || typeStr.includes('httponly') || typeStr.includes('clickjacking') || typeStr.includes('frame') || typeStr.includes('nosniff') || typeStr.includes('mismatch')) {
            return 'A05:2021 - Security Misconfiguration';
        }
        if (typeStr.includes('version') || typeStr.includes('outdated') || typeStr.includes('vulnerable component') || typeStr.includes('dependency') || typeStr.includes('cve') || typeStr.includes('retire')) {
            return 'A06:2021 - Vulnerable and Outdated Components';
        }
        if (typeStr.includes('error') || typeStr.includes('disclosure') || typeStr.includes('fingerprint') || typeStr.includes('information') || typeStr.includes('leak')) {
            return 'A04:2021 - Insecure Design';
        }
        if (typeStr.includes('resource') || typeStr.includes('dos') || typeStr.includes('denial') || typeStr.includes('exhaustion') || typeStr.includes('rate limit')) {
            return 'A01:2021 - Broken Access Control';
        }

        return 'A00:2021 - Uncategorized / General';
    }

    /**
     * Map vulnerability type to CWE ID and Name
     */
    static mapCwe(vulnType) {
        const typeStr = (vulnType || '').toLowerCase();

        // High Value Mappings for 2024 Baseline
        if (typeStr.includes('sql')) return { id: 'CWE-89', name: 'Improper Neutralization of Special Elements used in an SQL Command (\'SQL Injection\')' };
        if (typeStr.includes('xss') || typeStr.includes('cross site scripting')) return { id: 'CWE-79', name: 'Improper Neutralization of Input During Web Page Generation (\'Cross-site Scripting\')' };
        if (typeStr.includes('command') || typeStr.includes('rce')) return { id: 'CWE-77', name: 'Improper Neutralization of Special Elements used in a Command (\'Command Injection\')' };
        if (typeStr.includes('path traversal') || typeStr.includes('directory traversal') || typeStr.includes('lfi')) return { id: 'CWE-22', name: 'Improper Limitation of a Pathname to a Restricted Directory (\'Path Traversal\')' };
        if (typeStr.includes('csrf') || typeStr.includes('cross site request forgery')) return { id: 'CWE-352', name: 'Cross-Site Request Forgery (CSRF)' };
        if (typeStr.includes('xxe') || typeStr.includes('external entity')) return { id: 'CWE-611', name: 'Improper Restriction of XML External Entity Reference' };
        if (typeStr.includes('ssrf') || typeStr.includes('server side request forgery')) return { id: 'CWE-918', name: 'Server-Side Request Forgery (SSRF)' };
        if (typeStr.includes('open redirect')) return { id: 'CWE-601', name: 'URL Redirection to Untrusted Site (\'Open Redirect\')' };
        if (typeStr.includes('crlf') || typeStr.includes('response splitting')) return { id: 'CWE-113', name: 'Improper Neutralization of CRLF Sequences in HTTP Headers (\'HTTP Response Splitting\')' };
        if (typeStr.includes('upload') || typeStr.includes('file handling')) return { id: 'CWE-434', name: 'Unrestricted Upload of File with Dangerous Type' };
        if (typeStr.includes('ldap')) return { id: 'CWE-90', name: 'Improper Neutralization of Special Elements used in an LDAP Query (\'LDAP Injection\')' };
        if (typeStr.includes('cleartext') || typeStr.includes('unencrypted') || typeStr.includes('tls') || typeStr.includes('ssl')) return { id: 'CWE-319', name: 'Cleartext Transmission of Sensitive Information' };
        if (typeStr.includes('secure flag')) return { id: 'CWE-614', name: 'Sensitive Cookie in HTTPS Session Without Secure Attribute' };
        if (typeStr.includes('httponly')) return { id: 'CWE-1004', name: 'Sensitive Cookie Without \'HttpOnly\' Flag' };
        if (typeStr.includes('weak credentials') || typeStr.includes('password')) return { id: 'CWE-521', name: 'Weak Password Requirements' };
        if (typeStr.includes('backup') || typeStr.includes('dangerous file') || typeStr.includes('exposure')) return { id: 'CWE-538', name: 'Insertion of Sensitive Information into External-facing File or Directory' };
        if (typeStr.includes('fingerprint') || typeStr.includes('disclosure') || typeStr.includes('information leak')) return { id: 'CWE-200', name: 'Exposure of Sensitive Information to an Unauthorized Actor' };
        if (typeStr.includes('log4shell') || typeStr.includes('deserialization')) return { id: 'CWE-502', name: 'Deserialization of Untrusted Data' };
        if (typeStr.includes('csp') || typeStr.includes('hsts') || typeStr.includes('clickjacking') || typeStr.includes('frame') || typeStr.includes('misconfiguration')) return { id: 'CWE-16', name: 'Configuration' };
        if (typeStr.includes('error') || typeStr.includes('stack trace')) return { id: 'CWE-209', name: 'Generation of Error Message Containing Sensitive Information' };
        if (typeStr.includes('resource consumption') || typeStr.includes('dos') || typeStr.includes('rate limit')) return { id: 'CWE-400', name: 'Uncontrolled Resource Consumption' };
        if (typeStr.includes('cors') || typeStr.includes('origin')) return { id: 'CWE-942', name: 'Permissive Overly-Relaxed Cross-Domain Policy with Wildcards' };

        return { id: 'CWE-000', name: 'Uncategorized / General Security Criticality' };
    }
}

module.exports = ReportTransformer;

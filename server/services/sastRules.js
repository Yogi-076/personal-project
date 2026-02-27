/**
 * VAPT Framework - Advanced SAST Rules Database (Ultra Edition)
 * 
 * This file defines the security patterns for the custom SAST engine.
 * Covers: Secrets, Advanced Code, Infrastructure (IaC), Crypto, and Client-Side.
 */

const SAST_RULES = {
    // -------------------------------------------------------------------------
    // 1. SECRET DETECTION (Credentials, Keys, Tokens)
    // -------------------------------------------------------------------------
    secrets: [
        // Cloud Providers
        {
            id: 'AWS_ACCESS_KEY',
            name: 'AWS Access Key ID',
            description: 'Unencrypted AWS Access Key ID detected.',
            regex: /(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/,
            severity: 'critical',
            remediation: 'Revoke key. Use IAM roles.'
        },
        {
            id: 'AWS_SECRET_KEY',
            name: 'AWS Secret Access Key',
            description: 'Potential AWS Secret Access Key detected.',
            contextRegex: /(aws_secret_access_key|aws_secret_key|secret_key|secret)\s*[:=]\s*['"]([A-Za-z0-9/+=]{40})['"]/i,
            severity: 'critical',
            remediation: 'Revoke key. Do not commit secrets.'
        },
        {
            id: 'GOOGLE_API_KEY',
            name: 'Google API Key',
            description: 'Google Cloud API Key detected.',
            regex: /AIza[0-9A-Za-z\\-_]{35}/,
            severity: 'high',
            remediation: 'Restrict key usage. Use env vars.'
        },
        {
            id: 'GOOGLE_OAUTH',
            name: 'Google OAuth Access Token',
            regex: /ya29\.[0-9A-Za-z\\-_]+/,
            severity: 'high',
            remediation: 'Revoke token.'
        },
        {
            id: 'AZURE_KEY',
            name: 'Microsoft Azure Key',
            description: 'Azure Shared Key or API Key.',
            regex: /[a-zA-Z0-9]{52}==/,
            contextRegex: /(AccountKey|SharedKey|SubscriptionKey|AzureKey)\s*[:=]\s*['"]([a-zA-Z0-9+/=]{40,88})['"]/i,
            severity: 'critical',
            remediation: 'Rotate key via Azure Portal.'
        },
        {
            id: 'HEROKU_API_KEY',
            name: 'Heroku API Key',
            regex: /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/,
            contextRegex: /(heroku|HEROKU).{0,30}[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/i,
            severity: 'high',
            remediation: 'Revoke via Heroku Dashboard.'
        },
        {
            id: 'DIGITALOCEAN_TOKEN',
            name: 'DigitalOcean Token',
            regex: /dop_v1_[a-f0-9]{64}/,
            severity: 'critical',
            remediation: 'Revoke token via DigitalOcean Control Panel.'
        },

        // Social Media
        {
            id: 'FACEBOOK_TOKEN',
            name: 'Facebook Access Token',
            regex: /(EAACEdEose0cBA|EAAL|EAAAR)[a-zA-Z0-9]+/,
            severity: 'medium',
            remediation: 'Revoke token via App Dashboard.'
        },
        {
            id: 'TWITTER_TOKEN',
            name: 'Twitter/X Access Token',
            regex: /[1-9][0-9]+-[0-9a-zA-Z]{40}/,
            severity: 'medium',
            remediation: 'Regenerate keys in Developer Portal.'
        },
        {
            id: 'LINKEDIN_CLIENT',
            name: 'LinkedIn Client Secret',
            regex: /(?!00000000)[0-9a-zA-Z]{16}/, // Too generic?
            contextRegex: /(linkedin|LINKEDIN).{0,30}['"]([0-9a-zA-Z]{16})['"]/i,
            severity: 'medium',
            remediation: 'Rotate client secret.'
        },

        // SaaS & Messaging
        {
            id: 'SLACK_TOKEN',
            name: 'Slack Token',
            regex: /xox[baprs]-([0-9a-zA-Z]{10,48})/,
            severity: 'high',
            remediation: 'Revoke token.'
        },
        {
            id: 'SLACK_WEBHOOK',
            name: 'Slack Webhook',
            regex: /https:\/\/hooks\.slack\.com\/services\/T[a-zA-Z0-9_]{8}\/B[a-zA-Z0-9_]{8}\/[a-zA-Z0-9_]{24}/,
            severity: 'medium',
            remediation: 'Invalidate webhook URL.'
        },
        {
            id: 'TWILIO_API_KEY',
            name: 'Twilio API Key',
            regex: /SK[0-9a-fA-F]{32}/,
            severity: 'high',
            remediation: 'Revoke via Twilio Console.'
        },
        {
            id: 'SENDGRID_KEY',
            name: 'SendGrid API Key',
            regex: /SG\.[0-9a-zA-Z\-_]{22}\.[0-9a-zA-Z\-_]{43}/,
            severity: 'high',
            remediation: 'Revoke API Key.'
        },
        {
            id: 'MAILCHIMP_KEY',
            name: 'Mailchimp API Key',
            regex: /[0-9a-f]{32}-us[0-9]{1,2}/,
            severity: 'medium',
            remediation: 'Disable key.'
        },
        {
            id: 'STRIPE_KEY',
            name: 'Stripe API Key',
            regex: /(sk_live_|rk_live_)[0-9a-zA-Z]{24}/,
            severity: 'critical',
            remediation: 'Rotate key immediately.'
        },
        {
            id: 'PAYPAL_TOKEN',
            name: 'PayPal Access Token',
            regex: /access_token\$production\$[0-9a-z]{16}\$[0-9a-f]{32}/,
            severity: 'high',
            remediation: 'Revoke token.'
        },
        {
            id: 'SQUARE_TOKEN',
            name: 'Square Access Token',
            regex: /sq0atp-[0-9A-Za-z\-_]{22}/,
            severity: 'high',
            remediation: 'Replace token.'
        },

        // DevOps & Git
        {
            id: 'GITHUB_TOKEN',
            name: 'GitHub Personal Access Token',
            regex: /ghp_[0-9a-zA-Z]{36}/,
            severity: 'critical',
            remediation: 'Revoke via GitHub Settings.'
        },
        {
            id: 'GITHUB_OAUTH',
            name: 'GitHub OAuth Access Token',
            regex: /gho_[0-9a-zA-Z]{36}/,
            severity: 'high',
            remediation: 'Revoke token.'
        },
        {
            id: 'GITLAB_TOKEN',
            name: 'GitLab Personal Access Token',
            regex: /glpat-[0-9a-zA-Z\-_]{20}/,
            severity: 'critical',
            remediation: 'Revoke token.'
        },
        {
            id: 'BITBUCKET_TOKEN',
            name: 'Bitbucket App Password',
            contextRegex: /(bitbucket|BITBUCKET).{0,30}['"]([a-zA-Z0-9]{20,})['"]/i,
            severity: 'high',
            remediation: 'Change password.'
        },
        {
            id: 'NPM_TOKEN',
            name: 'NPM Access Token',
            regex: /npm_[a-zA-Z0-9]{36}/,
            severity: 'critical',
            remediation: 'Revoke token.'
        },

        // Miscellaneous
        {
            id: 'PRIVATE_KEY',
            name: 'RSA/DSA Private Key',
            fileRegex: /.*\.pem$|.*\.key$/,
            regex: /-----BEGIN ((EC|PGP|DSA|RSA|OPENSSH) )?PRIVATE KEY-----/,
            severity: 'critical',
            remediation: 'Remove key file.'
        },
        {
            id: 'GENERIC_SECRET',
            name: 'Generic Hardcoded Secret',
            // High entropy check on variables named like secrets
            regex: /(api_key|apikey|secret|token|auth_token|password|passwd|pwd|access_key)["']?\s*[:=]\s*['"]([a-zA-Z0-9_\-\.]{20,})['"]/i,
            severity: 'high',
            remediation: 'Do not hardcode secrets.'
        },
        {
            id: 'JWT_TOKEN',
            name: 'JSON Web Token (JWT)',
            description: 'Potential hardcoded JWT.',
            regex: /eyJ[a-zA-Z0-9\-_]{10,}\.eyJ[a-zA-Z0-9\-_]{10,}\.[a-zA-Z0-9\-_]{10,}/,
            severity: 'medium',
            remediation: 'Ensure this is not a sensitive user token hardcoded for testing.'
        },
        {
            id: 'FIREBASE_KEY',
            name: 'Firebase API Key',
            regex: /AIza[0-9A-Za-z\\-_]{35}/,
            contextRegex: /(firebaseConfig|apiKey).{0,10}['"](AIza[0-9A-Za-z\\-_]{35})['"]/i,
            severity: 'medium',
            remediation: 'Check Firebase security rules. Restrict key if possible.'
        }
    ],

    // -------------------------------------------------------------------------
    // 2. ADVANCED CODE SECURITY (Logic, Injection, Deserialization)
    // -------------------------------------------------------------------------
    code: [
        // Injection
        {
            id: 'NOSQL_INJECTION',
            name: 'NoSQL Injection Risk',
            description: 'Potential NoSQL Injection via $where or unsanitized input.',
            regex: /\$where\s*:|find\s*\(\s*{\s*[\w\.]+\s*:\s*req\.(body|query|params)/,
            severity: 'high',
            remediation: 'Validate all input. Do not pass req.body directly to queries. Use mongo-sanitize.'
        },
        {
            id: 'SQLI_CONCATENATION',
            name: 'Potential SQL Injection',
            description: 'Constructing SQL queries using string concatenation.',
            regex: /(SELECT|INSERT|UPDATE|DELETE).+?(FROM|INTO|SET).+?(\+|concat\(|\${)/i,
            severity: 'high',
            remediation: 'Use parameterized queries or prepared statements.'
        },
        {
            id: 'COMMAND_INJECTION_EXEC',
            name: 'Command Injection (exec)',
            regex: /\b(child_process|cp)\.exec\s*\(/,
            severity: 'critical',
            remediation: 'Use execFile or spawn. Validate inputs.'
        },
        {
            id: 'DANGEROUS_EVAL',
            name: 'Dangerous Eval Usage',
            regex: /\beval\s*\(/,
            severity: 'critical',
            remediation: 'Avoid eval(). Use JSON.parse().'
        },

        // Logic & Prototype
        {
            id: 'PROTOTYPE_POLLUTION',
            name: 'Prototype Pollution Risk',
            description: 'Unsafe object assignment affecting __proto__.',
            regex: /__proto__|constructor\.prototype/,
            severity: 'high',
            remediation: 'Freeze the prototype or use Map instead of Object. Use safe merge libraries.'
        },
        {
            id: 'SSRF',
            name: 'Server-Side Request Forgery (SSRF)',
            description: 'Unvalidated user input controlling network requests.',
            regex: /(axios|fetch|http\.get|request)\s*\(\s*(req\.|input|url|param)/,
            severity: 'high',
            remediation: 'Validate target URLs against an allowlist. Disable redirects.'
        },
        {
            id: 'INSECURE_DESERIALIZATION',
            name: 'Insecure Deserialization',
            description: 'Use of known dangerous deserialization methods.',
            regex: /node-serialize\.unserialize|java\.io\.ObjectInputStream/,
            severity: 'critical',
            remediation: 'Use JSON.parse(). Avoid native serialization of untrusted data.'
        },
        {
            id: 'XXE',
            name: 'XML External Entity (XXE)',
            description: 'XML parsing with external entities enabled.',
            regex: /noEnt\s*:\s*true|resolveEntity\s*:/,
            severity: 'high',
            remediation: 'Disable external entity resolution (noEnt: false).'
        },
        {
            id: 'PATH_TRAVERSAL',
            name: 'Path Traversal',
            description: 'File system access using user input.',
            regex: /fs\.(readFile|writeFile|unlink|rename)\s*\(\s*.*(req\.|input|params)/,
            severity: 'high',
            remediation: 'Sanitize paths. Use path.basename().'
        },
        {
            id: 'REDOS',
            name: 'Regex Denial of Service (ReDoS)',
            description: 'Potentially vulnerable regex (nested quantifiers).',
            regex: /\([^\)]+\+\)\+|\[[^\]]+\+\]\+/, // Basic heuristic for nested quantifiers like ((a+)+)
            severity: 'medium',
            remediation: 'Avoid nested quantifiers. Use safe-regex tools.'
        }
    ],

    // -------------------------------------------------------------------------
    // 3. CRYPTOGRAPHY (Deep Analysis)
    // -------------------------------------------------------------------------
    crypto: [
        {
            id: 'TIMING_ATTACK',
            name: 'Potential Timing Attack',
            description: 'Insecure string comparison of secrets.',
            regex: /(token|secret|password|hash|signature)\s*===\s*(user|req|input)/i, // Heuristic
            severity: 'medium',
            remediation: 'Use crypto.timingSafeEqual() for comparing secrets.'
        },
        {
            id: 'WEAK_HASH_MD5',
            name: 'Weak Hashing (MD5)',
            regex: /createHash\s*\(\s*['"]md5['"]\s*\)/i,
            severity: 'medium',
            remediation: 'Use SHA-256 or bcrypt.'
        },
        {
            id: 'WEAK_HASH_SHA1',
            name: 'Weak Hashing (SHA1)',
            regex: /createHash\s*\(\s*['"]sha1['"]\s*\)/i,
            severity: 'low',
            remediation: 'Use SHA-256.'
        },
        {
            id: 'WEAK_CIPHER_ECB',
            name: 'Insecure Cipher Mode (ECB)',
            description: 'AES-ECB mode detected. It does not provide semantic security.',
            regex: /AES-[0-9]{3}-ECB/i,
            severity: 'high',
            remediation: 'Use AES-GCM or CBC with a random IV.'
        },
        {
            id: 'WEAK_RANDOMNESS',
            name: 'Weak Randomness',
            description: 'Math.random() used in security context.',
            contextRegex: /(token|key|pwd|password|salt|nonce).{0,20}Math\.random\(\)/i,
            regex: /Math\.random\(\)/, // Too noisy on its own, rely on contextRegex often
            severity: 'medium',
            remediation: 'Use crypto.randomBytes() or crypto.getRandomValues().'
        }
    ],

    // -------------------------------------------------------------------------
    // 4. INFRASTRUCTURE & CONFIG (IaC)
    // -------------------------------------------------------------------------
    infrastructure: [
        {
            id: 'DOCKER_ROOT_USER',
            name: 'Docker Running as Root',
            fileRegex: /Dockerfile$/i,
            regex: /^USER\s+root/mi,
            severity: 'high',
            remediation: 'Create and use a non-root user (USER node).'
        },
        {
            id: 'DOCKER_SOCK_MOUNT',
            name: 'Docker Socket Exposure',
            description: 'Mounting /var/run/docker.sock gives root access to the host.',
            regex: /\/var\/run\/docker\.sock/,
            severity: 'critical',
            remediation: 'Do not mount the docker socket. Use a proxy or API.'
        },
        {
            id: 'DOCKER_ADD_USAGE',
            name: 'Docker ADD Usage',
            fileRegex: /Dockerfile$/i,
            regex: /^ADD\s+/mi, // ADD can unzip archives and fetch URLs, COPY is safer
            severity: 'low',
            remediation: 'Use COPY instead of ADD unless auto-extraction is required.'
        },
        {
            id: 'NGINX_AUTOINDEX',
            name: 'Nginx Directory Listing',
            fileRegex: /nginx.*\.conf$/i,
            regex: /autoindex\s+on/,
            severity: 'medium',
            remediation: 'Set autoindex off.'
        },
        {
            id: 'HARDCODED_PORT',
            name: 'Hardcoded Port',
            regex: /\.listen\s*\(\s*\d{2,5}\s*,/,
            severity: 'low',
            remediation: 'Use process.env.PORT.'
        }
    ],

    // -------------------------------------------------------------------------
    // 5. CLIENT-SIDE SECURITY (React, Frontend)
    // -------------------------------------------------------------------------
    frontend: [
        {
            id: 'REACT_DANGEROUS_HTML',
            name: 'React Dangerous HTML',
            regex: /dangerouslySetInnerHTML/,
            severity: 'medium',
            remediation: 'Sanitize content before rendering (e.g., DOMPurify).'
        },
        {
            id: 'XSS_HREF_JAVASCRIPT',
            name: 'XSS in href Attribute',
            description: 'Usage of javascript: protocol in links.',
            regex: /href\s*=\s*['"]javascript:/i,
            severity: 'high',
            remediation: 'Use onClick handlers instead. Avoid javascript: URIs.'
        },
        {
            id: 'INSECURE_STORAGE',
            name: 'Insecure Storage of Secrets',
            description: 'Storing sensitive data in localStorage/sessionStorage.',
            contextRegex: /(localStorage|sessionStorage)\.setItem\s*\(\s*['"](token|auth|key|secret)/i,
            severity: 'medium',
            remediation: 'Store tokens in HttpOnly cookies.'
        },
        {
            id: 'DOCUMENT_WRITE',
            name: 'Dangerous Document Write',
            regex: /document\.write\s*\(/,
            severity: 'high',
            remediation: 'Use safe DOM manipulation methods.'
        }
    ]
};

module.exports = SAST_RULES;

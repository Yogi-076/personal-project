const ReportTransformer = require('./utils/reportTransformer');

// Mock Data representing Wapiti output
const mockWapitiResults = {
    vulnerabilities: {
        'Cross Site Scripting': [
            {
                level: 1,
                method: 'GET',
                info: 'CSP is not set', // Sometimes empty info but has curl_command
                curl_command: 'curl "http://testphp.vulnweb.com/listproducts.php?cat=<script>alert(1)</script>"',
                url: 'http://testphp.vulnweb.com/listproducts.php',
                parameter: 'cat',
                info: 'Injected: <script>alert(1)</script>'
            }
        ],
        'SQL Injection': [
            {
                level: 2,
                url: 'http://testphp.vulnweb.com/artists.php',
                parameter: 'artist',
                curl_command: 'curl "http://testphp.vulnweb.com/artists.php?artist=1 OR 1=1"',
                payload: '1 OR 1=1' // Some scanners might populate this
            }
        ]
    }
};

// Mock Data representing ZAP output (often minimal, but let's test the 'attack' field if valid)
// Note: ZAP reports come in a different structure usually, but our Transformer acts on 'wapitiResults' object primarily.
// However, our logic might receive mixed objects if we unify them.
// Let's test the specific transformation logic for an object that HAS an attack field.

const mockZapLikeVuln = {
    level: 3,
    alert: 'SQL Injection',
    url: 'http://example.com/vuln',
    attack: 'UNION SELECT 1,2,3--',
    param: 'id'
};

console.log('--- Testing Wapiti Extraction ---');
const wapitiTransformed = ReportTransformer.transform(mockWapitiResults);
const xss = wapitiTransformed.findings.find(f => f.type === 'Cross Site Scripting');
const sqli = wapitiTransformed.findings.find(f => f.type === 'SQL Injection');

console.log('XSS Full Payload:', xss.payload);
console.log('XSS Steps contain curl?', xss.stepsToReproduce.includes('curl "http://testphp.vulnweb.com/listproducts.php?cat=<script>alert(1)</script>"'));

console.log('SQLi Full Payload:', sqli.payload);
console.log('SQLi Steps contain curl?', sqli.stepsToReproduce.includes('curl "http://testphp.vulnweb.com/artists.php?artist=1 OR 1=1"'));

console.log('\n--- Testing ZAP/Direct Payload Extraction ---');
// Manually calling transformVulnerability since the main transform() iterates keys
const zapTransformed = ReportTransformer.transformVulnerability(mockZapLikeVuln, 'SQL Injection');
console.log('ZAP Payload:', zapTransformed.payload);
console.log('ZAP Payload match:', zapTransformed.payload === 'UNION SELECT 1,2,3--');

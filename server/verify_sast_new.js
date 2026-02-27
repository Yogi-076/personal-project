const SastService = require('./services/sastService');
const fs = require('fs');
const path = require('path');

async function testSast() {
    console.log('Testing ULTRA Custom SAST Engine...');
    const service = new SastService();
    const scanId = 'test-scan-ultra';

    const testDir = path.join(__dirname, 'test-sast-ultra');
    if (!fs.existsSync(testDir)) fs.mkdirSync(testDir);

    // 1. Secrets & Code (JS)
    const vulnJs = `
        const AWS_KEY = "AKIA1234567890123456"; 
        eval("alert('xss')");
        if (token === userToken) { } // Timing attack
        const hash = crypto.createHash('md5'); // Weak hash
    `;
    fs.writeFileSync(path.join(testDir, 'vuln.js'), vulnJs);

    // 2. React Frontend (JSX)
    const vulnReact = `
        function App() {
            return <div dangerouslySetInnerHTML={{__html: userInput}} />;
        }
        const link = <a href="javascript:alert(1)">Click me</a>;
    `;
    fs.writeFileSync(path.join(testDir, 'App.jsx'), vulnReact);

    // 3. Infrastructure (Dockerfile)
    const vulnDocker = `
        FROM node:14
        USER root
        # Dangerous mount often passed in run, but checking generic root usage here
        ADD http://example.com/package.zip /tmp/
    `;
    fs.writeFileSync(path.join(testDir, 'Dockerfile'), vulnDocker);

    try {
        console.log('Analyzing test workspace...');
        // We simulate a directory scan
        const files = [
            path.join(testDir, 'vuln.js'),
            path.join(testDir, 'App.jsx'),
            path.join(testDir, 'Dockerfile')
        ];

        const findings = await service.analyzeFiles(files, testDir, scanId);

        console.log('\n--- ULTRA Findings ---');
        findings.forEach(f => {
            console.log(`[${f.type.toUpperCase()}] ${f.title}: ${f.evidence.trim().substring(0, 60)}...`);
        });

        // Cleanup
        // fs.rmSync(testDir, { recursive: true, force: true });
    } catch (e) {
        console.error(e);
    }
}

testSast();

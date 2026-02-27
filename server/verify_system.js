const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3001';

async function runVerification() {
    console.log("🔍 Starting System-Wide Verification...");

    // 1. Backend Health
    try {
        const health = await axios.get(`${BASE_URL}/api/health`);
        console.log(`✅ Backend Health: ${health.data.status} (Version: ${health.data.version})`);
    } catch (e) {
        console.error(`❌ Backend Health Failed: ${e.message}`);
        process.exit(1);
    }

    // 2. VMT Persistence Check
    try {
        const vmt = await axios.get(`${BASE_URL}/api/vulnerabilities/manual-project-default`);
        if (Array.isArray(vmt.data) || (vmt.data && vmt.data.findings)) {
            console.log(`✅ VMT Default Project: FOUND (Findings: ${Array.isArray(vmt.data) ? vmt.data.length : vmt.data.findings.length})`);
        } else {
            console.error(`❌ VMT Default Project: INVALID FORMAT`);
        }
    } catch (e) {
        console.error(`❌ VMT Check Failed: ${e.message}`);
    }

    // 3. Scanner Engine (ZAP Simulation)
    console.log("🚀 Triggering ZAP Scan (Simulation Mode)...");
    let scanId = null;
    try {
        const start = await axios.post(`${BASE_URL}/api/scan/start`, {
            target: "http://testphp.vulnweb.com/signup.php",
            tool: "zap"
        });
        scanId = start.data.scanId;
        console.log(`   Scan Initiated. ID: ${scanId}`);
    } catch (e) {
        console.error(`❌ Failed to start scan: ${e.message}`);
        return;
    }

    // Monitor Scan
    if (scanId) {
        let status = 'pending';
        let retries = 0;
        process.stdout.write("   Waiting for completion: ");
        while (status !== 'completed' && status !== 'failed' && retries < 20) {
            await new Promise(r => setTimeout(r, 2000));
            const poll = await axios.get(`${BASE_URL}/api/scan/status/${scanId}`);
            status = poll.data.status;
            process.stdout.write(".");
            retries++;
        }
        console.log(`\n   Final Status: ${status}`);

        if (status === 'completed') {
            const results = await axios.get(`${BASE_URL}/api/scan/results/${scanId}`);
            console.log(`✅ Scan Findings: ${results.data.findings ? results.data.findings.length : 0} items found.`);
            console.log("   (Simulation confirmed if ~4 mock items found)");
        } else {
            console.error("❌ Scan did not complete successfully in time.");
        }
    }

    console.log("\n✨ System Verification Complete.");
}

runVerification();

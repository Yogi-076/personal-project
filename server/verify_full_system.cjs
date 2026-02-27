
const axios = require('axios');
const { exec } = require('child_process');

const SERVER_URL = 'http://localhost:3001';
const ZAP_URL = 'http://localhost:8090';

async function checkService(name, url, isZap = false) {
    try {
        const target = isZap
            ? `${url}/JSON/core/view/version/?apikey=12345`  // ZAP endpoint
            : `${url}/health`;                               // API health endpoint (if exists) or just root

        // For ZAP specifically, we expecting JSON.
        // For our server, let's just check if it accepts connections or has a specific health endpoint.
        // Actually our server doesn't have a /health documented, let's try a known GET like /api/scan/history

        const testUrl = isZap ? target : `${url}/api/scan/history`;

        console.log(`Testing ${name} at ${testUrl}...`);
        const res = await axios.get(testUrl, { timeout: 2000 });

        if (isZap && typeof res.data === 'string' && res.data.trim().startsWith('<')) {
            console.error(`❌ ${name} FAIL: Responded with HTML (likely Port Conflict).`);
            return false;
        }

        console.log(`✅ ${name} is ONLINE. (Status: ${res.status})`);
        return true;
    } catch (e) {
        if (e.code === 'ECONNREFUSED') {
            console.error(`❌ ${name} FAIL: Connection Refused at ${url}. Is it running?`);
        } else {
            console.error(`❌ ${name} FAIL: ${e.message}`);
        }
        return false;
    }
}

async function verifyAll() {
    console.log("=== VAPT FRAMEWORK SYSTEM CHECK ===\n");

    // 1. Check ZAP
    const zapOk = await checkService('OWASP ZAP', ZAP_URL, true);
    if (!zapOk) {
        console.log("\n⚠️  ACTION REQUIRED: Run 'start_zap.bat' (Windows) or 'start_zap.sh' (Linux) to start ZAP.");
    }

    // 2. Check Backend Server
    const serverOk = await checkService('VAPT Backend', SERVER_URL, false);
    if (!serverOk) {
        console.log("\n⚠️  ACTION REQUIRED: Start the backend server with 'node server/index.js' or 'npm run server'.");
    }

    // 3. Summary
    console.log("\n-----------------------------------");
    if (zapOk && serverOk) {
        console.log("🎉 SYSTEM READY: All core services are reachable!");
    } else {
        console.log("⛔ SYSTEM NOT READY: Please resolve the issues above.");
    }
    console.log("-----------------------------------");
}

verifyAll();

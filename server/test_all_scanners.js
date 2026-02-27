const axios = require('axios');

const BASE_URL = 'http://localhost:3001/api';

async function test() {
    console.log('--- STARTING VERIFICATION ---');

    // 1. Health Check
    try {
        const health = await axios.get(`${BASE_URL}/health`);
        console.log('✅ Server Health:', health.data);
    } catch (e) {
        console.error('❌ Server is DOWN. Please start it with `node index.js`');
        process.exit(1);
    }

    // 2. Test Wapiti (Scanner 1)
    console.log('\n--- Testing Wapiti (Scanner 1) ---');
    try {
        const res = await axios.post(`${BASE_URL}/scan/start`, { target: 'http://testphp.vulnweb.com' });
        console.log('✅ Wapiti Scan Started:', res.data);
    } catch (e) {
        console.error('❌ Wapiti Start Failed:', e.message);
    }

    // 3. Test SAST (Scanner 2)
    console.log('\n--- Testing SAST (Scanner 2) ---');
    try {
        // Use a public repo for test or local? Local might be blocked by "starts with http"?
        // server/index.js line 104: if (!repoUrl || !repoUrl.startsWith('http'))
        const res = await axios.post(`${BASE_URL}/scan/sast/start`, { repoUrl: 'https://github.com/OWASP/NodeGoat.git' });
        console.log('✅ SAST Scan Started:', res.data);
    } catch (e) {
        console.error('❌ SAST Start Failed:', e.message);
    }

    // 4. Test OWASP ZAP (Scanner 3)
    console.log('\n--- Testing OWASP ZAP (Scanner 3) ---');
    try {
        const res = await axios.post(`${BASE_URL}/scan/zap/start`, { target: 'http://testphp.vulnweb.com' });
        console.log('✅ ZAP Scan Started:', res.data);
    } catch (e) {
        console.log('⚠️ ZAP Start Failed (Expected if ZAP not running at locahost:8080):', e.response ? e.response.data : e.message);
    }
}

test();

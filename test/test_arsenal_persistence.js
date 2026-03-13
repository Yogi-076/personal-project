const axios = require('axios');

async function testStatus() {
    try {
        const startRes = await axios.post('http://localhost:3001/api/tools/arsenal-pipeline', {
            url: 'https://example.com',
            threads: 5,
            depth: 2
        });
        const scanId = startRes.data.scanId;
        console.log('Started Scan:', scanId);

        // Wait 2 seconds and check status
        setTimeout(async () => {
            const statusRes = await axios.get(`http://localhost:3001/api/tools/arsenal-pipeline/status/${scanId}`);
            console.log('Scan Status:', statusRes.data.status);
            console.log('Logs Count:', statusRes.data.logs.length);
            if (statusRes.data.logs.length > 0) {
                console.log('First Log:', statusRes.data.logs[0]);
            }
        }, 2000);
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testStatus();

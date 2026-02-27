const axios = require('axios');

async function testSast() {
    const baseUrl = 'http://localhost:3001';

    // Use a small, public repo
    const target = 'https://github.com/octocat/Hello-World.git';

    console.log(`\n1️⃣ Starting SAST scan for: ${target}...`);
    try {
        const startRes = await axios.post(`${baseUrl}/api/scan/start`, {
            target,
            type: 'sast'
        });
        console.log('✅ Scan started. ID:', startRes.data.scanId);

        const scanId = startRes.data.scanId;

        // Poll status
        let status = 'pending';
        while (status === 'pending' || status === 'running') {
            await new Promise(r => setTimeout(r, 2000));
            const statusRes = await axios.get(`${baseUrl}/api/scan/status/${scanId}`);
            status = statusRes.data.status;
            process.stdout.write(`.`);
            if (status === 'failed') {
                console.log('\n❌ Scan failed:', statusRes.data.error);
                // Logs are in status response
                console.log('Logs:', statusRes.data.logs);
                break;
            }
            if (status === 'completed') {
                console.log('\n✅ Scan completed!');
                console.log('Findings:', statusRes.data.findings.length);
                break;
            }
        }

    } catch (error) {
        console.error('\n❌ Request failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testSast();

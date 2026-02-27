import axios from 'axios';

async function testShodan() {
    console.log("Testing Sovereign-Shodan Orchestrator...");
    const target = '1.1.1.1'; // Cloudflare DNS (Safe target)

    try {
        console.log(`[1] Scanning Host: ${target}`);
        const scanRes = await axios.post('http://localhost:3001/api/tools/shodan/scan', { target });
        console.log("Scan Result:", JSON.stringify(scanRes.data, null, 2));
    } catch (e) {
        console.error("Scan Failed:", e.response ? e.response.data : e.message);
    }

    // Monitor Test (Simulated)
    try {
        console.log(`[2] Monitoring Check`);
        const monRes = await axios.post('http://localhost:3001/api/tools/shodan/monitor', { cidr: '1.1.1.0/24' });
        console.log("Monitor Result:", monRes.data);
    } catch (e) {
        console.error("Monitor Failed:", e.response ? e.response.data : e.message);
    }
}

testShodan();

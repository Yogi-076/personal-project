import axios from 'axios';

async function triggerScan() {
    console.log("Triggering Aether Scan...");
    try {
        const response = await axios.post('http://localhost:3001/api/tools/aether/scan', {
            target: 'google.com'
        });
        console.log("Scan Response:", response.data);
    } catch (e) {
        console.error("Scan Error:", e.message);
        if (e.code === 'ECONNRESET') {
            console.error("CRITICAL: Server Connection Reset - Likely Crash");
        }
    }
}

triggerScan();

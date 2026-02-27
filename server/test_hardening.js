const axios = require('axios');

async function testServerHardening() {
    try {
        console.log("Testing POST /api/scan/start with NO body...");
        // This should NOT crash the server. It should return 400 or 500, but the server process should stay alive.
        // In our fix, we added `req.body || {}`, so destructuring shouldn't throw.
        // It should hit `if (!target)` and return 400.

        // Axios throws on 400/500 by default, so we catch it.
        await axios.post('http://localhost:3001/api/scan/start', {}, {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        if (error.response) {
            console.log(`✅ Server responded with status: ${error.response.status}`);
            if (error.response.status === 400 && error.response.data.error === 'Target URL is required') {
                console.log("✅ Correctly handled missing body/target.");
            } else {
                console.log("⚠️ Unexpected response:", error.response.data);
            }
        } else {
            console.error("❌ Request failed (Server might be down):", error.message);
        }
    }
}

testServerHardening();

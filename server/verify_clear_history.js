
const axios = require('axios');

async function testClearHistory() {
    try {
        console.log("Triggering Clear History...");
        const res = await axios.delete('http://localhost:3001/api/scan/history');
        console.log("✅ History Clear Response:", res.data);
    } catch (e) {
        console.error("❌ Clear History Failed:", e.message);
    }
}

testClearHistory();

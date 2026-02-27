const axios = require('axios');

async function testAether() {
    console.log("Testing Aether-Core API...");
    try {
        const res = await axios.post('http://localhost:3001/api/tools/aether/scan', {
            target: 'google.com'
        });
        console.log("Status:", res.status);
        console.log("Data:", JSON.stringify(res.data, null, 2));
    } catch (error) {
        console.error("Error:", error.response ? error.response.data : error.message);
    }
}

testAether();

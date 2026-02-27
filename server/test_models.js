const axios = require('axios');
require('dotenv').config();

async function check() {
    const key = process.env.GEMINI_API_KEY;
    console.log(`Checking key: ${key.substring(0, 10)}...`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;

    try {
        const res = await axios.get(url);
        console.log("✅ API Connection Successful!");
        console.log("Available Models:");
        res.data.models.forEach(m => console.log(` - ${m.name}`));
    } catch (e) {
        console.log("❌ API Error:");
        if (e.response) {
            console.log(`Status: ${e.response.status}`);
            console.log(JSON.stringify(e.response.data, null, 2));
        } else {
            console.log(e.message);
        }
    }
}
check();

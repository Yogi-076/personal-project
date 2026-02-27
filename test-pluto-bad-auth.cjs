const axios = require('axios');

async function testPlutoBadAuth() {
    console.log('Testing Pluto API with BAD TOKEN...');
    try {
        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: 'hi' }]
        }, {
            headers: { 'Authorization': 'Bearer INVALID_TOKEN' },
            timeout: 5000
        });
        console.log('❌ Unexpected Success:', response.status);
    } catch (error) {
        if (error.response) {
            console.log('✅ Server Responded:', error.response.status); // Expect 401
        } else {
            console.error('❌ Request Failed/Timeout:', error.message);
        }
    }
}

testPlutoBadAuth();

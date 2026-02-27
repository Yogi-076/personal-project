const axios = require('axios');

async function testPlutoDebug() {
    console.log('Testing Pluto API (127.0.0.1)...');
    try {
        const response = await axios.post('http://127.0.0.1:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: 'hi' }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' },
            timeout: 5000,
            maxRedirects: 0, // Stop redirects
            validateStatus: () => true // Accept all status codes
        });

        console.log('✅ Status:', response.status);
        console.log('✅ Status Text:', response.statusText);
        console.log('✅ Headers:', JSON.stringify(response.headers, null, 2));
        console.log('✅ Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error Message:', error.message);
        if (error.response) {
            console.error('❌ Status:', error.response.status);
            console.error('❌ Headers:', JSON.stringify(error.response.headers, null, 2));
        }
    }
}

testPlutoDebug();

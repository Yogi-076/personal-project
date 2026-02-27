import axios from 'axios';

async function testPluto() {
    console.log('Testing Pluto API on http://localhost:18789...');
    try {
        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: 'Hello, are you working?' }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' },
            timeout: 10000
        });

        console.log('✅ Status:', response.status);
        console.log('✅ Data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.response) {
            console.error('❌ Response Status:', error.response.status);
            console.error('❌ Response Data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testPluto();

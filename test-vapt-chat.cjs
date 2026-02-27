const axios = require('axios');

async function testVaptChat() {
    console.log('Testing VAPT Chat endpoint...');
    try {
        const response = await axios.post('http://localhost:3001/api/ai/vapt-chat', {
            message: 'Hello, what are you?',
            context: 'Testing the newly integrated VAPT Assistant.'
        });
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Test failed:', error.message);
        if (error.response) {
            console.error('Error status:', error.response.status);
            console.error('Error content:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testVaptChat();

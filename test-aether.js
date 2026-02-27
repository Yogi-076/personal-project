import axios from 'axios';

async function testAether() {
    try {
        console.log("Testing Aether Core with target: google.com");
        const response = await axios.post('http://localhost:3001/api/tools/aether/scan', {
            target: 'google.com'
        });
        console.log("Response Status:", response.status);
        console.log("Response Data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error testing Aether:", error.message);
        if (error.response) {
            console.error("Server Response:", error.response.data);
        }
    }
}

testAether();

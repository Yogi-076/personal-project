const axios = require('axios');

async function testLogin() {
    const baseUrl = 'http://localhost:3001';

    // 1. Register a user
    const email = `test_login_${Date.now()}@example.com`;
    const password = 'Password123!';

    console.log(`\n1️⃣ Registering user: ${email}...`);
    try {
        const regRes = await axios.post(`${baseUrl}/auth/register`, {
            email,
            password,
            username: 'LoginTester',
            firstName: 'Test',
            lastName: 'User',
            orgName: 'TestOrg'
        });
        console.log('✅ Registration successful:', regRes.data.user.email);

        // 2. Login
        console.log(`\n2️⃣ Logging in...`);
        const loginRes = await axios.post(`${baseUrl}/auth/login`, {
            email,
            password
        });

        if (loginRes.data.token) {
            console.log('✅ Login successful! Token received.');
            console.log('Token:', loginRes.data.token.substring(0, 20) + '...');
        } else {
            console.error('❌ Login failed: No token returned');
        }

    } catch (error) {
        console.error('❌ Authentication failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testLogin();

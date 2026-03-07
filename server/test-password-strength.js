const axios = require('axios');

async function testPasswordStrength() {
    const API_URL = 'http://localhost:3001';

    const weakPasswords = [
        '123456',
        'abcdef',
        'ABCDEF',
        '12345678', // Just numbers
        'abcdefgh', // Just lowercase
        'ABCDEFGH'  // Just uppercase
    ];

    const strongPasswords = [
        'VajraScan@2026',
        'StrongPass123!',
        'Admin#99#Secure'
    ];

    console.log('--- Testing Weak Passwords (should fail) ---');
    for (const pass of weakPasswords) {
        try {
            const res = await axios.post(`${API_URL}/auth/register`, {
                email: `test_${Math.random().toString(36).substring(7)}@example.com`,
                password: pass
            });
            console.log(`❌ FAIL: Password "${pass}" was accepted but should have been rejected.`);
        } catch (err) {
            console.log(`✅ OK: Password "${pass}" rejected correctly: ${err.response?.data?.error || err.message}`);
        }
    }

    console.log('\n--- Testing Strong Passwords (should pass) ---');
    for (const pass of strongPasswords) {
        try {
            const res = await axios.post(`${API_URL}/auth/register`, {
                email: `test_${Math.random().toString(36).substring(7)}@example.com`,
                password: pass
            });
            console.log(`✅ OK: Password "${pass}" accepted correctly.`);
        } catch (err) {
            console.log(`❌ FAIL: Password "${pass}" was rejected but should have been accepted: ${err.response?.data?.error || err.message}`);
        }
    }
}

testPasswordStrength();

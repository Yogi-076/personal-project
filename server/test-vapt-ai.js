const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testVAPTAI() {
    console.log('🧪 Testing VAPT AI Assistant Endpoints\n');

    // Test 1: VAPT Chat
    console.log('1️⃣ Testing VAPT Chat...');
    try {
        const chatResponse = await axios.post(`${BASE_URL}/api/ai/vapt-chat`, {
            message: 'How do I document a SQL injection vulnerability?',
            context: 'Testing VAPT AI Assistant'
        });
        console.log('✅ VAPT Chat Response:', chatResponse.data.reply.substring(0, 200) + '...\n');
    } catch (error) {
        console.log('❌ VAPT Chat Error:', error.response?.data || error.message, '\n');
    }

    // Test 2: Generate Finding
    console.log('2️⃣ Testing Generate Finding...');
    try {
        const findingResponse = await axios.post(`${BASE_URL}/api/ai/generate-finding`, {
            description: 'SQL Injection in login form',
            endpoint: '/api/auth/login',
            severity: 'Critical'
        });
        console.log('✅ Generated Finding:', findingResponse.data.finding.substring(0, 300) + '...\n');
    } catch (error) {
        console.log('❌ Generate Finding Error:', error.response?.data || error.message, '\n');
    }

    // Test 3: Calculate CVSS
    console.log('3️⃣ Testing CVSS Calculation...');
    try {
        const cvssResponse = await axios.post(`${BASE_URL}/api/ai/calculate-cvss`, {
            vulnerability: 'Remote Code Execution',
            attackVector: 'Network',
            complexity: 'Low',
            privileges: 'None',
            userInteraction: 'None',
            scope: 'Changed',
            impacts: {
                confidentiality: 'High',
                integrity: 'High',
                availability: 'High'
            }
        });
        console.log('✅ CVSS Score:', cvssResponse.data.score);
        console.log('   Vector:', cvssResponse.data.vector, '\n');
    } catch (error) {
        console.log('❌ CVSS Calculation Error:', error.response?.data || error.message, '\n');
    }

    // Test 4: Improve Text
    console.log('4️⃣ Testing Text Improvement...');
    try {
        const improveResponse = await axios.post(`${BASE_URL}/api/ai/improve-text`, {
            text: 'The app has a bug where users can see other users data.',
            targetAudience: 'executive'
        });
        console.log('✅ Improved Text:', improveResponse.data.improved.substring(0, 200) + '...\n');
    } catch (error) {
        console.log('❌ Text Improvement Error:', error.response?.data || error.message, '\n');
    }

    // Test 5: Validate Report
    console.log('5️⃣ Testing Report Validation...');
    try {
        const validateResponse = await axios.post(`${BASE_URL}/api/ai/validate-report`, {
            findings: [
                { issue_name: 'SQL Injection', severity: 'Critical', cvss_score: 9.8 },
                { issue_name: 'XSS', severity: 'High', cvss_score: 7.5 }
            ],
            sections: { executive_summary: true, findings: true }
        });
        console.log('✅ Validation Result:', validateResponse.data.validation.substring(0, 200) + '...');
        console.log('   Quality Score:', validateResponse.data.qualityScore, '\n');
    } catch (error) {
        console.log('❌ Report Validation Error:', error.response?.data || error.message, '\n');
    }

    console.log('✨ All tests completed!');
}

testVAPTAI().catch(console.error);

/**
 * test_user_isolation.cjs
 * Tests that users can only see THEIR OWN projects, not other users' projects.
 * 
 * Prerequisites: Backend must be running at http://localhost:3001
 * Run: node server/test_user_isolation.cjs
 */

'use strict';
const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3001';
const PASS = '\x1b[32m✅ PASS\x1b[0m';
const FAIL = '\x1b[31m❌ FAIL\x1b[0m';
const WARN = '\x1b[33m⚠️  WARN\x1b[0m';

let passed = 0, failed = 0;

function request(method, path, body, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(BASE_URL + path);
        const data = body ? JSON.stringify(body) : null;
        const options = {
            hostname: url.hostname,
            port: url.port || 3001,
            path: url.pathname,
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            }
        };
        const req = (url.protocol === 'https:' ? https : http).request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
                catch (e) { resolve({ status: res.statusCode, data: body }); }
            });
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

function assert(condition, message) {
    if (condition) {
        console.log(`${PASS} ${message}`);
        passed++;
    } else {
        console.log(`${FAIL} ${message}`);
        failed++;
    }
}

const timestamp = Date.now();
const userA = { email: `usera_${timestamp}@isolation-test.com`, password: 'TestPass@1234' };
const userB = { email: `userb_${timestamp}@isolation-test.com`, password: 'TestPass@1234' };

async function run() {
    console.log('\n🔒 User Data Isolation Test\n' + '─'.repeat(50));

    // Step 1: Register User A
    console.log('\n[1] Registering User A...');
    const regA = await request('POST', '/api/auth/register', { email: userA.email, password: userA.password, username: `usera_${timestamp}` });
    if (regA.status !== 200) { console.log(`${FAIL} User A registration failed: ${JSON.stringify(regA.data)}`); failed++; return; }
    const tokenA = regA.data.token;
    assert(!!tokenA, 'User A token received');

    // Step 2: Register User B
    console.log('\n[2] Registering User B...');
    const regB = await request('POST', '/api/auth/register', { email: userB.email, password: userB.password, username: `userb_${timestamp}` });
    if (regB.status !== 200) { console.log(`${FAIL} User B registration failed: ${JSON.stringify(regB.data)}`); failed++; return; }
    const tokenB = regB.data.token;
    assert(!!tokenB, 'User B token received');

    // Step 3: User A creates a project
    console.log('\n[3] User A creates Project Alpha...');
    const createRes = await request('POST', '/api/projects', {
        title: `Alpha_${timestamp}`,
        companyName: 'Test Corp A',
        targetUrls: ['https://example-a.com'],
        testerName: 'Tester A',
        testerEmail: 'tester@a.com',
        engagementType: 'VAPT'
    }, tokenA);
    assert(createRes.status === 201, `Project Alpha created (status: ${createRes.status})`);
    const projectId = createRes.data?.projectId;
    if (!projectId) { console.log(`${FAIL} No projectId returned`); failed++; return; }
    console.log(`   Project ID: ${projectId}`);

    // Step 4: User A can see their own project in list
    console.log('\n[4] User A fetches project list...');
    const listA = await request('GET', '/api/projects', null, tokenA);
    assert(listA.status === 200, 'List returned 200 for User A');
    const userAProjects = Array.isArray(listA.data) ? listA.data : [];
    const foundInA = userAProjects.some(p => p.id === projectId);
    assert(foundInA, `User A CAN see their own project "${projectId}" in their list`);

    // Step 5: User B CANNOT see User A's project in list
    console.log('\n[5] User B fetches project list (should NOT see Project Alpha)...');
    const listB = await request('GET', '/api/projects', null, tokenB);
    assert(listB.status === 200, 'List returned 200 for User B');
    const userBProjects = Array.isArray(listB.data) ? listB.data : [];
    const foundInB = userBProjects.some(p => p.id === projectId);
    assert(!foundInB, `User B CANNOT see User A's project "${projectId}" in list`);

    // Step 6: User B CANNOT access User A's project directly
    console.log('\n[6] User B attempts to GET User A\'s project directly...');
    const directB = await request('GET', `/api/projects/${projectId}`, null, tokenB);
    assert(directB.status === 403, `Accessing another user's project returns 403 (got: ${directB.status})`);

    // Step 7: User B CANNOT delete User A's project
    console.log('\n[7] User B attempts to DELETE User A\'s project...');
    const deleteB = await request('DELETE', `/api/projects/${projectId}`, null, tokenB);
    assert(deleteB.status === 403, `Deleting another user's project returns 403 (got: ${deleteB.status})`);

    // Step 8: User A CAN still access their project after User B tried
    console.log('\n[8] User A can still access their own project...');
    const directA = await request('GET', `/api/projects/${projectId}`, null, tokenA);
    assert(directA.status === 200, `User A can still GET their own project (status: ${directA.status})`);

    // Cleanup: User A deletes their test project
    await request('DELETE', `/api/projects/${projectId}`, null, tokenA);
    console.log('\n   [Cleanup] Test project deleted.');

    // Summary
    console.log('\n' + '─'.repeat(50));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed === 0) {
        console.log('\n🎉 ALL TESTS PASSED — User data isolation is working correctly!\n');
    } else {
        console.log('\n⚠️  Some tests failed — Review the output above.\n');
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Test runner crashed:', err.message);
    console.error('Make sure the backend is running at http://localhost:3001');
    process.exit(1);
});

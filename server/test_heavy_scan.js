const WapitiService = require('./services/wapitiService');

async function testHeavyScan() {
    console.log('--- STARTING HEAVY SCAN TEST ---');
    const service = new WapitiService();
    // Simulate the exact call made by the backend
    try {
        const result = await service.scan(
            'http://testphp.vulnweb.com',
            { scope: 'domain', level: '2' },
            'test-scan-id'
        );
        console.log('SCAN SUCCESS!');
        console.log(JSON.stringify(result.summary, null, 2));
    } catch (e) {
        console.error('SCAN FAILED:', e);
    }
}

testHeavyScan();

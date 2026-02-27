const storage = require('./utils/storage');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data', 'scans.json');

async function testPersistence() {
    console.log('🧪 Testing Persistence Layer...');

    // 1. Clean slate (optional, but good for test)
    // We won't delete the file to avoid messing up dev data, 
    // but we'll use a unique ID.

    const testId = 'test-' + Date.now();
    const testScan = {
        id: testId,
        target: 'http://example.com',
        status: 'pending',
        startedAt: new Date().toISOString(),
        progress: 10
    };

    console.log('1. Saving test scan...');
    await storage.saveScan(testScan);

    // 2. Read back from memory
    const retrieved = await storage.getScan(testId);
    assert.strictEqual(retrieved.id, testScan.id);
    assert.strictEqual(retrieved.status, testScan.status);
    console.log('✅ In-memory retrieval works');

    // 3. Verify file on disk
    if (!fs.existsSync(DATA_FILE)) {
        throw new Error('Data file not created!');
    }
    const fileContent = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    assert.strictEqual(fileContent[testId].id, testScan.id);
    assert.ok(fileContent[testId].savedAt, 'Missing savedAt field');
    console.log('✅ File persistence works');

    // 4. Update scan
    console.log('2. Updating test scan...');
    const updates = { status: 'completed', progress: 100 };
    await storage.updateScan(testId, updates);

    // 5. Verify update in memory
    const updated = await storage.getScan(testId);
    assert.strictEqual(updated.status, 'completed', 'Status not updated');
    assert.strictEqual(updated.progress, 100, 'Progress not updated');
    console.log('✅ Update works');

    // 6. Verify update on disk
    const updatedFileContent = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    assert.strictEqual(updatedFileContent[testId].status, 'completed', 'File status not updated');
    console.log('✅ File update works');

    // Cleanup
    // storage.deleteScan(testId); // Not implemented
    console.log('✅ Cleanup successful (Skipped)');

    console.log('🎉 All persistence tests passed!');
}

testPersistence().catch(console.error);

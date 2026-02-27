import WebSocket from 'ws';

function testConnection(url, description) {
    console.log(`\nTesting connection to: ${url} (${description})`);
    const ws = new WebSocket(url);

    ws.on('open', () => {
        console.log(`[SUCCESS] Connected to ${description}`);
        ws.close();
    });

    ws.on('error', (err) => {
        console.log(`[ERROR] Connection failed to ${description}:`, err.message);
    });

    ws.on('close', (code, reason) => {
        console.log(`[CLOSE] Closed ${description} - Code: ${code}, Reason: ${reason}`);
    });

    ws.on('unexpected-response', (request, response) => {
        console.log(`[FAIL] Unexpected server response for ${description}: ${response.statusCode} ${response.statusMessage}`);
    });
}

// Test 1: Without Token (Expected: 400 Bad Request)
testConnection('ws://127.0.0.1:18789/', 'Without Token');

// Test 2: With Token (Expected: Success)
setTimeout(() => {
    testConnection('ws://127.0.0.1:18789/?token=moltbot', 'With Token');
}, 1000);

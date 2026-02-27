import WebSocket from 'ws';
import http from 'http';

const GATEWAY_PORT = 18789;
const GATEWAY_HOST = '127.0.0.1';
const WEB_URL = `http://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const WS_URL = `ws://${GATEWAY_HOST}:${GATEWAY_PORT}`;
const TOKEN = 'moltbot';

console.log('🔍 Moltbot Health Check Tool');
console.log('============================');

async function checkHttp() {
    return new Promise((resolve) => {
        console.log(`\n1. Testing HTTP Endpoint (${WEB_URL})...`);
        const req = http.get(WEB_URL, (res) => {
            console.log(`   [OK] HTTP Status: ${res.statusCode}`);
            if (res.statusCode === 200 || res.statusCode === 404) {
                // 404 is fine for root if it doesn't serve index, but connection worked
                resolve(true);
            } else {
                resolve(true); // Technically connection worked even if 500
            }
        });

        req.on('error', (e) => {
            console.error(`   [FAIL] HTTP Connection failed: ${e.message}`);
            resolve(false);
        });

        req.end();
    });
}

function checkWebSocket() {
    return new Promise((resolve) => {
        console.log(`\n2. Testing WebSocket Endpoint (${WS_URL})...`);
        const url = `${WS_URL}/?token=${TOKEN}`;
        const ws = new WebSocket(url);

        const timeout = setTimeout(() => {
            console.log('   [FAIL] Connection timed out (5s)');
            ws.terminate();
            resolve(false);
        }, 5000);

        ws.on('open', () => {
            clearTimeout(timeout);
            console.log('   [OK] WebSocket Connected Successfully for "moltbot"');
            ws.close();
            resolve(true);
        });

        ws.on('error', (err) => {
            clearTimeout(timeout);
            console.log(`   [FAIL] WebSocket Error: ${err.message}`);
            resolve(false);
        });

        ws.on('unexpected-response', (req, res) => {
            clearTimeout(timeout);
            console.log(`   [FAIL] Unexpected Response: ${res.statusCode} ${res.statusMessage}`);
            if (res.statusCode === 400 || res.statusCode === 401) {
                console.log('          (Likely an authentication or header issue, expected if token is wrong)');
            }
            resolve(false);
        });
    });
}

async function run() {
    const httpOk = await checkHttp();
    const wsOk = await checkWebSocket();

    console.log('\n============================');
    if (httpOk && wsOk) {
        console.log('✅ SYSTEM STATUS: HEALTHY');
        console.log('   You can connect to the Moltbot Gateway.');
        process.exit(0);
    } else {
        console.log('❌ SYSTEM STATUS: UNHEALTHY');
        console.log('   Please check the logs at \\tmp\\moltbot\\');
        process.exit(1);
    }
}

run();

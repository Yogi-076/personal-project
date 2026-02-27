const AIHunterService = require('../server/services/aiHunterService');
const { spawn } = require('child_process');
const path = require('path');

async function testSwarm() {
    // 1. Start Vulnerable Server
    console.log('Starting Vulnerable Server...');
    const serverProcess = spawn('node', ['test/vulnerable-server.cjs'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
    });

    // Give it a second to start
    await new Promise(r => setTimeout(r, 2000));

    try {
        // 2. Start Hunt
        console.log('Starting Hunt...');
        const { scanId } = await AIHunterService.startHunt({
            target: 'http://localhost:3333'
        });

        console.log(`Scan started: ${scanId}`);

        // 3. Poll Status
        const interval = setInterval(() => {
            const status = AIHunterService.getStatus(scanId);
            console.log(`[Status] ${status.phase} | Findings: ${status.findings.length} | Logs: ${status.logs.length}`);

            // Print new logs (simple diff)
            // ...

            if (status.status === 'completed' || status.status === 'failed') {
                clearInterval(interval);
                console.log('Scan Finished!');
                console.log('Final Findings:', JSON.stringify(status.findings, null, 2));

                // Cleanup
                serverProcess.kill();
                process.exit(0);
            }
        }, 2000);

    } catch (e) {
        console.error(e);
        serverProcess.kill();
    }
}

testSwarm();

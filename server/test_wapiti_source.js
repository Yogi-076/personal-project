const { spawn } = require('child_process');
const path = require('path');

async function testWapitiSource() {
    console.log('--- STARTING SOURCE INTEGRATION TEST ---');

    // Exact logic from wapitiService.js
    const wapitiSourcePath = path.join(__dirname, '../wapiti-master/wapiti-master/bin/wapiti');
    const pythonPath = path.join(__dirname, '../wapiti-master/wapiti-master'); // server/../wapiti... -> root/wapiti...

    // Note: __dirname is 'server' because we run 'node server/test_wapiti_source.js' or similar?
    // Wait, __dirname in this file (inside server/) is '.../server'.
    // In service it was '.../server/services'. 
    // Service: path.join(__dirname, '../../wapiti-master') -> services/../.. -> root.
    // Here: path.join(__dirname, '../wapiti-master') -> server/.. -> root.
    // Correct.

    console.log(`Source Path: ${wapitiSourcePath}`);
    console.log(`PYTHONPATH: ${pythonPath}`);

    const args = ['-u', 'http://testphp.vulnweb.com', '--version'];
    const spawnArgs = [`"${wapitiSourcePath}"`].concat(args);

    console.log(`Executing: python ${spawnArgs.join(' ')}`);

    const child = spawn('python', spawnArgs, {
        shell: true,
        env: {
            ...process.env,
            PYTHONPATH: pythonPath
        }
    });

    child.stdout.on('data', (data) => console.log(`[STDOUT] ${data}`));
    child.stderr.on('data', (data) => console.log(`[STDERR] ${data}`));

    child.on('close', (code) => {
        console.log(`[EXIT] Code ${code}`);
        if (code === 0) console.log('✅ SOURCE INTEGRATION WORKS!');
        else console.log('❌ SOURCE INTEGRATION FAILED');
    });
}

testWapitiSource();

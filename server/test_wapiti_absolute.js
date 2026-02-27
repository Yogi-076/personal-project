const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testWapitiAbsolute() {
    console.log('--- STARTING ABSOLUTE PATH WAPITI TEST ---');

    // The path we found
    const wapitiPath = 'C:\\Users\\yogi\\AppData\\Local\\Packages\\PythonSoftwareFoundation.Python.3.11_qbz5n2kfra8p0\\LocalCache\\local-packages\\Python311\\Scripts\\wapiti.exe';

    console.log(`Path: ${wapitiPath}`);
    console.log(`Exists: ${fs.existsSync(wapitiPath)}`);

    // Test Target
    const target = 'http://testphp.vulnweb.com';
    // Wapiti 3 requires -u for the URL
    const args = ['-u', target, '--level', '1', '--scope', 'url', '-f', 'json', '-o', 'test_output_abs.json', '--flush-session'];

    console.log(`Spawning: "${wapitiPath}" ${args.join(' ')}`);

    try {
        const child = spawn(wapitiPath, args, {
            shell: true,
            env: process.env
        });

        child.stdout.on('data', (data) => {
            console.log(`[STDOUT] ${data.toString().trim()}`);
        });

        child.stderr.on('data', (data) => {
            console.log(`[STDERR] ${data.toString().trim()}`);
        });

        child.on('error', (err) => {
            console.error('[SPAWN ERROR]', err);
        });

        child.on('close', (code) => {
            console.log(`[EXIT] Process exited with code ${code}`);
        });
    } catch (e) {
        console.error('[EXCEPTION]', e);
    }
}

testWapitiAbsolute();

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testWapiti() {
    console.log('--- STARTING ISOLATED WAPITI TEST ---');
    console.log('Node Version:', process.version);
    console.log('Platform:', os.platform());

    // Test Target
    const target = 'http://testphp.vulnweb.com';
    console.log('Target:', target);

    // Command Construction
    const args = ['-m', 'wapiti', target, '--level', '1', '--scope', 'url', '-f', 'json', '-o', 'test_output.json', '--flush-session'];
    const command = 'python';

    console.log(`Spawning: ${command} ${args.join(' ')}`);

    const child = spawn(command, args, {
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
        if (code === 0) {
            console.log('SUCCESS! Wapiti ran correctly.');
            if (fs.existsSync('test_output.json')) {
                const size = fs.statSync('test_output.json').size;
                console.log(`Report generated. Size: ${size} bytes`);
                // Clean up
                fs.unlinkSync('test_output.json');
            } else {
                console.error('FAILURE: Output file not found!');
            }
        } else {
            console.error('FAILURE: Wapiti exited with errors.');
        }
    });
}

testWapiti();

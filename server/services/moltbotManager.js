const { spawn } = require('child_process');
const path = require('path');

class MoltbotManager {
    constructor() {
        this.process = null;
        this.gatewayPort = 18789;
        this.moltbotPath = path.resolve(__dirname, '../../../moltbot');
        this.scriptPath = path.join(this.moltbotPath, 'scripts/run-node.mjs');
    }

    async start() {
        console.log('[MoltbotManager] 🚀 Initializing Pluto AI Gateway...');

        // Check if port is in use and kill existing process
        try {
            const { execSync } = require('child_process');
            // Windows-specific port check and kill
            const processes = execSync(`netstat -ano | findstr :${this.gatewayPort}`).toString();
            if (processes) {
                console.log(`[MoltbotManager] ⚠️ Port ${this.gatewayPort} is busy. Killing existing process...`);
                // Extract PIDs (last token in line)
                const lines = processes.trim().split('\n');
                lines.forEach(line => {
                    const tokens = line.trim().split(/\s+/);
                    const pid = tokens[tokens.length - 1];
                    if (pid && pid !== '0') {
                        try {
                            execSync(`taskkill /F /PID ${pid}`);
                            console.log(`[MoltbotManager] 💀 Killed process ${pid}`);
                        } catch (e) { /* ignore */ }
                    }
                });
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for release
            }
        } catch (e) {
            // No process found or other error, ignore
        }

        const args = [
            `"${this.scriptPath}"`,
            'gateway',
            '--port', this.gatewayPort.toString(),
            '--allow-unconfigured',
            '--token', 'moltbot'
        ];

        // Ensure we set the state directory correctly
        const env = {
            ...process.env,
            MOLTBOT_STATE_DIR: path.resolve(this.moltbotPath, '../moltbot-data'),
            CLAWDBOT_GATEWAY_TOKEN: 'moltbot',
            GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || 'AIzaSyBPTeXSoUpvHRXf78G0AHl0PHv45zONc_0',
            // Force specific model if needed by Moltbot internal logic, though usually it defaults well.
            // set CLAWDBOT_MODEL_PROVIDER=google if supported
        };

        this.process = spawn('node', args, {
            cwd: this.moltbotPath,
            env: env,
            stdio: 'pipe',
            shell: true
        });

        this.process.stdout.on('data', (data) => {
            const output = data.toString().trim();
            console.log(`[Pluto AI] ${output}`);
        });

        this.process.stderr.on('data', (data) => {
            console.error(`[Pluto AI Error] ${data.toString().trim()}`);
            if (data.toString().includes('EADDRINUSE')) {
                console.error('[Pluto AI Error] Port conflict detected despite cleanup.');
            }
        });

        this.process.on('close', (code) => {
            console.log(`[MoltbotManager] ⚠️ Pluto AI Gateway exited with code ${code}`);
            // Only restart if not manually stopped
            if (code !== 0 && code !== null && this.process) {
                console.log('[MoltbotManager] 🔄 Attempting to restart Pluto AI in 5 seconds...');
                setTimeout(() => this.start(), 5000);
            }
        });

        console.log(`[MoltbotManager] ✅ Service spawned (PID: ${this.process.pid})`);
    }

    stop() {
        if (this.process) {
            console.log('[MoltbotManager] 🛑 Stopping Pluto AI Gateway...');
            this.process.kill();
            this.process = null;
        }
    }
}

module.exports = new MoltbotManager();

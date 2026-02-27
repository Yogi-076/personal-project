const WapitiService = require('./services/wapitiService');
const service = new WapitiService();

(async () => {
    try {
        console.log("Starting test scan...");

        const originalSpawn = require('child_process').spawn;
        require('child_process').spawn = function (cmd, args, opts) {
            console.log("Spawned:", cmd, args.join(' '));
            const child = originalSpawn(cmd, args, opts);

            // Kill it after 10 seconds
            setTimeout(() => {
                console.log("Sending default kill() to Wapiti...");
                child.kill();
            }, 10000);

            return child;
        };

        const res = await service.scan('http://testphp.vulnweb.com', { fullModules: true }, 'test-scan-kill-2');
        console.log("Scan Finished gracefully! Vulns:", res.vulnerabilities ? res.vulnerabilities.length : 0);
    } catch (e) {
        console.error("Scan Failed/Rejected:", e.message);
    }
})();

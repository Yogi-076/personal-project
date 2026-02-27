const WapitiService = require('./services/wapitiService');
const service = new WapitiService();
(async () => {
    try {
        console.log("Starting test scan...");
        const res = await service.scan('http://example.com', { fullModules: true }, 'test-scan-1234');
        console.log("Scan Finished!", res.vulnerabilities ? res.vulnerabilities.length : 0, "vulns");
    } catch (e) {
        console.error("Failed:", e);
    }
})();

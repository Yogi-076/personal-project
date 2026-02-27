const URL = 'http://localhost:3001/api/scan/start';
const STOP_URL = 'http://localhost:3001/api/scan/';

(async () => {
    try {
        console.log("1. Starting a new scan...");
        const res = await fetch(URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'http://testphp.vulnweb.com', fullModules: true, projectId: 'VAPT-2026-9601' })
        });
        const data = await res.json();
        console.log("Scan Started:", data.scanId);

        if (!data.scanId) return console.log("Failed to start scan:", data);

        console.log("2. Waiting 15 seconds to collect some logs...");
        await new Promise(r => setTimeout(r, 15000));

        console.log("3. Sending STOP signal...");
        const stopRes = await fetch(`${STOP_URL}${data.scanId}/stop`, { method: 'POST' });
        const stopData = await stopRes.json();

        console.log("4. Stop Result:", stopData.message);
        console.log("Findings captured:", stopData.summary.total);
    } catch (e) {
        console.error("Test Failed:", e.message);
    }
})();

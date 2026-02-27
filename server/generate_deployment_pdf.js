const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Updated Content for SaaS Architecture
        const content = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; line-height: 1.6; color: #333; }
                h1 { color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px; }
                h2 { color: #1976d2; margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px; }
                h3 { color: #444; margin-top: 20px; font-weight: bold; }
                table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .highlight { background-color: #e3f2fd; padding: 15px; border-left: 5px solid #2196f3; margin: 15px 0; }
                .critical { background-color: #ffebee; padding: 15px; border-left: 5px solid #f44336; margin: 15px 0; }
                ul { margin-bottom: 15px; }
                li { margin-bottom: 5px; }
                .footer { margin-top: 50px; font-size: 0.8em; color: #777; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
            </style>
        </head>
        <body>
            <h1>SaaS VAPT Deployment Requirements</h1>
            <p><strong>Accurate, scalable requirements</strong> for running the VAPT Framework as a multi-tenant SaaS. This architecture focuses on stability under concurrency.</p>

            <div class="critical">
                <strong>The Core Problem:</strong> One VAPT Scan (ZAP + Chrome) consumes <strong>~3.0 GB RAM</strong> and <strong>2 vCPUs</strong>.
                <br>If 5 users scan simultaneously on a single server, it will crash.
            </div>

            <h2>2. Recommended SaaS Architecture (Queue-Based)</h2>
            <p>You must separate the API (Manager) from the Scanners (Workers).</p>

            <h3>A. The Manager Node (API + DB)</h3>
            <ul>
                <li><strong>Role</strong>: Frontend, API, Database, Job Queue (Redis).</li>
                <li><strong>Specs</strong>: 4 vCPU / 8 GB RAM.</li>
                <li><strong>Estimate</strong>: ~$40/month.</li>
            </ul>

            <h3>B. The Worker Nodes (Scan Engines)</h3>
            <ul>
                <li><strong>Role</strong>: Executes ZAP/Puppeteer jobs from the Queue.</li>
                <li><strong>Strategy</strong>: 1 Worker Node = ~3 Concurrent Scans.</li>
                <li><strong>Specs</strong>: 4-8 vCPU / 16 GB RAM (High Memory is key).</li>
                <li><strong>Estimate</strong>: ~$25 - $80/month per node.</li>
            </ul>

            <h2>3. Capacity & Cost Calculation</h2>
            <table>
                <tr>
                    <th>Concurrent Users (Active Scans)</th>
                    <th>Required Infrastructure</th>
                    <th>Est. Monthly Cost</th>
                </tr>
                <tr>
                    <td><strong>1 - 3 Users</strong></td>
                    <td>1 Manager + 1 Worker (16GB)</td>
                    <td>~$65 - $80</td>
                </tr>
                <tr>
                    <td><strong>4 - 10 Users</strong></td>
                    <td>1 Manager + 3 Workers</td>
                    <td>~$200 - $300</td>
                </tr>
                <tr>
                    <td><strong>Scale (50+)</strong></td>
                    <td>Kubernetes Autoscaling</td>
                    <td>$1,500+</td>
                </tr>
            </table>

            <h2>4. Required Tech Stack Updates</h2>
            <div class="highlight">
                <strong>1. Job Queue (Required):</strong> Redis + BullMQ. Users are queued if capacity is full.<br>
                <strong>2. Database:</strong> PostgreSQL (JSON files will corrupt).<br>
                <strong>3. Isolation:</strong> Docker containers per scan to prevent data leaks.
            </div>

            <h2>5. The "Smart Start" Budget Config</h2>
            <p>To launch your SaaS MVP with minimal cost but high stability:</p>
            <ul>
                <li><strong>Manager:</strong> Hetzner CPX31 (4 vCPU / 8GB) - ~$15</li>
                <li><strong>Worker:</strong> Hetzner CPX41 (4 vCPU / 16GB) - ~$25</li>
                <li><strong>Total:</strong> ~$40/month for ~5 concurrent scans.</li>
            </ul>

            <div class="footer">
                VAPT Framework SaaS Plan - Generated ${new Date().toLocaleDateString()}
            </div>
        </body>
        </html>
        `;

        await page.setContent(content);

        const pdfPath = path.resolve(__dirname, 'VAPT_SaaS_Requirements.pdf');
        await page.pdf({
            path: pdfPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' }
        });

        console.log(`PDF generated successfully at: ${pdfPath}`);
        await browser.close();

    } catch (error) {
        console.error('Error generating PDF:', error);
        process.exit(1);
    }
})();

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
    console.log("[*] Starting Puppeteer PDF Diagnostic...");
    try {
        console.log("[1] Launching browser...");
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        console.log("[2] Browser launched successfully!");
        const page = await browser.newPage();
        
        await page.setContent(`
            <html>
                <body>
                    <h1>Puppeteer Diagnostic Success</h1>
                    <p>PDF generated at ${new Date().toISOString()}</p>
                </body>
            </html>
        `);

        console.log("[3] Generating test PDF...");
        const testPath = path.join(__dirname, 'test_diag.pdf');
        await page.pdf({ path: testPath, format: 'A4' });

        console.log(`[4] ✓ PDF generated successfully at: ${testPath}`);
        await browser.close();
        
        // Cleanup
        if (fs.existsSync(testPath)) {
            fs.unlinkSync(testPath);
            console.log("[5] Cleanup complete.");
        }

        console.log("\n[✓] DIAGNOSTIC PASSED: Puppeteer is fully functional!");

    } catch (err) {
        console.error("\n[✗] DIAGNOSTIC FAILED!");
        console.error("Error Message:", err.message);
        console.error("\nPossible fixes:");
        console.error("1. Run sudo bash scripts/install_pdf_deps.sh");
        console.error("2. Ensure the user running the server has write permissions.");
        console.error("3. Check for low memory (2GB+ RAM recommended for Puppeteer).");
        process.exit(1);
    }
})();

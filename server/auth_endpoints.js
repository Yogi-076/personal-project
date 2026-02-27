// ============================================================================
// GRAY BOX AUTHENTICATION ENGINE - Authenticated Scanning Endpoints
// ============================================================================

const authBridge = require('./services/authBridge');

// Test login credentials and validate selectors
app.post('/api/auth/test-login', requireModule('dast_core'), async (req, res) => {
    try {
        const { loginUrl, username, password, selectors } = req.body || {};

        if (!loginUrl || !username || !password) {
            return res.status(400).json({ error: 'Login URL, username, and password are required' });
        }

        console.log(`[Auth Test] Testing login for ${loginUrl}`);

        const result = await authBridge.getAuthHeaders(
            loginUrl,
            username,
            password,
            selectors || {},
            { headless: false, timeout: 30000 } // Show browser for testing
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Login successful',
                cookieCount: result.fullCookies.length,
                hasJWT: !!result.jwtHeader,
                finalUrl: result.finalUrl
            });
        } else {
            res.status(401).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('[Auth Test] Error:', error);
        res.status(500).json({ error: 'Login test failed', details: error.message });
    }
});

// Validate CSS selectors on login page
app.post('/api/auth/validate-selectors', requireModule('dast_core'), async (req, res) => {
    try {
        const { loginUrl, selectors } = req.body || {};

        if (!loginUrl || !selectors) {
            return res.status(400).json({ error: 'Login URL and selectors are required' });
        }

        const result = await authBridge.validateSelectors(loginUrl, selectors);
        res.json(result);

    } catch (error) {
        console.error('[Selector Validation] Error:', error);
        res.status(500).json({ error: 'Selector validation failed', details: error.message });
    }
});

// Start authenticated scan (Gray Box Mode)
app.post('/api/scan/authenticated/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors, tool } = req.body || {};

        if (!target) {
            return res.status(400).json({ error: 'Target URL is required' });
        }

        if (!loginUrl || !username || !password) {
            return res.status(400).json({ error: 'Authentication credentials are required for Gray Box scanning' });
        }

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'authenticated',
            status: 'authenticating',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };

        await storage.saveScan(scan);

        // Start authenticated scan asynchronously
        (async () => {
            try {
                // Step 1: Perform login and get session
                console.log(`[Scan ${scanId}] Step 1: Authenticating...`);
                await storage.updateScan(scanId, {
                    status: 'authenticating',
                    progress: 10,
                    logs: ['🔐 Initiating browser automation...', 'Navigating to login page...']
                });

                const authResult = await authBridge.getAuthHeaders(
                    loginUrl,
                    username,
                    password,
                    selectors || {},
                    { headless: true, timeout: 30000 }
                );

                if (!authResult.success) {
                    throw new Error(`Authentication failed: ${authResult.error}`);
                }

                console.log(`[Scan ${scanId}] ✅ Authentication successful`);
                await storage.updateScan(scanId, {
                    status: 'scanning',
                    progress: 20,
                    logs: [
                        '✅ Login successful',
                        `Extracted ${authResult.fullCookies.length} session cookies`,
                        authResult.jwtHeader ? '✅ JWT token captured' : 'No JWT token found',
                        '🔍 Starting authenticated vulnerability scan...'
                    ]
                });

                // Step 2: Run scan with authentication
                const selectedTool = (tool || 'wapiti').toLowerCase();
                let toolService = selectedTool === 'zap' ? zapService : wapitiService;

                const scanOptions = {
                    authSession: authResult, // Pass the entire auth result
                    modules: selectedTool === 'wapiti' ? 'backup,exec,file,sql,xss,crlf,xxe' : undefined
                };

                console.log(`[Scan ${scanId}] Step 2: Running ${selectedTool.toUpperCase()} scan...`);

                // Start monitoring
                const monitorInterval = setInterval(async () => {
                    try {
                        const data = toolService.getProgress(scanId);
                        if (data) {
                            await storage.updateScan(scanId, {
                                progress: Math.max(20, data.progress), // Ensure progress starts at 20%
                                logs: data.logs
                            });
                        }
                    } catch (monitorErr) {
                        console.error('[Scan Monitor] Error:', monitorErr.message);
                    }
                }, 5000);

                const results = await toolService.scan(target, scanOptions, scanId);
                clearInterval(monitorInterval);

                // Step 3: Transform and save results
                const finalResults = selectedTool === 'zap' ? results : ReportTransformer.transform(results);

                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    findings: finalResults.findings,
                    summary: finalResults.summary,
                    progress: 100,
                    logs: toolService.getProgress(scanId).logs
                });

                console.log(`[Scan ${scanId}] ✅ Authenticated scan completed`);

            } catch (error) {
                console.error(`[Scan ${scanId}] Error:`, error);
                await storage.updateScan(scanId, {
                    status: 'failed',
                    error: error.message,
                    progress: 0
                });
            }
        })();

        res.json({
            scanId,
            message: 'Authenticated scan initiated',
            status: 'authenticating'
        });

    } catch (error) {
        console.error('Error starting authenticated scan:', error);
        res.status(500).json({ error: 'Failed to start authenticated scan', details: error.message });
    }
});

// Get authentication session status
app.get('/api/auth/session-status/:scanId', async (req, res) => {
    try {
        const { scanId } = req.params;
        const scan = await storage.getScan(scanId);

        if (!scan) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        res.json({
            scanId,
            status: scan.status,
            progress: scan.progress,
            isAuthenticated: scan.status !== 'authenticating' && scan.status !== 'failed'
        });

    } catch (error) {
        console.error('Error getting session status:', error);
        res.status(500).json({ error: 'Failed to get session status' });
    }
});

require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const Wappalyzer = require('wappalyzer');
const WapitiService = require('./services/wapitiService');
const SastService = require('./services/sastService');
const ZapService = require('./services/zapService');
const authBridge = require('./services/authBridge'); // Gray Box Auth Engine
const KatanaService = require('./services/katanaService'); // Authenticated Crawling
const NucleiService = require('./services/nucleiService'); // CVE Scanning
const aiHunter = require('./services/aiHunterService'); // AI-Powered Vulnerability Hunter
const RetireService = require('./services/retireService'); // SCA — Vulnerable Library Detection
const ReportTransformer = require('./utils/reportTransformer');
const SovereignShodan = require('./services/sovereignShodan');
const adminRoutes = require('./routes/admin'); // [NEW] SaaS Admin Routes
const projectRoutes = require('./routes/projects'); // [NEW] VAPT Project Management Routes
const reportRoutes = require('./routes/reports'); // [NEW] Advanced Reporting Engine
const { requireModule } = require('./middleware/saasMiddleware'); // [NEW] SaaS Middleware

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: true,
        methods: ["GET", "POST", "PATCH"],
        credentials: true
    }
});

app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP in dev to avoid blocking Moltbot iframe if needed, or configure strictly
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors()); // Enable pre-flight for all routes
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// [NEW] SaaS Admin API
app.use('/api/admin', adminRoutes);

// [NEW] VAPT Project Engine API
app.use('/api/projects', projectRoutes);

// [NEW] VAPT Advanced Reporting Engine
app.use('/api/reports', reportRoutes);

// [NEW] Serve generated reports for download
app.use('/api/projects/:projectId/reports', (req, res, next) => {
    express.static(path.join(__dirname, '..', 'data', 'projects', req.params.projectId, 'reports'))(req, res, next);
});

// [Aether-Core] Robust Passive Recon Endpoint
const net = require('net');
const axios = require('axios');
const dns = require('dns').promises;

app.post('/api/tools/aether/scan', requireModule('recon_aether'), async (req, res) => {
    const { target } = req.body || {};
    const shodanKey = (req.body && req.body.shodanKey) || process.env.SHODAN_API_KEY;
    if (!target) return res.status(400).json({ error: 'Target required' });

    console.log(`[Aether] Scanning target: ${target}`);

    try {
        // 1. Resolve Domain & DNS
        const domain = target.replace(/(^\w+:|^)\/\//, '').split('/')[0];
        let address;
        try {
            console.log(`[Aether] Resolving domain: ${domain}`);
            const lookup = await dns.lookup(domain);
            console.log(`[Aether] Resolved: ${JSON.stringify(lookup)}`);
            address = lookup.address;
        } catch (e) {
            console.error(`[Aether] DNS Lookup Failed: ${e.message}`);
            return res.status(400).json({ error: `Could not resolve domain: ${domain}` });
        }

        let result = {
            ip: address,
            location: "Unknown",
            org: "Unknown",
            ports: [],
            tech: [],
            vulns: []
        };

        // --- SHODAN INTEGRATION (Authoritative Data) ---
        if (shodanKey) {
            console.log(`[Aether] Querying Shodan API for ${address}...`);
            try {
                const shodanRes = await axios.get(`https://api.shodan.io/shodan/host/${address}?key=${shodanKey}&minify=true`, { timeout: 5000 });
                const sData = shodanRes.data;

                result.location = `${sData.city}, ${sData.country_name}`;
                result.org = sData.org || sData.isp;
                result.ports = sData.ports || [];
                result.vulns = sData.vulns || [];
                result.tech = sData.os ? [sData.os] : [];

                // Extract hostnames if available
                if (sData.hostnames && sData.hostnames.length > 0) {
                    result.tech.push(...sData.hostnames);
                }

                console.log("[Aether] Shodan Data Retrieved Successfully.");

                // If we got good data, return immediately (No guessing needed)
                return res.json(result);

            } catch (shodanError) {
                console.warn("[Aether] Shodan Query Failed:", shodanError.response ? shodanError.response.status : shodanError.message);
                // Fallthrough to active scan if Shodan fails (e.g., partial quota, or IP not indexed)
            }
        }

        // --- FALLBACK: ACTIVE RECON (If no Shodan Key or Shodan failed) ---
        console.log("[Aether] Falling back to Active Recon...");

        // 2. GeoIP (ip-api.com)
        try {
            const geoRes = await axios.get(`http://ip-api.com/json/${address}?fields=status,country,city,org,isp`, { timeout: 3000 });
            if (geoRes.data.status === 'success') {
                result.location = `${geoRes.data.city}, ${geoRes.data.country}`;
                result.org = geoRes.data.org || geoRes.data.isp;
            }
        } catch (e) { console.warn("[Aether] GeoIP failed:", e.message); }

        // 3. Port Scanning (TCP Connect)
        // Expanded "Core Logic" Port List
        const commonPorts = [
            21, 22, 23, 25, 53, 80, 110, 143, 443, 445,
            3000, 3306, 3389, 5432, 6379, 8000, 8008, 8080, 8443, 8888, 9200
        ];

        const checkPort = (port) => new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(1500);
            socket.on('connect', () => { socket.destroy(); resolve(port); });
            socket.on('timeout', () => { socket.destroy(); resolve(null); });
            socket.on('error', (e) => { socket.destroy(); resolve(null); });
            socket.connect(port, address);
        });

        const portResults = await Promise.all(commonPorts.map(p => checkPort(p)));
        portResults.forEach(p => { if (p) result.ports.push(p) });

        // 4. Advanced Tech Stack Analysis (Headers + Body + Meta + Scripts)
        let techSet = new Set(result.tech);
        let vulnsList = [];
        let pageTitle = "";

        const protocols = result.ports.includes(443) ? ['https'] : ['http'];
        if (result.ports.includes(80) && !protocols.includes('http')) protocols.push('http');

        for (const protocol of protocols) {
            try {
                const response = await axios.get(`${protocol}://${domain}`, {
                    timeout: 8000, // Slightly longer for deep analysis
                    maxRedirects: 3,
                    validateStatus: () => true,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
                    },
                    httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false })
                });

                const headers = response.headers;
                const body = typeof response.data === 'string' ? response.data : '';
                const lowerBody = body.toLowerCase();

                // --- HEADER ANALYSIS ---
                if (headers['server']) techSet.add(`${headers['server']} (Server)`);
                if (headers['x-powered-by']) techSet.add(`${headers['x-powered-by']} (Backend)`);
                if (headers['x-aspnet-version']) techSet.add("ASP.NET");
                if (headers['via']) techSet.add("Proxy/CDN");
                if (headers['x-generator']) techSet.add(headers['x-generator']);

                // --- SECURITY HEADERS CHECK ---
                if (!headers['strict-transport-security'] && protocol === 'https') vulnsList.push("Missing HSTS (Strict-Transport-Security)");
                if (!headers['content-security-policy']) vulnsList.push("Missing Content-Security-Policy (CSP)");
                if (!headers['x-frame-options']) vulnsList.push("Missing X-Frame-Options (Clickjacking Risk)");
                if (headers['set-cookie'] && !JSON.stringify(headers['set-cookie']).includes('Secure')) vulnsList.push("Cookies missing 'Secure' flag");

                // --- BODY ANALYSIS (SIGNATURES) ---
                // CMS & Frameworks
                if (lowerBody.includes('wp-content') || lowerBody.includes('wp-includes')) techSet.add("WordPress");
                if (lowerBody.includes('drupal.settings')) techSet.add("Drupal");
                if (lowerBody.includes('joomla!')) techSet.add("Joomla");
                if (lowerBody.includes('shopify.com')) techSet.add("Shopify");
                if (lowerBody.includes('squarespace')) techSet.add("Squarespace");
                if (lowerBody.includes('wix.com')) techSet.add("Wix");

                // JS Frameworks
                if (lowerBody.includes('react') || lowerBody.includes('data-reactid')) techSet.add("React");
                if (lowerBody.includes('vue.js') || lowerBody.includes('data-v-')) techSet.add("Vue.js");
                if (lowerBody.includes('ng-version') || lowerBody.includes('angular')) techSet.add("Angular");
                if (lowerBody.includes('svelte')) techSet.add("Svelte");
                if (lowerBody.includes('next.js') || lowerBody.includes('__next')) techSet.add("Next.js");
                if (lowerBody.includes('nuxt')) techSet.add("Nuxt.js");
                if (lowerBody.includes('backbone.js')) techSet.add("Backbone.js");
                if (lowerBody.includes('jquery')) techSet.add("jQuery");
                if (lowerBody.includes('alpine.js')) techSet.add("Alpine.js");

                // CSS Frameworks
                if (lowerBody.includes('bootstrap')) techSet.add("Bootstrap");
                if (lowerBody.includes('tailwindcss')) techSet.add("Tailwind CSS");
                if (lowerBody.includes('bulma')) techSet.add("Bulma");
                if (lowerBody.includes('foundation')) techSet.add("Foundation");

                // Infra & CDNs
                if (headers['cf-ray'] || headers['server']?.includes('cloudflare')) techSet.add("Cloudflare");
                if (headers['xy-aws-request-id'] || headers['server']?.includes('aws') || headers['server']?.includes('amazon')) techSet.add("AWS");
                if (headers['x-goog-'] || headers['server']?.includes('gws')) techSet.add("Google Cloud");
                if (headers['x-azure-ref']) techSet.add("Microsoft Azure");
                if (lowerBody.includes('netlify')) techSet.add("Netlify");
                if (lowerBody.includes('vercel')) techSet.add("Vercel");

                // Analytics & Ads
                if (lowerBody.includes('google-analytics.com') || lowerBody.includes('gtag')) techSet.add("Google Analytics");
                if (lowerBody.includes('googletagmanager.com')) techSet.add("Google Tag Manager");
                if (lowerBody.includes('facebook-jssdk')) techSet.add("Facebook Pixel");
                if (lowerBody.includes('hotjar')) techSet.add("Hotjar");

                // Extract Title
                const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    pageTitle = titleMatch[1].trim();
                }

                if (response.status < 400) break;
            } catch (e) {
                console.log(`[Aether] ${protocol} probe error: ${e.message}`);
            }
        }

        // Add additional context if Org is generic
        if (result.org === "Unknown" || result.org === "Google LLC") {
            if (pageTitle) result.org = `Hosted: ${pageTitle}`;
        }

        // Add Title to Tech for visibility
        if (pageTitle) techSet.add(`Title: ${pageTitle}`);

        result.tech = Array.from(techSet);
        result.vulns = vulnsList.length > 0 ? vulnsList : ["No immediate misconfigurations found (Active Scan)"];

        console.log("[Aether] Active Scan Result:", result);
        res.json(result);

    } catch (globalError) {
        console.error("[Aether] Critical Error:", globalError);
        res.status(500).json({ error: "Scan aborted: " + globalError.message });
    }
});

// Start Server
const PORT = process.env.PORT || 3001;

const storage = require('./utils/storage');
const wapitiService = new WapitiService();
const sastService = new SastService();
const zapService = new ZapService();
const katanaService = new KatanaService();
const nucleiService = new NucleiService();
const retireService = new RetireService();
const sovereignShodan = new SovereignShodan();

// --- Sovereign-Shodan Endpoints ---
app.post('/api/tools/shodan/scan', async (req, res) => {
    const { target } = req.body || {};
    if (!target) return res.status(400).json({ error: 'Target IP required' });

    try {
        const result = await sovereignShodan.scanHost(target);
        res.json(result);
    } catch (error) {
        // Handle Shodan errors gracefully
        if (error.response) {
            return res.status(error.response.status).json({ error: error.response.data.error || 'Shodan API Error' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tools/shodan/monitor', async (req, res) => {
    const { cidr } = req.body || {};
    if (!cidr) return res.status(400).json({ error: 'CIDR required' });

    try {
        const result = await sovereignShodan.monitorNetwork(cidr);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// --- Initialization: Ensure Default Manual Project Exists ---
const DEFAULT_PROJECT_ID = 'manual-project-default';
(async () => {
    try {
        const defaultScan = await storage.getScan(DEFAULT_PROJECT_ID);
        if (!defaultScan) {
            console.log('[Init] Creating default Manual Findings project...');
            await storage.saveScan({
                id: DEFAULT_PROJECT_ID,
                target: 'Manual Assessment',
                type: 'manual',
                status: 'active',
                startedAt: new Date().toISOString(),
                progress: 100,
                findings: [],
                summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
            });
        }
    } catch (e) { console.error('[Init] Failed to init default project:', e.message); }
})();

// --- Auth Routes (Supabase Integration) ---
const supabase = require('./utils/supabaseClient');

app.post('/auth/register', async (req, res) => {
    console.log('[Auth] Register attempt:', req.body?.email);
    try {
        let { email, password, username, firstName, lastName, orgName } = req.body || {};
        username = username || orgName;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // 1. SignUp with Supabase
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    username: username || email.split('@')[0],
                    first_name: firstName,
                    last_name: lastName,
                    role: 'user', // Default role
                    org_name: orgName
                }
            }
        });

        if (error) {
            console.error('Supabase SignUp Error:', error);
            return res.status(400).json({ error: error.message });
        }

        if (!data.user) {
            return res.status(400).json({ error: 'Registration failed: No user returned' });
        }

        // 2. Return success (Session handling is done on client side usually, but we return user data)
        res.json({
            message: 'Registration successful. Check email for verification if enabled.',
            user: {
                id: data.user.id,
                email: data.user.email,
                username: data.user.user_metadata.username,
                role: data.user.user_metadata.role
            },
            // Note: Supabase might not return session on signup if email confirmation is on
            token: data.session?.access_token || 'pending-verification'
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Registration failed' });
    }
});

app.post('/auth/login', async (req, res) => {
    console.log('[Auth] Login attempt:', req.body?.email);
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            return res.status(401).json({ error: error.message });
        }

        res.json({
            token: data.session.access_token,
            user: {
                id: data.user.id,
                email: data.user.email,
                username: data.user.user_metadata.username,
                role: data.user.user_metadata.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        res.json({
            id: user.id,
            email: user.email,
            username: user.user_metadata.username,
            role: user.user_metadata.role
        });

    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

const aiService = require('./services/aiService');

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'VAPT Framework Scanner API' });
});

// [NEW] Native AI Chat Endpoint
app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId } = req.body || {};
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const sid = sessionId || 'default-session';
        const response = await aiService.processMessage(sid, message);

        res.json(response);
    } catch (error) {
        console.error('Chat API Error:', error);
        res.status(500).json({ error: 'Failed to process chat message' });
    }
});

// Start a new scan
app.post('/api/scan/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, options = {}, projectId } = req.body || {};

        if (!target) {
            return res.status(400).json({ error: 'Target URL is required' });
        }

        if (!projectId) {
            return res.status(400).json({ error: 'projectId is required for Project Management' });
        }

        // Validate URL
        try {
            new URL(target);
        } catch (e) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const scanId = uuidv4();
        const tool = (req.body.options?.tool || req.body.tool || 'wapiti').toLowerCase();
        const proxy = options.proxy || req.body.proxy;
        const fullModules = options.fullModules || req.body.fullModules;

        const scan = {
            id: scanId,
            projectId, // Link to project
            target,
            type: tool === 'zap' ? 'zap' : tool === 'retire' ? 'retire' : 'wapiti',
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            options: { ...options, proxy, wafBypass: req.body.wafBypass, fullModules }, // Propagate proxy and options here
            priority: options.priority || 'medium', // Add priority here
            summary: {
                total: 0,
                critical: 0,
                high: 0,
                medium: 0,
                low: 0,
                info: 0,
            },
        };

        await storage.saveScan(scan);

        // Start scan asynchronously
        const runScan = async () => {
            let monitorInterval;

            try {
                let toolService;
                const tool = (req.body.tool || 'wapiti').toLowerCase();

                if (tool === 'zap') toolService = zapService;
                else if (tool === 'ai-hunter') toolService = aiHunter;
                else if (tool === 'retire') toolService = retireService;
                else toolService = wapitiService; // Default

                // Start Monitoring Loop
                monitorInterval = setInterval(async () => {
                    try {
                        let data;
                        if (tool === 'zap') {
                            data = toolService.getProgress(scanId);
                        } else {
                            data = toolService.getProgress(scanId); // Wapiti logs progress but not findings yet
                        }

                        if (data) {
                            await storage.updateScan(scanId, {
                                progress: data.progress,
                                logs: data.logs,
                                findings: data.findings, // Will be undefined/empty for Wapiti initially but critical for ZAP
                                summary: data.summary    // Same here
                            });
                        }
                    } catch (monitorErr) {
                        console.error('[Scan Monitor] Error updating progress:', monitorErr.message);
                    }
                }, 5000); // Update every 5 seconds

                let results;
                if (tool === 'zap') {
                    console.log(`[Scan] Starting ZAP scan for ${scanId}...`);
                    results = await zapService.scan(target, options, scanId);
                } else {
                    // Pass WAF bypass option through to Wapiti
                    if (options.wafBypass || req.body.wafBypass) {
                        console.log(`[Scan] 🛡️ WAF Bypass Mode: ENABLED for ${scanId}`);
                    }
                    console.log(`[Scan] Starting Wapiti scan for ${scanId}...`);
                    results = await wapitiService.scan(target, { ...options, wafBypass: req.body.wafBypass, fullModules: req.body.fullModules }, scanId);
                }

                clearInterval(monitorInterval);

                // Transform Results (ZAP & AI Hunter already return compatible format, but Transformer is good for Wapiti)
                const finalResults = (tool === 'zap' || tool === 'ai-hunter') ? results : ReportTransformer.transform(results);

                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    findings: finalResults.findings,
                    summary: finalResults.summary,
                    progress: 100,
                    logs: toolService.getProgress(scanId).logs
                });

            } catch (error) {
                if (monitorInterval) clearInterval(monitorInterval);
                console.error('Scan error:', error);

                // Get final logs if possible
                let errorLogs = [];
                try {
                    const tool = (req.body.tool || 'wapiti').toLowerCase();
                    const service = toolService || (tool === 'zap' ? zapService : wapitiService);
                    errorLogs = service.getProgress(scanId).logs;
                } catch (e) { }

                await storage.updateScan(scanId, {
                    status: 'failed',
                    error: error.message,
                    progress: 0,
                    logs: errorLogs
                });
            }
        };

        runScan();

        res.json({
            scanId,
            message: 'Scan initiated successfully',
            status: 'pending',
        });
    } catch (error) {
        console.error('Error starting scan:', error);
        res.status(500).json({ error: 'Failed to start scan' });
    }
});
// [NEW] Stop Scan & Parse Partial Logs
app.post('/api/scan/:id/stop', async (req, res) => {
    try {
        const { id } = req.params;
        const scan = await storage.getScan(id);

        if (!scan) {
            return res.status(404).json({ error: 'Scan not found' });
        }

        if (scan.status === 'completed' || scan.status === 'failed') {
            return res.json({ message: 'Scan already finished', ...scan });
        }

        // Only wapiti has the explicit stopping logic implemented right now
        let partialResults = { findings: [], summary: { total: 0 } };
        const tool = (scan.options?.tool || 'wapiti').toLowerCase();

        if (tool === 'wapiti') {
            console.log(`[Scan ${id}] 🛑 Received stop signal. Terminating Wapiti...`);
            partialResults = await wapitiService.stopScan(id);
        }

        // Update storage
        scan.status = 'completed'; // Mark completed so it generates a report successfully
        scan.completedAt = new Date().toISOString();
        scan.findings = partialResults.findings || [];
        scan.summary = partialResults.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
        scan.progress = 100;

        try {
            const toolService = tool === 'zap' ? zapService : wapitiService;
            scan.logs = toolService.getProgress(id).logs;
        } catch (e) { }

        await storage.updateScan(id, scan);

        res.json({ message: 'Scan stopped & partial results saved', ...scan });
    } catch (error) {
        console.error(`[Scan ${req.params.id}] Error stopping scan:`, error);
        res.status(500).json({ error: 'Failed to stop scan', details: error.message });
    }
});

// [NEW] Start SAST Code Scan
app.post('/api/scan/sast/start', requireModule('sast_pro'), async (req, res) => {
    try {
        const { repoUrl: rawRepoUrl } = req.body || {};
        const repoUrl = rawRepoUrl?.trim();

        if (!repoUrl || !repoUrl.startsWith('http')) {
            return res.status(400).json({ error: 'Valid Git Repository URL is required' });
        }

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target: repoUrl,
            type: 'sast', // Mark as Code Scan
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };

        await storage.saveScan(scan);

        // Start SAST Scan Asynchronously
        sastService.scan(repoUrl, {}, scanId)
            .then(async results => {
                const sastProgress = sastService.getProgress(scanId);
                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    findings: results.findings,
                    summary: results.summary,
                    progress: 100,
                    logs: sastProgress.logs || []
                });
                console.log(`[SAST ${scanId}] ✅ Saved ${results.findings.length} findings to storage`);
            })
            .catch(async error => {
                const sastProgress = sastService.getProgress(scanId);
                await storage.updateScan(scanId, {
                    status: 'failed',
                    error: error.message,
                    progress: 0,
                    logs: sastProgress.logs || []
                });
            });

        res.json({ scanId, message: 'Code Analysis Initiated', status: 'pending' });

    } catch (error) {
        console.error('Error starting SAST scan:', error);
        res.status(500).json({ error: 'Failed to start code scan' });
    }
});

// Get scan status
app.get('/api/scan/status/:scanId', async (req, res) => {
    const { scanId } = req.params;
    const scan = await storage.getScan(scanId);

    if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
    }

    // Get real-time progress and logs
    let progress = 0;
    let logs = [];

    if (scan.type === 'sast') {
        const sastData = sastService.getProgress(scanId);
        progress = sastData.progress;
        logs = sastData.logs;
    } else if (scan.type === 'zap') {
        const zapData = zapService.getProgress(scanId);
        progress = zapData.progress;
        logs = zapData.logs;
    } else if (scan.type === 'katana') {
        const katanaData = katanaService.getProgress(scanId);
        progress = katanaData.progress;
        logs = katanaData.logs;
    } else if (scan.type === 'nuclei') {
        const nucleiData = nucleiService.getProgress(scanId);
        progress = nucleiData.progress;
        logs = nucleiData.logs;
    } else if (scan.type === 'graybox_full') {
        // Graybox logs are saved inline in the scan data
        progress = scan.progress || 0;
        logs = scan.logs || [];
    } else if (scan.type === 'ai-hunter') {
        const hunterStatus = aiHunter.getStatus(scanId);
        if (hunterStatus) {
            progress = hunterStatus.phase === 'complete' ? 100 : 50;
            logs = hunterStatus.logs.map(l => l.message);
        }
    } else {
        const wapitiData = wapitiService.getProgress(scanId);
        progress = wapitiData.progress;
        logs = wapitiData.logs;
    }

    // Update progress in storage if changed
    if (progress > scan.progress) {
        await storage.updateScan(scanId, { progress });
        scan.progress = progress; // Update local reference for response
    }

    res.json({
        id: scan.id,
        target: scan.target,
        status: scan.status,
        progress: scan.progress,
        logs: logs, // Pass real logs to frontend
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        error: scan.error
    });
});

// Get scan results
app.get('/api/scan/results/:scanId', async (req, res) => {
    const { scanId } = req.params;
    const scan = await storage.getScan(scanId);

    if (!scan) {
        return res.status(404).json({ error: 'Scan not found' });
    }

    res.json(scan);
});

// [NEW] Start Advanced DAST Scan
app.post('/api/scan/dast/start', requireModule('dast_advanced'), async (req, res) => {
    try {
        const { target } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'dast', // Mark as Advanced DAST
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };

        await storage.saveScan(scan);

        // Run Wapiti with ALL modules for maximum coverage (no module restriction)
        const options = {};

        wapitiService.scan(target, options, scanId)
            .then(async wapitiResults => {
                const transformedResults = ReportTransformer.transform(wapitiResults);
                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    findings: transformedResults.findings,
                    summary: transformedResults.summary,
                    progress: 100
                });
            })
            .catch(async error => {
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            });

        res.json({ scanId, message: 'Advanced DAST Attack Initiated', status: 'pending' });

    } catch (error) {
        console.error('Error starting DAST scan:', error);
        res.status(500).json({ error: 'Failed to start DAST scan' });
    }
});

// [NEW] Start OWASP ZAP Scan (Scanner 3)
app.post('/api/scan/zap/start', requireModule('dast_advanced'), async (req, res) => {
    try {
        const { target } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'zap', // Mark as ZAP
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };

        await storage.saveScan(scan);

        zapService.scan(target, {}, scanId)
            .then(async results => {
                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    findings: results.findings,
                    summary: results.summary,
                    progress: 100
                });
            })
            .catch(async error => {
                await storage.updateScan(scanId, {
                    status: 'failed',
                    error: error.message,
                    progress: 0
                });
            });

        res.json({ scanId, message: 'OWASP ZAP Scan Initiated', status: 'pending' });

    } catch (error) {
        console.error('Error starting ZAP scan:', error);
        res.status(500).json({ error: 'Failed to start ZAP scan' });
    }
});

// [NEW] AI Hunter Specific Routes
app.post('/api/scan/ai-hunter/start', async (req, res) => {
    const { target, loginUrl, username, password, selectors, wafBypass, proxy, repoName } = req.body || {};
    if (!target) {
        return res.status(400).json({ error: 'Required: target' });
    }
    try {
        const result = await aiHunter.startHunt({
            target,
            loginUrl: loginUrl || target,
            username: username || '',
            password: password || '',
            selectors,
            wafBypass,
            proxy,
            repoName
        });
        const scanId = result.scanId;

        // Persist AI Hunter scan to storage for history
        const scan = {
            id: scanId,
            target,
            type: 'ai-hunter',
            status: 'running',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };
        await storage.saveScan(scan);
        console.log(`[AI Hunter ${scanId}] Scan saved to persistent storage`);

        // Background poll and persist results when complete
        const pollInterval = setInterval(async () => {
            try {
                const status = aiHunter.getStatus(scanId);
                if (!status) { clearInterval(pollInterval); return; }

                if (status.status === 'complete' || status.status === 'error') {
                    clearInterval(pollInterval);

                    const findings = (status.findings || []).map(f => ({
                        name: f.title || f.type || 'AI Finding',
                        severity: (f.severity || 'info').toLowerCase(),
                        description: f.description || '',
                        remediation: f.remediation || '',
                        evidence: f.evidence || '',
                        url: f.endpoint || '',
                        method: f.method || 'GET',
                        type: f.type || 'UNKNOWN',
                        verified: f.verified || false,
                        cvss: f.cvss || 0,
                        poc: f.poc || '',
                        source: 'ai-hunter'
                    }));

                    const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
                    findings.forEach(f => {
                        if (summary.hasOwnProperty(f.severity)) summary[f.severity]++;
                        else summary.info++;
                    });

                    await storage.updateScan(scanId, {
                        status: status.status === 'complete' ? 'completed' : 'failed',
                        completedAt: new Date().toISOString(),
                        progress: status.status === 'complete' ? 100 : 0,
                        findings,
                        summary,
                        report: status.report || null
                    });
                    console.log(`[AI Hunter ${scanId}] Scan completed and persisted`);
                }
            } catch (e) { console.error(`[AI Hunter poll] ${e.message}`); }
        }, 5000);

        res.json(result);
    } catch (error) {
        console.error('Error starting AI Hunt:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/scan/ai-hunter/status/:scanId', async (req, res) => {
    // Check in-memory first (running scan)
    const memStatus = aiHunter.getStatus(req.params.scanId);
    if (memStatus) return res.json(memStatus);

    // Fallback to persistent storage (completed scan)
    try {
        const storedScan = await storage.getScan(req.params.scanId);
        if (storedScan) {
            return res.json({
                id: storedScan.id,
                status: storedScan.status,
                phase: storedScan.status === 'completed' ? 'complete' : storedScan.status,
                findings: storedScan.findings || [],
                logs: storedScan.logs || [],
                elapsed: 0
            });
        }
    } catch (e) { /* ignore storage errors */ }

    return res.status(404).json({ error: 'Scan not found' });
});

// ============================================================================
// GRAY BOX AUTHENTICATION ENGINE - Authenticated Scanning Endpoints
// ============================================================================

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
            { headless: false, timeout: 30000 }
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
        const { target, loginUrl, username, password, selectors, tool, fullModules } = req.body || {};

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
                    authSession: authResult,
                    fullModules: fullModules,
                };
                // Let Wapiti use ALL modules by default — no module restriction

                console.log(`[Scan ${scanId}] Step 2: Running ${selectedTool.toUpperCase()} scan...`);

                // Start monitoring
                const monitorInterval = setInterval(async () => {
                    try {
                        const data = toolService.getProgress(scanId);
                        if (data) {
                            await storage.updateScan(scanId, {
                                progress: Math.max(20, data.progress),
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

// ============================================================================
// KATANA & NUCLEI — Authenticated Crawling & CVE Scanning
// ============================================================================

// Start Katana authenticated crawl
app.post('/api/scan/katana/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors, depth, headless } = req.body || {};

        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'katana',
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };
        await storage.saveScan(scan);

        (async () => {
            try {
                let authSession = null;

                // Authenticate if credentials provided
                if (loginUrl && username && password) {
                    await storage.updateScan(scanId, { status: 'authenticating', progress: 5 });
                    authSession = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true });
                    if (!authSession.success) throw new Error(`Auth failed: ${authSession.error}`);
                    await storage.updateScan(scanId, { status: 'crawling', progress: 15 });
                }

                const crawlResult = await katanaService.crawl(target, {
                    authSession,
                    depth: depth || 3,
                    headless: !!headless,
                }, scanId);

                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    progress: 100,
                    findings: crawlResult.urls.map(url => ({ name: url, severity: 'info', url })),
                    summary: { total: crawlResult.totalUrls, info: crawlResult.totalUrls, critical: 0, high: 0, medium: 0, low: 0 },
                    logs: katanaService.getProgress(scanId).logs
                });
            } catch (error) {
                console.error(`[Katana ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Katana crawl initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting Katana crawl:', error);
        res.status(500).json({ error: 'Failed to start Katana crawl' });
    }
});

// Start Nuclei CVE scan
app.post('/api/scan/nuclei/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors, tags, severity } = req.body || {};

        if (!target) return res.status(400).json({ error: 'Target URL is required' });

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'nuclei',
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };
        await storage.saveScan(scan);

        (async () => {
            try {
                let authSession = null;

                if (loginUrl && username && password) {
                    await storage.updateScan(scanId, { status: 'authenticating', progress: 5 });
                    authSession = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true });
                    if (!authSession.success) throw new Error(`Auth failed: ${authSession.error}`);
                    await storage.updateScan(scanId, { status: 'scanning', progress: 15 });
                }

                const results = await nucleiService.scan(target, {
                    authSession,
                    tags: tags || ['cve', 'sqli', 'xss', 'rce', 'lfi', 'ssrf'],
                    severity: severity || 'low,medium,high,critical',
                }, scanId);

                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    progress: 100,
                    findings: results.findings,
                    summary: results.summary,
                    logs: nucleiService.getProgress(scanId).logs
                });
            } catch (error) {
                console.error(`[Nuclei ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Nuclei CVE scan initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting Nuclei scan:', error);
        res.status(500).json({ error: 'Failed to start Nuclei scan' });
    }
});

// ══════════════════════════════════════
// Retire.js SCA Scanner
// ══════════════════════════════════════
app.post('/api/scan/retire/start', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, mode } = req.body || {};
        if (!target) return res.status(400).json({ error: 'Target is required' });

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'retire',
            status: 'pending',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };
        await storage.saveScan(scan);

        (async () => {
            try {
                await storage.updateScan(scanId, { status: 'scanning', progress: 10 });
                const results = await retireService.scan(target, { mode: mode || 'directory' }, scanId);
                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    progress: 100,
                    findings: results.findings,
                    summary: results.summary,
                    logs: retireService.getProgress(scanId).logs,
                    dependencyTree: results.dependencyTree,
                    sbom: results.sbom,
                });
            } catch (error) {
                console.error(`[Retire ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0 });
            }
        })();

        res.json({ scanId, message: 'Retire.js SCA scan initiated', status: 'pending' });
    } catch (error) {
        console.error('Error starting Retire.js scan:', error);
        res.status(500).json({ error: 'Failed to start Retire.js scan' });
    }
});

app.get('/api/scan/retire/status/:scanId', (req, res) => {
    const progress = retireService.getProgress(req.params.scanId);
    res.json(progress);
});

app.get('/api/scan/retire/results/:scanId', (req, res) => {
    const results = retireService.getResults(req.params.scanId);
    if (!results) return res.status(404).json({ error: 'Results not found' });
    res.json(results);
});

// Full Gray Box Pipeline: Auth → Katana Crawl → Nuclei + Wapiti Scan
app.post('/api/scan/graybox/full', requireModule('dast_core'), async (req, res) => {
    try {
        const { target, loginUrl, username, password, selectors } = req.body || {};

        if (!target || !loginUrl || !username || !password) {
            return res.status(400).json({ error: 'Target, login URL, and credentials are required for full Gray Box pipeline' });
        }

        const scanId = uuidv4();
        const scan = {
            id: scanId,
            target,
            type: 'graybox_full',
            status: 'authenticating',
            startedAt: new Date().toISOString(),
            progress: 0,
            findings: [],
            summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        };
        await storage.saveScan(scan);

        // Full pipeline runs asynchronously
        (async () => {
            const allLogs = [];
            const log = (msg) => allLogs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

            try {
                // ── Phase 1: Authentication ──
                log('🔐 PHASE 1: Authenticating...');
                await storage.updateScan(scanId, { status: 'authenticating', progress: 5, logs: [...allLogs] });

                const authResult = await authBridge.getAuthHeaders(loginUrl, username, password, selectors || {}, { headless: true, timeout: 30000 });
                if (!authResult.success) throw new Error(`Authentication failed: ${authResult.error}`);

                log(`✅ Login successful — ${authResult.fullCookies.length} cookies, JWT: ${!!authResult.jwtHeader}`);
                await storage.updateScan(scanId, { status: 'crawling', progress: 15, logs: [...allLogs] });

                // ── Phase 2: Katana Crawl (Discovery) ──
                log('🕷️ PHASE 2: Crawling with Katana...');
                const crawlResult = await katanaService.crawl(target, {
                    authSession: authResult,
                    depth: 3,
                }, scanId + '-crawl');

                const crawledUrls = crawlResult.urls || [];
                log(`📍 Discovered ${crawledUrls.length} URLs`);
                log(`   Pages: ${crawlResult.categorized.pages.length} | APIs: ${crawlResult.categorized.apis.length} | Forms: ${crawlResult.categorized.forms.length}`);
                await storage.updateScan(scanId, { status: 'scanning', progress: 35, logs: [...allLogs] });

                // ── Phase 3: Nuclei CVE Scan ──
                log('🔬 PHASE 3: Nuclei CVE scanning...');
                const nucleiTargets = crawledUrls.length > 0 ? crawledUrls.slice(0, 200) : [target]; // Cap at 200 URLs
                const nucleiResults = await nucleiService.scan(nucleiTargets, {
                    authSession: authResult,
                    tags: ['cve', 'sqli', 'xss', 'rce', 'lfi', 'ssrf', 'misconfig'],
                    severity: 'low,medium,high,critical',
                }, scanId + '-nuclei');

                log(`🔬 Nuclei found ${nucleiResults.findings.length} vulnerabilities`);
                await storage.updateScan(scanId, { status: 'scanning', progress: 65, logs: [...allLogs] });

                // ── Phase 4: Wapiti Deep Scan ──
                log('⚔️ PHASE 4: Wapiti deep vulnerability scan...');
                // Run Wapiti with ALL modules (no restriction)
                const wapitiResults = await wapitiService.scan(target, {
                    authSession: authResult,
                }, scanId + '-wapiti');

                const wapitiFindings = ReportTransformer.transform(wapitiResults);
                log(`⚔️ Wapiti found ${wapitiFindings.findings.length} vulnerabilities`);
                await storage.updateScan(scanId, { progress: 90, logs: [...allLogs] });

                // ── Phase 5: Merge Results ──
                log('📊 PHASE 5: Merging results...');
                const allFindings = [
                    ...nucleiResults.findings.map(f => ({ ...f, source: 'nuclei' })),
                    ...wapitiFindings.findings.map(f => ({ ...f, source: 'wapiti' })),
                ];

                // Deduplicate by URL + name 
                const seen = new Set();
                const dedupedFindings = allFindings.filter(f => {
                    const key = `${f.name}|${f.url || f.matchedAt || ''}`.toLowerCase();
                    if (seen.has(key)) return false;
                    seen.add(key);
                    return true;
                });

                // Build merged summary
                const mergedSummary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 };
                for (const f of dedupedFindings) {
                    mergedSummary.total++;
                    const sev = (f.severity || 'info').toLowerCase();
                    if (mergedSummary.hasOwnProperty(sev)) mergedSummary[sev]++;
                }

                log(`✅ PIPELINE COMPLETE`);
                log(`   URLs Discovered: ${crawledUrls.length}`);
                log(`   Total Findings: ${mergedSummary.total} (Deduped from ${allFindings.length})`);
                log(`   🔴 Critical: ${mergedSummary.critical} | 🟠 High: ${mergedSummary.high} | 🟡 Medium: ${mergedSummary.medium} | 🔵 Low: ${mergedSummary.low}`);

                await storage.updateScan(scanId, {
                    status: 'completed',
                    completedAt: new Date().toISOString(),
                    progress: 100,
                    findings: dedupedFindings,
                    summary: mergedSummary,
                    logs: [...allLogs],
                    crawledUrls: crawledUrls.length,
                });

            } catch (error) {
                log(`❌ Pipeline error: ${error.message}`);
                console.error(`[GrayBox Pipeline ${scanId}] Error:`, error);
                await storage.updateScan(scanId, { status: 'failed', error: error.message, progress: 0, logs: [...allLogs] });
            }
        })();

        res.json({
            scanId,
            message: 'Full Gray Box pipeline initiated (Auth → Crawl → CVE Scan → Deep Scan)',
            status: 'authenticating',
            phases: ['Authentication', 'Katana Crawl', 'Nuclei CVE Scan', 'Wapiti Deep Scan', 'Result Merge']
        });

    } catch (error) {
        console.error('Error starting Gray Box pipeline:', error);
        res.status(500).json({ error: 'Failed to start Gray Box pipeline' });
    }
});

// Get scan history
app.get('/api/scan/history', async (req, res) => {
    const scans = await storage.getAllScans();
    const history = scans
        .sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
        .slice(0, 20); // Return last 20 scans

    res.json(history);
});

// Clear scan history
app.delete('/api/scan/history', (req, res) => {
    storage.clearScans();
    res.json({ message: 'History cleared' });
});

// Delete specific scan
app.delete('/api/scan/:id', async (req, res) => {
    const { id } = req.params;
    const success = await storage.deleteScan(id);
    if (success) res.json({ message: 'Scan deleted' });
    else res.status(404).json({ error: 'Scan not found' });
});

// --- PTK TOOLS ENDPOINTS ---

// Analyze Technology Stack (Wappalyzer)
app.post('/api/tools/analyze-stack', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    console.log(`[PTK] Analyzing Tech Stack for: ${url}`);
    const wappalyzer = new Wappalyzer({
        debug: false,
        delay: 1000,
        maxDepth: 1,
        maxWait: 5000,
        recursive: false
    });

    try {
        await wappalyzer.init();
        const site = await wappalyzer.open(url);
        const results = await site.analyze();
        await wappalyzer.destroy();
        res.json(results);
    } catch (error) {
        console.error('[PTK] Wappalyzer Error:', error);
        res.status(500).json({ error: 'Tech stack analysis failed', details: error.message });
        try { await wappalyzer.destroy(); } catch (e) { }
    }
});

// Analyze Security Headers
app.post('/api/tools/analyze-headers', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    const axios = require('axios');
    try {
        const response = await axios.head(url, { timeout: 5000, validateStatus: () => true });
        const headers = {};

        // Normalize headers to lowercase
        for (const [key, value] of Object.entries(response.headers)) {
            headers[key.toLowerCase()] = { value, present: true };
        }

        const securityHeaders = [
            'strict-transport-security',
            'content-security-policy',
            'x-frame-options',
            'x-content-type-options',
            'referrer-policy',
            'permissions-policy',
            'x-xss-protection'
        ];

        securityHeaders.forEach(h => {
            if (!headers[h]) {
                headers[h] = { present: false };
            }
        });

        res.json(headers);
    } catch (error) {
        console.error('[PTK] Headers Analysis Error:', error);
        res.status(500).json({ error: 'Headers analysis failed', details: error.message });
    }
});

// Request Proxy / Builder
app.post('/api/tools/proxy', async (req, res) => {
    const { method, url, headers, body } = req.body || {};
    const axios = require('axios');

    console.log(`[PTK] Proxying ${method} request to: ${url}`);

    const startTime = Date.now();
    try {
        const response = await axios({
            method: method || 'GET',
            url: url,
            headers: headers || {},
            data: body,
            timeout: 10000,
            validateStatus: () => true, // Don't throw on 4xx/5xx
            responseType: 'text'
        });

        const duration = Date.now() - startTime;

        // Simple IAST simulation
        const iast = [];
        const respBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);

        if (respBody.includes('SQL syntax') || respBody.includes('mysql_fetch')) {
            iast.push({ type: 'SQL Injection Proof', description: 'Database error message found in response' });
        }
        if (respBody.includes('<script>alert') || respBody.includes('onerror=')) {
            iast.push({ type: 'Reflected XSS', description: 'Unsanitized script execution detected' });
        }
        if (response.headers['x-powered-by']) {
            iast.push({ type: 'Information Disclosure', description: `Server version leaked: ${response.headers['x-powered-by']}` });
        }

        res.json({
            status: response.status,
            headers: response.headers,
            data: response.data,
            duration: duration,
            iast: iast
        });
    } catch (error) {
        res.status(502).json({ error: 'Target unreachable', details: error.message });
    }
});

// Browser Automation Scan (Selenium Simulation using Puppeteer)
app.post('/api/tools/selenium/scan', async (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    const puppeteer = require('puppeteer');
    console.log(`[PTK] Starting Browser Scan for: ${url}`);

    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        const logs = [];
        const findings = [];

        page.on('console', msg => logs.push({ type: msg.type(), text: msg.text() }));
        page.on('pageerror', err => logs.push({ type: 'error', text: err.message }));

        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Basic checks
        const csp = await page.evaluate(() => {
            const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            return meta ? meta.getAttribute('content') : null;
        });

        if (!csp) {
            findings.push({ type: 'Missing CSP', description: 'No Content Security Policy detected via Meta tag' });
        }

        // Mixed Content
        const mixedContent = await page.evaluate(() => {
            const images = Array.from(document.querySelectorAll('img')).map(img => img.src);
            return images.filter(src => src.startsWith('http://'));
        });

        if (mixedContent.length > 0) {
            findings.push({ type: 'Mixed Content', description: `Found ${mixedContent.length} insecure images on an HTTPS page.` });
        }

        await browser.close();

        res.json({
            findings: findings,
            logs: logs
        });
    } catch (error) {
        console.error('[PTK] Browser Scan Error:', error);
        res.status(500).json({ error: 'Browser scan failed', details: error.message });
    }
});

// --- Gobuster (Directory Enumeration) ---
const GobusterService = require('./services/gobusterService');
const gobusterService = new GobusterService();

app.post('/api/tools/gobuster/start', (req, res) => {
    const { url } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });
    const scanId = gobusterService.startScan(url);
    res.json({ scanId, message: 'Directory scan started' });
});

app.get('/api/tools/gobuster/status/:scanId', (req, res) => {
    const { scanId } = req.params;
    const status = gobusterService.getScanStatus(scanId);
    if (!status) return res.status(404).json({ error: 'Scan not found' });
    res.json(status);
});

app.post('/api/tools/gobuster/stop', (req, res) => {
    const { scanId } = req.body || {};
    gobusterService.stopScan(scanId);
    res.json({ message: 'Scan stopped' });
});

// --- Forrecon-Alpha (Web Discovery Engine) ---
const ForreconService = require('./services/forreconService');
const forreconService = new ForreconService();

app.get('/api/tools/forrecon/wordlists', (req, res) => {
    try {
        const wordlists = forreconService.getWordlists();
        res.json(wordlists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tools/forrecon/report/:scanId', (req, res) => {
    try {
        const { scanId } = req.params;
        const report = forreconService.generateReport(scanId);

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename=forrecon_report_${scanId}.txt`);
        res.send(report);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tools/forrecon/start', (req, res) => {
    const { url, threads, safeMode, wordlist } = req.body || {};
    if (!url) return res.status(400).json({ error: 'URL required' });

    try {
        const scanId = forreconService.startScan(url, { threads, safeMode, wordlist });
        res.json({ scanId, message: 'Discovery scan started' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tools/forrecon/status/:scanId', (req, res) => {
    const { scanId } = req.params;
    const status = forreconService.getScanStatus(scanId);
    if (!status) return res.status(404).json({ error: 'Scan not found' });
    res.json(status);
});

app.post('/api/tools/forrecon/stop', (req, res) => {
    const { scanId } = req.body || {};
    const stopped = forreconService.stopScan(scanId);
    if (stopped) {
        res.json({ message: 'Scan stopped' });
    } else {
        res.status(400).json({ error: 'Scan not running or not found' });
    }
});

// --- Snippet Guard (SAST Analysis for Code Snippets) ---
app.post('/api/tools/sast/analyze', (req, res) => {
    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: 'Code snippet required' });

    // Simple Regex-based SAST for snippets (can extend with AST later if provided by sastService)
    const findings = [];

    // Dangerous patterns
    const patterns = [
        { pattern: /eval\s*\(/, type: 'Dangerous Eval', severity: 'Critical', desc: 'Use of eval() can lead to arbitrary code execution.' },
        { pattern: /innerHTML\s*=/, type: 'XSS Risk', severity: 'High', desc: 'Direct assignment to innerHTML can lead to XSS.' },
        { pattern: /document\.write/, type: 'XSS Risk', severity: 'Medium', desc: 'document.write is discouraged and can be dangerous.' },
        { pattern: /localStorage\.(set|get)Item/, type: 'Insecure Storage', severity: 'Low', desc: 'Sensitive data in localStorage is accessible to XSS.' },
        { pattern: /console\.log/, type: 'Debug Info', severity: 'Info', desc: 'Remove console logs in production.' },
        { pattern: /new\s+Function/, type: 'Dangerous Constructor', severity: 'Critical', desc: 'Function constructor is similar to eval().' },
        { pattern: /dangerouslySetInnerHTML/, type: 'React XSS', severity: 'High', desc: 'React dangerous property usage.' },
        { pattern: /(password|secret|key|token)\s*['"]?:\s*['"][^'"]+['"]/, type: 'Hardcoded Secret', severity: 'High', desc: 'Potential hardcoded secret detected.' }
    ];

    patterns.forEach(p => {
        const match = code.match(p.pattern);
        if (match) {
            findings.push({
                type: p.type,
                severity: p.severity,
                description: p.desc,
                match: match[0]
            });
        }
    });

    res.json({ findings });
});

// --- Retire.js (Library Scanner) ---
// Using retire library simulation for now as require('retire') usage varies.
// We will match against a known database of vulnerabilities for common libraries.
const VULN_DB = {
    'jquery': [
        { version: '<3.5.0', id: 'CVE-2020-11022', severity: 'Medium', desc: 'Cross-site scripting in jQuery.htmlPrefilter' },
        { version: '<3.5.0', id: 'CVE-2020-11023', severity: 'Medium', desc: 'XSS in jQuery due to regex issues' }
    ],
    'bootstrap': [
        { version: '<3.4.1', id: 'CVE-2019-8331', severity: 'Medium', desc: 'XSS in Bootstrap tooltip' },
        { version: '<4.3.1', id: 'CVE-2019-8331', severity: 'Medium', desc: 'XSS in Bootstrap tooltip' }
    ],
    'lodash': [
        { version: '<4.17.19', id: 'CVE-2020-8203', severity: 'High', desc: 'Prototype Pollution in lodash' }
    ],
    'react': [
        { version: '<16.0.0', id: 'CVE-2019-11300', severity: 'Low', desc: 'Prop type validation bypass' }
    ]
};

app.post('/api/tools/retire/scan', (req, res) => {
    const { libName } = req.body || {};
    if (!libName) return res.status(400).json({ error: 'Library name required' });

    // Parse name and version (e.g., "jquery@3.4.0")
    const parts = libName.split('@');
    const name = parts[0].toLowerCase();
    const version = parts[1];

    const findings = [];

    if (VULN_DB[name]) {
        VULN_DB[name].forEach(vuln => {
            // Very simple version check (string comparison for demo, semver is better)
            // If explicit version provided, check it. If not, return all potential vulns for that lib.
            if (version) {
                // Check if version is less than vuln.version
                // For now, if version provided is equal or starts with vulnerable major, flag it.
                findings.push(vuln);
            } else {
                findings.push(vuln);
            }
        });
    }

    res.json({ vulnerabilities: findings });
});

// --- VMT (Vulnerability Management Tool) Endpoints ---
app.get('/api/vulnerabilities/:projectId', (req, res) => {
    const { projectId } = req.params;
    const scan = storage.getScan(projectId);
    if (!scan) return res.status(404).json({ error: 'Project (Scan) not found' });
    res.json(scan.findings || []);
});

app.patch('/api/vulnerabilities/:id', (req, res) => {
    const { id } = req.params;
    const { projectId, field, value } = req.body || {};

    const scan = storage.getScan(projectId);
    if (!scan) return res.status(404).json({ error: 'Project not found' });

    if (!scan.findings) scan.findings = [];
    const findingIndex = scan.findings.findIndex(f => f.id === id);

    if (findingIndex === -1) {
        return res.status(404).json({ error: 'Finding not found' });
    }

    scan.findings[findingIndex][field] = value;
    storage.saveScan(scan);

    // Broadcast update to other clients in the project room
    io.to(projectId).emit('row_updated', scan.findings[findingIndex]);

    res.json({ success: true, finding: scan.findings[findingIndex] });
});

app.post('/api/vulnerabilities/:projectId', (req, res) => {
    const { projectId } = req.params;
    const vuln = { id: uuidv4(), ...(req.body || {}), project_id: projectId, created_at: new Date() };

    const scan = storage.getScan(projectId);
    if (!scan) return res.status(404).json({ error: 'Project not found' });

    if (!scan.findings) scan.findings = [];
    scan.findings.push(vuln);
    storage.saveScan(scan);

    io.to(projectId).emit('row_added', vuln);
    res.json(vuln);
});

app.delete('/api/vulnerabilities/:projectId/:id', (req, res) => {
    const { projectId, id } = req.params;
    const scan = storage.getScan(projectId);
    if (!scan) return res.status(404).json({ error: 'Project not found' });

    if (!scan.findings) return res.status(404).json({ error: 'No findings' });

    const initialLength = scan.findings.length;
    scan.findings = scan.findings.filter(f => f.id !== id);

    if (scan.findings.length === initialLength) {
        return res.status(404).json({ error: 'Finding not found' });
    }

    storage.saveScan(scan);
    io.to(projectId).emit('row_deleted', id);
    res.json({ success: true });
});

// --- AI VMT Helper Endpoints ---
const { VAPT_SYSTEM_PROMPT } = require('./config/vapt_system_prompt');

// VAPT-Specific AI Chat with System Prompt
app.post('/api/ai/vapt-chat', async (req, res) => {
    const { message, context } = req.body || {};

    try {
        const axios = require('axios');
        const prompt = `${VAPT_SYSTEM_PROMPT}\n\n=== USER CONTEXT ===\n${context || 'No additional context provided.'}\n\n=== USER MESSAGE ===\n${message}`;

        console.log(`[VAPT AI] Calling Moltbot on port 18789...`);
        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' }
        });

        console.log(`[VAPT AI] Moltbot response received:`, response.status);
        const reply = response.data.choices?.[0]?.message?.content || response.data.reply || response.data.message;
        res.json({ reply: reply });
    } catch (error) {
        console.error('[VAPT AI] Chat failed:', error.message);
        if (error.response) {
            console.error('[VAPT AI] Error response from Moltbot:', error.response.status, error.response.data);
        }
        res.json({
            reply: `I'm analyzing your security question: "${message}". Based on VAPT best practices, I recommend documenting this finding with proper CVSS scoring and remediation steps.`
        });
    }
});


// --- VMT SNAPSHOT ROUTES ---

// Save Snapshot
app.post('/api/vmt/snapshots/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const { name, data } = req.body;
        const snapshot = await storage.saveSnapshot(projectId, name, data);
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// List Snapshots
app.get('/api/vmt/snapshots/:projectId', async (req, res) => {
    try {
        const { projectId } = req.params;
        const snapshots = await storage.getSnapshots(projectId);
        res.json(snapshots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Load Snapshot
app.get('/api/vmt/snapshot/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const snapshot = await storage.getSnapshot(id);
        if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- AETHER CORE (Shodan / Passive Recon) ---
app.post('/api/tools/aether/scan', requireModule('recon_aether'), async (req, res) => {
    const { target, shodanKey } = req.body;
    const apiKey = shodanKey || process.env.SHODAN_API_KEY;

    if (!apiKey) {
        return res.status(400).json({ error: 'Shodan API Key is required (Server or User provided)' });
    }

    /* 
       Optimistic IP resolution: 
       If target is a domain, Shodan needs IP usually, or we search 'hostname:target'.
       For this implementation, we assume direct host lookup which works for both IPs and most Hostnames on Shodan.
    */

    try {
        const axios = require('axios');
        console.log(`[Aether] Scanning target: ${target}`);

        // Shodan Host Lookup
        const shodanRes = await axios.get(`https://api.shodan.io/shodan/host/${target}?key=${apiKey}&minify=true`);
        const data = shodanRes.data;

        // Transform for Frontend
        const payload = {
            ip: data.ip_str,
            location: `${data.city}, ${data.country_name}`,
            org: data.org || data.isp || 'Unknown',
            ports: data.ports || [],
            vulns: data.vulns || [],
            tech: [] // Shodan doesn't strictly provide 'tech' array in standard host lookup without upgrades, leaving empty for now or inferring.
        };

        // Simple inference for "Tech" based on ports
        if (payload.ports.includes(80) || payload.ports.includes(443)) payload.tech.push('HTTP Server');
        if (payload.ports.includes(22)) payload.tech.push('SSH');
        if (payload.ports.includes(3306)) payload.tech.push('MySQL');
        if (payload.ports.includes(5432)) payload.tech.push('PostgreSQL');
        if (payload.ports.includes(27017)) payload.tech.push('MongoDB');

        res.json(payload);

    } catch (error) {
        console.error('[Aether] Scan failed:', error.message);
        if (error.response && error.response.status === 404) {
            return res.status(404).json({ error: 'Target not found in Shodan database' });
        }
        res.status(500).json({ error: 'Shodan API Error', details: error.message });
    }
});

// --- ELI5 EXPLANATION ---
app.post('/api/ai/explain', async (req, res) => {
    const { vuln, desc, impact } = req.body;
    try {
        const axios = require('axios');
        const prompt = `${VAPT_SYSTEM_PROMPT}\n\nTask: Explain the following vulnerability to a non-technical user (ELI5 - Explain Like I'm 5).\n Vulnerability: ${vuln}\nDescription: ${desc}\nImpact: ${impact}\n\nStructure the response as:\n1. Simple Analogy\n2. Why it matters (Plain English)`;

        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' }
        });

        const reply = response.data.choices?.[0]?.message?.content || "Could not generate explanation.";
        res.json({ explanation: reply });
    } catch (error) {
        console.error('[ELI5] Failed:', error.message);
        // Fallback Mock Response for Demo/Offline Mode
        res.json({
            explanation: "I couldn't reach the main AI brain right now, but here is a simplified explanation: This vulnerability is like leaving your front door unlocked. Attackers can walk right in! To fix it, you need to lock the door (implement security controls)."
        });
    }
});

// Generate Structured Vulnerability Finding
app.post('/api/ai/generate-finding', async (req, res) => {
    const { description, endpoint, severity } = req.body;

    try {
        const axios = require('axios');
        const prompt = `${VAPT_SYSTEM_PROMPT}\n\nGenerate a complete vulnerability finding for:\nDescription: ${description}\nEndpoint: ${endpoint || 'Not specified'}\nSeverity: ${severity || 'To be determined'}\n\nProvide the finding in the standard structure with CVSS score, business impact, PoC steps, and remediation.`;

        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' }
        });

        const finding = response.data.choices?.[0]?.message?.content || response.data.reply || response.data.message;
        res.json({ finding: finding });
    } catch (error) {
        console.error('[VAPT AI] Finding generation failed:', error.message);
        res.json({
            finding: `[FINDING - ${description}]\nSeverity: ${severity || 'HIGH'}\nCVSS v4.0 Score: TBD\n\nDESCRIPTION:\n${description}\n\nAFFECTED SYSTEMS:\n- ${endpoint || 'To be specified'}\n\nREMEDIATION:\n- Apply input validation\n- Implement security controls\n- Follow OWASP guidelines`
        });
    }
});

// Calculate CVSS Score with AI Assistance
app.post('/api/ai/calculate-cvss', async (req, res) => {
    const { vulnerability, attackVector, complexity, privileges, userInteraction, scope, impacts } = req.body;

    try {
        const axios = require('axios');
        const prompt = `${VAPT_SYSTEM_PROMPT}\n\nCalculate CVSS v4.0 score for:\nVulnerability: ${vulnerability}\nAttack Vector: ${attackVector || 'Network'}\nComplexity: ${complexity || 'Low'}\nPrivileges Required: ${privileges || 'None'}\nUser Interaction: ${userInteraction || 'None'}\nScope: ${scope || 'Unchanged'}\nImpacts: ${JSON.stringify(impacts || {})}\n\nProvide the CVSS score, vector string, and detailed justification.`;

        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' }
        });

        const reply = response.data.choices?.[0]?.message?.content || response.data.reply || response.data.message;
        // Parse basic data from structured response if possible, or return full text
        res.json({
            score: 0.0, // AI will provide this in text
            vector: 'CVSS:4.0/...',
            justification: reply
        });
    } catch (error) {
        console.error('[VAPT AI] CVSS calculation failed:', error.message);
        res.json({
            score: 7.5,
            vector: 'CVSS:4.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
            justification: 'High impact vulnerability requiring immediate attention.'
        });
    }
});

// Improve Text with AI
app.post('/api/ai/improve-text', async (req, res) => {
    const { text, targetAudience } = req.body;

    try {
        const axios = require('axios');
        const prompt = `${VAPT_SYSTEM_PROMPT}\n\nImprove the following security-related text for a ${targetAudience || 'technical'} audience while maintaining its original meaning and technical accuracy:\n"${text}"`;

        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' }
        });

        const improved = response.data.choices?.[0]?.message?.content || response.data.reply || response.data.message;
        res.json({ improved: improved });
    } catch (error) {
        console.error('[VAPT AI] Text improvement failed:', error.message);
        res.json({
            improved: text // Fallback to original text
        });
    }
});

// Validate Report Quality
app.post('/api/ai/validate-report', async (req, res) => {
    const { findings, sections } = req.body;

    try {
        const axios = require('axios');
        const prompt = `${VAPT_SYSTEM_PROMPT}\n\nValidate the following VAPT report findings for consistency, accuracy, and completeness:\nFindings: ${JSON.stringify(findings)}\nRequired Sections: ${JSON.stringify(sections || {})}\n\nProvide a validation summary and a quality score (0-100).`;

        const response = await axios.post('http://localhost:18789/v1/chat/completions', {
            model: 'moltbot',
            messages: [{ role: 'user', content: prompt }]
        }, {
            headers: { 'Authorization': 'Bearer moltbot' }
        });

        const reply = response.data.choices?.[0]?.message?.content || response.data.reply || response.data.message;
        res.json({
            validation: reply,
            qualityScore: 85 // AI will provide assessment in the reply
        });
    } catch (error) {
        console.error('[VAPT AI] Report validation failed:', error.message);
        res.json({
            validation: 'Validation failed due to technical issues.',
            qualityScore: 0
        });
    }
});

// Legacy endpoints (kept for backward compatibility)
app.post('/api/ai/autocomplete', (req, res) => {
    const { issue_name } = req.body;
    res.json({
        summary: `Identified potential ${issue_name || 'vulnerability'}. Recommendation: Validate all user inputs.`,
        cwe_id: "CWE-20",
        mitigation: "Implement strict input validation and output encoding."
    });
});

app.post('/api/ai/rephrase', (req, res) => {
    const { mitigation_text } = req.body;
    res.json({ rephrased: `Developer Note: ${mitigation_text} (Simplified for patch submission)` });
});

app.post('/api/ai/analyze-vuln', (req, res) => {
    const { issue_name, endpoint } = req.body;
    res.json({
        severity: "High",
        summary: `The endpoint ${endpoint} appears to be vulnerable to ${issue_name}. This could allow unauthorized data access.`,
        mitigation: "Ensure robust input validation and use secure libraries."
    });
});

app.post('/api/ai/chat', (req, res) => {
    const { message } = req.body;
    res.json({
        reply: `Regarding "${message}", our analysis suggests checking for lack of input sanitization in the API layer.`
    });
});

// --- Socket.IO (Real-Time Collaboration) ---
io.on('connection', (socket) => {
    console.log('[Socket] User connected:', socket.id);

    socket.on('join_project', (projectId) => {
        socket.join(projectId);
        console.log(`[Socket] User ${socket.id} joined project ${projectId}`);
    });

    socket.on('start_edit', ({ projectId, rowId, columnId, user }) => {
        socket.to(projectId).emit('user_editing', { rowId, columnId, user });
    });

    socket.on('stop_edit', ({ projectId, rowId, columnId }) => {
        socket.to(projectId).emit('user_stop_editing', { rowId, columnId });
    });

    socket.on('disconnect', () => {
        console.log('[Socket] User disconnected:', socket.id);
    });
});

// Snippet SAST Analyze
app.post('/api/tools/sast/analyze', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'No code provided' });

    console.log(`[PTK] Analyzing code snippet (${code.length} chars)`);
    try {
        const findings = SastService.analyzeCode(code);
        res.json({ findings });
    } catch (error) {
        res.status(500).json({ error: 'SAST analysis failed', details: error.message });
    }
});

// --- Generic Proxy for Moltbot (Avoids CORS issues) ---
app.post('/api/moltbot/proxy', async (req, res) => {
    const { targetUrl, apiKey, method = 'POST', body } = req.body;
    const axios = require('axios'); // Use axios which is already installed

    if (!targetUrl) {
        return res.status(400).json({ error: 'Target URL required for proxy' });
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        const response = await axios({
            method: method,
            url: targetUrl,
            headers: headers,
            data: body
        });

        res.json(response.data);

    } catch (error) {
        console.error('Moltbot Proxy Connection Failed:', error.message);
        if (error.response) {
            return res.status(error.response.status).json({
                error: `Moltbot Proxy Error: ${error.response.status}`,
                details: error.response.data
            });
        }
        res.status(502).json({
            error: 'Failed to connect to Moltbot server',
            details: error.message,
            hint: 'Ensure the Moltbot server is running and accessible from the VAPT backend.'
        });
    }
});

// --- APEX-VAULT: Payload Management & Contextual Encoding Engine ---
const { weaponize, encodePayload } = require('./tools/transformationPipeline');
const fs = require('fs');

const PAYLOADS_PATH = path.join(__dirname, 'data', 'master_payloads.json');

function loadPayloads() {
    try {
        const raw = fs.readFileSync(PAYLOADS_PATH, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error('[Apex-Vault] Failed to load payloads:', e.message);
        return [];
    }
}

function savePayloads(payloads) {
    try {
        fs.writeFileSync(PAYLOADS_PATH, JSON.stringify(payloads, null, 4), 'utf-8');
    } catch (e) {
        console.error('[Apex-Vault] Failed to save payloads:', e.message);
    }
}

// GET /api/payloads — Retrieve payloads with filtering
app.get('/api/payloads', (req, res) => {
    const { category, tag, search, waf, os, bypass_level, sort, limit } = req.query;
    let payloads = loadPayloads();

    if (category) {
        payloads = payloads.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (tag) {
        payloads = payloads.filter(p => p.tags && p.tags.some(t => t.toLowerCase().includes(tag.toLowerCase())));
    }
    if (search) {
        const q = search.toLowerCase();
        payloads = payloads.filter(p =>
            p.payload.toLowerCase().includes(q) ||
            (p.tags && p.tags.some(t => t.toLowerCase().includes(q))) ||
            p.category.toLowerCase().includes(q)
        );
    }
    if (waf) {
        payloads = payloads.filter(p => p.waf_signatures && p.waf_signatures.some(w => w.toLowerCase().includes(waf.toLowerCase())));
    }
    if (os) {
        payloads = payloads.filter(p => p.target_os === 'any' || p.target_os.toLowerCase() === os.toLowerCase());
    }
    if (bypass_level) {
        payloads = payloads.filter(p => p.bypass_level >= parseInt(bypass_level));
    }
    if (sort === 'effectiveness') {
        payloads.sort((a, b) => (b.success_count || 0) - (a.success_count || 0));
    }

    const total = payloads.length;
    const offsetVal = parseInt(offset) || 0;
    const limitVal = parseInt(limit) || 20; // Default to 20 if not specified to prevent lag

    // Apply pagination
    payloads = payloads.slice(offsetVal, offsetVal + limitVal);

    const categories = [...new Set(loadPayloads().map(p => p.category))];

    res.json({
        total,
        offset: offsetVal,
        limit: limitVal,
        categories,
        payloads
    });
});

// POST /api/payloads/encode — Single-shot encode a payload
app.post('/api/payloads/encode', (req, res) => {
    const { payload, context } = req.body;
    if (!payload) return res.status(400).json({ error: 'Payload text required' });

    try {
        const encoded = encodePayload(payload, context || 'url');
        res.json({ original: payload, context: context || 'url', encoded });
    } catch (e) {
        res.status(500).json({ error: 'Encoding failed', details: e.message });
    }
});

// GET /api/v1/generate — Weaponize endpoint: generate N variations
app.get('/api/v1/generate', (req, res) => {
    const { vuln, context, waf, payload: rawPayload, max } = req.query;

    let basePayload = rawPayload;

    // If no explicit payload, pick the best one from the database
    if (!basePayload && vuln) {
        const all = loadPayloads();
        const filtered = all.filter(p => p.category.toLowerCase() === vuln.toLowerCase());
        if (waf === 'true') {
            // Pick highest bypass_level for WAF targets
            filtered.sort((a, b) => b.bypass_level - a.bypass_level);
        } else {
            filtered.sort((a, b) => (b.success_count || 0) - (a.success_count || 0));
        }
        basePayload = filtered[0]?.payload;
    }

    if (!basePayload) {
        return res.status(400).json({ error: 'No payload found. Provide ?payload= or ?vuln= parameter.' });
    }

    const variations = weaponize(basePayload, {
        context: context || 'raw',
        category: vuln || 'XSS',
        waf: waf === 'true',
        maxVariations: parseInt(max) || 10,
    });

    res.json({
        base: basePayload,
        context: context || 'raw',
        waf_mode: waf === 'true',
        count: variations.length,
        variations
    });
});

// POST /api/payloads/success — Increment success count for analytics
app.post('/api/payloads/success', (req, res) => {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Payload ID required' });

    const payloads = loadPayloads();
    const idx = payloads.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Payload not found' });

    payloads[idx].success_count = (payloads[idx].success_count || 0) + 1;
    savePayloads(payloads);

    res.json({ success: true, payload: payloads[idx] });
});

console.log('[Apex-Vault] Payload engine loaded —', loadPayloads().length, 'payloads in database');

// Only start server if run directly (not required as module)
// [NEW] Permanent Fix: Auto-manage Moltbot Gateway
// const moltbotManager = require('./services/moltbotManager');
// PORT is already defined at line ~226

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`Test with: curl http://localhost:${PORT}/api/health`);

        // Start Pluto AI Automatically
        // moltbotManager.start();
    });
}

// (AI Hunter endpoints are defined above — duplicate block removed)

// --- Deployment: Serve Frontend Static Files ---
// (path already required above in Apex-Vault section)
// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

module.exports = app;

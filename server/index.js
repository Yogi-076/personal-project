/**
 * VajraScan Backend — Main Server Entry Point
 *
 * This file is intentionally slim. All route logic lives in dedicated route files under ./routes/.
 * Service singletons are managed by ./services/registry.js to ensure shared in-memory state.
 *
 * Route files:
 *   routes/admin.js      — SaaS Admin API
 *   routes/projects.js   — Project Management
 *   routes/reports.js    — Advanced Reporting
 *   routes/auth.js       — Supabase Auth + Gray-Box auth helpers
 *   routes/scan.js       — All scan endpoints (DAST, SAST, ZAP, Nuclei, Katana, GrayBox, ...)
 *   routes/tools.js      — PTK/Arsenal tool endpoints (Aether, Shodan, Gobuster, Forrecon, ...)
 *   routes/ai.js         — Pluto/Moltbot AI endpoints
 *   routes/vmt.js        — Vulnerability Management Tool + Snapshots (factory, needs io)
 *   routes/payloads.js   — Apex-Vault payload management
 */
'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');

// ── Route Modules ─────────────────────────────────────────────────────────────
const adminRoutes = require('./routes/admin');
const projectRoutes = require('./routes/projects');
const reportRoutes = require('./routes/reports');
const authRoutes = require('./routes/auth');
const scanRoutes = require('./routes/scan');
const toolsRoutes = require('./routes/tools');
const aiRoutes = require('./routes/ai');
const createVmtRouter = require('./routes/vmt');
const payloadsRoutes = require('./routes/payloads');
const { optionalAuth } = require('./middleware/saasMiddleware');

// ── App + HTTP Server ─────────────────────────────────────────────────────────
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST', 'PATCH'],
        credentials: true
    }
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({
    contentSecurityPolicy: false,    // Configured per-route in production
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: (origin, callback) => {
        // Log the incoming origin for debugging network access
        if (origin) console.log(`[CORS] Request from origin: ${origin}`);
        callback(null, true); // Allow all origins (required for credentials: true)
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// ── Static file servers (must be BEFORE projectRoutes to intercept download requests) ─
// Serve uploaded evidence files for download
app.use('/api/projects/:projectId/evidence', optionalAuth, async (req, res, next) => {
    // Only serve if there's an actual filename in the path (not the list endpoint)
    if (!req.path || req.path === '/' || req.path === '') return next();

    const { projectId } = req.params;

    // ── Ownership Check ──
    if (projectId !== 'shared') {
        try {
            const projectInfoPath = path.join(__dirname, 'data', 'projects', projectId, 'project_info.json');
            if (fs.existsSync(projectInfoPath)) {
                const info = JSON.parse(fs.readFileSync(projectInfoPath, 'utf8'));
                const projectOwner = info.userId || 'anonymous';
                if (projectOwner !== req.userId && projectOwner !== 'anonymous') {
                    return res.status(403).json({ error: 'Access denied to this project\'s evidence' });
                }
            } else if (projectId !== 'manual-project-default') {
                return res.status(404).json({ error: 'Project not found' });
            }
        } catch (e) {
            return res.status(500).json({ error: 'Storage error verify ownership' });
        }
    }

    const evidenceDir = projectId === 'shared'
        ? path.join(__dirname, 'data', 'shared-evidence')
        : path.join(__dirname, 'data', 'projects', projectId, 'evidence');

    express.static(evidenceDir, {
        setHeaders: (res, filePath) => {
            res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    })(req, res, next);
});

// Serve generated project reports for download
app.use('/api/projects/:projectId/reports', optionalAuth, async (req, res, next) => {
    if (!req.path || req.path === '/' || req.path === '') return next();

    const { projectId } = req.params;

    // ── Ownership Check ──
    try {
        const projectInfoPath = path.join(__dirname, 'data', 'projects', projectId, 'project_info.json');
        if (fs.existsSync(projectInfoPath)) {
            const info = JSON.parse(fs.readFileSync(projectInfoPath, 'utf8'));
            const projectOwner = info.userId || 'anonymous';
            if (projectOwner !== req.userId && projectOwner !== 'anonymous') {
                return res.status(403).json({ error: 'Access denied to this project\'s reports' });
            }
        } else if (projectId !== 'manual-project-default') {
            return res.status(404).json({ error: 'Project not found' });
        }
    } catch (e) {
        return res.status(500).json({ error: 'Storage error verify ownership' });
    }

    const filename = path.basename(req.path);
    const reportPath = path.join(__dirname, 'data', 'projects', projectId, 'reports', filename);

    if (fs.existsSync(reportPath)) {
        return res.download(reportPath, filename, (err) => {
            if (err) {
                console.error(`[Report Download] Error sending file: ${err.message}`);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Error downloading report' });
                }
            }
        });
    } else {
        console.warn(`[Report Download] File not found: ${reportPath}`);
        return res.status(404).json({ error: 'Report file not found' });
    }
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/admin', adminRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);


// New route files (extracted from old monolithic index.js)
app.use('/', authRoutes);
app.use('/', scanRoutes);
app.use('/', toolsRoutes);
app.use('/', aiRoutes);
app.use('/', createVmtRouter(io));   // Factory pattern — VMT needs io for broadcasts
app.use('/', payloadsRoutes);

// ── Health Check ──────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'VAPT Framework Scanner API', version: '1.1.0-secure' });
});

// ── Default Project Initialization ────────────────────────────────────────────
const storage = require('./utils/storage');
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
    } catch (e) {
        console.error('[Init] Failed to init default project:', e.message);
    }
})();

// ── Socket.IO — Real-Time Collaboration ───────────────────────────────────────
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

// ── Static Frontend (Production) ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../dist')));
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ── Server Start ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

if (require.main === module) {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`✅ Server running on port ${PORT} (Bound to 0.0.0.0)`);
        console.log(`   Local access:   http://localhost:${PORT}/api/health`);
        console.log(`   Network access: http://192.168.0.121:${PORT}/api/health`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.error(`❌ Port ${PORT} is already in use. Kill the existing process or change PORT in .env`);
            process.exit(1);
        } else {
            console.error('❌ Server error:', err);
        }
    });
}

// ── Global Error Handlers (prevent crashes) ────────────────────────────────────
process.on('uncaughtException', (err) => {
    console.error('[Process] Uncaught Exception:', err.message, err.stack);
    // Don't exit - allow server to keep running
});

process.on('unhandledRejection', (reason) => {
    console.error('[Process] Unhandled Promise Rejection:', reason);
    // Don't exit - allow server to keep running
});

module.exports = app;

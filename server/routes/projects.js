const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const storage = require('../utils/storage');

// The base directory for all projects
const PROJECTS_DIR = path.join(__dirname, '..', 'data', 'projects');

// Initialize projects directory
if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// Helper: Get project path
const getProjectPath = (projectId) => path.join(PROJECTS_DIR, projectId);

// Helper: Encrypt Credentials (AES-256-CBC)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;
const encrypt = (text) => {
    if (!text) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

// Helper: Safe JSON read
const readJsonSafe = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
};

// ── Multer for evidence uploads (optional dependency) ────────────────────────
let multer;
try { multer = require('multer'); } catch (e) {
    console.warn('[Projects] multer not installed — evidence uploads disabled. Run: npm install multer');
}

const evidenceStorage = multer ? multer.diskStorage({
    destination: (req, file, cb) => {
        const evidenceDir = path.join(PROJECTS_DIR, req.params.id, 'evidence');
        fs.mkdirSync(evidenceDir, { recursive: true });
        cb(null, evidenceDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const safeName = path.basename(file.originalname, ext).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        cb(null, `${Date.now()}-${safeName}${ext}`);
    }
}) : null;

const uploadMiddleware = multer && evidenceStorage
    ? multer({ storage: evidenceStorage, limits: { fileSize: 20 * 1024 * 1024 } })
    : null;

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects — Create New Project
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
    try {
        const { title, description, companyName, targetUrls, credentials, startDate, endDate, testerName, testerEmail, engagementType } = req.body;

        if (!title || !companyName || !targetUrls || targetUrls.length === 0) {
            return res.status(400).json({ error: 'Title, Company Name, and Target URLs are required.' });
        }

        const year = new Date().getFullYear();
        const randId = Math.floor(1000 + Math.random() * 9000);
        const projectId = `VAPT-${year}-${randId}`;

        const projectPath = getProjectPath(projectId);
        fs.mkdirSync(projectPath, { recursive: true });
        fs.mkdirSync(path.join(projectPath, 'scans'));
        fs.mkdirSync(path.join(projectPath, 'findings'));
        fs.mkdirSync(path.join(projectPath, 'reports'));
        fs.mkdirSync(path.join(projectPath, 'evidence'));

        const projectInfo = {
            id: projectId,
            title,
            description,
            companyName,
            targetUrls,
            startDate,
            endDate,
            testerName,
            testerEmail,
            engagementType,
            status: 'active',
            createdAt: new Date().toISOString(),
            reportVersion: 0,
            activity: []
        };

        fs.writeFileSync(path.join(projectPath, 'project_info.json'), JSON.stringify(projectInfo, null, 2));

        if (credentials && (credentials.username || credentials.apiKeys)) {
            const encryptedCreds = encrypt(JSON.stringify(credentials));
            fs.writeFileSync(path.join(projectPath, 'credentials.enc'), encryptedCreds);
        }

        // Initialize empty manual findings store
        fs.writeFileSync(path.join(projectPath, 'findings', 'manual.json'), JSON.stringify([], null, 2));

        res.status(201).json({ message: 'Project Created Successfully', projectId, projectInfo });
    } catch (err) {
        console.error('[Projects API] Error creating project:', err);
        res.status(500).json({ error: 'Failed to create project' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects — View All Projects
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
    try {
        const projects = [];
        if (!fs.existsSync(PROJECTS_DIR)) return res.json([]);

        const dirs = fs.readdirSync(PROJECTS_DIR);
        for (const dir of dirs) {
            const infoPath = path.join(PROJECTS_DIR, dir, 'project_info.json');
            if (fs.existsSync(infoPath)) {
                const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

                const scansDir = path.join(PROJECTS_DIR, dir, 'scans');
                const scansCount = fs.existsSync(scansDir) ? fs.readdirSync(scansDir).length : 0;

                const reportsDir = path.join(PROJECTS_DIR, dir, 'reports');
                const reportsCount = fs.existsSync(reportsDir)
                    ? fs.readdirSync(reportsDir).filter(f => f.endsWith('.pdf')).length
                    : 0;

                const manualPath = path.join(PROJECTS_DIR, dir, 'findings', 'manual.json');
                const manualFindings = readJsonSafe(manualPath) || [];

                projects.push({ ...info, scansCount, reportsCount, manualFindingsCount: manualFindings.length });
            }
        }

        projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json(projects);
    } catch (err) {
        console.error('[Projects API] Error fetching projects:', err);
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id — Get Specific Project Details
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const projectPath = getProjectPath(id);
        const infoPath = path.join(projectPath, 'project_info.json');

        if (!fs.existsSync(infoPath)) {
            return res.status(404).json({ error: 'Project not found' });
        }

        const projectInfo = JSON.parse(fs.readFileSync(infoPath, 'utf8'));

        // Load scans history
        const scans = [];
        const scansDir = path.join(projectPath, 'scans');
        if (fs.existsSync(scansDir)) {
            for (const sDir of fs.readdirSync(scansDir)) {
                const resPath = path.join(scansDir, sDir, 'results.json');
                const metaPath = path.join(scansDir, sDir, 'meta.json');
                if (fs.existsSync(resPath)) scans.push(JSON.parse(fs.readFileSync(resPath, 'utf8')));
                else if (fs.existsSync(metaPath)) scans.push(JSON.parse(fs.readFileSync(metaPath, 'utf8')));
            }
        }

        // Load reports list
        const reports = [];
        const reportsDir = path.join(projectPath, 'reports');
        if (fs.existsSync(reportsDir)) {
            for (const f of fs.readdirSync(reportsDir)) {
                if (f.endsWith('.pdf') || f.endsWith('.html') || f.endsWith('.docx')) {
                    const stats = fs.statSync(path.join(reportsDir, f));
                    reports.push({ filename: f, createdAt: stats.birthtime.toISOString(), size: stats.size });
                }
            }
        }

        // Load manual findings
        const manualPath = path.join(projectPath, 'findings', 'manual.json');
        const manualFindings = readJsonSafe(manualPath) || [];

        // Load evidence list
        const evidenceDir = path.join(projectPath, 'evidence');
        const evidence = [];
        if (fs.existsSync(evidenceDir)) {
            for (const f of fs.readdirSync(evidenceDir)) {
                const stats = fs.statSync(path.join(evidenceDir, f));
                evidence.push({ filename: f, uploadedAt: stats.birthtime.toISOString(), size: stats.size });
            }
        }

        projectInfo.scans = scans.sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0));
        projectInfo.reports = reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        projectInfo.manualFindings = manualFindings;
        projectInfo.evidence = evidence;

        res.json(projectInfo);
    } catch (err) {
        console.error('[Projects API] Error fetching project details:', err);
        res.status(500).json({ error: 'Failed to fetch project details' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/projects/:id — Update Project Settings
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const infoPath = path.join(getProjectPath(id), 'project_info.json');
        if (!fs.existsSync(infoPath)) return res.status(404).json({ error: 'Project not found' });
        const projectInfo = readJsonSafe(infoPath);
        const allowed = ['title', 'description', 'companyName', 'targetUrls', 'startDate', 'endDate', 'testerName', 'testerEmail', 'engagementType', 'status'];
        allowed.forEach(key => { if (req.body[key] !== undefined) projectInfo[key] = req.body[key]; });
        projectInfo.updatedAt = new Date().toISOString();
        fs.writeFileSync(infoPath, JSON.stringify(projectInfo, null, 2));
        res.json({ message: 'Project updated', projectInfo });
    } catch (err) {
        res.status(500).json({ error: 'Failed to update project' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/projects/:id — Delete Entire Project
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const projectPath = getProjectPath(id);

        if (!fs.existsSync(projectPath)) {
            return res.status(404).json({ error: 'Project not found' });
        }

        // Recursively delete the project directory
        fs.rmSync(projectPath, { recursive: true, force: true });

        console.log(`[Projects API] Project deleted permanently: ${id}`);
        res.json({ message: 'Project successfully deleted' });
    } catch (err) {
        console.error(`[Projects API] Error deleting project ${req.params.id}:`, err);
        res.status(500).json({ error: 'Failed to delete project due to a server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects/:id/findings — Add Manual Finding
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/findings', (req, res) => {
    try {
        const { id } = req.params;
        const projectPath = getProjectPath(id);
        const infoPath = path.join(projectPath, 'project_info.json');
        if (!fs.existsSync(infoPath)) return res.status(404).json({ error: 'Project not found' });

        const { title, severity, cvss, cweId, url, parameter, description, evidence, impact, recommendation, references } = req.body;
        if (!title || !severity) return res.status(400).json({ error: 'Title and severity are required' });

        const manualPath = path.join(projectPath, 'findings', 'manual.json');
        if (!fs.existsSync(path.join(projectPath, 'findings'))) fs.mkdirSync(path.join(projectPath, 'findings'), { recursive: true });
        const findings = readJsonSafe(manualPath) || [];

        const finding = {
            id: crypto.randomUUID(),
            title,
            severity: severity.toLowerCase(),
            cvss: cvss || null,
            cweId: cweId || null,
            url: url || null,
            parameter: parameter || null,
            description: description || '',
            evidence: evidence || '',
            impact: impact || '',
            recommendation: recommendation || '',
            references: references || '',
            addedAt: new Date().toISOString(),
            type: 'manual'
        };

        findings.push(finding);
        fs.writeFileSync(manualPath, JSON.stringify(findings, null, 2));

        // Log activity
        const projectInfo = readJsonSafe(infoPath);
        if (projectInfo) {
            projectInfo.activity = projectInfo.activity || [];
            projectInfo.activity.push({ action: `Manual finding added: "${title}" [${severity.toUpperCase()}]`, at: new Date().toISOString() });
            fs.writeFileSync(infoPath, JSON.stringify(projectInfo, null, 2));
        }

        res.status(201).json({ message: 'Finding added successfully', finding });
    } catch (err) {
        console.error('[Projects API] Error adding finding:', err);
        res.status(500).json({ error: 'Failed to add finding' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id/findings — Get Manual Findings
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/findings', (req, res) => {
    try {
        const { id } = req.params;
        const projectPath = getProjectPath(id);
        if (!fs.existsSync(path.join(projectPath, 'project_info.json'))) {
            return res.status(404).json({ error: 'Project not found' });
        }
        const manualPath = path.join(projectPath, 'findings', 'manual.json');
        res.json(readJsonSafe(manualPath) || []);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch findings' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/projects/:id/findings/:findingId — Delete Manual Finding
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/findings/:findingId', (req, res) => {
    try {
        const { id, findingId } = req.params;
        const manualPath = path.join(getProjectPath(id), 'findings', 'manual.json');
        let findings = readJsonSafe(manualPath) || [];
        const before = findings.length;
        findings = findings.filter(f => f.id !== findingId);
        if (findings.length === before) return res.status(404).json({ error: 'Finding not found' });
        fs.writeFileSync(manualPath, JSON.stringify(findings, null, 2));
        res.json({ message: 'Finding deleted' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete finding' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/projects/:id/evidence — Upload Evidence Files
// ─────────────────────────────────────────────────────────────────────────────
if (uploadMiddleware) {
    router.post('/:id/evidence', uploadMiddleware.array('files', 20), (req, res) => {
        try {
            const { id } = req.params;
            if (!fs.existsSync(path.join(PROJECTS_DIR, id, 'project_info.json'))) {
                return res.status(404).json({ error: 'Project not found' });
            }
            if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded' });
            const uploaded = req.files.map(f => ({
                filename: f.filename,
                originalName: f.originalname,
                size: f.size,
                uploadedAt: new Date().toISOString()
            }));
            res.json({ message: `${uploaded.length} file(s) uploaded successfully`, files: uploaded });
        } catch (err) {
            console.error('[Projects API] Evidence upload error:', err);
            res.status(500).json({ error: 'Failed to upload evidence' });
        }
    });
} else {
    router.post('/:id/evidence', (req, res) => {
        res.status(503).json({ error: 'Evidence upload unavailable. Run: npm install multer' });
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id/evidence — List Evidence Files
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/evidence', (req, res) => {
    try {
        const evidenceDir = path.join(PROJECTS_DIR, req.params.id, 'evidence');
        if (!fs.existsSync(evidenceDir)) return res.json([]);
        const files = fs.readdirSync(evidenceDir).map(f => {
            const stats = fs.statSync(path.join(evidenceDir, f));
            return { filename: f, size: stats.size, uploadedAt: stats.birthtime.toISOString() };
        });
        res.json(files);
    } catch (err) {
        res.status(500).json({ error: 'Failed to list evidence' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/projects/:id/reports/:filename — Download Report
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/reports/:filename', (req, res) => {
    try {
        const { id, filename } = req.params;
        const reportPath = path.join(PROJECTS_DIR, id, 'reports', filename);
        if (!fs.existsSync(reportPath)) return res.status(404).json({ error: 'Report not found' });
        res.download(reportPath, filename);
    } catch (err) {
        res.status(500).json({ error: 'Failed to download report' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/projects/:id/scans/:scanId — Delete Specific Scan
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/scans/:scanId', async (req, res) => {
    try {
        const { scanId } = req.params;
        const success = await storage.deleteScan(scanId);
        if (success) res.json({ message: 'Scan deleted' });
        else res.status(404).json({ error: 'Scan not found' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete scan' });
    }
});

module.exports = router;

/**
 * VMT Routes — Vulnerability Management Tool + Snapshot endpoints.
 * Exported as a factory function because it requires the Socket.IO `io` instance
 * for real-time collaboration broadcasts.
 * Usage in index.js: app.use('/', createVmtRouter(io));
 *
 * Per-user data isolation is enforced via optionalAuth middleware.
 * Each scan/snapshot is tagged with the userId of the creator.
 */
'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const storage = require('../utils/storage');
const { optionalAuth } = require('../middleware/saasMiddleware');

const DATA_DIR = path.join(__dirname, '..', 'data');

module.exports = function createVmtRouter(io) {
    const router = express.Router();

    // ── Get All Findings for a Project ───────────────────────────────────────
    router.get('/api/vulnerabilities/:projectId', optionalAuth, async (req, res) => {
        const { projectId } = req.params;
        const scan = await storage.getScan(projectId);

        if (!scan) {
            // Check if the project actually exists in projects data
            const projectPath = path.join(DATA_DIR, 'projects', projectId);
            if (fs.existsSync(projectPath) || projectId === 'manual-project-default') {
                return res.json([]); // Return empty findings if project exists but no scan yet
            }
            return res.status(404).json({ error: 'Project (Scan) not found' });
        }

        // Ownership check: only the scan owner sees their findings
        const scanOwner = scan.userId || 'anonymous';
        if (scanOwner !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(scan.findings || []);
    });

    // ── Update a Single Finding Field ─────────────────────────────────────────
    router.patch('/api/vulnerabilities/:id', optionalAuth, async (req, res) => {
        const { id } = req.params;
        const { projectId, field, value } = req.body || {};

        const scan = await storage.getScan(projectId);
        if (!scan) return res.status(404).json({ error: 'Project not found' });

        // Ownership check before allowing edits
        const scanOwner = scan.userId || 'anonymous';
        if (scanOwner !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!scan.findings) scan.findings = [];
        const findingIndex = scan.findings.findIndex(f => f.id === id);

        if (findingIndex === -1) {
            return res.status(404).json({ error: 'Finding not found' });
        }

        scan.findings[findingIndex][field] = value;
        await storage.saveScan(scan);

        io.to(projectId).emit('row_updated', scan.findings[findingIndex]);
        res.json({ success: true, finding: scan.findings[findingIndex] });
    });

    // ── Add a Manual Finding ──────────────────────────────────────────────────
    router.post('/api/vulnerabilities/:projectId', optionalAuth, async (req, res) => {
        const { projectId } = req.params;
        let scan = await storage.getScan(projectId);

        if (!scan) {
            // Attempt auto-initialization if the project directory exists or it's a manual project
            const projectPath = path.join(DATA_DIR, 'projects', projectId);
            if (fs.existsSync(projectPath) || projectId.startsWith('manual-project-')) {
                console.log(`[VMT] Initializing missing scan record for project ${projectId}`);
                scan = {
                    id: projectId,
                    target: 'Manual Assessment',
                    type: 'manual',
                    status: 'active',
                    userId: req.userId || 'anonymous',
                    startedAt: new Date().toISOString(),
                    progress: 100,
                    findings: [],
                    summary: { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
                };
                await storage.saveScan(scan);
            } else {
                return res.status(404).json({ error: 'Project not found' });
            }
        }

        // Ownership check before adding findings
        const scanOwner = scan.userId || 'anonymous';
        if (scanOwner !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const vuln = { id: uuidv4(), ...(req.body || {}), project_id: projectId, created_at: new Date() };

        if (!scan.findings) scan.findings = [];
        scan.findings.push(vuln);
        await storage.saveScan(scan);

        io.to(projectId).emit('row_added', vuln);
        res.json(vuln);
    });

    // ── Delete a Finding ──────────────────────────────────────────────────────
    router.delete('/api/vulnerabilities/:projectId/:id', optionalAuth, async (req, res) => {
        const { projectId, id } = req.params;
        const scan = await storage.getScan(projectId);
        if (!scan) return res.status(404).json({ error: 'Project not found' });

        // Ownership check before deleting
        const scanOwner = scan.userId || 'anonymous';
        if (scanOwner !== req.userId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!scan.findings) return res.status(404).json({ error: 'No findings' });

        const initialLength = scan.findings.length;
        scan.findings = scan.findings.filter(f => f.id !== id);

        if (scan.findings.length === initialLength) {
            return res.status(404).json({ error: 'Finding not found' });
        }

        await storage.saveScan(scan);
        io.to(projectId).emit('row_deleted', id);
        res.json({ success: true });
    });

    // ── Save Snapshot ─────────────────────────────────────────────────────────
    router.post('/api/vmt/snapshots/:projectId', optionalAuth, async (req, res) => {
        try {
            const { projectId } = req.params;
            const { name, data } = req.body;
            // Pass userId so snapshot is scoped to this user
            const snapshot = await storage.saveSnapshot(projectId, name, data, req.userId);
            res.json(snapshot);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ── List Snapshots ────────────────────────────────────────────────────────
    router.get('/api/vmt/snapshots/:projectId', optionalAuth, async (req, res) => {
        try {
            const { projectId } = req.params;
            // Filter snapshots by userId so each user only sees their own
            const snapshots = await storage.getSnapshots(projectId, req.userId);
            res.json(snapshots);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // ── Load Snapshot by ID ───────────────────────────────────────────────────
    router.get('/api/vmt/snapshot/:id', optionalAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const snapshot = await storage.getSnapshot(id);
            if (!snapshot) return res.status(404).json({ error: 'Snapshot not found' });

            // Ownership check on individual snapshot load
            const snapOwner = snapshot.userId || 'anonymous';
            if (snapOwner !== req.userId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            res.json(snapshot);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};

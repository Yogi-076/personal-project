const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit'); // Wait to implement full pdfkit-table next iteration for simplicity

// Assume DATA_DIR is passed or relative
const DATA_DIR = path.join(__dirname, '..', 'data');

/**
 * Helper to ensure directory exists
 */
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Helper to safely read JSON
 */
const readJsonSafe = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
};

// ═══════════════════════════════════════════
// POST /api/reports/generate
// Generates a VAPT report for a specific project
// ═══════════════════════════════════════════
router.post('/generate', async (req, res) => {
    const { projectId, format = 'pdf', sections = ['executive', 'technical', 'findings'], reportType = 'combined', confidentiality = 'confidential' } = req.body;

    if (!projectId) {
        return res.status(400).json({ error: "projectId is required" });
    }

    const projectDir = path.join(DATA_DIR, 'projects', projectId);
    const infoPath = path.join(projectDir, 'project_info.json');
    const scansDir = path.join(projectDir, 'scans');
    const reportsDir = path.join(projectDir, 'reports');

    if (!fs.existsSync(infoPath)) {
        return res.status(404).json({ error: "Project not found" });
    }

    const projectInfo = readJsonSafe(infoPath);
    ensureDir(reportsDir);

    // 1. Get report version (increment on every generation)
    const reportVersion = (projectInfo.reportVersion || 0) + 1;

    // 2. Gather all findings from completed scans for this project
    let allFindings = [];
    let summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };

    if (fs.existsSync(scansDir)) {
        const scanFolders = fs.readdirSync(scansDir).filter(f => fs.lstatSync(path.join(scansDir, f)).isDirectory());

        for (const scanId of scanFolders) {
            const resultsPath = path.join(scansDir, scanId, 'results.json');
            const scanData = readJsonSafe(resultsPath);
            if (scanData && scanData.status === 'completed' && scanData.findings) {
                allFindings = [...allFindings, ...scanData.findings];

                if (scanData.summary) {
                    summary.critical += scanData.summary.critical || 0;
                    summary.high += scanData.summary.high || 0;
                    summary.medium += scanData.summary.medium || 0;
                    summary.low += scanData.summary.low || 0;
                    summary.info += scanData.summary.info || 0;
                }
            }
        }
    }

    // 3. Include manual findings
    const manualPath = path.join(projectDir, 'findings', 'manual.json');
    const manualFindings = readJsonSafe(manualPath) || [];
    manualFindings.forEach(f => {
        allFindings.push(f);
        const sev = (f.severity || 'info').toLowerCase();
        if (summary[sev] !== undefined) summary[sev]++;
        else summary.info++;
    });

    // Sort findings by severity
    const severityMap = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
    allFindings.sort((a, b) => (severityMap[(b.severity || 'info').toLowerCase()] || 0) - (severityMap[(a.severity || 'info').toLowerCase()] || 0));

    // Remove duplicates based on title and URL for cleaner reporting
    const uniqueFindingsMap = new Map();
    allFindings.forEach(f => {
        const key = `${f.title || f.name}-${f.url || f.path}`;
        if (!uniqueFindingsMap.has(key)) uniqueFindingsMap.set(key, f);
    });
    const uniqueFindings = Array.from(uniqueFindingsMap.values());


    // 4. Build the PDF Document with versioned filename
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const companyName = projectInfo.companyName || 'Client';
    const testerName = projectInfo.testerName || 'Security Team';
    const targetUrls = Array.isArray(projectInfo.targetUrls) ? projectInfo.targetUrls : [projectInfo.targetUrl || 'N/A'];
    const engagementType = projectInfo.engagementType || 'VAPT';
    const safeCompany = companyName.replace(/[^a-z0-9]/gi, '_');
    const reportFilename = `${projectId}_Report_v${reportVersion}.0_${dateStr}.pdf`;
    const reportPath = path.join(reportsDir, reportFilename);

    try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const stream = fs.createWriteStream(reportPath);
        doc.pipe(stream);

        // --- COVER PAGE ---
        doc.rect(0, 0, doc.page.width, doc.page.height).fill('#0f172a'); // Dark Midnight Background

        doc.fillColor('#e2e8f0')
            .fontSize(32)
            .font('Helvetica-Bold')
            .text('Vulnerability Assessment', 50, 200, { align: 'center' });
        doc.fontSize(24)
            .text('& Penetration Testing Report', { align: 'center' });

        doc.moveDown(3);

        doc.fontSize(16)
            .fillColor('#38bdf8') // Primary blue
            .text(`Prepared for: ${companyName}`, { align: 'center' });

        doc.moveDown(1);

        doc.fontSize(12)
            .fillColor('#94a3b8')
            .text(`Date: ${new Date().toLocaleDateString()}`, { align: 'center' })
            .text(`Project ID: ${projectId}`, { align: 'center' })
            .text(`Engagement: ${engagementType}`, { align: 'center' })
            .text(`Lead Tester: ${testerName}`, { align: 'center' });

        doc.addPage();

        // Reset to Light Theme for Content (Better printing)
        const renderHeader = (title) => {
            doc.fillColor('#0f172a').fontSize(20).font('Helvetica-Bold').text(title, { underline: true });
            doc.moveDown(1);
        };

        // --- EXECUTIVE SUMMARY ---
        if (sections.includes('executive')) {
            renderHeader('1. Executive Summary');
            doc.fontSize(11).font('Helvetica').fillColor('#334155')
                .text(`This report documents the findings of the VAPT performed for ${companyName}. The objective was to identify security weaknesses in the target infrastructure and provide actionable remediation guidelines.`, { align: 'justify' });

            doc.moveDown();

            // Scope
            doc.font('Helvetica-Bold').text('1.1 Scope of Engagement');
            doc.font('Helvetica').text(targetUrls.join(', '));

            doc.moveDown();

            // Stats
            doc.font('Helvetica-Bold').text('1.2 Threat Intelligence Summary');
            doc.font('Helvetica').text(`The assessment identified a total of ${uniqueFindings.length} unique security findings across the target scope.`, { continued: true });

            doc.moveDown(2);

            const total = summary.critical + summary.high + summary.medium + summary.low + summary.info;
            doc.fillColor('#dc2626').text(`CRITICAL: ${summary.critical}`);
            doc.fillColor('#ea580c').text(`HIGH: ${summary.high}`);
            doc.fillColor('#d97706').text(`MEDIUM: ${summary.medium}`);
            doc.fillColor('#3b82f6').text(`LOW / INFO: ${summary.low + summary.info}`);
            doc.fillColor('#334155');

            doc.addPage();
        }

        // --- DETAILED FINDINGS ---
        if (sections.includes('findings')) {
            renderHeader('2. Detailed Findings');

            if (uniqueFindings.length === 0) {
                doc.fontSize(11).font('Helvetica-Oblique').text('No significant vulnerabilities were identified during this assessment.');
            } else {
                uniqueFindings.forEach((finding, index) => {
                    const severityColors = {
                        critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#3b82f6', info: '#64748b'
                    };
                    const color = severityColors[(finding.severity || 'info').toLowerCase()] || '#64748b';

                    // Finding Header
                    doc.fillColor(color).fontSize(14).font('Helvetica-Bold')
                        .text(`2.${index + 1} ${(finding.title || finding.name).toUpperCase()}`);

                    // Severity Badge
                    doc.fontSize(10).text(`Severity: ${(finding.severity || 'Info').toUpperCase()}`, { underline: true });
                    doc.moveDown(0.5);

                    // Details
                    doc.fillColor('#0f172a').font('Helvetica-Bold').text('Target: ', { continued: true })
                        .font('Helvetica').fillColor('#334155').text(finding.url || finding.path || 'N/A');

                    doc.moveDown(0.5);

                    doc.fillColor('#0f172a').font('Helvetica-Bold').text('Description:');
                    doc.font('Helvetica').fillColor('#334155').text(finding.description || 'No description provided.', { align: 'justify' });

                    doc.moveDown(0.5);

                    if (finding.evidence || finding.proof) {
                        doc.fillColor('#0f172a').font('Helvetica-Bold').text('Evidence / Proof of Concept:');
                        doc.font('Courier').fontSize(9).fillColor('#475569') // Use courier for code/payloads
                            .text((finding.evidence || finding.proof).substring(0, 500) + ((finding.evidence || finding.proof).length > 500 ? '...' : ''));
                        doc.fontSize(11).font('Helvetica'); // Reset
                    }

                    doc.moveDown(0.5);

                    doc.fillColor('#0f172a').font('Helvetica-Bold').text('Remediation / Recommendation:');
                    doc.font('Helvetica').fillColor('#15803d').text(finding.remediation || 'Consult security best practices for mitigation.', { align: 'justify' });

                    doc.moveDown(2);
                });
            }
        }

        // Finalize PDF
        doc.end();

        stream.on('finish', () => {
            // Increment version in project_info.json & log activity
            projectInfo.reportVersion = reportVersion;
            projectInfo.activity = projectInfo.activity || [];
            projectInfo.activity.push({
                action: `Report generated (${reportFilename}) by ${projectInfo.testerName || 'Tester'}`,
                at: new Date().toISOString()
            });
            fs.writeFileSync(infoPath, JSON.stringify(projectInfo, null, 2));

            res.json({
                message: "Report generated successfully",
                version: reportVersion,
                filename: reportFilename,
                downloadUrl: `/api/projects/${projectId}/reports/${reportFilename}`
            });
        });

    } catch (err) {
        console.error("PDF Gen Error:", err);
        res.status(500).json({ error: "Failed to generate PDF document" });
    }
});

module.exports = router;

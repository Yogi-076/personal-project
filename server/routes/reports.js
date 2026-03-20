const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit'); // Wait to implement full pdfkit-table next iteration for simplicity
const { optionalAuth } = require('../middleware/saasMiddleware');

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
router.post('/generate', optionalAuth, async (req, res) => {
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

    // ── User Isolation: Only project owner can generate their report ──
    const projectOwner = projectInfo.userId || 'anonymous';
    const requester = req.userId || 'anonymous';
    if (projectOwner !== requester) {
        return res.status(403).json({ error: 'Access denied: You do not own this project' });
    }

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


// 4. Build the Professional HTML Document
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const companyName = projectInfo.companyName || 'Client';
    const testerName = projectInfo.testerName || 'Security Team';
    const targetUrls = Array.isArray(projectInfo.targetUrls) ? projectInfo.targetUrls : [projectInfo.targetUrl || 'N/A'];
    const engagementType = projectInfo.engagementType || 'VAPT';
    const reportFilename = `${projectId}_Report_v${reportVersion}.0_${dateStr}.pdf`;
    const reportPath = path.join(reportsDir, reportFilename);
    const dateFormatted = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Total stats
    const total = summary.critical + summary.high + summary.medium + summary.low + summary.info;
    
    // Header tags based on confidentiality
    let confTagClasses = "bg-red-500/20 text-red-500 border-red-500/30";
    if(confidentiality === 'internal') confTagClasses = "bg-amber-500/20 text-amber-500 border-amber-500/30";
    else if(confidentiality === 'strictly-confidential') confTagClasses = "bg-purple-500/20 text-purple-500 border-purple-500/30";

    const severityColors = { 
        critical: '#ef4444', 
        high: '#f97316', 
        medium: '#eab308', 
        low: '#3b82f6', 
        info: '#64748b' 
    };

    const severityBgColors = { 
        critical: 'rgba(239, 68, 68, 0.1)', 
        high: 'rgba(249, 115, 22, 0.1)', 
        medium: 'rgba(234, 179, 8, 0.1)', 
        low: 'rgba(59, 130, 246, 0.1)', 
        info: 'rgba(100, 116, 139, 0.1)' 
    };

    let htmlBody = '';

    // COVER PAGE
    if (sections.includes('cover')) {
        htmlBody += `
        <div class="page cover-page">
            <div class="cover-content">
                <div class="confidentiality-badge ${confidentiality}">${confidentiality.toUpperCase().replace('-', ' ')}</div>
                <h1 class="main-title">SECURITY ASSESSMENT REPORT</h1>
                <div class="subtitle-box">
                    <p class="project-title">${projectInfo.title || 'Vulnerability Assessment & Penetration Testing'}</p>
                    <p class="company-name">Prepared for: <strong>${companyName}</strong></p>
                </div>
                
                <table class="meta-table">
                    <tr><th>Date of Report</th><td>${dateFormatted}</td></tr>
                    <tr><th>Project Reference</th><td>${projectId}</td></tr>
                    <tr><th>Engagement Type</th><td>${engagementType}</td></tr>
                    <tr><th>Assigned Lead</th><td>${testerName}</td></tr>
                    <tr><th>Report Version</th><td>v${reportVersion}.0</td></tr>
                    <tr><th>Report Type</th><td>${reportType.charAt(0).toUpperCase() + reportType.slice(1)}</td></tr>
                </table>
            </div>
            <div class="cover-footer">
                <p>Generated by VajraScan VAPT Framework • © ${new Date().getFullYear()} Fornsec Solutions</p>
                <div class="accent-bar"></div>
            </div>
        </div>`;
    }

    // EXECUTIVE SUMMARY
    if (sections.includes('executive')) {
        htmlBody += `
        <div class="page">
            <h2 class="section-title">1. Executive Summary</h2>
            <div class="card">
                <p>This document presents the findings from the Vulnerability Assessment and Penetration Testing (VAPT) engagement performed for <strong>${companyName}</strong>. The objective of this assessment was to systematically identify, quantify, and document security weaknesses across the defined target scope.</p>
                <p>The engagement followed industry-standard methodologies to evaluate the security posture of the infrastructure and applications, simulating realistic threat vectors to measure the impact of potential exploits.</p>
            </div>
            
            <h3 class="subsection-title">1.1 Scope of Engagement</h3>
            <div class="card">
                <ul class="clean-list">
                    ${targetUrls.map(url => `<li><code>${url}</code></li>`).join('')}
                </ul>
            </div>

            <h3 class="subsection-title">1.2 High-Level Results</h3>
            <div class="card text-center pb-0">
                <p>A total of <strong>${total}</strong> findings were identified across the target scope. The breakdown of these vulnerabilities by risk rating is detailed below:</p>
            </div>
            
            <div class="stats-grid">
                <div class="stat-box" style="border-top-color: ${severityColors.critical}">
                    <div class="stat-value" style="color: ${severityColors.critical}">${summary.critical}</div>
                    <div class="stat-label">CRITICAL</div>
                </div>
                <div class="stat-box" style="border-top-color: ${severityColors.high}">
                    <div class="stat-value" style="color: ${severityColors.high}">${summary.high}</div>
                    <div class="stat-label">HIGH</div>
                </div>
                <div class="stat-box" style="border-top-color: ${severityColors.medium}">
                    <div class="stat-value" style="color: ${severityColors.medium}">${summary.medium}</div>
                    <div class="stat-label">MEDIUM</div>
                </div>
                <div class="stat-box" style="border-top-color: ${severityColors.low}">
                    <div class="stat-value" style="color: ${severityColors.low}">${summary.low}</div>
                    <div class="stat-label">LOW</div>
                </div>
                <div class="stat-box" style="border-top-color: ${severityColors.info}">
                    <div class="stat-value" style="color: ${severityColors.info}">${summary.info}</div>
                    <div class="stat-label">INFO</div>
                </div>
            </div>
        </div>`;
    }

    // SCOPE AND METHODOLOGY
    if (sections.includes('scope')) {
        htmlBody += `
        <div class="page">
            <h2 class="section-title">2. Scope & Methodology</h2>
            <div class="card">
                <p>The security assessment was conducted using a combination of automated scanning tools and manual verification techniques. The following phases were executed:</p>
                <ol>
                    <li><strong>Reconnaissance & Footprinting:</strong> Information gathering to map the target's attack surface.</li>
                    <li><strong>Vulnerability Scanning:</strong> Automated detection of known CVEs, misconfigurations, and standard web vulnerabilities using the VajraScan multi-engine orchestrator.</li>
                    <li><strong>Manual Verification & Exploitation:</strong> Manual analysis to confirm the validity of automated findings, eliminate false positives, and identify complex logical flaws.</li>
                    <li><strong>Reporting & Recommendations:</strong> Documentation of identified risks and formulation of remediation strategies.</li>
                </ol>
            </div>
            <h3 class="subsection-title">2.1 Detailed Rules of Engagement</h3>
            <div class="card">
                <p>${projectInfo.description ? projectInfo.description.replace(/\\n/g, '<br/>') : 'No additional constraints or specific testing windows were defined for this engagement.'}</p>
            </div>
        </div>`;
    }

    // DETAILED FINDINGS
    if (sections.includes('findings') && (reportType === 'technical' || reportType === 'combined' || reportType === 'compliance')) {
        let titleClassIndex = 3;
        if (!sections.includes('scope')) titleClassIndex--;
        if (!sections.includes('executive')) titleClassIndex--;

        htmlBody += `
        <div class="page">
            <h2 class="section-title">${titleClassIndex}. Detailed Vulnerability Findings</h2>
            <p style="margin-bottom: 20px;">The following section outlines the technical details and evidence for each identified vulnerability, ordered by severity.</p>
        `;

        if (uniqueFindings.length === 0) {
            htmlBody += `<div class="card text-center" style="padding: 40px;"><p style="color: #64748b; font-style: italic;">No significant vulnerabilities were identified during this assessment.</p></div>`;
        } else {
            uniqueFindings.forEach((finding, index) => {
                const sev = (finding.severity || 'info').toLowerCase();
                const color = severityColors[sev] || severityColors.info;
                const bgColor = severityBgColors[sev] || severityBgColors.info;

                htmlBody += `
                <div class="finding-block" style="page-break-inside: avoid;">
                    <div class="finding-header" style="background-color: ${bgColor}; border-left: 5px solid ${color};">
                        <div class="finding-title">${titleClassIndex}.${index + 1} ${(finding.title || finding.name).toUpperCase()}</div>
                        <div class="finding-badge" style="background-color: ${color}; color: white;">${sev.toUpperCase()}</div>
                    </div>
                    <div class="finding-content">
                        <table class="finding-meta">
                            <tr><th>Target Affected</th><td><code>${finding.url || finding.path || 'N/A'}</code></td></tr>
                            ${finding.cve ? `<tr><th>CVE Reference</th><td>${finding.cve}</td></tr>` : ''}
                            ${finding.cvss ? `<tr><th>CVSS Score</th><td>${finding.cvss}</td></tr>` : ''}
                        </table>
                        
                        <h4>Vulnerability Description</h4>
                        <p>${(finding.description || 'No description provided.').replace(/\\n/g, '<br/>')}</p>
                        
                        ${finding.evidence || finding.proof ? `
                        <h4>Proof of Concept / Evidence</h4>
                        <pre><code>${(finding.evidence || finding.proof).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                        ` : ''}
                        
                        ${sections.includes('recommendations') ? `
                        <h4>Remediation Recommendations</h4>
                        <div class="remediation-box">
                            <p>${(finding.remediation || 'Apply necessary security patches and follow secure coding guidelines.').replace(/\\n/g, '<br/>')}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>`;
            });
        }
        
        htmlBody += `</div>`; // Close page
    }

    // CONCLUSION
    if (sections.includes('conclusion')) {
        let titleClassIndex = 4;
        if (!sections.includes('scope')) titleClassIndex--;
        if (!sections.includes('executive')) titleClassIndex--;
        if (!sections.includes('findings')) titleClassIndex--;

        htmlBody += `
        <div class="page">
            <h2 class="section-title">${titleClassIndex}. Conclusion</h2>
            <div class="card">
                <p>The assessment revealed a total of <strong>${total}</strong> security issues ranging from ${summary.critical > 0 ? 'Critical' : summary.high > 0 ? 'High' : 'Medium'} to Info severity. The overall security posture of the target scope is considered to be <strong>${summary.critical > 0 ? 'WEAK' : summary.high > 0 ? 'AT RISK' : 'MODERATE'}</strong>.</p>
                <p>It is highly recommended that the management prioritizes the remediation of Critical and High severity vulnerabilities immediately to prevent potential exploitation. Subsequent re-testing should be scheduled once the remediation phase is complete to ensure the efficacy of the applied fixes.</p>
                
                <div style="margin-top: 60px; display: flex; justify-content: space-between;">
                    <div style="width: 45%; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center;">
                        <strong>${testerName}</strong><br/>
                        <span style="color: #64748b; font-size: 10pt;">Lead Security Consultant</span>
                    </div>
                    <div style="width: 45%; border-top: 1px solid #cbd5e1; padding-top: 10px; text-align: center;">
                        <strong>Fornsec Solutions</strong><br/>
                        <span style="color: #64748b; font-size: 10pt;">Quality Assurance Team</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    const htmlFull = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
    
    @page { size: A4; margin: 25mm 20mm; }
    
    body {
      font-family: 'Inter', sans-serif;
      line-height: 1.6;
      color: #334155;
      font-size: 10.5pt;
      margin: 0; padding: 0;
    }
    
    .page { page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    
    /* Cover Page Styles */
    .cover-page {
      display: flex; flex-direction: column; justify-content: center; height: 100vh;
      background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
      margin: -25mm -20mm;
      padding: 0 40mm;
      color: white;
      box-sizing: border-box;
    }
    
    .confidentiality-badge {
      display: inline-block; padding: 6px 16px; border-radius: 4px; border: 1px solid;
      font-size: 10pt; font-weight: 700; letter-spacing: 2px;
      margin-bottom: 40px; align-self: flex-start;
    }
    .confidential { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-color: rgba(96, 165, 250, 0.4); }
    .strictly-confidential { background: rgba(220, 38, 38, 0.2); color: #f87171; border-color: rgba(248, 113, 113, 0.4); }
    .internal { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(251, 191, 36, 0.4); }
    
    .main-title {
      font-size: 38pt; font-weight: 800; line-height: 1.1; margin: 0 0 20px 0;
      background: linear-gradient(to right, #60a5fa, #c084fc);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    }
    
    .subtitle-box { margin-bottom: 60px; border-left: 4px solid #60a5fa; padding-left: 20px; }
    .project-title { font-size: 18pt; color: #cbd5e1; margin: 0 0 5px 0; font-weight: 500; }
    .company-name { font-size: 14pt; color: #94a3b8; margin: 0; }
    
    .meta-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
    .meta-table th, .meta-table td { padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: left; }
    .meta-table th { width: 40%; color: #94a3b8; font-weight: 500; text-transform: uppercase; font-size: 9pt; letter-spacing: 1px; }
    .meta-table td { color: #f8fafc; font-weight: 600; font-size: 11pt; }
    
    .cover-footer { position: absolute; bottom: 40mm; left: 40mm; right: 40mm;}
    .cover-footer p { color: #64748b; font-size: 9pt; text-align: center; margin: 0;}
    .accent-bar { height: 4px; width: 100%; background: linear-gradient(to right, #3b82f6, #8b5cf6); margin-top: 20px; border-radius: 2px; }
    
    /* Content Pages */
    .section-title {
      font-size: 22pt; font-weight: 800; color: #0f172a; border-bottom: 2px solid #e2e8f0;
      padding-bottom: 15px; margin-top: 0; margin-bottom: 30px;
    }
    
    .subsection-title { font-size: 14pt; font-weight: 700; color: #334155; margin-top: 35px; margin-bottom: 15px; }
    
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 25px; margin-bottom: 25px; }
    
    .stats-grid { display: flex; justify-content: space-between; gap: 15px; margin-top: 30px; }
    .stat-box {
      flex: 1; background: #fff; border: 1px solid #e2e8f0; border-top: 4px solid;
      border-radius: 8px; padding: 20px 10px; text-align: center;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .stat-value { font-size: 28pt; font-weight: 800; line-height: 1; margin-bottom: 5px; }
    .stat-label { font-size: 9pt; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
    
    .clean-list { margin: 0; padding-left: 20px; }
    .clean-list li { margin-bottom: 10px; }
    
    code { font-family: 'JetBrains Mono', monospace; background: rgba(15, 23, 42, 0.05); color: #db2777; padding: 2px 6px; border-radius: 4px; font-size: 9pt; word-wrap: break-word;}
    pre { background: #0f172a; color: #f8fafc; padding: 15px; border-radius: 6px; overflow-x: auto; margin: 15px 0; white-space: pre-wrap; word-wrap: break-word;}
    pre code { background: transparent; color: inherit; padding: 0; font-size: 9pt; }
    
    /* Findings Styling */
    .finding-block { margin-bottom: 40px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff; }
    .finding-header { display: flex; justify-content: space-between; align-items: center; padding: 15px 20px; }
    .finding-title { font-weight: 800; font-size: 14pt; color: #0f172a; margin: 0; width: 80%;}
    .finding-badge { font-size: 9pt; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.5px; }
    .finding-content { padding: 20px; }
    
    .finding-meta { width: 100%; border-collapse: collapse; margin-bottom: 20px; background: #f8fafc; border-radius: 6px; overflow: hidden; }
    .finding-meta th, .finding-meta td { padding: 10px 15px; border-bottom: 1px solid #e2e8f0; text-align: left;}
    .finding-meta th { width: 25%; color: #64748b; font-weight: 600; font-size: 10pt; }
    .finding-meta td { color: #0f172a; }
    .finding-meta tr:last-child th, .finding-meta tr:last-child td { border-bottom: none; }
    
    h4 { font-size: 12pt; font-weight: 700; color: #1e293b; margin-top: 25px; margin-bottom: 10px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; }
    
    .remediation-box { background: rgba(21, 128, 61, 0.05); border-left: 4px solid #15803d; padding: 15px 20px; border-radius: 0 6px 6px 0; }
    .text-center { text-align: center; }
    .pb-0 { padding-bottom: 0; }
  </style>
</head>
<body>
${htmlBody}
</body>
</html>`;

    try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setContent(htmlFull, { waitUntil: 'networkidle0' });

        await page.pdf({
            path: reportPath,
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: true,
            headerTemplate: '<div></div>',
            footerTemplate: '<div style="font-size:8pt;color:#94a3b8;width:100%;text-align:center;padding-bottom:10mm;font-family:Arial,sans-serif;">VajraScan VAPT Framework • Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>',
            margin: {
                top: '0', 
                right: '0',
                bottom: '0',
                left: '0'
            }
        });

        await browser.close();

        // Increment version in project_info.json & log activity
        projectInfo.reportVersion = reportVersion;
        projectInfo.activity = projectInfo.activity || [];
        projectInfo.activity.push({
            action: `Generated ${reportType} report (${reportFilename}) by ${projectInfo.testerName || 'Tester'}`,
            at: new Date().toISOString()
        });
        fs.writeFileSync(infoPath, JSON.stringify(projectInfo, null, 2));

        res.json({
            message: "Report generated successfully",
            version: reportVersion,
            filename: reportFilename,
            downloadUrl: `/api/projects/${projectId}/reports/${reportFilename}`
        });

    } catch (err) {
        console.error("Puppeteer PDF Gen Error:", err);
        res.status(500).json({ error: "Failed to generate professional PDF document via Puppeteer" });
    }
});

// ═══════════════════════════════════════════
// GET /api/reports/raw/:projectId/:scanId
// Downloads the raw JSON scan results
// ═══════════════════════════════════════════
router.get('/raw/:projectId/:scanId', optionalAuth, (req, res) => {
    try {
        const { projectId, scanId } = req.params;
        const projectDir = path.join(DATA_DIR, 'projects', projectId);
        const infoFile = path.join(projectDir, 'project_info.json');

        // ── User Isolation: Enforce ownership ──
        if (fs.existsSync(infoFile)) {
            const pInfo = JSON.parse(fs.readFileSync(infoFile, 'utf8'));
            const pOwner = pInfo.userId || 'anonymous';
            const pRequester = req.userId || 'anonymous';
            if (pOwner !== pRequester) {
                return res.status(403).json({ error: 'Access denied: You do not own this project' });
            }
        }

        const scanResultPath = path.join(projectDir, 'scans', scanId, 'results.json');

        if (!fs.existsSync(scanResultPath)) {
            return res.status(404).json({ error: "Raw scan results not found. The scan may not have completed." });
        }

        // Send the file as an attachment
        res.download(scanResultPath, `raw_scan_${scanId}.json`, (err) => {
            if (err) {
                console.error("[Reports API] Error downloading raw scan:", err);
            }
        });

    } catch (err) {
        console.error("[Reports API] Error serving raw scan:", err);
        res.status(500).json({ error: "Server error while fetching raw scan data" });
    }
});

module.exports = router;

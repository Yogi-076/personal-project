import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Download,
    FileText,
    Shield,
    AlertTriangle,
    XCircle,
    Info,
    CheckCircle,
    Search,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VulnerabilityCard } from "./VulnerabilityCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailedFinding } from "./DetailedFinding";
import { Badge } from "@/components/ui/badge";

interface ScanResult {
    id: string;
    target: string;
    status: "completed" | "running" | "failed";
    startedAt: string;
    completedAt?: string;
    findings: Vulnerability[];
    summary: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
}

interface Vulnerability {
    id: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    type: string;
    url: string;
    parameter?: string;
    evidence: string;
    remediation: string;
    description?: string;
    impact?: string;
    stepsToReproduce?: string;
    curlCommand?: string;
    reproductionUrl?: string;
    payload?: string;
    cvssScore: number;
    cwe?: string;
    owasp?: string;
}

interface GroupedVulnerability {
    type: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    instances: Vulnerability[];
    remediation: string;
    description: string;
    impact: string;
    cvssScore: number;
    cwe?: string;
    owasp?: string;
}

interface ScanReportProps {
    result: ScanResult;
}

// Define the VulnerabilityGroup component
interface VulnerabilityGroupProps {
    group: GroupedVulnerability;
    severityConfig: {
        [key: string]: {
            icon: any;
            color: string;
            bg: string;
            border: string;
            label: string;
        };
    };
}

const VulnerabilityGroup = ({ group, severityConfig }: VulnerabilityGroupProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);
    const severity = group.severity?.toLowerCase() || "info";
    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
    const Icon = config.icon;

    return (
        <Card className={`${config.bg} ${config.border} transition-all hover:shadow-md border-l-4`}>
            <div
                className="flex flex-row items-center justify-between cursor-pointer py-4 px-6"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${config.color} bg-background border shadow-sm`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <CardTitle className="text-base font-semibold text-foreground">{group.type}</CardTitle>
                            <Badge variant="outline" className={`${config.color} ${config.bg} bg-opacity-20 border-opacity-30 ${config.border}`}>
                                {config.label}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {group.instances.length} instances • Max CVSS: {(group.cvssScore || 0).toFixed(1)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden bg-background/50 border-t"
                    >
                        <CardContent className="pt-6 pb-6 px-6 space-y-6">

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Description</h5>
                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                        {group.description || group.instances[0]?.description || "No description provided."}
                                    </p>
                                </div>
                                <div>
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Impact</h5>
                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                        {group.impact || group.instances[0]?.impact || "Impact assessment unavailable."}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h5 className="text-xs font-bold text-muted-foreground uppercase">Affected Locations</h5>
                                <div className="rounded-md border bg-card">
                                    {group.instances.map((inst, i) => (
                                        <div key={inst.id} className="border-b last:border-0 group">
                                            <div
                                                className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedInstanceId(expandedInstanceId === inst.id ? null : inst.id);
                                                }}
                                            >
                                                <div className="flex-1 overflow-hidden pr-4">
                                                    <div className="font-mono text-sm text-foreground truncate flex items-center gap-2">
                                                        {expandedInstanceId === inst.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                        {inst.url}
                                                    </div>
                                                    {inst.parameter && (
                                                        <div className="text-xs text-muted-foreground mt-1 ml-5">
                                                            Param: <span className="bg-muted px-1.5 py-0.5 rounded border">{inst.parameter}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-mono text-xs font-semibold">
                                                    CVSS: {(Number(inst.cvssScore) || 0).toFixed(1)}
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {expandedInstanceId === inst.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="px-4 pb-4 overflow-hidden bg-muted/10 border-t border-dashed"
                                                    >
                                                        <div className="pt-4 ml-5">
                                                            <DetailedFinding finding={inst} />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <h5 className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Remediation
                                </h5>
                                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                                    {group.remediation}
                                </p>
                            </div>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};

const NoFindings = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-card border border-dashed rounded-xl">
        <div className="p-4 rounded-full bg-muted mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-lg font-semibold text-foreground">All Clear</p>
        <p className="text-sm">No findings match your criteria.</p>
    </div>
);

export const ScanReport = ({ result }: ScanReportProps) => {
    const [filter, setFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const severityConfig = {
        critical: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critical" },
        high: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "High" },
        medium: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Medium" },
        low: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Low" },
        info: { icon: CheckCircle, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20", label: "Info" },
    };

    const getSeverityConfig = (sev: string) => {
        const s = (sev || "info").toLowerCase();
        return severityConfig[s as keyof typeof severityConfig] || severityConfig.info;
    };

    const handleExport = () => {
        const reportData = JSON.stringify(result, null, 2);
        const blob = new Blob([reportData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vapt-report-${result.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    const handleDownloadPDF = () => {
        const overlay = document.createElement("div");
        overlay.id = "vapt-report-builder-modal";
        Object.assign(overlay.style, {
            position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
            backgroundColor: "rgba(2, 6, 23, 0.98)", backdropFilter: "blur(12px)",
            zIndex: "10000", display: "flex", alignItems: "center", justifyContent: "center"
        });
        
        const modal = document.createElement("div");
        Object.assign(modal.style, {
            background: "#020617", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "16px", width: "95%", maxWidth: "880px", maxHeight: "92vh",
            overflowY: "auto", padding: "40px", color: "#f8fafc", fontFamily: "'Inter', sans-serif",
            boxShadow: "0 25px 70px -12px rgba(0, 0, 0, 0.8)", position: "relative"
        });

        modal.innerHTML = `
            <div style="margin-bottom: 32px;">
                <h2 style="font-size: 24px; font-weight: 800; margin: 0 0 4px 0; color: #fff; letter-spacing: -0.5px;">Configure & compile security assessment report</h2>
                <p style="color: #64748b; font-size: 15px; margin: 0;">Finalize the structural components and sensitivity parameters for the engagement deliverable.</p>
            </div>

            <!-- 1. REPORT TYPE -->
            <div style="margin-bottom: 32px;">
                <h3 style="font-size: 13px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">1. REPORT TYPE</h3>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                    <div class="rtype-card active" data-type="combined" style="border: 2px solid #3b82f6; background: rgba(59, 130, 246, 0.08); padding: 20px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px; color: #fff;">Combined Report</div>
                        <div style="font-size: 13px; color: #94a3b8;">Both executive summary and full technical analysis sections</div>
                    </div>
                    <div class="rtype-card" data-type="executive" style="border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.02); padding: 20px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                        <div style="font-weight: 700; font-size: 16px; margin-bottom: 4px; color: #fff;">Executive Summary</div>
                        <div style="font-size: 13px; color: #94a3b8;">High-level overview for management and clients (non-technical)</div>
                    </div>
                </div>
            </div>

            <!-- 2. INCLUDE SECTIONS -->
            <div style="margin-bottom: 32px;">
                <h3 style="font-size: 13px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">2. INCLUDE SECTIONS</h3>
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                    ${[
                        { id: 'cover', label: 'Cover Page with Engagement Details', checked: true },
                        { id: 'summary', label: 'Executive Summary Overview', checked: true },
                        { id: 'methodology', label: 'Scope & Assessment Methodology', checked: true },
                        { id: 'vulns', label: 'Detailed Vulnerability Exhibits', checked: true },
                        { id: 'cvss', label: 'CVSS Risk Score Breakdown', checked: true },
                        { id: 'remediation', label: 'Priority Remediation Roadmap', checked: true }
                    ].map(s => `
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer; font-size: 14px; font-weight: 500; color: #e2e8f0;">
                            <input type="checkbox" id="check-${s.id}" ${s.checked ? 'checked' : ''} style="width: 18px; height: 18px; border-radius: 4px; accent-color: #3b82f6;">
                            ${s.label}
                        </label>
                    `).join('')}
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 32px;">
                <!-- 3. CONFIDENTIALITY -->
                <div>
                    <h3 style="font-size: 13px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">3. CONFIDENTIALITY LEVEL</h3>
                    <div style="display: flex; gap: 10px;">
                        <button class="conf-btn active" data-conf="CONFIDENTIAL" style="flex: 1; padding: 12px; background: rgba(59, 130, 246, 0.1); border: 1px solid #3b82f6; color: #fff; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">Confidential</button>
                        <button class="conf-btn" data-conf="INTERNAL USE" style="flex: 1; padding: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94a3b8; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer;">Internal Only</button>
                    </div>
                </div>
                
                <!-- 4. MANUAL INPUTS -->
                <div>
                    <h3 style="font-size: 13px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px;">4. MANUAL INPUTS</h3>
                     <textarea id="execNote" style="width: 100%; min-height: 48px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; color: #fff; font-size: 13px; box-sizing: border-box;" placeholder="Add final forward/closing notes..."></textarea>
                </div>
            </div>

            <div style="display: flex; justify-content: flex-end; gap: 16px;">
                <button id="cancelBtn" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #fff; padding: 12px 32px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 15px;">Discard</button>
                <button id="generateBtn" style="background: linear-gradient(to right, #2563eb, #3b82f6); border: none; color: #fff; padding: 12px 40px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 15px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);">Compile Report</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // State orchestration
        (modal as any)._selectedType = 'combined';
        (modal as any)._selectedConf = 'CONFIDENTIAL';

        modal.querySelectorAll('.rtype-card').forEach(c => c.addEventListener('click', () => {
            modal.querySelectorAll('.rtype-card').forEach(x => { (x as HTMLElement).style.border = '1px solid rgba(255,255,255,0.1)'; (x as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; });
            (c as HTMLElement).style.border = '2px solid #3b82f6'; (c as HTMLElement).style.background = 'rgba(59, 130, 246, 0.08)';
            (modal as any)._selectedType = (c as HTMLElement).dataset.type;
        }));

        modal.querySelectorAll('.conf-btn').forEach(b => b.addEventListener('click', () => {
            modal.querySelectorAll('.conf-btn').forEach(x => { (x as HTMLElement).style.border = '1px solid rgba(255,255,255,0.1)'; (x as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (x as HTMLElement).style.color = '#94a3b8'; });
            (b as HTMLElement).style.border = '1px solid #3b82f6'; (b as HTMLElement).style.background = 'rgba(59, 130, 246, 0.1)'; (b as HTMLElement).style.color = '#fff';
            (modal as any)._selectedConf = (b as HTMLElement).dataset.conf;
        }));

        const cleanup = () => document.body.removeChild(overlay);
        document.getElementById("cancelBtn")?.addEventListener("click", cleanup);
        document.getElementById("generateBtn")?.addEventListener("click", () => {
             const options = {
                 type: (modal as any)._selectedType,
                 confidentiality: (modal as any)._selectedConf,
                 sections: {
                     cover: (document.getElementById('check-cover') as HTMLInputElement).checked,
                     summary: (document.getElementById('check-summary') as HTMLInputElement).checked,
                     methodology: (document.getElementById('check-methodology') as HTMLInputElement).checked,
                     vulns: (document.getElementById('check-vulns') as HTMLInputElement).checked,
                     cvss: (document.getElementById('check-cvss') as HTMLInputElement).checked,
                     remediation: (document.getElementById('check-remediation') as HTMLInputElement).checked
                 },
                 notes: (document.getElementById('execNote') as HTMLTextAreaElement).value
             };
             cleanup();
             generateFinalPDF(options.notes, { title: '' }, options);
        });
    };

    const generateFinalPDF = (executiveNote: string, manualFinding: any, options: any = {}) => {
        const { type = 'combined', confidentiality = 'CONFIDENTIAL', sections = {}, notes = '' } = options;
        const severityColors: Record<string, string> = {
            critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#3b82f6', info: '#64748b'
        };
        const findings = [...(result.findings || [])];
        const summary = { ...(result.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }) };
        
        // Handle Manual Finding
        if (manualFinding && manualFinding.title && manualFinding.title.trim() !== '') {
            findings.unshift({
                id: 'MANUAL-' + Date.now(),
                severity: manualFinding.severity.toLowerCase(),
                type: manualFinding.title,
                title: manualFinding.title,
                url: result.target,
                evidence: manualFinding.poc,
                stepsToReproduce: manualFinding.poc,
                remediation: manualFinding.remediation,
                description: manualFinding.description,
                cvssScore: manualFinding.severity === 'CRITICAL' ? 9.8 : (manualFinding.severity === 'HIGH' ? 8.0 : (manualFinding.severity === 'MEDIUM' ? 5.0 : 0.0))
            });
            summary.total += 1;
            summary[manualFinding.severity.toLowerCase() as keyof typeof summary] += 1;
        }

        const dateStr = new Date().toLocaleString();

        const findingsHtml = (type === 'executive') ? '' : findings.map((f: any, i: number) => {
            const sev = (f.severity || 'info').toLowerCase();
            const color = severityColors[sev] || '#64748b';
            
            return `
                <div style="margin-bottom: 40px; page-break-inside: avoid; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; background: #fff;">
                    <div style="background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 16px 24px; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div>
                            <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #64748b; margin-bottom: 4px;">FINDING-${String(i+1).padStart(3, '0')}</div>
                            <h3 style="margin: 0; font-size: 18px; color: #0f172a; font-weight: 800;">${f.title || f.type}</h3>
                            <div style="font-size: 12px; color: #475569; margin-top: 6px;">URL: <code>${f.url || 'N/A'}</code></div>
                        </div>
                        <div style="text-align: right;">
                            <div style="background: ${color}; color: #fff; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 800; text-transform: uppercase;">${sev}</div>
                            <div style="margin-top: 6px; font-size: 12px; color: #475569; font-weight: 600;">CVSS: ${(Number(f.cvssScore) || 0).toFixed(1)}</div>
                        </div>
                    </div>
                    <div style="padding: 24px;">
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 800;">Description & Impact</h4>
                        <p style="margin: 0 0 20px 0; font-size: 14px; color: #1e293b; line-height: 1.6;">${f.description || f.impact || 'N/A'}</p>
                        
                        ${(f.evidence || f.stepsToReproduce || f.curlCommand) && sections.vulns ? `
                        <h4 style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 800;">Proof of Concept</h4>
                        <div style="margin: 0 0 20px 0; background: #0f172a; padding: 15px; border-radius: 6px; overflow-x: auto;">
                            <pre style="margin: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #e2e8f0; white-space: pre-wrap; word-break: break-all;">${f.curlCommand || f.evidence || f.stepsToReproduce}</pre>
                        </div>` : ''}
                        
                        ${sections.remediation ? `
                        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 16px; border-radius: 6px;">
                            <h4 style="margin: 0 0 6px 0; font-size: 12px; text-transform: uppercase; color: #16a34a; font-weight: 800;">Remediation</h4>
                            <p style="margin: 0; font-size: 13px; color: #15803d; line-height: 1.5;">${f.remediation || 'Conduct thorough code review and implement context-aware output encoding.'}</p>
                        </div>` : ''}
                    </div>
                </div>`;
        }).join('');

        const renderedHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap');
  body { font-family: 'Inter', sans-serif; color: #0f172a; margin: 0; padding: 0; background: #fff; }
  .confidential-watermark { position: fixed; top: 20px; right: 40px; font-size: 12px; font-weight: 800; color: #dc2626; border: 2px solid #dc2626; padding: 4px 10px; border-radius: 4px; z-index: 1000; transform: rotate(5deg); }
  .cover-page { height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 80px; background: #020617; color: #fff; page-break-after: always; position: relative; }
  .report-content { padding: 60px 80px; }
  .section-ttl { font-size: 24px; font-weight: 800; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin: 40px 0 24px 0; }
  .summary-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 12px; margin-bottom: 40px; }
  .stat-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; text-align: center; }
  .stat-val { font-size: 28px; font-weight: 800; line-height: 1; margin-bottom: 4px; }
  .stat-lab { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
  @media print { .cover-page { background: #020617 !important; -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
    <div class="confidential-watermark">${confidentiality}</div>

    <!-- 1. COVER PAGE -->
    ${sections.cover ? `
    <div class="cover-page">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 60px;">
            <div style="width: 44px; height: 44px; background: #38bdf8; border-radius: 10px; display: flex; align-items: center; justify-content: center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#020617" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            </div>
            <span style="font-size: 22px; font-weight: 800; letter-spacing: 1.5px; color: #fff;">VAJRA<span style="color: #38bdf8;">SCAN</span></span>
        </div>
        <h1 style="font-size: 48px; font-weight: 800; line-height: 1; margin-bottom: 10px;">Security Assessment Report</h1>
        <p style="font-size: 18px; color: #94a3b8; margin-bottom: 60px;">${type === 'combined' ? 'Comprehensive Vulnerability Validation' : (type === 'executive' ? 'Executive Risk Summary' : 'Technical Security Exhibit')}</p>
        <div style="width: 80px; height: 4px; background: #2563eb; margin-bottom: 60px;"></div>
        <div style="display: grid; grid-template-columns: 120px 1fr; gap: 12px; font-size: 14px;">
            <div style="color: #64748b; font-weight: 700;">TARGET</div><div style="font-family: 'JetBrains Mono';">${result.target}</div>
            <div style="color: #64748b; font-weight: 700;">DATE</div><div>${dateStr}</div>
            <div style="color: #64748b; font-weight: 700;">ENGAGEMENT</div><div style="font-family: 'JetBrains Mono';">${result.id}</div>
        </div>
        <div style="position: absolute; bottom: 40px; font-size: 11px; color: #475569;">VajraScan VAPT Framework • Final Deliverable</div>
    </div>` : ''}

    <div class="report-content">
        <!-- 2. EXECUTIVE SUMMARY -->
        ${sections.summary ? `
        <h2 class="section-ttl">Executive Summary</h2>
        ${notes ? `<div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 20px; font-size: 14px; line-height: 1.7; margin-bottom: 32px;">${notes.replace(/\n/g, '<br>')}</div>` : ''}
        <div class="summary-grid">
            <div style="border-top: 4px solid #dc2626;" class="stat-card"><div class="stat-val" style="color: #dc2626;">${summary.critical}</div><div class="stat-lab">Critical</div></div>
            <div style="border-top: 4px solid #ea580c;" class="stat-card"><div class="stat-val" style="color: #ea580c;">${summary.high}</div><div class="stat-lab">High</div></div>
            <div style="border-top: 4px solid #d97706;" class="stat-card"><div class="stat-val" style="color: #d97706;">${summary.medium}</div><div class="stat-lab">Medium</div></div>
            <div style="border-top: 4px solid #3b82f6;" class="stat-card"><div class="stat-val" style="color: #3b82f6;">${summary.low}</div><div class="stat-lab">Low</div></div>
            <div style="border-top: 4px solid #64748b;" class="stat-card"><div class="stat-val" style="color: #64748b;">${summary.info}</div><div class="stat-lab">Info</div></div>
            <div style="background: #eff6ff;" class="stat-card"><div class="stat-val" style="color: #1e40af;">${summary.total}</div><div class="stat-lab">Total</div></div>
        </div>` : ''}

        <!-- 3. METHODOLOGY -->
        ${sections.methodology ? `
        <h2 class="section-ttl">Assessment Methodology</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">This assessment utilized standard penetration testing methodologies including reconnaissance, automated fuzzing, and manual validation. All findings represent verified security weaknesses at the time of the scan.</p>` : ''}

        <!-- 4. FINDINGS -->
        ${sections.vulns ? `
        <h2 class="section-ttl">Technical Vulnerability Exhibits</h2>
        ${findingsHtml}` : ''}

        <!-- 5. COMPLIANCE MAPPING -->
        ${sections.compliance ? `
        <h2 class="section-ttl">Compliance Framework Mapping</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 40px; font-size: 13px;">
            <thead>
                <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                    <th style="padding: 12px; text-align: left; font-weight: 800; color: #64748b;">FINDING ID</th>
                    <th style="padding: 12px; text-align: left; font-weight: 800; color: #64748b;">CATEGORY</th>
                    <th style="padding: 12px; text-align: left; font-weight: 800; color: #64748b;">OWASP 2021/2024</th>
                    <th style="padding: 12px; text-align: left; font-weight: 800; color: #64748b;">CWE IDENTIFIER</th>
                </tr>
            </thead>
            <tbody>
                ${findings.map((f: any, i: number) => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-family: 'JetBrains Mono'; color: #475569;">F-${String(i+1).padStart(3, '0')}</td>
                    <td style="padding: 12px; font-weight: 600;">${f.title || f.type}</td>
                    <td style="padding: 12px; color: #1e40af;">${f.owasp || 'A00: Uncategorized'}</td>
                    <td style="padding: 12px;"><span style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: 'JetBrains Mono';">${f.cweId || 'N/A'}</span></td>
                </tr>`).join('')}
            </tbody>
        </table>
        <p style="font-size: 11px; color: #94a3b8; font-style: italic;">Note: This mapping is generated based on standard industry taxonomy (CWE 4.13, OWASP Top 10 2021).</p>` : ''}

        <div style="margin-top: 100px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b;">
            This report was securely generated by the VajraScan VAPT Framework.
        </div>
    </div>
</body>
</html>`;

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        const doc = iframe.contentWindow?.document;
        if (doc) {
            doc.open();
            doc.write(renderedHtml);
            doc.close();
            setTimeout(() => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
                document.body.removeChild(iframe);
            }, 500);
        }
    };

    const [isGrouped, setIsGrouped] = useState(true);

    const filteredFindings = result.findings.filter((v) => {
        const matchFilter = filter === "all" || v.severity === filter;
        const matchSearch =
            (v.type || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (v.url || "").toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    // Grouping Logic
    const groupedFindings = filteredFindings.reduce((acc: { [key: string]: GroupedVulnerability }, curr) => {
        if (!acc[curr.type]) {
            acc[curr.type] = {
                type: curr.type,
                severity: curr.severity,
                instances: [],
                remediation: curr.remediation,
                description: curr.description || "No description provided.",
                impact: curr.impact || "No impact assessment provided.",
                cvssScore: curr.cvssScore
            };
        }
        acc[curr.type].instances.push(curr);
        if (curr.cvssScore > acc[curr.type].cvssScore) {
            acc[curr.type].cvssScore = curr.cvssScore;
            acc[curr.type].severity = curr.severity;
        }
        return acc;
    }, {});

    const groups = Object.values(groupedFindings);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 print:space-y-4 font-sans"
        >
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 md:items-start md:justify-between bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/[0.05] shadow-lg print:border-none print:p-0">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-sky-500/20 flex items-center justify-center border border-primary/20 shadow-inner print:hidden">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-foreground tracking-tight print:text-black">
                            Assessment Report
                        </h2>
                    </div>
                    <div className="flex flex-col gap-1.5 pl-1">
                        <p className="text-muted-foreground text-sm font-medium">Target: <span className="text-foreground tracking-wide font-mono bg-white/[0.03] px-2 py-0.5 rounded">{result.target}</span></p>
                        <p className="text-xs text-muted-foreground/60 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            Completed: {(() => {
                                const dStr = result.completedAt || result.startedAt;
                                if (!dStr) return "Date Unavailable";
                                const d = new Date(dStr);
                                return isNaN(d.getTime()) ? "Invalid Date" : d.toLocaleString();
                            })()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 print:hidden">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export JSON
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleDownloadPDF}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Download PDF
                    </Button>
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="overview" className="w-full space-y-6">
                <TabsList className="bg-muted p-1 rounded-lg w-full md:w-auto grid grid-cols-2">
                    <TabsTrigger value="overview">Executive Summary</TabsTrigger>
                    <TabsTrigger value="findings">Technical Findings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: "Total Issues", value: result.summary.total, severity: "all" },
                            { label: "Critical", value: result.summary.critical, severity: "critical" },
                            { label: "High", value: result.summary.high, severity: "high" },
                            { label: "Medium", value: result.summary.medium, severity: "medium" },
                            { label: "Low", value: result.summary.low, severity: "low" },
                        ].map((stat, i) => {
                            const isActive = filter === stat.severity;
                            const config = stat.severity !== "all" ? getSeverityConfig(stat.severity) : { color: 'text-foreground', border: 'border-border', bg: 'bg-transparent' };

                            return (
                                <Card
                                    key={stat.label}
                                    className={"cursor-pointer transition-all duration-300 overflow-hidden relative " + (isActive ? "ring-1 ring-offset-0 " + config.bg + " bg-opacity-20 " + config.border : "bg-card/40 border-white/[0.04] hover:bg-card hover:border-white/[0.08]")}
                                    onClick={() => setFilter(stat.severity)}
                                >
                                    {isActive && <div className={"absolute inset-0 bg-gradient-to-br from-transparent to-" + (stat.severity === 'all' ? 'primary/10' : (config.color.split('-')[1] || 'gray') + '-500/10')} />}
                                    <CardContent className="p-6 flex flex-col items-center justify-center text-center relative z-10">
                                        <div className={"text-4xl font-black mb-2 tracking-tighter drop-shadow-sm " + (stat.severity === 'all' ? 'text-foreground' : config.color)}>{stat.value}</div>
                                        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">{stat.label}</div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Recommendations Section */}
                    <Card className="border-l-4 border-l-sky-500 bg-card/30 border-y-white/[0.02] border-r-white/[0.02] backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Security Best Practices
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    {[
                                        "Perform regular security assessments",
                                        "Keep all dependencies updated"
                                    ].map((rec, i) => (
                                        <div key={i} className="flex gap-3 text-xs text-muted-foreground items-start font-medium">
                                            <div className="h-1.5 w-1.5 rounded-full bg-sky-500/50 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                                            {rec}
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    {[
                                        "Implement CSP and HSTS headers",
                                        "Follow OWASP ASVS guidelines"
                                    ].map((rec, i) => (
                                        <div key={i} className="flex gap-3 text-xs text-muted-foreground items-start font-medium">
                                            <div className="h-1.5 w-1.5 rounded-full bg-sky-500/50 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                                            {rec}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="findings" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Findings List */}
                        <div className="lg:col-span-12 space-y-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-primary" />
                                        Findings Details {filter !== "all" && <span className="text-muted-foreground text-sm font-normal">({getSeverityConfig(filter).label})</span>}
                                    </h3>
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/30">
                                        <label className="text-xs font-semibold text-muted-foreground cursor-pointer select-none" htmlFor="group-view">Grouped View</label>
                                        <input
                                            id="group-view"
                                            type="checkbox"
                                            checked={isGrouped}
                                            onChange={(e) => setIsGrouped(e.target.checked)}
                                            className="w-4 h-4 accent-primary cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="relative w-full md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search findings..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-card"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {isGrouped ? (
                                    groups.length > 0 ? (
                                        groups.map((group: GroupedVulnerability) => (
                                            <VulnerabilityGroup key={group.type} group={group} severityConfig={severityConfig} />
                                        ))
                                    ) : (
                                        <NoFindings />
                                    )
                                ) : (
                                    filteredFindings.length > 0 ? (
                                        filteredFindings.map((vulnerability, index) => (
                                            <motion.div
                                                key={vulnerability.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <VulnerabilityCard vulnerability={vulnerability} />
                                            </motion.div>
                                        ))
                                    ) : (
                                        <NoFindings />
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

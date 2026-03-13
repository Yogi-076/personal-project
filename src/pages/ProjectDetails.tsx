import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Building2, Globe, Calendar, User, ShieldAlert,
    Search, FileText, Paperclip, BarChart3, Settings,
    ArrowLeft, Download, Shield, ShieldCheck, AlertTriangle, AlertCircle, Info, Loader2,
    Target, Zap, Activity, ChevronRight, Clock, Trash2, FileImage, FileDown, File
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { ReportGenerator } from "@/components/ReportGenerator";
import { ManualFindingModal } from "@/components/ManualFindingModal";
import { EvidenceUploadModal } from "@/components/EvidenceUploadModal";
import { FindingsDashboard } from "@/components/FindingsDashboard";
import { motion, AnimatePresence } from "framer-motion";
import { scannerApi } from "@/lib/api_vmt";
import { Config } from "@/config";

interface ProjectDetails {
    id: string;
    title: string;
    description: string;
    companyName: string;
    targetUrls: string[];
    startDate: string;
    endDate: string;
    testerName: string;
    testerEmail: string;
    engagementType: string;
    status: string;
    scans: any[];
    reports: any[];
    manualFindings: any[];
    evidence: any[];
    reportVersion: number;
}

export default function ProjectDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [project, setProject] = useState<ProjectDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // Modal states
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [findingModalOpen, setFindingModalOpen] = useState(false);
    const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
    const [dashboardOpen, setDashboardOpen] = useState(false);

    const refreshProject = useCallback(async () => {
        if (!id) return;
        try {
            const res = await fetch(`${Config.API_URL}/api/projects/${id}`);
            if (res.ok) {
                const data = await res.json();
                setProject(data);
            }
        } catch (e) {
            console.error("Failed to refresh project", e);
        }
    }, [id]);

    const fetchProject = useCallback(async () => {
        try {
            const res = await fetch(`${Config.API_URL}/api/projects/${id}`);
            if (res.ok) {
                setProject(await res.json());
            } else {
                toast({ variant: "destructive", title: "Project not found" });
                navigate("/projects");
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id, navigate, toast]);

    useEffect(() => {
        if (id) fetchProject();
    }, [id, fetchProject]);

    if (loading) {
        return (
            <div className="h-screen bg-background aurora-bg flex flex-col items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin mb-6" />
                <p className="text-xs font-mono text-primary/60 tracking-[0.3em] uppercase animate-pulse">Establishing Uplink...</p>
            </div>
        );
    }

    if (!project) return null;

    // Aggregate findings from scan results
    let critical = 0, high = 0, med = 0, low = 0;
    project.scans.forEach(scan => {
        if (scan.summary) {
            critical += scan.summary.critical || 0;
            high += scan.summary.high || 0;
            med += scan.summary.medium || 0;
            low += (scan.summary.low || 0) + (scan.summary.info || 0);
        }
    });

    // Add manual findings to counts
    (project.manualFindings || []).forEach(f => {
        const s = (f.severity || '').toLowerCase();
        if (s === 'critical') critical++;
        else if (s === 'high') high++;
        else if (s === 'medium') med++;
        else low++;
    });

    const totalFindings = critical + high + med + low;

    const handleDownloadReport = (filename: string) => {
        const a = document.createElement('a');
        a.href = `${Config.API_URL}/api/projects/${project.id}/reports/${filename}`;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast({ title: "Downloading Report", description: filename });
    };

    return (
        <div className="min-h-screen bg-background aurora-bg noise-texture p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">

                {/* ── PREMIUM HEADER ── */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 pb-6 border-b border-white/[0.07]">
                    <div className="flex items-center gap-5">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate('/projects')}
                            className="w-12 h-12 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/10 hover:border-primary/30 transition-all text-muted-foreground hover:text-primary shrink-0"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div className="space-y-1">
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-black text-white tracking-tight">{project.title}</h1>
                                <div className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md border border-primary/20">
                                    {project.id}
                                </div>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-white/5'
                                    }`}>
                                    {project.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                                    {project.status}
                                </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-x-5 gap-y-1 text-xs font-medium text-muted-foreground">
                                <span className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-primary/60 outline-none" /> {project.companyName}</span>
                                <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-primary/60" /> {project.testerName}</span>
                                <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-primary/60" /> {project.engagementType}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <div className="relative group w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search scans/reports..."
                                className="pl-10 h-11 bg-black/40 border-white/10 rounded-xl focus:border-primary/50 transition-all font-mono text-xs"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Button
                            variant="destructive"
                            className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white border border-red-500/20 h-11 px-6 rounded-xl shadow-lg transition-all"
                            onClick={async () => {
                                if (window.confirm("Are you absolute sure you want to delete this project? This will permanently erase all scans, reports, and findings associated with it. This action cannot be undone.")) {
                                    try {
                                        const res = await fetch(`${Config.API_URL}/api/projects/${project.id}`, {
                                            method: 'DELETE'
                                        });
                                        if (res.ok) {
                                            toast({ title: "Project Deleted", description: "All project data has been purged." });
                                            navigate('/projects');
                                        } else {
                                            toast({ variant: "destructive", title: "Deletion Failed", description: "Could not delete project." });
                                        }
                                    } catch (err) {
                                        toast({ variant: "destructive", title: "Connection Error", description: "Failed to reach the server." });
                                    }
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Project
                        </Button>
                        <Button
                            className="btn-cyber h-11 px-6 rounded-xl shadow-lg shadow-primary/20"
                            onClick={() => setReportModalOpen(true)}
                        >
                            <FileText className="w-4 h-4 mr-2" />
                            Finalize Report (v{(project.reportVersion || 0) + 1}.0)
                        </Button>
                    </div>
                </div>

                {/* ── MISSION INTELLIGENCE HUD ── */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Findings Matrix */}
                    <div className="lg:col-span-1 card-premium p-6 flex flex-col justify-between hex-grid-bg relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center justify-between">
                                Threat Matrix
                                <ShieldAlert className="w-4 h-4 text-red-500 animate-pulse" />
                            </h3>
                            <div className="grid grid-cols-2 gap-3 mb-6">
                                {[
                                    { val: critical, label: "Critical", text: "text-red-500", border: "neon-border-critical" },
                                    { val: high, label: "High", text: "text-orange-500", border: "neon-border-high" },
                                    { val: med, label: "Medium", text: "text-amber-500", border: "neon-border-medium" },
                                    { val: low, label: "Info/Low", text: "text-blue-500", border: "neon-border-low" }
                                ].map(s => (
                                    <div key={s.label} className={`p-4 rounded-xl bg-black/40 border border-white/5 flex flex-col items-center group cursor-help transition-all duration-300 hover:scale-105 ${s.border}`}>
                                        <div className={`text-2xl font-black ${s.text}`}>{s.val}</div>
                                        <div className="text-[9px] uppercase font-bold text-muted-foreground/60">{s.label}</div>
                                    </div>
                                ))}
                            </div>
                            <div className="pt-4 border-t border-white/5 text-center">
                                <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-1">Impact Score Aggregate</div>
                                <div className="text-4xl font-black text-white tabular-nums">{totalFindings}</div>
                            </div>
                        </div>
                    </div>

                    {/* Target Context */}
                    <div className="lg:col-span-3 card-premium p-6 flex flex-col justify-between relative overflow-hidden">
                        <div className="relative z-10 h-full flex flex-col">
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-6 flex items-center gap-2">
                                <Target className="w-4 h-4 text-primary" />
                                Engagement Scope Detail
                            </h3>

                            <div className="flex-1 space-y-6">
                                <div className="bg-black/60 p-5 rounded-2xl border border-white/5 font-mono text-sm leading-relaxed group relative">
                                    <div className="absolute top-3 right-3 opacity-20 group-hover:opacity-100 transition-opacity">
                                        <Zap className="w-4 h-4 text-primary" />
                                    </div>
                                    <p className="text-primary/90 flex items-center gap-3">
                                        <Globe className="w-4 h-4 text-slate-500" />
                                        {project.targetUrls.map(url => <span key={url} className="px-2 py-0.5 bg-primary/10 rounded">{url}</span>)}
                                    </p>
                                    <div className="mt-4 text-muted-foreground/80 leading-relaxed text-xs">
                                        {project.description || "No specific scope constraints documented for this engagement."}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                                    {[
                                        { label: "Deployment", value: project.startDate || 'LIVE', icon: <Calendar className="w-4 h-4" /> },
                                        { label: "Termination", value: project.endDate || 'PERP', icon: <Clock className="w-4 h-4" /> },
                                        { label: "Assigned Dev", value: project.testerName.split(' ')[0], icon: <User className="w-4 h-4" /> },
                                        { label: "Engine State", value: project.scans.length + " ACTIVE", icon: <Activity className="w-4 h-4" /> },
                                    ].map(item => (
                                        <div key={item.label} className="group">
                                            <div className="text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-2 flex items-center gap-1.5">
                                                <span className="text-primary group-hover:scale-110 transition-transform">{item.icon}</span>
                                                {item.label}
                                            </div>
                                            <div className="text-sm font-black text-foreground group-hover:text-primary transition-colors">{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── TESTER PANEL [A]-[F] ── */}
                <div className="space-y-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                        <Settings className="w-4 h-4 text-indigo-400" />
                        Tester Orchestration Panel
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[
                            { id: '[A]', title: "Start New Scan", sub: "Launch automated multi-engine DAST", icon: Search, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", action: () => navigate(`/scanner?projectId=${project.id}&targetUrl=${encodeURIComponent(project.targetUrls[0] || '')}`) },
                            { id: '[B]', title: "Add Manual Finding", sub: "Inject logic & custom exploits", icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", action: () => setFindingModalOpen(true) },
                            { id: '[C]', title: "Evidence Storage", sub: project.evidence?.length + " Secure artifacts loaded", icon: Paperclip, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", action: () => setEvidenceModalOpen(true) },
                            { id: '[D]', title: "Findings HUD", sub: "Manage & resolve vulnerabilities", icon: BarChart3, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", action: () => setDashboardOpen(true) },
                            { id: '[E]', title: "Generate Report", sub: "Compile VAPT PDF Engine v" + ((project.reportVersion || 0) + 1) + ".0", icon: FileText, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-indigo-500/20", action: () => setReportModalOpen(true) },
                            { id: '[F]', title: "Settings Cluster", sub: "Scope constraints & auth keys", icon: Settings, color: "text-slate-500", bg: "bg-white/[0.03]", border: "border-white/10", action: () => toast({ title: "Opening Settings..." }) }
                        ].map((btn) => (
                            <button
                                key={btn.id}
                                onClick={btn.action}
                                className={`h-24 px-6 rounded-2xl border ${btn.bg} ${btn.border} flex items-center gap-5 group relative overflow-hidden transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl hover:shadow-black/20`}
                            >
                                <div className="absolute inset-0 bg-white/[0.03] translate-x-[-100%] group-hover:translate-x-0 transition-transform duration-500 pointer-events-none" />
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${btn.border} bg-black/40 group-hover:scale-110 transition-transform`}>
                                    <btn.icon className={`w-6 h-6 ${btn.color}`} />
                                </div>
                                <div className="text-left relative z-10">
                                    <div className="flex items-center gap-2">
                                        <span className={`text-[10px] font-black ${btn.color} opacity-60`}>{btn.id}</span>
                                        <span className="text-base font-black text-foreground group-hover:text-primary transition-colors">{btn.title}</span>
                                    </div>
                                    <div className="text-[10px] font-medium text-muted-foreground/70 mt-0.5">{btn.sub}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── HISTORY TABLES ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Scan Cluster */}
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <Activity className="w-4 h-4 text-primary" />
                            Recent Scan Deployments
                        </h3>
                        <div className="card-premium overflow-hidden border-none shadow-2xl">
                            <div className="p-0 max-h-[320px] overflow-y-auto custom-scrollbar bg-black/40">
                                {project.scans.length > 0 ? project.scans.filter(s =>
                                    s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (s.type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (s.status || '').toLowerCase().includes(searchQuery.toLowerCase())
                                ).map((scan, i) => (
                                    <div key={i} className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between hover:bg-white/[0.03] transition-colors group cursor-pointer" onClick={() => navigate('/scanner')}>
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-center group-hover:border-primary/40 transition-colors">
                                                <Target className="w-4.5 h-4.5 text-muted-foreground/60 group-hover:text-primary" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm text-foreground truncate max-w-[120px]">{scan.id.slice(0, 12)}...</div>
                                                <div className="text-[9px] font-mono text-primary/60 uppercase font-black">{(scan.type || 'wapiti')} Assessment</div>
                                            </div>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1.5">
                                            <Badge variant="outline" className={`h-5 text-[9px] border-none font-black px-2 uppercase ${scan.status === 'completed' ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"
                                                }`}>
                                                {scan.status}
                                            </Badge>
                                            <div className="text-[9px] font-mono text-muted-foreground/40">{new Date(scan.startedAt).toLocaleTimeString()}</div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    try {
                                                        const response = await fetch(`${Config.API_URL}/api/reports/raw/${id}/${scan.id}`);
                                                        if (!response.ok) throw new Error('Raw scan results not available');
                                                        
                                                        const blob = await response.blob();
                                                        const url = window.URL.createObjectURL(blob);
                                                        const a = document.createElement('a');
                                                        a.href = url;
                                                        a.download = `raw_scan_${scan.id}.json`;
                                                        document.body.appendChild(a);
                                                        a.click();
                                                        window.URL.revokeObjectURL(url);
                                                        document.body.removeChild(a);
                                                        toast({ title: "Downloaded", description: "Raw scan results downloaded." });
                                                    } catch (err: any) {
                                                        toast({ title: "Download Failed", description: err.message, variant: "destructive" });
                                                    }
                                                }}
                                                className="h-8 w-8 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 hover:text-blue-300"
                                                title="Download Raw JSON"
                                            >
                                                <Download className="w-4 h-4" />
                                            </Button>
                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (confirm('Delete this scan record?')) {
                                                        try {
                                                            await scannerApi.deleteScan(scan.id);
                                                            toast({ title: "Scan Deleted", description: "History updated." });
                                                            refreshProject();
                                                        } catch (err: any) {
                                                            toast({ title: "Error", description: err.message, variant: "destructive" });
                                                        }
                                                    }
                                                }}
                                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-all"
                                                title="Delete Scan"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </motion.button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-16 text-center text-muted-foreground/30 flex flex-col items-center">
                                        <Shield className="w-12 h-12 mb-4 opacity-5" />
                                        <span className="text-xs uppercase tracking-widest font-black">Ready for Deployment</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Report Ledger */}
                    <div className="space-y-4">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <FileText className="w-4 h-4 text-violet-400" />
                            Generated Report Ledger
                        </h3>
                        <div className="card-premium overflow-hidden border-none shadow-2xl">
                            <div className="p-0 max-h-[320px] overflow-y-auto custom-scrollbar bg-black/40">
                                {project.reports.length > 0 ? project.reports.filter(r =>
                                    r.filename.toLowerCase().includes(searchQuery.toLowerCase())
                                ).map((rep, i) => (
                                    <div key={i} className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between hover:bg-white/[0.03] transition-colors cursor-pointer group">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                                                <FileText className="w-4.5 h-4.5 text-violet-400" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate max-w-[180px]">{rep.filename}</div>
                                                <div className="text-[9px] font-mono text-muted-foreground/50">{new Date(rep.createdAt).toLocaleString()}</div>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDownloadReport(rep.filename)}
                                            className="opacity-0 group-hover:opacity-100 h-8 px-4 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all font-bold text-[10px]"
                                        >
                                            <Download className="w-3.5 h-3.5 mr-1.5" /> DOWNLOAD
                                        </Button>
                                    </div>
                                )) : (
                                    <div className="p-16 text-center text-muted-foreground/30 flex flex-col items-center">
                                        <FileText className="w-12 h-12 mb-4 opacity-5" />
                                        <span className="text-xs uppercase tracking-widest font-black">No Reports Archived</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── EVIDENCE VAULT ── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                            <Paperclip className="w-4 h-4 text-slate-400" />
                            Evidence Vault
                            <span className="ml-2 px-2 py-0.5 bg-slate-500/10 border border-slate-500/20 rounded-md text-[10px] font-black text-slate-400">
                                {project.evidence?.length || 0} FILES
                            </span>
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEvidenceModalOpen(true)}
                            className="h-7 px-3 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white border border-white/5 hover:border-slate-500/40 rounded-lg"
                        >
                            <Paperclip className="w-3 h-3 mr-1.5" /> Upload More
                        </Button>
                    </div>
                    <div className="card-premium overflow-hidden border-none shadow-2xl">
                        <div className="p-0 max-h-[280px] overflow-y-auto custom-scrollbar bg-black/40">
                            {(project.evidence?.length || 0) > 0 ? project.evidence.map((ev, i) => {
                                const ext = ev.filename.split('.').pop()?.toLowerCase() || '';
                                const isImg = ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext);
                                const isDoc = ['pdf','doc','docx','txt','md','csv','json','xml'].includes(ext);
                                const handleDownloadEvidence = () => {
                                    const fileUrl = `${Config.API_URL}/api/projects/${project.id}/evidence/${encodeURIComponent(ev.filename)}`;
                                    const a = document.createElement('a');
                                    a.href = fileUrl;
                                    a.target = '_blank';
                                    a.rel = 'noopener noreferrer';
                                    document.body.appendChild(a);
                                    a.click();
                                    document.body.removeChild(a);
                                };
                                const handleDeleteEvidence = async () => {
                                    if (!window.confirm(`Are you sure you want to delete "${ev.filename}"?`)) return;
                                    try {
                                        const url = `${Config.API_URL}/api/projects/${project.id}/evidence/${encodeURIComponent(ev.filename)}`;
                                        const resp = await fetch(url, { method: 'DELETE' });
                                        if (!resp.ok) throw new Error('Failed to delete file');
                                        
                                        toast({ title: "Success", description: "Evidence deleted successfully." });
                                        refreshProject(); 
                                    } catch (err: any) {
                                        toast({ variant: "destructive", title: "Error", description: err.message });
                                    }
                                };
                                const formatBytes = (b: number) => b < 1024 ? `${b} B` : b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(2)} MB`;
                                return (
                                    <div key={i} className="px-6 py-4 border-b border-white/[0.05] flex items-center justify-between hover:bg-white/[0.03] transition-colors group">
                                        <div className="flex items-center gap-4 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center shrink-0">
                                                {isImg ? <FileImage className="w-4 h-4 text-blue-400" /> : isDoc ? <FileText className="w-4 h-4 text-orange-400" /> : <File className="w-4 h-4 text-slate-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm text-foreground group-hover:text-primary transition-colors truncate max-w-[260px]">{ev.filename}</div>
                                                <div className="text-[9px] font-mono text-muted-foreground/50 flex gap-3">
                                                    <span>{formatBytes(ev.size)}</span>
                                                    <span>{new Date(ev.uploadedAt).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleDownloadEvidence}
                                                className="h-8 px-4 bg-slate-700 text-white rounded-lg hover:bg-slate-600 shadow-lg transition-all font-bold text-[10px]"
                                            >
                                                <FileDown className="w-3.5 h-3.5 mr-1.5" /> DOWNLOAD
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleDeleteEvidence}
                                                className="h-8 px-3 bg-red-900/40 text-red-100 border border-red-500/30 rounded-lg hover:bg-red-800 shadow-lg transition-all font-bold text-[10px]"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            }) : (
                                <div className="p-16 text-center text-muted-foreground/30 flex flex-col items-center">
                                    <Paperclip className="w-12 h-12 mb-4 opacity-5" />
                                    <span className="text-xs uppercase tracking-widest font-black">No Evidence Uploaded</span>
                                    <span className="text-[10px] mt-2 text-muted-foreground/20">Use the [C] Evidence Storage button above to upload files</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── MODALS ── */}

                <ReportGenerator
                    projectId={project.id}
                    projectTitle={project.title}
                    currentVersion={project.reportVersion || 0}
                    open={reportModalOpen}
                    onOpenChange={setReportModalOpen}
                    onSuccess={refreshProject}
                />
                <ManualFindingModal
                    projectId={project.id}
                    open={findingModalOpen}
                    onOpenChange={setFindingModalOpen}
                    onSuccess={refreshProject}
                />
                <EvidenceUploadModal
                    projectId={project.id}
                    open={evidenceModalOpen}
                    onOpenChange={setEvidenceModalOpen}
                    onSuccess={refreshProject}
                />
                <FindingsDashboard
                    projectId={project.id}
                    open={dashboardOpen}
                    onOpenChange={setDashboardOpen}
                    onFindingDeleted={refreshProject}
                />
            </div>
        </div>
    );
}

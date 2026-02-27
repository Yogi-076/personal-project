import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
    Target, PlusCircle, FolderOpen, Activity, ArrowRight,
    ShieldCheck, Search, Loader2, Briefcase, Globe,
    LayoutGrid, Users, Zap, FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface Project {
    id: string;
    title: string;
    companyName: string;
    targetUrls: string | string[];
    status: string;
    createdAt: string;
    scansCount: number;
    reportsCount: number;
    severitySummary?: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

export default function Projects() {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // New Project Form State
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        companyName: "",
        targetUrls: "",
        startDate: new Date().toISOString().split('T')[0],
        endDate: "",
        testerName: "",
        testerEmail: "",
        engagementType: "Black Box",
        username: "",
        password: ""
    });

    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (e) {
            console.error("Failed to fetch projects", e);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                title: formData.title,
                description: formData.description,
                companyName: formData.companyName,
                targetUrls: formData.targetUrls.split(',').map(s => s.trim()),
                startDate: formData.startDate,
                endDate: formData.endDate,
                testerName: formData.testerName,
                testerEmail: formData.testerEmail,
                engagementType: formData.engagementType,
                credentials: {
                    username: formData.username,
                    password: formData.password
                }
            };

            const res = await fetch('http://localhost:3001/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                toast({
                    title: "Project Created Successfully!",
                    description: `Project ID: ${data.projectId}`,
                });
                setIsCreateModalOpen(false);
                fetchProjects();
                setFormData({
                    title: "", description: "", companyName: "", targetUrls: "",
                    startDate: new Date().toISOString().split('T')[0], endDate: "",
                    testerName: "", testerEmail: "", engagementType: "Black Box",
                    username: "", password: ""
                });
            } else {
                const err = await res.json();
                toast({
                    variant: "destructive",
                    title: "Error creating project",
                    description: err.error || "Unknown error occurred"
                });
            }
        } catch (e) {
            toast({
                variant: "destructive",
                title: "Connection Error",
                description: "Could not reach the backend API."
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const stats = {
        total: projects.length,
        active: projects.filter(p => p.status === 'active').length,
        scans: projects.reduce((acc, p) => acc + (p.scansCount || 0), 0),
        reports: projects.reduce((acc, p) => acc + (p.reportsCount || 0), 0)
    };

    return (
        <div className="min-h-screen bg-background aurora-bg noise-texture p-6 lg:p-8">
            <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">

                {/* ── MISSION CONTROL HUD ── */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[
                        { label: "Total Engagements", value: stats.total, icon: Briefcase, color: "text-primary", bg: "bg-primary/10" },
                        { label: "Active Sessions", value: stats.active, icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                        { label: "Analysis Runs", value: stats.scans, icon: Target, color: "text-blue-400", bg: "bg-blue-500/10" },
                        { label: "Executive Reports", value: stats.reports, icon: ShieldCheck, color: "text-violet-400", bg: "bg-violet-500/10" }
                    ].map((stat, i) => (
                        <div key={i} className="card-premium p-5 flex items-center gap-4 group">
                            <div className={`w-12 h-12 rounded-xl border border-white/5 flex items-center justify-center ${stat.bg} group-hover:scale-110 transition-transform duration-300`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <div>
                                <div className="text-3xl font-black tabular-nums animate-count">{stat.value}</div>
                                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground opacity-70">{stat.label}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── HEADER & SEARCH ── */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-white/[0.07] pb-8 hex-grid-bg">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-black tracking-tighter">
                            PROJECT <span className="text-gradient-cyber">WORKSPACE</span>
                        </h1>
                        <p className="text-muted-foreground text-sm font-medium flex items-center gap-2">
                            <Globe className="w-4 h-4 text-primary" />
                            Manage and organize your VAPT security engagements
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="relative w-full sm:w-80 group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Search UUID, Client or Title..."
                                className="pl-10 h-11 bg-black/40 border-white/10 rounded-xl focus:border-primary/50 transition-all font-mono text-sm"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                            <DialogTrigger asChild>
                                <Button className="btn-cyber h-11 px-6 rounded-xl w-full sm:w-auto shadow-lg shadow-primary/20">
                                    <PlusCircle className="w-4 h-4 mr-2" />
                                    Launch New Project
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[750px] border-white/10 bg-[hsl(222,47%,5%)] backdrop-blur-2xl p-0 overflow-hidden rounded-3xl">
                                <div className="bg-gradient-to-r from-primary/20 via-transparent to-transparent p-6 border-b border-white/5">
                                    <DialogHeader>
                                        <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                                <Zap className="w-5 h-5 text-primary" />
                                            </div>
                                            NEW SECURITY <span className="text-gradient-cyber">ENGAGEMENT</span>
                                        </DialogTitle>
                                        <DialogDescription className="text-muted-foreground font-medium">
                                            Initialize a new VAPT project with multi-engine orchestration.
                                        </DialogDescription>
                                    </DialogHeader>
                                </div>
                                <form onSubmit={handleCreateProject} className="p-8 space-y-8 max-h-[75vh] overflow-y-auto custom-scrollbar">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Project Title</Label>
                                                <Input required placeholder="Ex: Q1 Infrastructure Audit" className="bg-white/[0.03] border-white/10 h-10 px-4 rounded-xl" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Company Name</Label>
                                                <Input required placeholder="Ex: Acme Global Inc." className="bg-white/[0.03] border-white/10 h-10 px-4 rounded-xl" value={formData.companyName} onChange={e => setFormData({ ...formData, companyName: e.target.value })} />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Target Scope (URLs)</Label>
                                                <Input required placeholder="https://app.target.com" className="bg-white/[0.03] border-white/10 h-10 px-4 rounded-xl font-mono text-sm" value={formData.targetUrls} onChange={e => setFormData({ ...formData, targetUrls: e.target.value })} />
                                            </div>
                                        </div>

                                        <div className="space-y-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Engagement Model</Label>
                                                <Select value={formData.engagementType} onValueChange={v => setFormData({ ...formData, engagementType: v })}>
                                                    <SelectTrigger className="bg-white/[0.03] border-white/10 h-10 rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-slate-950 border-white/10">
                                                        <SelectItem value="Black Box">Black Box (Zero-Knowledge)</SelectItem>
                                                        <SelectItem value="Grey Box">Grey Box (Partial Access)</SelectItem>
                                                        <SelectItem value="White Box">White Box (Full-Disclosure)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Assigned Lead</Label>
                                                <div className="relative group">
                                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary" />
                                                    <Input required placeholder="Tester Name" className="bg-white/[0.03] border-white/10 h-10 pl-10 rounded-xl" value={formData.testerName} onChange={e => setFormData({ ...formData, testerName: e.target.value })} />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Start Date</Label>
                                                    <Input type="date" className="bg-white/[0.03] border-white/10 h-10 px-3 rounded-xl text-xs" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Deadline</Label>
                                                    <Input type="date" className="bg-white/[0.03] border-white/10 h-10 px-3 rounded-xl text-xs" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Description & Scope Detail</Label>
                                        <Textarea placeholder="Define secondary objectives, excluded subdomains, or specific testing windows..." className="bg-white/[0.03] border-white/10 rounded-2xl min-h-[100px] p-4 text-sm" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                    </div>

                                    <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 to-transparent border border-red-500/15 space-y-4">
                                        <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-[0.15em]">
                                            <ShieldCheck className="w-4 h-4" /> TEST ACCESS CREDENTIALS
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <Input placeholder="Username / Login" className="bg-black/30 border-white/10 h-10 px-4 rounded-xl" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
                                            <Input type="password" placeholder="Password / Auth Key" className="bg-black/30 border-white/10 h-10 px-4 rounded-xl" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground italic tracking-wide">
                                            * Credentials will be AES-256 encrypted before persistence.
                                        </p>
                                    </div>
                                </form>
                                <div className="p-6 bg-black/40 border-t border-white/5 flex justify-end gap-3">
                                    <Button variant="ghost" className="rounded-xl px-6 font-semibold" onClick={() => setIsCreateModalOpen(false)}>Abort</Button>
                                    <Button className="btn-cyber rounded-xl px-8 min-w-[160px]" onClick={handleCreateProject} disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                                        INITIALIZE PROJECT
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>

                {/* ── PROJECTS GRID ── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-96 card-premium border-dashed">
                        <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin mb-4 shadow-[0_0_15px_hsl(199,89%,48%,0.3)]" />
                        <p className="text-xs font-mono text-primary/60 tracking-widest animate-pulse">WORKSPACE SYNCING...</p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-96 card-premium border-dashed gap-4 text-center p-8">
                        <div className="w-20 h-20 rounded-3xl bg-white/[0.03] flex items-center justify-center border border-white/5">
                            <FolderOpen className="w-10 h-10 text-muted-foreground/30" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black tracking-tight mb-2">NO ACTIVE ENGAGEMENTS</h3>
                            <p className="text-muted-foreground text-sm max-w-sm">
                                {searchQuery ? "Your search query yielded zero results." : "Initialize your first project to begin professional vulnerability assessments."}
                            </p>
                        </div>
                        {!searchQuery && (
                            <Button className="btn-cyber mt-2 rounded-xl" onClick={() => setIsCreateModalOpen(true)}>
                                Create Project →
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredProjects.map((project, idx) => (
                            <motion.div
                                key={project.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.05 }}
                                className={`card-premium group relative ${project.status === 'active' ? 'accent-bar-active' : 'accent-bar-default'
                                    }`}
                            >
                                <div className="p-6 space-y-5">
                                    {/* Project Header */}
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors truncate">
                                                {project.title}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] font-mono font-bold text-primary px-1.5 py-0.5 bg-primary/10 rounded">#{project.id.slice(0, 8)}</span>
                                                <span className="text-[10px] font-mono text-muted-foreground">{project.companyName}</span>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className={`h-6 text-[10px] border-none font-black uppercase tracking-widest px-3 ${project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                                            }`}>
                                            {project.status}
                                        </Badge>
                                    </div>

                                    {/* Target Mono Box */}
                                    <div className="relative group/tag">
                                        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent scale-x-0 group-hover/tag:scale-x-100 transition-transform duration-500" />
                                        <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center gap-3">
                                            <Target className="w-4 h-4 text-primary opacity-60 group-hover/tag:opacity-100 transition-opacity" />
                                            <span className="text-xs font-mono text-foreground/80 truncate">
                                                {Array.isArray(project.targetUrls) ? project.targetUrls[0] : project.targetUrls}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 group-hover:bg-primary/5 transition-colors">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Activity className="w-3.5 h-3.5 text-blue-400" />
                                                <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Scans</span>
                                            </div>
                                            <div className="text-2xl font-black font-mono text-blue-400">{project.scansCount || 0}</div>
                                        </div>
                                        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5 group-hover:bg-primary/5 transition-colors">
                                            <div className="flex items-center gap-2 mb-1">
                                                <FileText className="w-3.5 h-3.5 text-violet-400" />
                                                <span className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">Reports</span>
                                            </div>
                                            <div className="text-2xl font-black font-mono text-violet-400">{project.reportsCount || 0}</div>
                                        </div>
                                    </div>

                                    {/* Enter Button */}
                                    <Button
                                        className="w-full h-11 rounded-xl bg-white/[0.05] border border-white/5 group-hover:btn-cyber group-hover:shadow-lg group-hover:shadow-primary/10 transition-all font-bold text-sm"
                                        onClick={() => navigate(`/projects/${project.id}`)}
                                    >
                                        ENTER CONSOLE
                                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

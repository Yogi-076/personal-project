import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Config } from "@/config";
import {
    Target, PlusCircle, FolderOpen, Activity, ArrowRight,
    ShieldCheck, Search, Loader2, Briefcase, Globe,
    LayoutGrid, Users, Zap, FileText, Trash2
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
import { validateUrl, validateEmail, sanitizeString } from "@/lib/validation";

import { useAuth } from "@/contexts/AuthContext";

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
    const { user } = useAuth();
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Dynamic dates
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(today.getDate() + 14); // Default to 2-week engagement

    // New Project Form State
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        companyName: "",
        targetUrls: [""], // Dynamic array instead of string
        startDate: today.toISOString().split('T')[0],
        endDate: futureDate.toISOString().split('T')[0],
        testerName: user?.email ? user.email.split('@')[0] : "", // Auto-fill from auth
        testerEmail: user?.email || "",
        engagementType: "Black Box",
        username: "",
        password: ""
    });


    useEffect(() => {
        fetchProjects();
    }, []);

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${Config.API_URL}/api/projects`);
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
            const cleanTitle = sanitizeString(formData.title, 100);
            const cleanCompanyName = sanitizeString(formData.companyName, 100);
            const cleanTesterName = sanitizeString(formData.testerName, 100);
            const cleanTesterEmail = sanitizeString(formData.testerEmail, 100);
            const cleanDescription = sanitizeString(formData.description, 2000);

            if (!cleanTitle || !cleanCompanyName || !cleanTesterName) {
                setIsSubmitting(false);
                return toast({ variant: "destructive", title: "Missing Data", description: "Please fill in all required fields." });
            }

            if (cleanTesterEmail && !validateEmail(cleanTesterEmail)) {
                setIsSubmitting(false);
                return toast({ variant: "destructive", title: "Invalid Email", description: "Tester email format is incorrect." });
            }

            const urlList = formData.targetUrls.map(s => s.trim()).filter(s => s);
            if (urlList.length === 0) {
                setIsSubmitting(false);
                return toast({ variant: "destructive", title: "Missing Scope", description: "At least one target URL is required." });
            }

            for (const url of urlList) {
                if (!validateUrl(url)) {
                    setIsSubmitting(false);
                    return toast({ variant: "destructive", title: "Invalid URL", description: `Malformed target URL: ${url}` });
                }
            }


            if (formData.endDate && new Date(formData.endDate) < new Date(formData.startDate)) {
                setIsSubmitting(false);
                return toast({ variant: "destructive", title: "Invalid Dates", description: "Deadline cannot be before the start date." });
            }

            const payload = {
                title: cleanTitle,
                description: cleanDescription,
                companyName: cleanCompanyName,
                targetUrls: urlList,
                startDate: formData.startDate,
                endDate: formData.endDate,
                testerName: cleanTesterName,
                testerEmail: cleanTesterEmail,
                engagementType: formData.engagementType,
                credentials: {
                    username: sanitizeString(formData.username, 50),
                    password: formData.password
                }
            };

            const res = await fetch(`${Config.API_URL}/api/projects`, {
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
                    title: "", description: "", companyName: "", targetUrls: [""],
                    startDate: today.toISOString().split('T')[0], endDate: futureDate.toISOString().split('T')[0],
                    testerName: user?.email ? user.email.split('@')[0] : "", testerEmail: user?.email || "", engagementType: "Black Box",
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

    const handleDeleteProject = async (projectId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevents click from bubbling to the parent
        if (!window.confirm("Are you sure you want to permanently delete this project and all its data?")) return;

        setDeletingId(projectId);
        try {
            const res = await fetch(`${Config.API_URL}/api/projects/${projectId}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toast({
                    title: "Project Deleted",
                    description: "The project has been permanently removed.",
                });
                fetchProjects(); // refresh the list
            } else {
                const err = await res.json();
                toast({
                    variant: "destructive",
                    title: "Error deleting project",
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
            setDeletingId(null);
        }
    };

    const filteredProjects = projects.filter(p =>
        (p.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.companyName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.id || "").toLowerCase().includes(searchQuery.toLowerCase())
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
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.4 }}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="card-premium p-5 flex items-center gap-4 group cursor-pointer"
                        >
                            <div className={`w-12 h-12 rounded-xl border border-white/5 flex items-center justify-center ${stat.bg} group-hover:scale-110 shadow-lg group-hover:shadow-primary/5 transition-all duration-300`}>
                                <stat.icon className={`w-6 h-6 ${stat.color} group-hover:animate-pulse`} />
                            </div>
                            <div>
                                <div className={`text-3xl font-black tabular-nums tracking-tighter ${stat.color}`}>{stat.value}</div>
                                <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground opacity-50">{stat.label}</div>
                            </div>
                        </motion.div>
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
                                            <div className="space-y-1.5 p-4 rounded-xl border border-white/10 bg-white/[0.01]">
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                                        <Globe className="w-4 h-4 text-primary" /> Target Scope (URLs)
                                                    </Label>
                                                    <Badge variant="outline" className="text-[9px] font-mono border-white/10">{formData.targetUrls.length} Target(s)</Badge>
                                                </div>
                                                <div className="space-y-3 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                                                    <AnimatePresence>
                                                        {formData.targetUrls.map((url, i) => (
                                                            <motion.div
                                                                key={i}
                                                                initial={{ opacity: 0, height: 0, scale: 0.95 }}
                                                                animate={{ opacity: 1, height: "auto", scale: 1 }}
                                                                exit={{ opacity: 0, height: 0, scale: 0.95 }}
                                                                className="relative flex items-center gap-2"
                                                            >
                                                                <Input 
                                                                    required={i === 0} 
                                                                    placeholder="https://app.target.com" 
                                                                    className="bg-black/40 border-white/10 h-10 px-4 rounded-lg font-mono text-sm flex-1 focus:border-primary/50 transition-colors" 
                                                                    value={url} 
                                                                    onChange={e => {
                                                                        const newUrls = [...formData.targetUrls];
                                                                        newUrls[i] = e.target.value;
                                                                        setFormData({ ...formData, targetUrls: newUrls });
                                                                    }} 
                                                                />
                                                                {formData.targetUrls.length > 1 && (
                                                                    <Button 
                                                                        type="button"
                                                                        variant="ghost" 
                                                                        size="icon" 
                                                                        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg"
                                                                        onClick={() => {
                                                                            const newUrls = [...formData.targetUrls];
                                                                            newUrls.splice(i, 1);
                                                                            setFormData({ ...formData, targetUrls: newUrls });
                                                                        }}
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </motion.div>
                                                        ))}
                                                    </AnimatePresence>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="secondary" 
                                                    size="sm" 
                                                    className="w-full mt-2 h-9 border border-white/5 bg-white/5 hover:bg-white/10 text-xs font-semibold rounded-lg text-primary"
                                                    onClick={() => setFormData({ ...formData, targetUrls: [...formData.targetUrls, ""] })}
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5 mr-2" /> Add Target URL
                                                </Button>
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
                        <AnimatePresence mode="popLayout">
                            {filteredProjects.map((project, idx) => (
                                <motion.div
                                    key={project.id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                    transition={{
                                        delay: idx * 0.05,
                                        type: "spring",
                                        stiffness: 260,
                                        damping: 20
                                    }}
                                    className={`card-premium group relative cursor-pointer overflow-hidden ${project.status === 'active' ? 'accent-bar-active' : 'accent-bar-default'
                                        }`}
                                    whileHover={{ y: -8, transition: { duration: 0.2 } }}
                                >
                                    {/* Subtle Background Shimmer */}
                                    <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                                    <div className="p-6 space-y-5 relative z-10">
                                        {/* Project Header */}
                                        <div className="flex justify-between items-start gap-4">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-xl font-black text-foreground group-hover:text-primary transition-colors truncate tracking-tight">
                                                    {project.title}
                                                </h3>
                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[10px] font-black text-primary px-1.5 py-0.5 bg-primary/10 rounded uppercase tracking-tighter">#{project.id.slice(0, 8)}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground font-bold">{project.companyName}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`h-6 text-[10px] border-none font-black uppercase tracking-widest px-3 ${project.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                                                    }`}>
                                                    {project.status}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all active:scale-90"
                                                    onClick={(e) => handleDeleteProject(project.id, e)}
                                                    disabled={deletingId === project.id}
                                                    title="Delete Project"
                                                >
                                                    {deletingId === project.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Target Mono Box */}
                                        <div className="relative group/tag">
                                            <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent scale-x-0 group-hover/tag:scale-x-100 transition-transform duration-500" />
                                            <div className="p-3 rounded-xl bg-black/60 border border-white/5 flex items-center gap-3 transition-colors group-hover/tag:border-primary/20">
                                                <Target className="w-4 h-4 text-primary opacity-40 group-hover/tag:opacity-100 transition-all group-hover/tag:scale-110" />
                                                <span className="text-xs font-mono text-foreground/70 truncate group-hover/tag:text-foreground">
                                                    {Array.isArray(project.targetUrls) ? project.targetUrls[0] : project.targetUrls}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 group-hover:bg-primary/5 transition-all group-hover:border-primary/10">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <Activity className="w-3.5 h-3.5 text-blue-400/70" />
                                                    <span className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Scans</span>
                                                </div>
                                                <div className="text-2xl font-black font-mono text-blue-400">{project.scansCount || 0}</div>
                                            </div>
                                            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 group-hover:bg-primary/5 transition-all group-hover:border-primary/10">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <FileText className="w-3.5 h-3.5 text-violet-400/70" />
                                                    <span className="text-[9px] uppercase font-black tracking-[0.2em] text-muted-foreground/50">Reports</span>
                                                </div>
                                                <div className="text-2xl font-black font-mono text-violet-400">{project.reportsCount || 0}</div>
                                            </div>
                                        </div>

                                        {/* Enter Button */}
                                        <Button
                                            className="w-full h-11 rounded-xl bg-white/[0.03] border border-white/5 group-hover:btn-cyber group-hover:shadow-2xl group-hover:shadow-primary/20 transition-all font-black text-[11px] tracking-widest"
                                            onClick={() => navigate(`/projects/${project.id}`)}
                                        >
                                            ACCESS CONTROL PANEL
                                            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1.5 transition-transform" />
                                        </Button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
}

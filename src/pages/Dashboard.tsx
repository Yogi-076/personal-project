import { useEffect, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, LogOut, User, BarChart3, Globe, Settings, FileText,
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock,
  Wrench, ChevronRight, LayoutGrid, Menu, Database, Zap
} from "lucide-react";
import { TopCriticalFixes } from "@/components/dashboard/TopCriticalFixes";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Config } from "@/config";
import { CyberGrid } from "@/components/CyberGrid";
import { useToast } from "@/hooks/use-toast";
import { VMTSpreadsheet } from "@/components/VMTSpreadsheet";
import { scannerApi, vmtApi } from "@/lib/api_vmt";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { VaptFlowchart } from "@/components/dashboard/VaptFlowchart";
import { ThreatTopologyChart } from "@/components/dashboard/ThreatTopologyChart";

const Dashboard = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const getSectionFromPath = (path: string) => {
    if (path.includes("/vmt")) return "VMT";
    if (path.includes("/projects")) return "Projects";
    if (path.includes("/scans") || path.includes("/scanner")) return "Scans";
    if (path.includes("/reports")) return "Reports";
    if (path.includes("/analytics")) return "Analytics";
    if (path.includes("/settings")) return "Settings";
    if (path.includes("/tools")) return "Tools";
    return "Dashboard";
  };

  const [activeSection, setActiveSection] = useState(getSectionFromPath(location.pathname));
  const [isLive, setIsLive] = useState(true);

  // Dynamic dates
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + 14); // Default to 2-week engagement

  // New Project State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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


  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        companyName: formData.companyName,
        targetUrls: formData.targetUrls.map(s => s.trim()).filter(s => s),
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
        setFormData({
          title: "", description: "", companyName: "", targetUrls: [""],
          startDate: today.toISOString().split('T')[0], endDate: futureDate.toISOString().split('T')[0],
          testerName: user?.email ? user.email.split('@')[0] : "", testerEmail: user?.email || "", engagementType: "Black Box",
          username: "", password: ""
        });

        navigate(`/projects/${data.projectId}`);
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

  useEffect(() => {
    setActiveSection(getSectionFromPath(location.pathname));
  }, [location.pathname]);

  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState([
    { icon: Shield, label: "Total Scans", value: "0", color: "text-primary" },
    { icon: XCircle, label: "Critical", value: "0", color: "text-red-400" },
    { icon: AlertTriangle, label: "High/Medium", value: "0", color: "text-amber-400" },
    { icon: CheckCircle2, label: "Resolved", value: "0", color: "text-green-400" },
  ]);

  const fetchDashboardData = async () => {
    try {
      const data = await scannerApi.getHistory();
      setHistory(data);
      let critical = 0, highMedium = 0, resolved = 0;
      data.forEach((scan: any) => {
        if (scan.summary) {
          critical += (scan.summary.critical || 0);
          highMedium += (scan.summary.high || 0) + (scan.summary.medium || 0);
        }
        if (scan.status === 'completed') resolved++;
      });
      setStats([
        { icon: Shield, label: "Total Scans", value: String(data.length), color: "text-primary" },
        { icon: XCircle, label: "Critical", value: String(critical), color: "text-red-400" },
        { icon: AlertTriangle, label: "High/Medium", value: String(highMedium), color: "text-amber-400" },
        { icon: CheckCircle2, label: "Resolved", value: String(resolved), color: "text-green-400" },
      ]);
    } catch (e) {
      console.error("Dashboard fetch error", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchDashboardData();
      const interval = setInterval(fetchDashboardData, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('createProject') === 'true') {
      setIsCreateModalOpen(true);
      // Clean up the URL
      navigate(location.pathname, { replace: true });
    }
  }, [location.search]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleMenuClick = (label: string) => {
    setActiveSection(label);
    if (label === "Scans") { navigate("/scanner"); return; }
    toast({ title: `Navigating to ${label}`, description: `Loading ${label.toLowerCase()} section...` });
  };

  const handleNewScan = () => navigate("/scanner");

  const handleQuickAction = (title: string) => {
    toast({ title, description: `Opening ${title.toLowerCase()}...` });
    if (title === "View Reports") setActiveSection("Reports");
    else if (title === "Configure Settings") setActiveSection("Settings");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin shadow-[0_0_16px_hsl(199_89%_48%/0.3)]" />
          <p className="text-xs font-mono text-primary/60 tracking-widest animate-pulse">LOADING CONSOLE...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const menuItems = [
    { icon: BarChart3, label: "Dashboard", path: "/dashboard", active: activeSection === "Dashboard" },
    { icon: LayoutGrid, label: "Projects", path: "/projects", active: activeSection === "Projects" },
    { icon: Globe, label: "Scans", path: "/scanner", active: activeSection === "Scans" },
    { icon: FileText, label: "Reports", path: "/reports", active: activeSection === "Reports" },
    { icon: Activity, label: "Analytics", path: "/analytics", active: activeSection === "Analytics" },
    { icon: Settings, label: "Settings", path: "/settings", active: activeSection === "Settings" },
    { icon: Wrench, label: "Arsenal", path: "/tools", active: activeSection === "Tools" },
    { icon: Database, label: "VMT", path: "/vmt", active: activeSection === "VMT" },
  ];

  // Stat card color map
  const statStyle: Record<string, { bg: string; border: string; iconBg: string }> = {
    "text-primary": { bg: "from-primary/8 to-primary/2", border: "border-primary/15", iconBg: "bg-primary/10 border-primary/20" },
    "text-red-400": { bg: "from-red-500/8 to-red-500/2", border: "border-red-500/15", iconBg: "bg-red-500/10 border-red-500/20" },
    "text-amber-400": { bg: "from-amber-500/8 to-amber-500/2", border: "border-amber-500/15", iconBg: "bg-amber-500/10 border-amber-500/20" },
    "text-green-400": { bg: "from-green-500/8 to-green-500/2", border: "border-green-500/15", iconBg: "bg-green-500/10 border-green-500/20" },
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── PREMIUM SIDEBAR ── */}
      <motion.aside
        className="w-64 border-r border-white/[0.07] bg-[hsl(222_47%_5%)] p-5 hidden lg:flex flex-col"
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 cursor-pointer group" onClick={() => navigate("/")}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center group-hover:border-primary/60 transition-all shadow-[0_0_16px_hsl(199_89%_48%/0.12)]">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="leading-none">
            <div className="font-black text-base tracking-tight">
              <span className="text-gradient-cyber">Vajra</span><span className="text-foreground">Scan</span>
            </div>
            <div className="text-[9px] font-mono text-primary/50 tracking-[0.15em] uppercase mt-0.5">VAPT Platform</div>
          </div>
        </div>

        {/* Nav items */}
        <nav className="flex-1 space-y-1">
          {menuItems.map((item, idx) => (
            <motion.div
              key={item.label}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 + idx * 0.05 }}
            >
              <Link
                to={item.path}
                onClick={() => setActiveSection(item.label)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group/nav relative overflow-hidden",
                  item.active
                    ? "sidebar-item-active bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                {/* Hover Glow Effect */}
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover/nav:opacity-100 transition-opacity duration-500" />
                <item.icon className={cn(
                  "w-4 h-4 shrink-0 transition-transform duration-300 group-hover/nav:scale-110",
                  item.active ? "text-primary" : "group-hover/nav:text-primary/70"
                )} />
                <span className="relative z-10">{item.label}</span>
                {item.active && (
                  <motion.span
                    layoutId="active-indicator"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(6,182,212,0.8)]"
                  />
                )}
              </Link>
            </motion.div>
          ))}
        </nav>

        {/* User info */}
        <div className="pt-4 border-t border-white/[0.07] space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{user.email}</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                Security Analyst
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="w-full text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl text-xs justify-start gap-2"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </Button>
        </div>
      </motion.aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 p-3 lg:p-8 relative min-w-0 overflow-hidden">
        <CyberGrid />

        <div className="relative z-10 max-w-6xl mx-auto">

          {/* Mobile header */}
          <div className="lg:hidden mb-6 flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-primary" />
              <span className="font-bold text-gradient-cyber tracking-tight">VajraScan</span>
            </div>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon"><Menu className="w-6 h-6" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="bg-[hsl(222_47%_5%)] border-r border-white/10 p-0">
                <div className="p-6 h-full flex flex-col">
                  <div className="flex items-center gap-3 mb-8">
                    <Shield className="w-6 h-6 text-primary" />
                    <span className="font-black text-gradient-cyber">VajraScan</span>
                  </div>
                  <nav className="flex-1 space-y-1">
                    {menuItems.map((item) => (
                      <SheetTrigger key={item.label} asChild>
                        <Link
                          to={item.path}
                          onClick={() => setActiveSection(item.label)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${item.active ? "sidebar-item-active" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                            }`}
                        >
                          <item.icon className={`w-4 h-4 ${item.active ? "text-primary" : ""}`} />
                          {item.label}
                        </Link>
                      </SheetTrigger>
                    ))}
                  </nav>
                  <Button variant="ghost" onClick={handleSignOut} className="mt-auto text-red-400 hover:bg-red-500/10">
                    <LogOut className="w-4 h-4 mr-2" /> Sign Out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Header */}
          {activeSection === "VMT" ? (
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className="text-2xl sm:text-3xl font-black mb-2 flex flex-wrap items-center tracking-tighter"
                >
                  <span className="text-gradient-danger mr-2">V</span>ULNERABILITY
                  <span className="w-2 sm:w-4" />
                  <span className="text-gradient-violet mr-2">M</span>ANAGEMENT
                </motion.h1>
                <div className="flex items-center gap-3 text-muted-foreground text-[10px] font-mono mt-2 tracking-[0.2em] uppercase opacity-70">
                  <span className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                    SOC ACTIVE
                  </span>
                  <span className="w-[1px] h-3 bg-white/10" />
                  <span>LEVEL 5</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:gap-3">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full sm:w-auto border-white/10 bg-white/5 rounded-xl transition-all h-10 px-4 sm:px-5 text-xs sm:text-sm",
                      isLive ? 'text-primary border-primary/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : 'text-muted-foreground'
                    )}
                    onClick={() => { setIsLive(!isLive); toast({ title: isLive ? "Live Feed Paused" : "Live Feed Active" }); }}
                  >
                    <Activity className={cn("w-4 h-4 mr-2", isLive ? 'animate-pulse' : '')} />
                    {isLive ? "LIVE STREAM" : "CONNECT FEED"}
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex-1 sm:flex-none">
                  <Button className="btn-cyber w-full sm:w-auto h-10 px-4 sm:px-6 rounded-xl shadow-lg shadow-primary/20 text-xs sm:text-sm" onClick={() => toast({ title: "Auto-Mitigation Initiated", description: "AI Agents deployed..." })}>
                    <Shield className="w-4 h-4 mr-2" /> AUTO-MITIGATE
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              className="mb-8"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl font-black text-foreground mb-1 tracking-tighter uppercase">
                {activeSection === "Dashboard" ? (
                  <><span className="text-gradient-cyber">SECURITY</span> HUB</>
                ) : activeSection.toUpperCase()}
              </h1>
              <p className="text-[11px] font-mono text-muted-foreground/50 uppercase tracking-widest mt-1">
                {activeSection === "Dashboard"
                  ? "Vulnerability Intelligence & Real-Time Orchestration"
                  : `Managing ${activeSection.toLowerCase()} environment`}
              </p>
            </motion.div>
          )}

          {/* Main View Area */}
          <AnimatePresence mode="wait">
            {activeSection === "Dashboard" && (
              <motion.div key="dashboard-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>

                {/* Top Critical Fixes Widget */}
                {history.length > 0 && history[0].findings && (
                  <TopCriticalFixes findings={history[0].findings} />
                )}

                {/* ── Premium Stats Grid ── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  {stats.map((stat, idx) => {
                    const s = statStyle[stat.color] || statStyle["text-primary"];
                    return (
                      <motion.div
                        key={stat.label}
                        className={cn(
                          "group p-5 rounded-2xl bg-gradient-to-br border cursor-pointer transition-all duration-500 hover:shadow-2xl",
                          s.bg, s.border,
                          stat.color === 'text-primary' ? 'hover:shadow-primary/10' :
                            stat.color === 'text-red-400' ? 'hover:shadow-red-500/10' :
                              stat.color === 'text-amber-400' ? 'hover:shadow-amber-500/10' : 'hover:shadow-green-500/10'
                        )}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.2 + idx * 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                        whileHover={{ y: -5, scale: 1.02 }}
                        onClick={() => toast({ title: stat.label, description: `${stat.value} ${stat.label.toLowerCase()} recorded` })}
                      >
                        <div className={cn("w-10 h-10 rounded-xl border flex items-center justify-center mb-4 transition-transform group-hover:scale-110", s.iconBg)}>
                          <stat.icon className={cn("w-5 h-5", stat.color)} />
                        </div>
                        <div className={cn("text-4xl font-black tabular-nums tracking-tighter", stat.color)}>{stat.value}</div>
                        <div className="text-[10px] text-muted-foreground/60 mt-2 font-black uppercase tracking-widest">{stat.label}</div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* ── Visual Intelligence Area ── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="lg:col-span-2">
                    <VaptFlowchart />
                  </div>
                  <div className="lg:col-span-1">
                    <ThreatTopologyChart />
                  </div>
                </div>

                {/* ── Dashboard Quick Actions ── */}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                    <DialogTrigger asChild>
                      <button className="card-premium shimmer-effect p-6 text-left group w-full bg-gradient-to-br from-blue-600/15 to-transparent">
                        <div className="w-12 h-12 rounded-xl border flex items-center justify-center mb-4 bg-blue-500/10 border-blue-500/20 group-hover:scale-110 transition-transform duration-300">
                          <PlusCircle className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="font-bold text-foreground mb-1">Create Project</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">Initialize a new VAPT security engagement</p>
                        <div className="mt-3 text-xs font-mono font-semibold text-blue-400 opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1 duration-200">
                          + New Project
                        </div>
                      </button>
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
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary" />
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
                            <Shield className="w-4 h-4" /> TEST ACCESS CREDENTIALS
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

                  {[
                    { title: "View Reports", description: "Access detailed VAPT assessment reports", icon: FileText, gradient: "from-indigo-600/15 to-transparent", iconBg: "bg-indigo-500/10 border-indigo-500/20", iconColor: "text-indigo-400", label: "→ Reports" },
                    { title: "Configure Settings", description: "Manage scanner configuration & API keys", icon: Settings, gradient: "from-slate-600/15 to-transparent", iconBg: "bg-slate-500/10 border-slate-500/20", iconColor: "text-slate-400", label: "→ Config" },
                  ].map((action) => (
                    <button
                      key={action.title}
                      onClick={() => handleQuickAction(action.title)}
                      className={`card-premium shimmer-effect p-6 text-left group w-full bg-gradient-to-br ${action.gradient}`}
                    >
                      <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${action.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                        <action.icon className={`w-6 h-6 ${action.iconColor}`} />
                      </div>
                      <h3 className="font-bold text-foreground mb-1">{action.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
                      <div className={`mt-3 text-xs font-mono font-semibold ${action.iconColor} opacity-0 group-hover:opacity-100 transition-all translate-x-0 group-hover:translate-x-1 duration-200`}>
                        {action.label}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {activeSection === "Reports" && (
              <motion.div key="reports-view" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                <div className="card-premium p-8 text-center">
                  <FileText className="w-16 h-16 text-primary/40 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold mb-2">Vulnerability Reports</h2>
                  <p className="text-muted-foreground mb-6">Access and export detailed security reports.</p>
                  <Button className="btn-cyber rounded-xl" onClick={() => navigate("/scanner")}>View Scanner Reports</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {history.filter(s => s.status === 'completed').slice(0, 4).map(scan => (
                    <div key={scan.id} className="card-premium p-4 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary" />
                        <div>
                          <p className="font-semibold text-sm group-hover:text-primary transition-colors">{scan.target}</p>
                          <p className="text-xs text-muted-foreground">{new Date(scan.startedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => navigate("/scanner")}>Open</Button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeSection === "Analytics" && (
              <motion.div key="analytics-view" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 card-premium p-6 h-[400px] flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" /> Security Trends
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">Vulnerability findings over time</p>
                    </div>
                    <div className="flex-1 flex items-end justify-between gap-2 px-4 py-8">
                      {history.slice(0, 12).map((h, i) => {
                        const height = Math.min(100, Math.max(10, (h.summary?.total || 0) * 2));
                        return (
                          <div key={i} className="w-full bg-primary/10 rounded-t-sm relative group">
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${height}%` }}
                              className="bg-gradient-to-t from-primary to-primary/60 rounded-t-sm"
                            />
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-popover text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                              {h.summary?.total || 0}
                            </div>
                          </div>
                        );
                      })}
                      {history.length === 0 && <div className="text-muted-foreground w-full text-center text-sm">No data yet.</div>}
                    </div>
                  </div>
                  <div className="card-premium p-6">
                    <h3 className="font-bold mb-6">Risk Distribution</h3>
                    <div className="space-y-4">
                      {(() => {
                        let c = 0, h = 0, m = 0, l = 0;
                        history.forEach(scan => { c += (scan.summary?.critical || 0); h += (scan.summary?.high || 0); m += (scan.summary?.medium || 0); l += (scan.summary?.low || 0); });
                        const total = Math.max(1, c + h + m + l);
                        return [
                          { label: 'Critical', value: c, color: 'bg-red-500', text: 'text-red-400' },
                          { label: 'High', value: h, color: 'bg-orange-500', text: 'text-orange-400' },
                          { label: 'Medium', value: m, color: 'bg-amber-500', text: 'text-amber-400' },
                          { label: 'Low', value: l, color: 'bg-blue-500', text: 'text-blue-400' },
                        ].map(item => (
                          <div key={item.label} className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className={item.text}>{item.label}</span>
                              <span className="text-muted-foreground">{item.value} ({Math.round(item.value / total * 100)}%)</span>
                            </div>
                            <div className="h-2 bg-secondary rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${(item.value / total) * 100}%` }} className={`h-full ${item.color}`} />
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "Settings" && (
              <motion.div key="settings-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="card-premium p-6 space-y-4">
                    <h3 className="font-bold text-lg flex items-center gap-2"><User className="w-5 h-5 text-primary" /> User Profile</h3>
                    <div className="space-y-2"><label className="text-xs text-muted-foreground uppercase tracking-wider">Email</label><Input value={user.email || ''} readOnly className="bg-black/50 font-mono border-white/10" /></div>
                    <div className="space-y-2"><label className="text-xs text-muted-foreground uppercase tracking-wider">Role</label><Input value="Security Administrator" readOnly className="bg-black/50 font-mono border-white/10" /></div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeSection === "Tools" && (
              <div className="card-premium flex flex-col items-center justify-center h-64 space-y-4 text-muted-foreground">
                <Wrench className="w-12 h-12 opacity-20 text-primary" />
                <p className="text-sm">Advanced Arsenal ready for deployment.</p>
                <Button className="btn-cyber rounded-xl px-6" onClick={() => navigate("/tools")}>Launch Arsenal Console</Button>
              </div>
            )}

            {activeSection === "VMT" && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col gap-6 relative">
                <AnimatePresence>
                  {isLive && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="bg-black/90 border border-primary/20 rounded-xl font-mono text-xs overflow-hidden">
                      <div className="p-4 h-32 overflow-y-auto space-y-1">
                        <p className="text-primary animate-pulse">&gt;&gt;&gt; ESTABLISHING SECURE UPLINK...</p>
                        <p className="text-emerald-400">[SUCCESS] FEED CONNECTED.</p>
                        <p className="text-slate-400">&gt; DETECTED IP: 192.168.1.45 [SUSPICIOUS]</p>
                        <p className="text-amber-400">&gt; ALERT: NEW VULN SIGNATURE (CVE-2024-9921)</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { label: "Active Project", value: "Acme Corp", color: "text-white", sub: "Production", icon: Globe },
                    { label: "Critical Findings", value: "3", color: "text-red-500", sub: "+1 this hour", icon: AlertTriangle },
                    { label: "Mitigation Rate", value: "85%", color: "text-primary", sub: "Top 5% Industry", icon: Activity },
                    { label: "AI Engine", value: "Active", color: "text-violet-400", sub: "Neural v2", icon: Shield },
                  ].map((stat, i) => (
                    <div key={i} className="stat-card-premium card-premium p-4 relative overflow-hidden">
                      <div className="relative z-10 flex justify-between items-start">
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1 font-mono">{stat.label}</p>
                          <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                          <p className="text-[10px] text-slate-500 mt-1">{stat.sub}</p>
                        </div>
                        <stat.icon className={`w-5 h-5 ${stat.color} opacity-50`} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="h-[calc(100vh-22rem)] min-h-[500px] rounded-2xl overflow-hidden shadow-2xl border border-white/10 relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-violet-500/20 blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
                  <VMTSpreadsheet />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

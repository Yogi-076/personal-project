import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { motion } from "framer-motion";
import { Shield, ShieldCheck, LayoutDashboard, Terminal, Activity, FileCode, Wrench, ChevronRight, Search, Globe, Layers, Ghost, Gift, FolderSearch, Key, Package, Menu, Target, Lock } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { CyberGrid } from "@/components/CyberGrid";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppSidebar } from "@/components/AppSidebar";
import { AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";

// Lazy Loaded Arsenal Components
const Forrecon = lazy(() => import("@/components/arsenal/Forrecon").then(m => ({ default: m.Forrecon })));
const AetherCore = lazy(() => import("@/components/arsenal/AetherCore").then(m => ({ default: m.AetherCore })));
const PayloadForge = lazy(() => import("@/components/arsenal/PayloadForge").then(m => ({ default: m.PayloadForge })));
const JWTMaster = lazy(() => import("./JWTMaster").then(m => ({ default: m.JWTMaster })));
const HeaderChecker = lazy(() => import("@/components/arsenal/HeaderChecker").then(m => ({ default: m.HeaderChecker })));
const Clickjacking = lazy(() => import("@/components/arsenal/Clickjacking").then(m => ({ default: m.Clickjacking })));
const ArsenalPipeline = lazy(() => import("@/components/arsenal/ArsenalPipeline").then(m => ({ default: m.ArsenalPipeline })));
const Gitleaks = lazy(() => import("@/components/arsenal/Gitleaks").then(m => ({ default: m.Gitleaks })));

const ToolSkeleton = () => (
    <div className="w-full h-full flex flex-col gap-6 animate-pulse p-4">
        <div className="h-24 bg-white/5 rounded-2xl border border-white/10" />
        <div className="flex-1 grid grid-cols-12 gap-6">
            <div className="col-span-4 bg-white/5 rounded-2xl border border-white/10" />
            <div className="col-span-8 bg-white/5 rounded-2xl border border-white/10" />
        </div>
    </div>
);

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 text-red-500 bg-black/50 border border-red-500/20 rounded-lg m-4 backdrop-blur-md">
                    <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                        <Shield className="w-5 h-5" /> Module Crash Detected
                    </h2>
                    <p className="text-sm mb-4 text-muted-foreground">The security tool encountered a critical runtime error.</p>
                    <pre className="whitespace-pre-wrap font-mono text-xs bg-black/80 p-4 rounded text-red-400 border border-red-500/30 overflow-auto max-h-[400px]">
                        {this.state.error?.toString()}
                        {this.state.error?.stack}
                    </pre>
                    <button
                        onClick={() => this.setState({ hasError: false })}
                        className="mt-4 px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded hover:bg-red-500/30 text-xs font-bold uppercase transition-colors"
                    >
                        Try Restarting Module
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

const Tools = () => {
    const [searchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState("forrecon");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        const toolParam = searchParams.get("tool");
        if (toolParam) {
            setActiveTab(toolParam);
        }
    }, [searchParams]);

    return (
        <div className="h-screen bg-background text-foreground flex overflow-hidden">
            <CyberGrid />
            <AppSidebar mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

            <main className="flex-1 relative z-10 flex flex-col h-full overflow-hidden p-4 lg:p-6">
                <div className="flex-none mb-4">
                    {/* Compact Header */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-muted rounded-md lg:hidden">
                                <Menu className="w-5 h-5" />
                            </button>
                            <div>
                                <motion.div
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="flex items-center gap-2 text-primary mb-1"
                                >
                                    <Wrench className="w-4 h-4" />
                                    <span className="text-xs font-bold uppercase tracking-widest">Arsenal</span>
                                </motion.div>
                                <motion.h1
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-2xl font-extrabold tracking-tight"
                                >
                                    Advanced <span className="text-primary italic">Exploitation</span> Tools
                                </motion.h1>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tools Interface - Fills remaining space */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <Tabs value={activeTab} className="h-full flex flex-col space-y-4" onValueChange={setActiveTab}>
                        <TabsList className="flex-none bg-black/70 backdrop-blur-2xl border border-white/10 p-1.5 h-auto flex flex-wrap gap-2 justify-start w-full rounded-2xl">
                            <TabsTrigger
                                value="forrecon"
                                className="data-[state=active]:bg-cyber-cyan/15 data-[state=active]:text-cyber-cyan font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-cyber-cyan/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Search className="w-3.5 h-3.5 mr-2" /> FORRECON
                            </TabsTrigger>
                            <TabsTrigger
                                value="aether"
                                className="data-[state=active]:bg-cyan-500/15 data-[state=active]:text-cyan-400 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-cyan-500/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Globe className="w-3.5 h-3.5 mr-2" /> AETHER-CORE
                            </TabsTrigger>
                            <TabsTrigger
                                value="payload"
                                className="data-[state=active]:bg-purple-600/15 data-[state=active]:text-purple-400 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-purple-500/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Wrench className="w-3.5 h-3.5 mr-2" /> PAYLOAD-FORGE
                            </TabsTrigger>
                            <TabsTrigger
                                value="jwt"
                                className="data-[state=active]:bg-amber-500/15 data-[state=active]:text-amber-400 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-amber-500/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Key className="w-3.5 h-3.5 mr-2" /> JWT-MASTER
                            </TabsTrigger>
                            <TabsTrigger
                                value="headers"
                                className="data-[state=active]:bg-green-500/15 data-[state=active]:text-green-400 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-green-500/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 mr-2" /> HEADERS
                            </TabsTrigger>
                            <TabsTrigger
                                value="clickjacking"
                                className="data-[state=active]:bg-blue-500/15 data-[state=active]:text-blue-400 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-blue-500/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Target className="w-3.5 h-3.5 mr-2" /> CLICKJACKING
                            </TabsTrigger>
                            <TabsTrigger
                                value="arsenal-pipeline"
                                className="data-[state=active]:bg-red-500/15 data-[state=active]:text-red-400 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-red-500/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Terminal className="w-3.5 h-3.5 mr-2" /> ARSENAL-PIPELINE
                            </TabsTrigger>
                            <TabsTrigger
                                value="gitleaks"
                                className="data-[state=active]:bg-red-600/15 data-[state=active]:text-red-500 font-black text-[10px] tracking-widest px-4 py-2 border border-transparent data-[state=active]:border-red-600/30 rounded-xl transition-all hover:bg-white/5 active:scale-95"
                            >
                                <Lock className="w-3.5 h-3.5 mr-2" /> GITLEAKS
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 min-h-0 border border-white/10 rounded-2xl bg-black/60 backdrop-blur-3xl relative shadow-2xl overflow-hidden">
                            {/* Simplified static background glow */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                                <div className="absolute -top-24 -right-24 w-96 h-96 blur-[120px] rounded-full opacity-10 bg-primary/20" />
                            </div>

                            {/* Conditional rendering for performance - only mounts active tab */}
                            <ErrorBoundary>
                                <div className="absolute inset-0 z-10 overflow-y-auto p-6">
                                    <Suspense fallback={<ToolSkeleton />}>
                                        {activeTab === 'forrecon' && <Forrecon />}
                                        {activeTab === 'aether' && <AetherCore />}
                                        {activeTab === 'payload' && <PayloadForge />}
                                        {activeTab === 'jwt' && <JWTMaster />}
                                        {activeTab === 'headers' && <HeaderChecker />}
                                        {activeTab === 'clickjacking' && <Clickjacking />}
                                        {activeTab === 'arsenal-pipeline' && <ArsenalPipeline />}
                                        {activeTab === 'gitleaks' && <Gitleaks />}
                                    </Suspense>
                                </div>
                            </ErrorBoundary>
                        </div>

                    </Tabs>
                </div>
            </main >
        </div >
    );
};

export default Tools;

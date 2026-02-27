import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { motion } from "framer-motion";
import { Shield, LayoutDashboard, Terminal, Activity, FileCode, Wrench, ChevronRight, Search, Globe, Layers, Ghost, Gift, FolderSearch, Key, Package } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { CyberGrid } from "@/components/CyberGrid";
import { ArsenalEmptyState } from "@/components/arsenal/ArsenalEmptyState";
import { Forrecon } from "@/components/arsenal/Forrecon";
import { SovereignVuln } from "@/components/arsenal/SovereignVuln";
import { AetherCore } from "@/components/arsenal/AetherCore";
import { PayloadForge } from "@/components/arsenal/PayloadForge";
import { JWTMaster } from "./JWTMaster";
import { RetireScanner } from "@/components/arsenal/RetireScanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppSidebar } from "@/components/AppSidebar";

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

    useEffect(() => {
        const toolParam = searchParams.get("tool");
        if (toolParam) {
            setActiveTab(toolParam);
        }
    }, [searchParams]);

    return (
        <div className="min-h-screen bg-background text-foreground flex overflow-hidden">
            <CyberGrid />
            <AppSidebar />

            <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden p-4 lg:p-6">
                <div className="flex-none mb-4">
                    {/* Compact Header */}
                    <div className="flex items-center justify-between gap-4">
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

                {/* Tools Interface - Fills remaining space */}
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                    <Tabs value={activeTab} className="h-full flex flex-col space-y-4" onValueChange={setActiveTab}>
                        <TabsList className="flex-none bg-background/40 backdrop-blur border border-white/5 p-1 h-auto flex flex-wrap gap-2 justify-start w-full">
                            <TabsTrigger value="forrecon" className="data-[state=active]:bg-cyber-cyan/20 data-[state=active]:text-cyber-cyan font-mono text-xs px-3 py-1.5 border border-transparent data-[state=active]:border-cyber-cyan/30">
                                <Search className="w-3 h-3 mr-2" /> FORRECON
                            </TabsTrigger>
                            <TabsTrigger value="aether" className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-400 font-mono text-xs px-3 py-1.5 border border-transparent data-[state=active]:border-cyan-500/30">
                                <Globe className="w-3 h-3 mr-2" /> AETHER-CORE
                            </TabsTrigger>
                            <TabsTrigger value="sovereign" className="data-[state=active]:bg-cyber-purple/20 data-[state=active]:text-cyber-purple font-mono text-xs px-3 py-1.5 border border-transparent data-[state=active]:border-cyber-purple/30">
                                <Shield className="w-3 h-3 mr-2" /> SOVEREIGN
                            </TabsTrigger>
                            <TabsTrigger value="payload" className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-400 font-mono text-xs px-3 py-1.5 border border-transparent data-[state=active]:border-purple-500/30">
                                <Wrench className="w-3 h-3 mr-2" /> PAYLOAD-FORGE
                            </TabsTrigger>
                            <TabsTrigger value="jwt" className="data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400 font-mono text-xs px-3 py-1.5 border border-transparent data-[state=active]:border-amber-500/30">
                                <Key className="w-3 h-3 mr-2" /> JWT-MASTER
                            </TabsTrigger>
                            <TabsTrigger value="retire" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400 font-mono text-xs px-3 py-1.5 border border-transparent data-[state=active]:border-emerald-500/30">
                                <Package className="w-3 h-3 mr-2" /> RETIRE-JS
                            </TabsTrigger>
                        </TabsList>

                        <div className="flex-1 border border-white/5 rounded-lg bg-black/20 backdrop-blur-sm p-4 overflow-hidden relative">
                            <TabsContent value="forrecon" className="h-full mt-0 data-[state=active]:flex flex-col">
                                <ErrorBoundary>
                                    <Forrecon />
                                </ErrorBoundary>
                            </TabsContent>
                            <TabsContent value="aether" className="h-full mt-0 data-[state=active]:flex flex-col">
                                <ErrorBoundary>
                                    <AetherCore />
                                </ErrorBoundary>
                            </TabsContent>
                            <TabsContent value="sovereign" className="h-full mt-0 data-[state=active]:flex flex-col">
                                <ErrorBoundary>
                                    <SovereignVuln />
                                </ErrorBoundary>
                            </TabsContent>
                            <TabsContent value="payload" className="h-full mt-0 data-[state=active]:flex flex-col">
                                <ErrorBoundary>
                                    <PayloadForge />
                                </ErrorBoundary>
                            </TabsContent>
                            <TabsContent value="jwt" className="h-full mt-0 data-[state=active]:flex flex-col">
                                <ErrorBoundary>
                                    <JWTMaster />
                                </ErrorBoundary>
                            </TabsContent>
                            <TabsContent value="retire" className="h-full mt-0 data-[state=active]:flex flex-col">
                                <ErrorBoundary>
                                    <RetireScanner />
                                </ErrorBoundary>
                            </TabsContent>
                        </div>
                    </Tabs>
                </div>
            </main>
        </div>
    );
};

export default Tools;

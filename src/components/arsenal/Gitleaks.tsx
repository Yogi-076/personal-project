import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Target, AlertTriangle, CheckCircle2, Search, Crosshair, Globe, Layers, Lock, Github, Terminal, Info, ChevronRight, Zap } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Config from '@/config';
import { motion, AnimatePresence } from "framer-motion";

export const Gitleaks = () => {
    const { toast } = useToast();
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [scanId, setScanId] = useState<string | null>(null);
    const [status, setStatus] = useState<any>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [status?.logs]);

    // Polling for status
    useEffect(() => {
        let interval: any;
        if (loading && scanId) {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${Config.API_URL}/api/tools/gitleaks/status/${scanId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setStatus(data);
                        if (data.status === 'completed' || data.status === 'failed') {
                            setLoading(false);
                            clearInterval(interval);
                            toast({
                                title: data.status === 'completed' ? "Scan Finished" : "Scan Failed",
                                description: data.status === 'completed' ? `Found ${data.findings?.length || 0} potential leaks.` : "Error during scan process.",
                                variant: data.status === 'completed' ? "default" : "destructive"
                            });
                        }
                    }
                } catch (e) {
                    console.error("Polling error:", e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [loading, scanId]);

    const handleStartScan = async () => {
        if (!target) {
            toast({ title: "Target Required", description: "Please enter a GitHub repository URL.", variant: "destructive" });
            return;
        }

        if (!target.includes('github.com')) {
            toast({ title: "Invalid URL", description: "Only GitHub repositories are supported at this time.", variant: "destructive" });
            return;
        }

        setLoading(true);
        setScanId(null);
        setStatus(null);

        try {
            const res = await fetch(`${Config.API_URL}/api/tools/gitleaks/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: target })
            });

            if (res.ok) {
                const data = await res.json();
                setScanId(data.scanId);
                toast({ title: "Scan Initiated", description: "Connecting to GitHub engine..." });
            } else {
                throw new Error("Backend failed to start scan");
            }
        } catch (e) {
            console.error(e);
            setLoading(false);
            toast({ title: "Scan Failed", description: "Could not initiate scan process.", variant: "destructive" });
        }
    };

    const getSeverityColor = (sev: string) => {
        switch (sev?.toLowerCase()) {
            case 'critical': return 'text-red-500 border-red-500/30 bg-red-500/10';
            case 'high': return 'text-orange-500 border-orange-500/30 bg-orange-500/10';
            case 'medium': return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10';
            default: return 'text-blue-500 border-blue-500/30 bg-blue-500/10';
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-280px)] min-h-[500px] font-sans relative">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

            {/* Left Column: Command Center */}
            <div className="lg:col-span-4 flex flex-col gap-4">
                <Card className="border-red-500/20 bg-black/40 backdrop-blur-xl shadow-[0_0_20px_rgba(239,68,68,0.05)]">
                    <CardHeader className="pb-4 border-b border-white/5 bg-white/5">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-red-500 font-mono tracking-tighter text-lg uppercase">
                                <Lock className="w-5 h-5" />
                                Gitleaks Engine
                            </CardTitle>
                            <Badge variant="outline" className="border-red-500/50 text-red-500 bg-red-500/10 text-[10px] h-5">SECRET SCANNER</Badge>
                        </div>
                        <CardDescription className="text-xs text-muted-foreground mt-2">
                            Deep repository analysis for leaked API keys, tokens, and sensitive credentials in git history.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Repository URL</Label>
                            <div className="relative group">
                                <Github className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-hover:text-red-400 transition-colors" />
                                <Input
                                    placeholder="https://github.com/user/repo"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    className="pl-8 h-9 bg-black/40 border-white/10 focus-visible:ring-red-500/50 font-mono text-xs"
                                    onKeyDown={(e) => e.key === 'Enter' && handleStartScan()}
                                />
                            </div>
                        </div>

                        <Button 
                            className="h-9 w-full bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.1)] group text-xs mt-4" 
                            onClick={handleStartScan} 
                            disabled={loading}
                        >
                            {loading ? (
                                <span className="flex items-center gap-2 animate-pulse"><Zap className="w-3 h-3 animate-spin" /> SCANNING...</span>
                            ) : (
                                <span className="flex items-center gap-2"><Target className="w-3 h-3 group-hover:scale-110 transition-transform" /> INITIATE AUDIT</span>
                            )}
                        </Button>

                        {status && (
                            <div className="pt-4 space-y-3 border-t border-white/5 mt-4">
                                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-muted-foreground">
                                    <span>Engine Status</span>
                                    <span className={status.status === 'completed' ? 'text-green-500' : 'text-red-400'}>{status.status}</span>
                                </div>
                                <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${status.progress}%` }}
                                        className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="flex-1 border-white/5 bg-black/40 backdrop-blur-xl overflow-hidden flex flex-col min-h-[250px]">
                    <CardHeader className="py-2 px-3 border-b border-white/5 bg-white/5 flex flex-row items-center gap-2">
                        <Terminal className="w-3 h-3 text-muted-foreground" />
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">Live Logs</span>
                    </CardHeader>
                    <CardContent className="flex-1 p-0">
                        <ScrollArea className="h-full max-h-[250px] font-mono text-[10px] p-3">
                            <AnimatePresence>
                                {(status?.logs || []).map((log: string, i: number) => (
                                    <motion.div 
                                        key={i}
                                        initial={{ opacity: 0, x: -5 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="py-0.5 border-l border-red-500/20 pl-2 mb-1"
                                    >
                                        <span className="text-red-500/50 mr-2">{'>'}</span>
                                        <span className={log.startsWith('[ERROR]') ? 'text-red-400' : 'text-gray-400'}>{log}</span>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                            <div ref={logsEndRef} />
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Findings Dashboard */}
            <div className="lg:col-span-8 flex flex-col gap-4">
                <Card className="flex-1 border-white/5 bg-black/60 backdrop-blur-2xl relative overflow-hidden flex flex-col">
                    <CardHeader className="py-3 px-4 bg-black/20 border-b border-white/5 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase text-muted-foreground">
                            <Layers className="w-3 h-3" /> Secrets Detection Log
                        </div>
                        {status?.findings && (
                            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 font-mono text-[9px] h-5">
                                {status.findings.length} FINDINGS
                            </Badge>
                        )}
                    </CardHeader>

                    <CardContent className="flex-1 p-0 relative">
                        {!status && !loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 space-y-4">
                                <Shield className="w-16 h-16 opacity-10" />
                                <div className="text-center">
                                    <p className="font-mono text-xs uppercase tracking-widest">System Idle</p>
                                    <p className="text-[9px] uppercase tracking-tighter opacity-50 mt-1">Awaiting repository vector</p>
                                </div>
                            </div>
                        ) : (status?.findings || []).length === 0 && (status?.status === 'completed') ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                                <div className="p-4 rounded-full bg-green-500/10 border border-green-500/20">
                                    <CheckCircle2 className="w-12 h-12 text-green-500" />
                                </div>
                                <div className="text-center">
                                    <p className="text-green-400 font-bold uppercase text-sm">Clean Audit</p>
                                    <p className="text-[10px] text-muted-foreground uppercase mt-1">No known secret patterns detected in history</p>
                                </div>
                            </div>
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-3">
                                    <AnimatePresence>
                                        {(status?.findings || []).map((finding: any, i: number) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="group relative bg-black/40 border border-white/5 rounded-lg overflow-hidden hover:border-red-500/30 transition-all"
                                            >
                                                <div className="p-3 flex items-start gap-3">
                                                    <div className={`p-2 rounded-md ${getSeverityColor(finding.severity)}`}>
                                                        <AlertTriangle className="w-4 h-4" />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h4 className="font-bold text-sm text-gray-200">{finding.type}</h4>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[9px] font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                                                                    ENTROPY: {finding.entropy}
                                                                </span>
                                                                <Badge variant="outline" className={`text-[9px] ${getSeverityColor(finding.severity)}`}>
                                                                    {finding.severity}
                                                                </Badge>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono truncate">
                                                            <Globe className="w-3 h-3" />
                                                            {finding.file} : line {finding.line}
                                                        </div>
                                                        <div className="mt-2 p-2 bg-black/60 border border-white/5 rounded font-mono text-[10px] text-red-400/80 break-all select-all">
                                                            {finding.match}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="absolute right-2 bottom-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 hover:bg-red-500/10 hover:text-red-400">
                                                        <ChevronRight className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </AnimatePresence>
                                    {loading && (status?.findings || []).length === 0 && (
                                        <div className="p-8 text-center animate-pulse">
                                            <Search className="w-8 h-8 text-red-500/20 mx-auto mb-2" />
                                            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Scanning Repository Objects...</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ShieldAlert, Search, Terminal, Activity, Zap,
    AlertTriangle, CheckCircle, Bug, Lock, Server
} from "lucide-react";
import Config from '@/config';
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

interface Vulnerability {
    cve_id: string;
    epss_score: number;
    severity: string;
    remediation_cmd: string;
    patch_link?: string;
}

interface AnalysisResult {
    target_cpe: string;
    risk_score: number;
    critical_vulnerabilities: Vulnerability[];
}

export const SovereignVuln = () => {
    const { toast } = useToast();
    const [banner, setBanner] = useState('');
    const [analyzing, setAnalyzing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [result, setResult] = useState<AnalysisResult | null>(null);

    const handleAnalyze = async () => {
        if (!banner) {
            toast({ title: "Input Required", description: "Please enter a banner string.", variant: "destructive" });
            return;
        }

        setAnalyzing(true);
        setResult(null);

        try {
            // Direct call to Python Engine (CORS must be handled or proxied, assuming direct for now or via Vite proxy)
            // Ideally this goes through the Node backend to avoid CORS, but user asked for "Grand Orchestrator" connecting scanners.
            // For now, we'll try direct. If CORS fails, we might need a proxy.
            const res = await fetch('http://localhost:8000/analyze/banner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ banner })
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
                toast({
                    title: "Analysis Complete",
                    description: `Risk Score: ${data.risk_score}`,
                    className: "border-cyber-purple bg-cyber-navy/50 text-cyber-cyan"
                });
            } else {
                toast({ title: "Analysis Failed", description: "Engine unreachable or error.", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Connection Error", description: "Is Sovereign-VULN (Port 8000) running?", variant: "destructive" });
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-320px)] min-h-[600px] font-sans relative">
            <div className="absolute inset-0 bg-cyber-grid opacity-5 pointer-events-none -z-10" />

            {/* Input Panel */}
            <div className="lg:col-span-4 space-y-6 flex flex-col">
                <Card className="border-cyber-purple/30 bg-background/40 backdrop-blur-xl shadow-[0_0_15px_rgba(168,85,247,0.1)]">
                    <CardHeader className="pb-4 border-b border-cyber-purple/10">
                        <CardTitle className="flex items-center gap-2 text-cyber-purple font-mono tracking-tighter text-xl">
                            <ShieldAlert className="w-5 h-5" />
                            SOVEREIGN INTEL
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-6">
                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Service Banner / Header</Label>
                            <Input
                                placeholder="e.g. Apache/2.4.49 (Unix)"
                                value={banner}
                                onChange={(e) => setBanner(e.target.value)}
                                className="bg-black/20 border-white/10 focus-visible:ring-cyber-purple/50 font-mono text-sm"
                            />
                        </div>

                        <Button
                            className="w-full bg-cyber-purple/10 hover:bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/50 shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                            onClick={handleAnalyze}
                            disabled={analyzing}
                        >
                            {analyzing ? <Activity className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                            {analyzing ? "ANALYZING..." : "ANALYZE VULNERABILITY"}
                        </Button>

                        {/* Quick Examples */}
                        <div className="pt-4 border-t border-white/5">
                            <Label className="text-[10px] uppercase text-muted-foreground">Quick Test Payloads</Label>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="cursor-pointer hover:bg-white/5 font-mono text-[10px]" onClick={() => setBanner("Apache/2.4.49 (Unix)")}>Apache 2.4.49</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-white/5 font-mono text-[10px]" onClick={() => setBanner("Grafana v8.2.0")}>Grafana 8.x</Badge>
                                <Badge variant="outline" className="cursor-pointer hover:bg-white/5 font-mono text-[10px]" onClick={() => setBanner("nginx/1.18.0")}>Nginx 1.18</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Status/Score Card */}
                {result && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="border-cyber-purple/30 bg-black/40 backdrop-blur-xl">
                            <CardContent className="p-6 text-center">
                                <div className="text-sm uppercase text-muted-foreground tracking-widest mb-2">Total Risk Score</div>
                                <div className={`text-5xl font-black font-mono tracking-tighter ${result.risk_score > 5 ? 'text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'text-green-500'}`}>
                                    {result.risk_score.toFixed(2)}
                                </div>
                                <div className="mt-2 text-xs font-mono text-cyber-cyan">
                                    {result.target_cpe}
                                </div>
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* Creating Results Feed */}
            <div className="lg:col-span-8">
                <Card className="h-full flex flex-col border-cyber-purple/20 bg-background/60 backdrop-blur-2xl overflow-hidden">
                    <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10 flex-wrap gap-4">
                        <div className="flex items-center gap-3">
                            <Activity className="w-5 h-5 text-cyber-purple" />
                            <h3 className="font-bold text-lg tracking-tight">Intelligence Feed</h3>
                        </div>
                        {result && (
                            <div className="relative w-full md:w-64 group">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-cyber-purple transition-colors" />
                                <Input 
                                    placeholder="Search CVE or vulnerability..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 bg-black/40 border-white/10 text-xs font-mono focus:border-cyber-purple/50"
                                />
                            </div>
                        )}
                    </div>

                    <CardContent className="flex-1 p-0 overflow-hidden relative">
                        <ScrollArea className="h-full p-6">
                            {!result ? (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground/30 space-y-4 pt-20">
                                    <Server className="w-24 h-24 opacity-20" />
                                    <p className="font-mono text-sm tracking-widest uppercase">Awaiting Target Data</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {result.critical_vulnerabilities.length === 0 ? (
                                        <div className="flex items-center gap-4 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                                            <CheckCircle className="w-8 h-8" />
                                            <div>
                                                <div className="font-bold">No Critical Vulnerabilities Found</div>
                                                <div className="text-xs opacity-80">The system appears clean based on current intelligence.</div>
                                            </div>
                                        </div>
                                    ) : (
                                        result.critical_vulnerabilities
                                            .filter(v => 
                                                (v.cve_id || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                (v.severity || '').toLowerCase().includes(searchQuery.toLowerCase())
                                            )
                                            .map((vuln, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    className="rounded-lg border border-red-500/30 bg-red-950/10 overflow-hidden"
                                                >
                                                <div className="p-4 bg-red-950/30 border-b border-red-500/20 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Bug className="w-5 h-5 text-red-500" />
                                                        <span className="font-bold text-red-400 font-mono text-lg">{vuln.cve_id}</span>
                                                    </div>
                                                    <Badge variant="destructive" className="bg-red-500/20 text-red-400 border-red-500/50">
                                                        EPSS: {(vuln.epss_score * 100).toFixed(1)}%
                                                    </Badge>
                                                </div>
                                                <div className="p-4 space-y-4">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] uppercase text-muted-foreground font-semibold">Severity</div>
                                                            <div className="text-sm font-bold text-red-300">{vuln.severity}</div>
                                                        </div>
                                                        <div className="space-y-1">
                                                            <div className="text-[10px] uppercase text-muted-foreground font-semibold">Exploit Probability</div>
                                                            <div className="h-2 w-full bg-black/40 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                                                                    style={{ width: `${vuln.epss_score * 100}%` }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-3 rounded bg-black/40 border border-white/5 font-mono text-xs">
                                                        <div className="flex items-center justify-between mb-2 text-cyber-cyan">
                                                            <span className="flex items-center gap-2"><Terminal className="w-3 h-3" /> REMEDIATION COMMAND</span>
                                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => navigator.clipboard.writeText(vuln.remediation_cmd)}>
                                                                <AlertTriangle className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                        <code className="text-gray-300">{vuln.remediation_cmd}</code>
                                                    </div>

                                                    {vuln.patch_link && (
                                                        <Button variant="outline" className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10" onClick={() => window.open(vuln.patch_link, '_blank')}>
                                                            <Lock className="w-3 h-3 mr-2" /> View Official Patch
                                                        </Button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

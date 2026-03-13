import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Target, AlertTriangle, CheckCircle2, Search, Crosshair, Globe, Layers, Box } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import Config from '@/config';
import { motion } from "framer-motion";

export const Clickjacking = () => {
    const { toast } = useToast();
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleCheck = async () => {
        if (!target) {
            toast({ title: "Target Required", description: "Please enter a valid URL.", variant: "destructive" });
            return;
        }

        // Add http protocol if missing
        let formattedUrl = target;
        if (!/^https?:\/\//i.test(formattedUrl)) {
            formattedUrl = 'https://' + formattedUrl;
        }

        setLoading(true);
        setResult(null);

        try {
            const res = await fetch(`${Config.API_URL}/api/tools/clickjacking/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: formattedUrl })
            });

            if (res.ok) {
                const data = await res.json();
                setResult(data);
                toast({
                    title: "Scan Complete",
                    description: data.vulnerable ? "Vulnerability Detected" : "Target is Secured",
                    className: data.vulnerable ? "border-red-500 bg-red-950/20 text-red-200" : "border-green-500 bg-green-950/20 text-green-200"
                });
            } else {
                throw new Error("API responded with error");
            }
        } catch (e) {
            console.error(e);
            toast({ title: "Scan Failed", description: "Could not reach target or API.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-280px)] min-h-[500px] font-sans relative">
            <div className="absolute inset-0 bg-black/20 pointer-events-none -z-10" />

            {/* Left Column: Mission Control */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full">
                <Card className="flex-none border-blue-500/20 bg-black/40 backdrop-blur-xl shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                    <CardHeader className="pb-4 border-b border-white/5 bg-white/5">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-blue-400 font-mono tracking-tighter text-lg uppercase">
                                <Box className="w-5 h-5 text-blue-500" />
                                Frame Analyzer
                            </CardTitle>
                            <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 text-[10px] h-5">v1.2</Badge>
                        </div>
                        <CardDescription className="text-xs text-muted-foreground mt-2">
                            Detects UI redressing vulnerabilities by inspecting X-Frame-Options and CSP frame-ancestors headers.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Target Coordinates</Label>
                            <div className="relative group">
                                <Globe className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-hover:text-blue-400 transition-colors" />
                                <Input
                                    placeholder="https://example.com"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    className="pl-8 h-9 bg-black/40 border-white/10 focus-visible:ring-blue-500/50 font-mono text-xs"
                                    onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
                                />
                            </div>
                        </div>

                        <Button className="h-9 w-full bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] group text-xs mt-4" onClick={handleCheck} disabled={loading}>
                            {loading ? (
                                <span className="flex items-center gap-2 animate-pulse"><Search className="w-3 h-3 animate-spin" /> SCANNING HEADERS...</span>
                            ) : (
                                <span className="flex items-center gap-2"><Crosshair className="w-3 h-3 group-hover:scale-110 transition-transform" /> ANALYZE FRAMES</span>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Diagnostic Output */}
            <div className="lg:col-span-8 flex flex-col gap-4 h-full">
                <Card className="flex-1 border-white/5 bg-black/60 backdrop-blur-2xl relative overflow-hidden flex flex-col">
                    <CardHeader className="py-3 px-4 bg-black/20 border-b border-white/5 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-2 text-xs font-mono uppercase text-muted-foreground">
                            <Layers className="w-3 h-3" /> Header Interception Log
                        </div>
                        {result && (
                            <Badge variant={result.vulnerable ? "destructive" : "default"} className={`font-mono text-[9px] uppercase px-2 py-0 h-5 ${result.vulnerable ? 'bg-red-950/50 border-red-500/30 text-red-400' : 'bg-green-950/50 border-green-500/30 text-green-400'}`}>
                                {result.vulnerable ? 'VULNERABLE' : 'SECURE'}
                            </Badge>
                        )}
                    </CardHeader>

                    <CardContent className="flex-1 p-0 relative">
                        {!result && !loading ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/30 space-y-2">
                                <Shield className="w-16 h-16 opacity-20" />
                                <span className="font-mono text-xs uppercase tracking-widest">Awaiting target parameters</span>
                            </div>
                        ) : loading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="space-y-4 text-center">
                                    <div className="w-16 h-16 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto" />
                                    <p className="font-mono text-[10px] text-blue-400 uppercase tracking-widest animate-pulse">Requesting Headers...</p>
                                </div>
                            </div>
                        ) : result ? (
                            <ScrollArea className="h-full w-full p-6">
                                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 flex flex-col h-full">
                                    {/* Visual Evidence Section (PoC) */}
                                    {result.vulnerable ? (
                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2">
                                                    <Target className="w-3 h-3" /> Exploitation Preview (PoC)
                                                </h4>
                                                <Badge variant="outline" className="text-[9px] border-red-500/30 text-red-500 bg-red-500/5 animate-pulse">
                                                    LIVE RENDER ATTEMPT
                                                </Badge>
                                            </div>
                                            
                                            <div className="relative h-[400px] rounded-lg border border-red-500/30 bg-[#0a0a0a] shadow-[inset_0_0_40px_rgba(0,0,0,0.8)] overflow-hidden group">
                                                {/* The "Attacker" Overlay */}
                                                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-red-500/10 z-10 group-hover:border-red-500/30 transition-colors" />
                                                <div className="absolute top-2 left-2 z-20 bg-red-600/80 backdrop-blur-md text-[9px] font-bold text-white px-2 py-0.5 rounded shadow-lg uppercase tracking-widest border border-red-500/50">
                                                    Malicious Iframe Overlay
                                                </div>
                                                
                                                <iframe 
                                                    src={target.startsWith('http') ? target : `https://${target}`}
                                                    className="w-full h-full border-none opacity-70 filter grayscale-[30%] group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 scale-100"
                                                    title="Clickjacking PoC"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex-1 flex flex-col items-center justify-center space-y-4 border border-green-500/20 rounded-xl bg-green-500/5 p-8">
                                            <div className="relative">
                                                <Shield className="w-20 h-20 text-green-500/40" />
                                                <CheckCircle2 className="w-8 h-8 text-green-500 absolute -bottom-2 -right-2 bg-black rounded-full" />
                                            </div>
                                            <div className="text-center space-y-1">
                                                <h3 className="text-green-400 font-bold uppercase tracking-tighter text-lg">Target Hardened</h3>
                                                <p className="text-xs text-muted-foreground max-w-xs">No UI redressing vectors detected. The application's framing policy is properly configured.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Final Assessment Frame */}
                                    <div className={`p-4 rounded-lg border flex items-start gap-4 ${result.vulnerable ? 'bg-red-500/5 border-red-500/20' : 'bg-green-500/5 border-green-500/20'}`}>
                                        <div className={`p-2 rounded-md ${result.vulnerable ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                            {result.vulnerable ? <AlertTriangle className="w-6 h-6 text-red-500" /> : <CheckCircle2 className="w-6 h-6 text-green-500" />}
                                        </div>
                                        <div>
                                            <h3 className={`font-bold font-mono text-sm uppercase ${result.vulnerable ? 'text-red-400' : 'text-green-400'}`}>
                                                {result.vulnerable ? 'Clickjacking Attack Vector Open' : 'Frame Protection Active'}
                                            </h3>
                                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                                {result.vulnerable
                                                    ? "The target application permits external framing. An attacker can load this site inside a hidden iframe to trick users into performing unintended actions (UI Redressing)."
                                                    : "The target application correctly implements anti-framing defenses. Content cannot be embedded maliciously."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Raw Headers Breakdown */}
                                    <div>
                                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <Search className="w-3 h-3" /> Header Analysis
                                        </h4>
                                        <div className="space-y-2">
                                            {/* X-Frame-Options */}
                                            <div className="bg-black/40 border border-white/5 rounded p-3 font-mono text-xs flex justify-between items-center group">
                                                <span className="text-gray-400">X-Frame-Options</span>
                                                {result.headers['x-frame-options'] ? (
                                                    <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                                                        {result.headers['x-frame-options']}
                                                    </span>
                                                ) : (
                                                    <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" /> MISSING
                                                    </span>
                                                )}
                                            </div>

                                            {/* Content-Security-Policy (CSP) */}
                                            <div className="bg-black/40 border border-white/5 rounded p-3 font-mono text-xs group flex flex-col gap-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-400">Content-Security-Policy</span>
                                                    {!result.headers['content-security-policy'] ? (
                                                        <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 flex items-center gap-1">
                                                            <AlertTriangle className="w-3 h-3" /> MISSING
                                                        </span>
                                                    ) : result.hasFrameAncestors ? (
                                                        <span className="text-green-400 bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">
                                                            frame-ancestors directive present
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                                            NO frame-ancestors
                                                        </span>
                                                    )}
                                                </div>
                                                {result.headers['content-security-policy'] && (
                                                    <div className="text-[10px] text-gray-500 break-all p-2 bg-black/60 rounded border border-white/5">
                                                        {result.headers['content-security-policy']}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </motion.div>
                            </ScrollArea>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

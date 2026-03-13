import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Play, Square, Terminal, Activity, Shield, FileText,
    AlertTriangle, Copy, ExternalLink, Check, Zap, Server,
    Radio, Crosshair, Download, Globe, Search
} from "lucide-react";
import Config from '@/config';
import { useToast } from "@/hooks/use-toast";
import { useScanner } from '@/contexts/ScannerContext';

interface Log {
    type: 'info' | 'error' | 'warning';
    message: string;
    time: string;
}

interface Finding {
    timestamp: string;
    url: string;
    status: number;
    length: number;
    waf_detected?: string;
    redirect?: string;
}

interface Wordlist {
    name: string;
    path: string;
    size: number;
}

export const Forrecon = () => {
    const { toast } = useToast();
    const { scanState, setForreconScanId } = useScanner();
    const [target, setTarget] = useState('');
    const [threads, setThreads] = useState(50);
    const [safeMode, setSafeMode] = useState(false);
    const [wordlist, setWordlist] = useState<string>('');
    const [wordlists, setWordlists] = useState<Wordlist[]>([]);
    const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'stopped'>('idle');
    const [logs, setLogs] = useState<Log[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [findings, setFindings] = useState<Finding[]>([]);
    const logsEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Fetch wordlists
    useEffect(() => {
        fetch(`${Config.API_URL}/api/tools/forrecon/wordlists`)
            .then(res => res.json())
            .then(data => {
                setWordlists(data);
                if (data.length > 0) setWordlist(data[0].path);
            })
            .catch(err => console.error("Failed to load wordlists", err));
    }, []);

    // Poll for status
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (scanState.forreconScanId && status === 'running') {
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${Config.API_URL}/api/tools/forrecon/status/${scanState.forreconScanId}`);
                    if (res.ok) {
                        const data = await res.json();
                        setStatus(data.status);

                        if (data.logs) setLogs(data.logs);
                        if (data.findings) setFindings(data.findings);

                        if (data.status === 'completed' || data.status === 'failed') {
                            clearInterval(interval);
                            toast({
                                title: `Scan ${data.status.toUpperCase()}`,
                                description: `Discovery process finished.`,
                                className: data.status === 'completed' ? "border-green-500 bg-green-950/20 text-green-200" : "border-red-500"
                            });
                        }
                    }
                } catch (e) {
                    console.error("Polling error", e);
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [scanState.forreconScanId, status]);

    const handleStart = async () => {
        if (!target) {
            toast({ title: "Target Required", description: "Please enter a target URL.", variant: "destructive" });
            return;
        }

        setStatus('running');
        setLogs([]);
        setFindings([]);
        setForreconScanId(null);

        try {
            const res = await fetch(`${Config.API_URL}/api/tools/forrecon/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: target,
                    threads: parseInt(threads.toString()),
                    safeMode,
                    wordlist
                })
            });

            if (res.ok) {
                const data = await res.json();
                setForreconScanId(data.scanId);
                toast({
                    title: "Engine Engaged",
                    description: "Forrecon-Alpha is operational and scanning.",
                    className: "border-cyber-cyan bg-cyber-navy/50 text-cyber-cyan"
                });
            } else {
                setStatus('idle');
                const errData = await res.json();
                toast({
                    title: "Start Failed",
                    description: errData.error || "Could not launch engine.",
                    variant: "destructive"
                });
            }
        } catch (e) {
            setStatus('idle');
            toast({ title: "Connection Error", variant: "destructive" });
        }
    };

    const handleStop = async () => {
        if (!scanState.forreconScanId) return;
        try {
            await fetch(`${Config.API_URL}/api/tools/forrecon/stop`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scanId: scanState.forreconScanId })
            });
            setStatus('stopped');
            setForreconScanId(null);
        } catch (e) {
            console.error(e);
        }
    };

    const filteredFindings = findings.filter(f => 
        (f.url || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full font-sans relative">
            {/* Background Grid Decoration */}
            <div className="absolute inset-0 bg-cyber-grid opacity-10 pointer-events-none -z-10" />

            {/* Left Column: Mission Control & Status (4 cols) */}
            <div className="xl:col-span-4 lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">

                {/* Config Card - Compacted */}
                <Card className="flex-none border-cyber-cyan/30 bg-background/40 backdrop-blur-xl shadow-[0_0_15px_rgba(56,189,248,0.1)]">
                    <CardHeader className="pb-2 pt-3 border-b border-cyber-cyan/10">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2 text-cyber-cyan font-mono tracking-tighter text-lg">
                                <Crosshair className="w-4 h-4 animate-spin-slow" />
                                MISSION CONTROL
                            </CardTitle>
                            <Badge variant="outline" className="border-cyber-cyan/50 text-cyber-cyan bg-cyber-cyan/10 text-[10px] h-5">v1.0.0</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-3 pb-3">
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Target Coordinates</Label>
                            <div className="relative group">
                                <Globe className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground group-hover:text-cyber-cyan transition-colors" />
                                <Input
                                    placeholder="https://target.com"
                                    value={target}
                                    onChange={(e) => setTarget(e.target.value)}
                                    className="pl-8 h-9 bg-black/20 border-white/10 focus-visible:ring-cyber-cyan/50 font-mono text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Concurrency</Label>
                                <div className="relative">
                                    <Zap className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-amber-400" />
                                    <Input
                                        type="number"
                                        min="1" max="500"
                                        value={threads}
                                        onChange={(e) => setThreads(parseInt(e.target.value))}
                                        className="pl-8 h-9 bg-black/20 border-white/10 font-mono text-xs"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Technique</Label>
                                <div className="flex items-center justify-between h-9 px-2 rounded-md border border-white/10 bg-black/20">
                                    <span className={`text-[10px] font-bold ${safeMode ? 'text-green-400' : 'text-red-400'}`}>
                                        {safeMode ? 'STEALTH' : 'AGGRESSIVE'}
                                    </span>
                                    <Switch
                                        checked={safeMode}
                                        onCheckedChange={setSafeMode}
                                        className="scale-75 data-[state=checked]:bg-green-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Payload List</Label>
                            <Select value={wordlist} onValueChange={setWordlist}>
                                <SelectTrigger className="h-9 bg-black/20 border-white/10 font-mono text-xs">
                                    <SelectValue placeholder="Select Wordlist" />
                                </SelectTrigger>
                                <SelectContent className="bg-black/90 border-cyber-cyan/20 backdrop-blur-xl">
                                    {wordlists.map((w) => (
                                        <SelectItem key={w.path} value={w.path} className="font-mono text-xs focus:bg-cyber-cyan/20">
                                            {w.name} <span className="text-muted-foreground ml-2">({(w.size / 1024).toFixed(1)} KB)</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="pt-1">
                            {status === 'running' ? (
                                <Button variant="destructive" className="h-9 w-full relative overflow-hidden group border-red-500/50 hover:bg-red-950/50 text-xs" onClick={handleStop}>
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        <Square className="w-3 h-3 fill-current" /> ABORT SCAN
                                    </span>
                                    <div className="absolute inset-0 bg-red-500/10 group-hover:bg-red-500/20 transition-colors" />
                                </Button>
                            ) : (
                                <Button className="h-9 w-full bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 shadow-[0_0_20px_rgba(34,211,238,0.2)] group text-xs" onClick={handleStart}>
                                    <Play className="w-3 h-3 mr-2 fill-current group-hover:scale-110 transition-transform" /> ENGAGE ENGINE
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* HUD / Logs - Fills remaining height */}
                <Card className="flex-1 flex flex-col border-cyber-purple/30 bg-background/40 backdrop-blur-xl overflow-hidden min-h-0">
                    <CardHeader className="py-2 px-3 bg-black/20 border-b border-white/5 flex flex-row items-center justify-between space-y-0 flex-none">
                        <div className="flex items-center gap-2 text-xs font-mono text-cyber-purple uppercase">
                            <Terminal className="w-3 h-3" />
                            System Log
                        </div>
                        <div className="flex gap-2">
                            <Badge variant="outline" className={`font-mono text-[9px] h-4 px-1 ${status === 'running' ? 'border-green-500 text-green-400 bg-green-500/10 animate-pulse' :
                                status === 'idle' ? 'border-gray-500 text-gray-500' : 'border-red-500 text-red-500'
                                }`}>
                                {status.toUpperCase()}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 p-0 relative min-h-0">
                        {status === 'running' && (
                            <div className="absolute top-0 left-0 w-full h-[1px] bg-cyber-purple shadow-[0_0_10px_#a855f7] animate-scan z-10 opacity-50" />
                        )}
                        <ScrollArea className="h-full w-full p-3 font-mono text-[10px] leading-relaxed relative">
                            <div className="absolute inset-0">
                                <div className="p-3">
                                    {logs.length === 0 && <span className="text-gray-600 italic">... waiting for command input ...</span>}
                                    {logs.map((log, i) => (
                                        <div key={i} className="mb-1 break-all flex gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                                            <span className="opacity-30 select-none">[{new Date(log.time).toLocaleTimeString([], { hour12: false })}]</span>
                                            <span className={log.type === 'error' ? 'text-red-400 font-bold' : log.type === 'warning' ? 'text-amber-400' : 'text-cyber-cyan/90'}>
                                                {log.type === 'info' && <span className="text-green-500 mr-1">➜</span>}
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                    <div ref={logsEndRef} />
                                </div>
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Right Column: Findings Feed (8 cols) - Fills height */}
            <Card className="xl:col-span-8 lg:col-span-8 flex flex-col border-cyber-cyan/20 bg-background/60 backdrop-blur-2xl shadow-2xl relative overflow-hidden h-full">
                {/* Header */}
                <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/10 flex-none gap-4">
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="p-1.5 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/20">
                            <Activity className="w-4 h-4 text-cyber-cyan" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm tracking-tight text-foreground">Discovery Feed</h3>
                            <p className="text-[10px] text-muted-foreground font-mono">Live Intelligence Stream</p>
                        </div>
                    </div>

                    <div className="relative flex-1 max-w-xs group hidden md:block">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground group-focus-within:text-cyber-cyan transition-colors" />
                        <Input
                            placeholder="Search Resources..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-7 h-7 bg-black/40 border-white/10 rounded-md text-[10px] font-mono focus:border-cyber-cyan/50"
                        />
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                            <div className="text-lg font-bold font-mono leading-none text-cyber-cyan">
                                {searchQuery ? `${filteredFindings.length}/${findings.length}` : findings.length}
                            </div>
                            <div className="text-[9px] uppercase text-muted-foreground tracking-wider">Targets Found</div>
                        </div>

                        {status === 'completed' && scanState.forreconScanId && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-300 transition-all"
                                onClick={() => window.open(`${Config.API_URL}/api/tools/forrecon/report/${scanState.forreconScanId}`, '_blank')}
                            >
                                <Download className="w-3 h-3 mr-1" />
                                REPORT
                            </Button>
                        )}
                    </div>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-white/5 bg-cyber-navy/20 text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex-none">
                    <div className="col-span-1">Status</div>
                    <div className="col-span-7">Resource Path</div>
                    <div className="col-span-2 text-right">Size</div>
                    <div className="col-span-2">Tags</div>
                </div>

                {/* Findings List - Fills remaining height */}
                <CardContent className="flex-1 p-0 overflow-hidden relative min-h-0">
                    <ScrollArea className="h-full w-full">
                        <div className="px-2 py-2">
                            {filteredFindings.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center pt-24 text-muted-foreground/30 space-y-3">
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-cyber-cyan/20 blur-xl rounded-full" />
                                        <Shield className="w-16 h-16 relative z-10" />
                                    </div>
                                    <p className="font-mono text-xs tracking-widest uppercase">No data captured</p>
                                </div>
                            ) : (
                                filteredFindings.map((f, i) => (
                                    <div key={i} className="group grid grid-cols-12 gap-4 px-3 py-2 mb-1 rounded bg-black/5 hover:bg-white/5 transition-all text-xs font-mono items-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                                        <div className="col-span-1">
                                            <Badge
                                                className={`font-mono text-[9px] border px-1 py-0 h-4 ${f.status >= 200 && f.status < 300 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                                    f.status >= 300 && f.status < 400 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        'bg-red-500/10 text-red-400 border-red-500/20'
                                                    }`}
                                            >
                                                {f.status}
                                            </Badge>
                                        </div>
                                        <div className="col-span-7 flex items-center justify-between gap-2 overflow-hidden relative group">
                                            <div className="break-all text-gray-300 select-all font-mono text-[11px] leading-tight">
                                                <span className="text-muted-foreground select-none">/</span>
                                                {f.url.replace(target, '')}
                                                {f.redirect && <span className="text-amber-400/70 ml-2">➜ {f.redirect}</span>}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 backdrop-blur-md rounded-l px-1 py-0.5 border-l border-y border-white/10">
                                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-cyber-cyan" onClick={() => {
                                                    navigator.clipboard.writeText(f.url);
                                                    toast({ title: "Copied", className: "h-10 w-32" });
                                                }}>
                                                    <Copy className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 hover:text-cyber-cyan" onClick={() => window.open(f.url, '_blank')}>
                                                    <ExternalLink className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="col-span-2 text-right text-muted-foreground text-[10px]">
                                            {f.length.toLocaleString()} <span className="text-[9px]">B</span>
                                        </div>
                                        <div className="col-span-2 flex items-center gap-1">
                                            {f.waf_detected && (
                                                <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 bg-red-950/50 text-red-500 border-red-500/30">
                                                    WAF
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
};

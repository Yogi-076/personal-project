import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Play, Terminal, Target, Settings, FileJson, AlertTriangle, Trash2, CheckCircle2, XCircle, Info, Search } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { useScanner } from "@/contexts/ScannerContext";
import { Config } from "@/config";

const API_URL = Config.API_URL;

interface ToolStatus {
    [key: string]: boolean;
}

export const ArsenalPipeline = () => {
    const { toast } = useToast();
    const { scanState, setArsenalScanId } = useScanner();
    const [targetUrl, setTargetUrl] = useState('');
    const [threads, setThreads] = useState('10');
    const [depth, setDepth] = useState('3');
    const [highCookie, setHighCookie] = useState('');
    const [lowCookie, setLowCookie] = useState('');
    const [isRunning, setIsRunning] = useState(false);
    const [report, setReport] = useState<any>(null);
    const [logLines, setLogLines] = useState<string[]>([]);
    const [toolStatus, setToolStatus] = useState<ToolStatus | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [checkingDeps, setCheckingDeps] = useState(false);
    const terminalEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logLines]);

    useEffect(() => {
        checkDeps();
    }, []);

    // Poll for status if we have an active scanId
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (scanState.arsenalScanId) {
            setIsRunning(true);
            interval = setInterval(async () => {
                try {
                    const res = await fetch(`${API_URL}/api/tools/arsenal-pipeline/status/${scanState.arsenalScanId}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.logs) setLogLines(data.logs);
                        if (data.report) setReport(data.report);
                        
                        if (data.status === 'completed' || data.status === 'failed' || data.status === 'stopped') {
                            setIsRunning(false);
                            clearInterval(interval);
                            if (data.status === 'completed') {
                                toast({ title: "Pipeline Completed", description: "Vulnerability analysis finished." });
                            }
                        }
                    } else if (res.status === 404) {
                        setArsenalScanId(null);
                        setIsRunning(false);
                        clearInterval(interval);
                    }
                } catch (e) {
                    console.error('Polling error:', e);
                }
            }, 2000);
        }
        return () => clearInterval(interval);
    }, [scanState.arsenalScanId]);

    const checkDeps = async () => {
        setCheckingDeps(true);
        try {
            const res = await fetch(`${API_URL}/api/tools/arsenal-check-deps`);
            if (res.ok) {
                const data = await res.json();
                setToolStatus(data.tools);
            }
        } catch (e) {
            console.warn('Could not check tool deps:', e);
        } finally {
            setCheckingDeps(false);
        }
    };

    const runPipeline = async () => {
        if (!targetUrl) {
            toast({ title: "Target Required", description: "Please enter a valid target URL.", variant: "destructive" });
            return;
        }

        setIsRunning(true);
        setReport(null);
        setLogLines(['[SYS] Initializing Arsenal Pipeline...', '[SYS] ================================']);

        try {
            const response = await fetch(`${API_URL}/api/tools/arsenal-pipeline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetUrl,
                    threads: parseInt(threads),
                    depth: parseInt(depth),
                    highCookie,
                    lowCookie
                })
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({ error: response.statusText }));
                throw new Error(errData.error || "API responded with error status");
            }

            const data = await response.json();
            setArsenalScanId(data.scanId);
            toast({ title: "Pipeline Ignition", description: "Arsenal Core engine engaged." });

        } catch (error: any) {
            console.error('Pipeline Execution Error:', error);
            setLogLines(prev => [...prev, `[!] Error: ${error.message || 'Network error connecting to backend API.'}`]);
            toast({ title: "System Error", description: error.message || "Failed to communicate with the backend.", variant: "destructive" });
        } finally {
            setIsRunning(false);
        }
    };

    const missingTools = toolStatus ? Object.entries(toolStatus).filter(([, v]) => !v).map(([k]) => k) : [];
    const installedTools = toolStatus ? Object.entries(toolStatus).filter(([, v]) => v).map(([k]) => k) : [];

    return (
        <div className="space-y-4">
            {/* Tool Dependency Banner */}
            {toolStatus && (
                <div className={`rounded-lg border p-3 flex flex-wrap items-start gap-3 text-xs font-mono ${missingTools.length > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                    <div className="flex items-center gap-2 font-bold uppercase tracking-widest text-amber-400 whitespace-nowrap">
                        <Info className="w-4 h-4" />
                        Tool Status
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {installedTools.map(t => (
                            <span key={t} className="flex items-center gap-1 text-emerald-400">
                                <CheckCircle2 className="w-3 h-3" /> {t}
                            </span>
                        ))}
                        {missingTools.map(t => (
                            <span key={t} className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-3 h-3" /> {t}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-card border-border">
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <Target className="w-5 h-5 text-red-500" />
                            <span>Arsenal Core Configuration</span>
                        </CardTitle>
                        <CardDescription>Configure the 4-phase automated vulnerability scanning pipeline.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Target URL</Label>
                            <Input
                                placeholder="https://example.com"
                                value={targetUrl}
                                onChange={(e) => setTargetUrl(e.target.value)}
                                className="bg-background"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Threads / Concurrency</Label>
                                <Input type="number" value={threads} onChange={(e) => setThreads(e.target.value)} className="bg-background" />
                            </div>
                            <div className="space-y-2">
                                <Label>Katana Crawl Depth</Label>
                                <Input type="number" value={depth} onChange={(e) => setDepth(e.target.value)} className="bg-background" />
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <Label className="flex items-center space-x-2">
                                <Settings className="w-4 h-4 text-blue-400" />
                                <span>Autorize IDOR Configuration (Optional)</span>
                            </Label>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <Input placeholder="High Privilege Cookie (Admin)" value={highCookie} onChange={(e) => setHighCookie(e.target.value)} className="bg-background text-xs" />
                                <Input placeholder="Low Privilege Cookie (User)" value={lowCookie} onChange={(e) => setLowCookie(e.target.value)} className="bg-background text-xs" />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={runPipeline} disabled={isRunning}>
                                {isRunning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Pipeline Running...</>) : (<><Play className="mr-2 h-4 w-4" />Deploy Full Pipeline</>)}
                            </Button>
                            {isRunning && (
                                <Button variant="outline" className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10" onClick={async () => { 
                                    if (scanState.arsenalScanId) {
                                        await fetch(`${API_URL}/api/tools/arsenal-pipeline/stop`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ scanId: scanState.arsenalScanId })
                                        });
                                    }
                                    setArsenalScanId(null);
                                    setIsRunning(false); 
                                    setLogLines(prev => [...prev, '[!] Scan reset by user.']); 
                                }}>
                                    Reset
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Live Console Output */}
                <Card className="bg-[#0a0a0a] border-[#333] shadow-inner">
                    <CardHeader className="pb-2 border-b border-[#222]">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center space-x-2 text-sm text-green-500 font-mono">
                                <Terminal className="w-4 h-4" />
                                <span>Arsenal stdout</span>
                                {isRunning && <span className="ml-2 inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />}
                            </CardTitle>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] border-[#333] text-gray-500 font-mono">{logLines.length} lines</Badge>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-600 hover:text-red-400" onClick={() => setLogLines([])}>
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px] w-full">
                            <div className="p-4 font-mono text-xs space-y-0.5">
                                {logLines.length === 0 ? (
                                    <span className="text-gray-600 italic">Waiting for pipeline ignition...</span>
                                ) : (
                                    logLines.map((line, i) => {
                                        const isError = line.includes('[!]') || line.includes('ERR') || line.includes('error');
                                        const isOk = line.includes('[OK]') || line.includes('[+]');
                                        const isWarn = line.includes('WARN') || line.includes('[SKIP]');
                                        const isSys = line.includes('[SYS]');
                                        return (
                                            <div key={i} className={`leading-5 break-all ${isError ? 'text-red-400' : isOk ? 'text-green-400' : isWarn ? 'text-yellow-400' : isSys ? 'text-cyan-400 font-semibold' : 'text-gray-300'}`}>
                                                {line}
                                            </div>
                                        );
                                    })
                                )}
                                <div ref={terminalEndRef} />
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Verification Report Display */}
            {report && (
                <Card className="bg-card border-border mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                            <FileJson className="w-5 h-5 text-blue-500" />
                            <span>Scan Report & Findings</span>
                        </CardTitle>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex space-x-4 text-sm text-muted-foreground">
                                <span>Duration: {report.meta?.duration_seconds}s</span>
                                <span>Total URLs: {report.summary?.total_urls}</span>
                                <span>Fuzzable Params: {report.summary?.total_params}</span>
                            </div>
                            <div className="relative w-full md:w-64 group">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-blue-400 transition-colors" />
                                <Input 
                                    placeholder="Search findings..." 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8 h-8 bg-background/50 border-border text-xs focus:border-blue-400/50"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 border border-red-500/30 bg-red-500/10 rounded flex flex-col justify-center items-center">
                                <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
                                <span className="text-2xl font-bold text-red-500">{report.summary?.confirmed_vulns ?? 0}</span>
                                <span className="text-sm text-red-400">Total Confirmed Findings</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg flex items-center space-x-2">
                                <span>Zero-FP Validated Findings</span>
                                <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-none">100% Verified</Badge>
                            </h3>
                            {report.findings?.length > 0 ? (
                                <div className="space-y-2">
                                    {(report.findings || [])
                                        .filter((f: any) => 
                                            (f.type || "").toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            (f.details || "").toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map((finding: any, idx: number) => (
                                            <div key={idx} className="p-3 border border-border rounded bg-background flex flex-col space-y-2 text-sm font-mono">
                                                <div className="flex items-center space-x-2">
                                                    <Badge className="bg-red-500 text-white">{finding.type}</Badge>
                                                </div>
                                                <span className="text-blue-400">{finding.details}</span>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-muted-foreground border border-border border-dashed rounded bg-background/50">
                                    Pipeline execution returned 0 vulnerabilities. The target appears resilient across the scanning modalities.
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

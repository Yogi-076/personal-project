import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Layers, Play, Square, Terminal, Download, Package,
    AlertTriangle, CheckCircle, ChevronRight, FileJson,
    TreePine, Shield, RefreshCw, FolderSearch, Globe
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import Config from "@/config";

const API = Config.API_URL;

interface Finding {
    name: string;
    severity: string;
    library: string;
    version: string;
    latestVersion?: string;
    cves: string[];
    description: string;
    remediation: string;
    url: string;
    references: string[];
}

interface DepNode {
    file: string;
    parent: string | null;
    libraries: { name: string; version: string; latest: string | null; vulnerabilities: number; severity: string }[];
}

const severityColors: Record<string, string> = {
    critical: 'text-red-400 bg-red-500/10 border-red-500/30',
    high: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
    medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
    low: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    info: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
};

export const RetireScanner = () => {
    const [target, setTarget] = useState("");
    const [mode, setMode] = useState<"directory" | "url">("directory");
    const [scanning, setScanning] = useState(false);
    const [scanId, setScanId] = useState<string | null>(null);
    const [logs, setLogs] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [depTree, setDepTree] = useState<DepNode[]>([]);
    const [sbom, setSbom] = useState<any>(null);
    const [activeView, setActiveView] = useState<"findings" | "tree" | "sbom">("findings");
    const terminalRef = useRef<HTMLDivElement>(null);

    // Auto-scroll terminal
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [logs]);

    // Poll scan status
    useEffect(() => {
        if (!scanId || !scanning) return;
        const interval = setInterval(async () => {
            try {
                const res = await fetch(`${API}/api/scan/retire/status/${scanId}`);
                const data = await res.json();
                if (data.logs) setLogs(data.logs);
                if (data.progress !== undefined) setProgress(data.progress);

                if (data.status === 'completed' || data.progress >= 100) {
                    clearInterval(interval);
                    // Fetch full results
                    const resResults = await fetch(`${API}/api/scan/retire/results/${scanId}`);
                    const results = await resResults.json();
                    setFindings(results.findings || []);
                    setDepTree(results.dependencyTree || []);
                    setSbom(results.sbom || null);
                    setScanning(false);
                } else if (data.status === 'failed') {
                    clearInterval(interval);
                    setScanning(false);
                }
            } catch { /* ignore */ }
        }, 2000);
        return () => clearInterval(interval);
    }, [scanId, scanning]);

    const startScan = async () => {
        if (!target.trim()) return;
        setScanning(true);
        setLogs([]);
        setFindings([]);
        setDepTree([]);
        setSbom(null);
        setProgress(0);

        try {
            const res = await fetch(`${API}/api/scan/retire/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target: target.trim(), mode }),
            });

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                throw new Error(`Server returned non-JSON response (${res.status}). Is the backend running on ${API}?`);
            }

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Server error: ${res.status}`);
            }

            const data = await res.json();
            setScanId(data.scanId);
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Scan initiated (ID: ${data.scanId})`]);
        } catch (err) {
            setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ ${err instanceof Error ? err.message : String(err)}`]);
            setScanning(false);
        }
    };

    const downloadSBOM = () => {
        if (!sbom) return;
        const blob = new Blob([JSON.stringify(sbom, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sbom-${target.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
            {/* Input Bar */}
            <div className="flex-none flex gap-3 items-center">
                {/* Mode Toggle */}
                <div className="flex bg-black/30 rounded-lg p-0.5 border border-white/5">
                    <button
                        onClick={() => setMode("directory")}
                        className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${mode === "directory" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <FolderSearch className="w-3 h-3 inline mr-1.5" />DIR
                    </button>
                    <button
                        onClick={() => setMode("url")}
                        className={`px-3 py-1.5 text-xs font-mono rounded-md transition-all ${mode === "url" ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" : "text-muted-foreground hover:text-foreground"
                            }`}
                    >
                        <Globe className="w-3 h-3 inline mr-1.5" />URL
                    </button>
                </div>

                <Input
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                    placeholder={mode === "directory" ? "/path/to/project" : "https://example.com"}
                    className="flex-1 bg-black/30 border-white/10 font-mono text-sm"
                    onKeyDown={(e) => e.key === 'Enter' && !scanning && startScan()}
                />

                <Button
                    onClick={scanning ? () => setScanning(false) : startScan}
                    disabled={!target.trim() && !scanning}
                    className={`min-w-[120px] font-mono text-xs ${scanning
                        ? "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                        }`}
                    variant="outline"
                >
                    {scanning ? <><Square className="w-3 h-3 mr-2" /> STOP</> : <><Play className="w-3 h-3 mr-2" /> SCAN</>}
                </Button>
            </div>

            {/* Main Area: Terminal + Results */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-0 overflow-hidden">
                {/* Terminal */}
                <div className="flex flex-col border border-white/5 rounded-lg bg-black/30 overflow-hidden">
                    <div className="flex-none flex items-center justify-between px-3 py-2 bg-black/50 border-b border-white/5">
                        <div className="flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-xs font-mono text-emerald-400">RETIRE.JS SCANNER</span>
                        </div>
                        {scanning && (
                            <div className="flex items-center gap-2">
                                <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                                <span className="text-xs font-mono text-muted-foreground">{Math.round(progress)}%</span>
                            </div>
                        )}
                    </div>
                    {scanning && (
                        <div className="flex-none h-1 bg-black/50">
                            <motion.div
                                className="h-full bg-gradient-to-r from-emerald-500 to-green-400"
                                initial={{ width: '0%' }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                    )}
                    <div ref={terminalRef} className="flex-1 p-3 font-mono text-xs overflow-y-auto space-y-0.5" style={{ minHeight: 200 }}>
                        {logs.length === 0 && !scanning && (
                            <div className="text-muted-foreground/50 italic">... waiting for scan ...</div>
                        )}
                        {logs.map((log, i) => (
                            <div key={i} className={`leading-relaxed ${log.includes('❌') || log.includes('ERROR') ? 'text-red-400' :
                                log.includes('✅') ? 'text-emerald-400' :
                                    log.includes('⚠️') ? 'text-yellow-400' :
                                        log.includes('🔍') || log.includes('📦') ? 'text-cyan-400' :
                                            'text-muted-foreground'
                                }`}>{log}</div>
                        ))}
                    </div>
                </div>

                {/* Results Panel */}
                <div className="flex flex-col border border-white/5 rounded-lg bg-black/30 overflow-hidden">
                    {/* View Tabs */}
                    <div className="flex-none flex items-center gap-1 px-3 py-2 bg-black/50 border-b border-white/5">
                        <button onClick={() => setActiveView("findings")} className={`px-3 py-1 text-xs font-mono rounded transition-all ${activeView === 'findings' ? 'bg-emerald-500/20 text-emerald-400' : 'text-muted-foreground hover:text-foreground'}`}>
                            <AlertTriangle className="w-3 h-3 inline mr-1.5" />FINDINGS ({findings.length})
                        </button>
                        <button onClick={() => setActiveView("tree")} className={`px-3 py-1 text-xs font-mono rounded transition-all ${activeView === 'tree' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground hover:text-foreground'}`}>
                            <TreePine className="w-3 h-3 inline mr-1.5" />DEP TREE
                        </button>
                        <button onClick={() => setActiveView("sbom")} className={`px-3 py-1 text-xs font-mono rounded transition-all ${activeView === 'sbom' ? 'bg-purple-500/20 text-purple-400' : 'text-muted-foreground hover:text-foreground'}`}>
                            <FileJson className="w-3 h-3 inline mr-1.5" />SBOM
                        </button>
                        {sbom && (
                            <button onClick={downloadSBOM} className="ml-auto px-2 py-1 text-xs font-mono text-emerald-400 hover:bg-emerald-500/10 rounded transition-all">
                                <Download className="w-3 h-3 inline mr-1" />Export
                            </button>
                        )}
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-3 space-y-2">
                            {activeView === "findings" && (
                                <>
                                    {findings.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground/50">
                                            <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm">No vulnerable libraries detected</p>
                                            <p className="text-xs mt-1">Run a scan to check for known CVEs</p>
                                        </div>
                                    ) : (
                                        findings.map((f, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, y: 5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className={`p-3 rounded-lg border ${severityColors[f.severity] || severityColors.info}`}
                                            >
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <span className="font-mono text-sm font-bold">{f.library} <span className="opacity-60">v{f.version}</span></span>
                                                    <Badge variant="outline" className={`text-[10px] uppercase ${severityColors[f.severity]}`}>{f.severity}</Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mb-1.5">{f.description}</p>
                                                {f.cves.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mb-1.5">
                                                        {f.cves.map(cve => (
                                                            <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noreferrer" className="text-[10px] font-mono px-1.5 py-0.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors">
                                                                {cve}
                                                            </a>
                                                        ))}
                                                    </div>
                                                )}
                                                <p className="text-[11px] text-emerald-400/80">
                                                    <CheckCircle className="w-3 h-3 inline mr-1" />{f.remediation}
                                                </p>
                                            </motion.div>
                                        ))
                                    )}
                                </>
                            )}

                            {activeView === "tree" && (
                                <>
                                    {depTree.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground/50">
                                            <TreePine className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm">No dependency tree available</p>
                                        </div>
                                    ) : (
                                        depTree.map((node, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="border border-white/5 rounded-lg overflow-hidden"
                                            >
                                                <div className="px-3 py-2 bg-black/40 flex items-center gap-2 text-xs font-mono">
                                                    <FolderSearch className="w-3.5 h-3.5 text-cyan-400" />
                                                    <span className="text-cyan-400 truncate">{node.file}</span>
                                                </div>
                                                <div className="p-2 space-y-1">
                                                    {node.libraries.map((lib, j) => (
                                                        <div key={j} className="flex items-center justify-between px-2 py-1.5 rounded bg-black/20 text-xs font-mono">
                                                            <div className="flex items-center gap-2">
                                                                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                                                <span>{lib.name}</span>
                                                                <span className="text-muted-foreground">v{lib.version}</span>
                                                                {lib.latest && <span className="text-emerald-400/50">→ v{lib.latest}</span>}
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                {lib.vulnerabilities > 0 && (
                                                                    <Badge variant="outline" className={`text-[10px] ${severityColors[lib.severity]}`}>
                                                                        {lib.vulnerabilities} vuln{lib.vulnerabilities > 1 ? 's' : ''}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </motion.div>
                                        ))
                                    )}
                                </>
                            )}

                            {activeView === "sbom" && (
                                <>
                                    {!sbom ? (
                                        <div className="text-center py-12 text-muted-foreground/50">
                                            <FileJson className="w-10 h-10 mx-auto mb-3 opacity-30" />
                                            <p className="text-sm">No SBOM generated</p>
                                            <p className="text-xs mt-1">Run a scan to generate CycloneDX SBOM</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs font-mono mb-3">
                                                <span className="text-purple-400">CycloneDX v{sbom.specVersion}</span>
                                                <span className="text-muted-foreground">{sbom.components?.length || 0} components | {sbom.vulnerabilities?.length || 0} vulns</span>
                                            </div>
                                            <pre className="text-[11px] font-mono text-muted-foreground bg-black/40 p-3 rounded-lg overflow-x-auto border border-white/5 max-h-[400px] overflow-y-auto">
                                                {JSON.stringify(sbom, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
};

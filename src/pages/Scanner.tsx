import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from "@/hooks/use-toast";
import { ScanReport } from '@/components/ScanReport';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Play, Square, Terminal, Shield, RefreshCw, Maximize2, XCircle,
    Search, Settings, ArrowLeft, Bug, Globe, Crosshair, Brain,
    Clock, ChevronRight, Trash2, Plus, Lock, Unlock, Zap, Activity,
    Target, ExternalLink, History, Sparkles, Radar, Eye, Wifi,
    ChevronDown, Layers, ScanLine, AlertTriangle, CheckCircle2, Server
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import Config from '@/config';
import { scannerApi } from '@/lib/api_vmt';

// ═══════════════════════════════════════════
// SCAN TYPE DEFINITIONS (Simplified to Wapiti Only)
// ═══════════════════════════════════════════
const SCAN_TYPES = [
    { id: 'wapiti', label: 'Web Scanner', icon: Search, description: 'Deep web vulnerability analysis', color: 'from-sky-500 to-cyan-400', iconColor: 'text-sky-400', glowColor: 'shadow-sky-500/20', bgGlow: 'bg-sky-500/5', borderColor: 'border-sky-500/30', ringColor: 'ring-sky-400/40', premium: true },
] as const;

// ═══════════════════════════════════════════
// ANIMATED BACKGROUND PARTICLES
// ═══════════════════════════════════════════
const FloatingParticles = () => {
    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    className="absolute w-1 h-1 rounded-full bg-primary/20"
                    initial={{
                        x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1400),
                        y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
                    }}
                    animate={{
                        y: [null, Math.random() * -200 - 100],
                        opacity: [0, 0.6, 0],
                    }}
                    transition={{
                        duration: Math.random() * 8 + 6,
                        repeat: Infinity,
                        delay: Math.random() * 5,
                        ease: "easeInOut",
                    }}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════
// ANIMATED RADAR PULSE (for scanning state)
// ═══════════════════════════════════════════
const RadarPulse = ({ active }: { active: boolean }) => {
    if (!active) return null;
    return (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    className="absolute rounded-full border border-primary/10"
                    initial={{ width: 40, height: 40, opacity: 0.5 }}
                    animate={{
                        width: [40, 600],
                        height: [40, 600],
                        opacity: [0.4, 0],
                    }}
                    transition={{
                        duration: 3,
                        repeat: Infinity,
                        delay: i * 1,
                        ease: "easeOut",
                    }}
                />
            ))}
        </div>
    );
};

// ═══════════════════════════════════════════
// SIDEBAR: Scan History Panel (Enhanced)
// ═══════════════════════════════════════════
interface ScanHistoryItem {
    id: string;
    target: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    type?: string;
    summary?: { total: number; critical: number; high: number; medium: number; low: number };
}

const ScanHistoryPanel = ({
    history, loading, activeScanId, onSelect, onClear, onNewScan, onDelete
}: {
    history: ScanHistoryItem[];
    loading: boolean;
    activeScanId: string | null;
    onSelect: (scan: ScanHistoryItem) => void;
    onClear: () => void;
    onNewScan: () => void;
    onDelete: (id: string, e: React.MouseEvent) => void;
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filtered = history.filter(s => (s.target || '').toLowerCase().includes(searchTerm.toLowerCase()));

    const getScanTypeInfo = (scan: ScanHistoryItem) => {
        const t = scan.type || 'wapiti';
        return SCAN_TYPES.find(st => st.id === t) || SCAN_TYPES[0];
    };

    const getStatusStyle = (status: string) => {
        if (status === 'completed') return { dot: 'bg-emerald-400', text: 'text-emerald-400', bg: 'bg-emerald-500/10' };
        if (status === 'failed') return { dot: 'bg-red-400', text: 'text-red-400', bg: 'bg-red-500/10' };
        if (status === 'running' || status === 'scanning') return { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', bg: 'bg-blue-500/10' };
        return { dot: 'bg-amber-400 animate-pulse', text: 'text-amber-400', bg: 'bg-amber-500/10' };
    };

    return (
        <div className="h-full flex flex-col bg-gradient-to-b from-card/60 to-card/30 backdrop-blur-xl border-r border-white/[0.04]">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-white/[0.04]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 border border-primary/10 flex items-center justify-center">
                            <Layers className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xs tracking-tight">Scan History</h3>
                            <p className="text-[9px] text-muted-foreground font-medium">{filtered.length} {filtered.length === 1 ? 'scan' : 'scans'}</p>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={onClear}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all"
                        title="Clear history"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </motion.button>
                </div>
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40 group-focus-within:text-primary/60 transition-colors" />
                    <Input
                        placeholder="Search scans..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs bg-white/[0.02] border-white/[0.06] rounded-xl focus:border-primary/30 focus:bg-white/[0.04] transition-all placeholder:text-muted-foreground/30"
                    />
                </div>
            </div>

            {/* Scan List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 gap-3">
                            <div className="relative">
                                <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                            </div>
                            <span className="text-[10px] text-muted-foreground/50 font-medium">Loading scans...</span>
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-14 gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/[0.02] border border-white/[0.04] flex items-center justify-center">
                                <Radar className="w-5 h-5 text-muted-foreground/20" />
                            </div>
                            <div className="text-center">
                                <p className="text-[11px] text-muted-foreground/40 font-medium">No scans yet</p>
                                <p className="text-[9px] text-muted-foreground/25 mt-0.5">Start your first scan above</p>
                            </div>
                        </div>
                    )}
                    <AnimatePresence>
                        {filtered.map((scan, i) => {
                            const isActive = activeScanId === scan.id;
                            const isRunning = scan.status === 'running' || scan.status === 'scanning' || scan.status === 'pending';
                            const domain = (scan.target || 'Unknown').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
                            const typeInfo = getScanTypeInfo(scan);
                            const statusStyle = getStatusStyle(scan.status);
                            const Icon = typeInfo.icon;
                            const totalFindings = scan.summary ? (scan.summary.critical + scan.summary.high + scan.summary.medium + scan.summary.low) : 0;

                            return (
                                <motion.div
                                    key={scan.id}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -16 }}
                                    transition={{ delay: i * 0.04, type: "spring", stiffness: 300, damping: 25 }}
                                    onClick={() => onSelect(scan)}
                                    className={`
                                        p-3 rounded-xl cursor-pointer transition-all duration-200 relative group overflow-hidden
                                        ${isActive
                                            ? `bg-gradient-to-r ${typeInfo.bgGlow} border ${typeInfo.borderColor} shadow-lg ${typeInfo.glowColor}`
                                            : 'hover:bg-white/[0.03] border border-transparent hover:border-white/[0.06]'
                                        }
                                    `}
                                >
                                    {/* Scan line animation for active */}
                                    {isActive && (
                                        <motion.div
                                            className="absolute inset-0 opacity-30"
                                            style={{
                                                background: `linear-gradient(90deg, transparent, hsl(var(--primary) / 0.1), transparent)`,
                                            }}
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        />
                                    )}

                                    <div className="relative flex items-start gap-2.5">
                                        {/* Type Icon */}
                                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${typeInfo.color} p-[1px] shrink-0 mt-0.5`}>
                                            <div className="w-full h-full rounded-[7px] bg-card/90 flex items-center justify-center">
                                                <Icon className={`w-3.5 h-3.5 ${typeInfo.iconColor}`} />
                                            </div>
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="font-semibold text-[11px] truncate leading-tight">{domain}</div>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${statusStyle.bg} ${statusStyle.text}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                                                    {scan.status}
                                                </span>
                                                <span className="text-[9px] text-muted-foreground/30 font-mono">
                                                    {(() => {
                                                        try {
                                                            if (!scan.startedAt) return '';
                                                            const d = new Date(scan.startedAt);
                                                            return isNaN(d.getTime()) ? '' : format(d, 'HH:mm');
                                                        } catch { return ''; }
                                                    })()}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Findings Badge or Delete */}
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            {totalFindings > 0 && (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    {scan.summary && (scan.summary.critical + scan.summary.high) > 0 && (
                                                        <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md">
                                                            {scan.summary.critical + scan.summary.high}
                                                        </span>
                                                    )}
                                                    {scan.summary && scan.summary.medium > 0 && (
                                                        <span className="text-[9px] font-mono text-amber-400/70">
                                                            +{scan.summary.medium}M
                                                        </span>
                                                    )}
                                                </div>
                                            )}

                                            <motion.button
                                                whileHover={{ scale: 1.1 }}
                                                whileTap={{ scale: 0.9 }}
                                                onClick={(e) => onDelete(scan.id, e)}
                                                className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/30 hover:text-destructive transition-all"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </motion.button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* New Scan Button */}
            <div className="p-3 border-t border-white/[0.04]">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Button
                        onClick={onNewScan}
                        className="w-full h-10 text-xs font-bold bg-gradient-to-r from-primary/10 to-purple-500/10 hover:from-primary/20 hover:to-purple-500/20 text-primary border border-primary/15 hover:border-primary/30 rounded-xl transition-all shadow-lg shadow-primary/5 hover:shadow-primary/15"
                        variant="outline"
                    >
                        <Plus className="w-4 h-4 mr-2" /> New Scan
                    </Button>
                </motion.div>
            </div>
        </div>
    );
};


// ═══════════════════════════════════════════
// MAIN SCANNER PAGE
// ═══════════════════════════════════════════
export const Scanner = () => {
    const { toast } = useToast();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Project Management Context
    const projectId = searchParams.get('projectId');
    const initialTarget = searchParams.get('targetUrl') || '';

    // Scan config state
    const [targetUrl, setTargetUrl] = useState(initialTarget);
    const [scanType, setScanType] = useState<string>('wapiti');
    const [authEnabled, setAuthEnabled] = useState(false);
    const [loginUrl, setLoginUrl] = useState('');
    const [authUsername, setAuthUsername] = useState('');
    const [authPassword, setAuthPassword] = useState('');
    const [customSelectors, setCustomSelectors] = useState({ user: '', pass: '', btn: '' });
    const [showAdvancedSelectors, setShowAdvancedSelectors] = useState(false);
    const [wafBypassEnabled, setWafBypassEnabled] = useState(false);
    const [proxyEnabled, setProxyEnabled] = useState(false);
    const [fullModulesEnabled, setFullModulesEnabled] = useState(true); // Always ON for Specific Full Scan
    const [spaModeEnabled, setSpaModeEnabled] = useState(false);
    const [proxyUrl, setProxyUrl] = useState('');
    const [repoName, setRepoName] = useState('');

    // Scan runtime state
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [scanResult, setScanResult] = useState<any>(null);
    const [progress, setProgress] = useState(0);
    const [currentScanId, setCurrentScanId] = useState<string | null>(null);
    const [terminalExpanded, setTerminalExpanded] = useState(false);

    // History state
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // View state: 'config' (new scan form) or 'results' (viewing a past scan)
    const [viewMode, setViewMode] = useState<'config' | 'results'>('config');

    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Fetch History ──
    const fetchHistory = async () => {
        try {
            const data = await scannerApi.getHistory();
            if (Array.isArray(data)) setHistory(data);
        } catch { }
        finally { setHistoryLoading(false); }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 15000);
        return () => clearInterval(interval);
    }, [isScanning]);

    // ── Auto-scroll terminal ──
    useEffect(() => {
        if (scrollRef.current) {
            const el = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (el) el.scrollTop = el.scrollHeight;
        }
    }, [logs]);

    const addLog = (message: string) => {
        setLogs(prev => [...prev.slice(-299), `[${new Date().toLocaleTimeString()}] ${message}`]);
    };

    // ── Clear History ──
    const handleClearHistory = async () => {
        if (!confirm('Clear all scan history?')) return;
        try {
            await scannerApi.clearHistory();
            setHistory([]);
            if (viewMode === 'results') handleNewScan();
            toast({ title: "History Cleared", description: "All records removed." });
        } catch { }
    };

    // ── Delete Specific Scan ──
    const handleDeleteScan = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this scan record permanently?')) return;

        try {
            await scannerApi.deleteScan(id);
            setHistory(prev => prev.filter(s => s.id !== id));
            if (currentScanId === id) {
                handleNewScan();
            }
            toast({ title: "Scan Deleted", description: "Record removed successfully." });
        } catch (error: any) {
            toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
        }
    };

    // ── Select a history scan ──
    const handleSelectScan = async (scan: ScanHistoryItem) => {
        if (isScanning) {
            toast({ title: "Busy", description: "Wait for the current scan to finish.", variant: "destructive" });
            return;
        }
        setTargetUrl(scan.target);
        setCurrentScanId(scan.id);
        setLogs([`📋 Loaded: ${scan.target}`, `🕒 Scan ID: ${scan.id}`]);
        setProgress(100);
        setViewMode('results');

        try {
            const resultsData = await scannerApi.getResults(scan.id);
            setScanResult(resultsData);
        } catch {
            toast({ title: "Error", description: "Could not load report.", variant: "destructive" });
        }
    };

    // ── New Scan (reset form) ──
    const handleNewScan = () => {
        if (isScanning) return;
        setTargetUrl('');
        setLogs([]);
        setProgress(0);
        setScanResult(null);
        setCurrentScanId(null);
        setViewMode('config');
    };

    // ── Start Scan ──
    const handleStartScan = async () => {
        if (!targetUrl.trim()) {
            toast({ title: "Missing Target", description: "Enter a target URL or domain.", variant: "destructive" });
            return;
        }

        // Auto-normalize: add http:// if no scheme is provided
        const normalizedUrl = /^https?:\/\//i.test(targetUrl.trim()) ? targetUrl.trim() : `http://${targetUrl.trim()}`;
        if (normalizedUrl !== targetUrl) setTargetUrl(normalizedUrl);

        if (authEnabled && (!loginUrl || !authUsername || !authPassword)) {
            toast({ title: "Auth Required", description: "Fill in all authentication fields.", variant: "destructive" });
            return;
        }

        setIsScanning(true);
        setLogs([]);
        setProgress(0);
        setScanResult(null);
        setViewMode('config');

        const typeConfig = SCAN_TYPES.find(t => t.id === scanType);
        addLog(`🚀 Initializing ${typeConfig?.label || 'Scanner'}...`);
        addLog(`📡 Target: ${normalizedUrl}`);
        if (authEnabled) {
            addLog(`🔐 Authentication: Enabled`);
            addLog(`🔑 Login URL: ${loginUrl}`);
        }
        addLog('🔄 Connecting to security engine...');
        if (wafBypassEnabled) {
            addLog('🛡️ WAF Bypass Mode: ENABLED — rotating headers & UA');
        }

        try {
            let data;
            const selectors = (customSelectors.user || customSelectors.pass || customSelectors.btn) ? customSelectors : undefined;

            if (authEnabled) {
                data = await scannerApi.startAuthenticatedScan({
                    target: normalizedUrl, loginUrl, username: authUsername,
                    password: authPassword, selectors, tool: 'wapiti', projectId: projectId || undefined,
                    fullModules: fullModulesEnabled, spaMode: spaModeEnabled
                });
            } else {
                data = await scannerApi.startScan(normalizedUrl, {
                    wafBypass: wafBypassEnabled,
                    proxy: proxyEnabled ? proxyUrl : undefined,
                    projectId: projectId || undefined,
                    fullModules: fullModulesEnabled,
                    spaMode: spaModeEnabled
                });
            }

            const scanId = data.scanId;
            setCurrentScanId(scanId);
            addLog(`✅ Session ID: ${scanId.substring(0, 8)}`);
            addLog('🔍 Scan in progress...');

            toast({ title: "Scan Started", description: `${typeConfig?.label} on ${normalizedUrl}` });

            // ── Polling ──
            const pollInterval = window.setInterval(async () => {
                // Attach the interval ID to the window object so `handleStopScan` can clear it
                (window as any).__vapt_poll_interval = pollInterval;
                try {
                    const statusData = await scannerApi.getStatus(scanId);

                    if (statusData.logs?.length > 0) {
                        setLogs(prev => {
                            const newLogs = statusData.logs.filter((l: string) => !prev.includes(l));
                            return newLogs.length ? [...prev, ...newLogs].slice(-300) : prev;
                        });
                    }
                    if (statusData.progress) setProgress(statusData.progress);

                    if (statusData.status === 'completed') {
                        clearInterval(pollInterval);
                        const resultsData = await scannerApi.getResults(scanId);
                        addLog('📊 Scan complete.');
                        setScanResult(resultsData);
                        setIsScanning(false);
                        setViewMode('results');
                        toast({ title: "Complete", description: `${resultsData.summary?.total || 0} findings.` });
                        fetchHistory();

                        // Project Auto-Prompt Logic
                        if (projectId) {
                            setTimeout(() => {
                                // For now, navigate directly. We can refine this to a Modal.
                                if (confirm("Scan Complete! Would you like to generate a VAPT Report now?")) {
                                    navigate(`/projects/${projectId}`); // Wait to implement Report generator next
                                }
                            }, 1000);
                        }
                    } else if (statusData.status === 'failed') {
                        clearInterval(pollInterval);
                        // Show a clean, user-friendly error message
                        const errMsg = statusData.error || 'Scan failed unexpectedly';
                        addLog(`❌ ${errMsg}`);
                        setIsScanning(false);
                        toast({ variant: "destructive", title: "Scan Failed", description: errMsg });
                        fetchHistory();
                    }
                } catch (error) { console.error("Poll error", error); }
            }, 3000);

        } catch (error: any) {
            setIsScanning(false);
            const msg = error.response?.data?.error || error.message || 'Connection to scanner failed. Ensure backend is running.';
            addLog(`❌ ${msg}`);
            toast({ variant: 'destructive', title: "Error Starting Scan", description: msg });
        }
    };


    const handleStopScan = async () => {
        if (!currentScanId) return;

        // Optimistic UI updates
        setIsScanning(false);
        addLog('🛑 Terminating security engine & saving partial results...');

        // Stop the active polling
        if ((window as any).__vapt_poll_interval) {
            clearInterval((window as any).__vapt_poll_interval);
            delete (window as any).__vapt_poll_interval;
        }

        try {
            // Signal Backend to kill process and parse current logs
            const partialResult = await scannerApi.stopScan(currentScanId);

            addLog('✅ Engine terminated. Partial report generated.');
            setScanResult(partialResult);
            setViewMode('results');
            toast({ title: "Stopped", description: `Scan stopped. Analyzed ${partialResult.summary?.total || 0} findings so far.` });

            fetchHistory();
        } catch (error: any) {
            addLog(`❌ Failed to stop scan cleanly: ${error.message}`);
            toast({ variant: "destructive", title: "Termination Error", description: error.message });
        }
    };

    const getLogStyle = (msg: string) => {
        const lowerMsg = msg.toLowerCase();
        if (msg.includes('ERROR') || msg.includes('failed') || msg.includes('❌') || msg.includes('🛑') || lowerMsg.includes('vulnerability in') || lowerMsg.includes('lack of anti csrf')) return 'text-red-400 font-medium';
        if (msg.includes('WARN') || msg.includes('⚠️')) return 'text-yellow-400';
        if (msg.includes('COMPLETE') || msg.includes('✅') || msg.trim().startsWith('[+]')) return 'text-emerald-400/90';
        if (msg.includes('🚀') || msg.includes('🔬') || msg.includes('🎯') || msg.trim().startsWith('[*]')) return 'text-blue-400/90';
        if (msg.includes('📊') || msg.includes('📦')) return 'text-purple-400';
        if (msg.trim().startsWith('---')) return 'text-purple-400/50';
        if (msg.trim().startsWith('data:') || msg.trim().startsWith('Host:') || msg.trim().startsWith('Referer:') || msg.trim().startsWith('Content-Type:') || msg.trim().match(/^[A-Z]+\s\//)) return 'text-muted-foreground/50 pl-6';
        return 'text-foreground/70';
    };

    // Component to render individual log lines beautifully
    const renderTerminalLine = (log: string, i: number) => {
        const timestampMatch = log.match(/^\[([\d:]+\s?(?:AM|PM)?)\]\s?(.*)/);
        let time = '';
        let message = log;

        if (timestampMatch) {
            time = timestampMatch[1];
            message = timestampMatch[2];
        }

        // Highlight methods and URLs minimally
        const formattedMessage = message.replace(/\b(GET|POST|PUT|DELETE)\b/g, '<span class="text-sky-400 font-bold">$1</span>')
            .replace(/(https?:\/\/[^\s]+)/g, '<span class="text-emerald-400/70 underline underline-offset-2">$1</span>')
            .replace(/(\[\+\])/g, '<span class="text-emerald-500 font-bold">$1</span>')
            .replace(/(\[\*\])/g, '<span class="text-blue-500 font-bold">$1</span>')
            .replace(/(\[-\])/g, '<span class="text-red-500 font-bold">$1</span>');

        return (
            <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
                className={`break-words py-[1.5px] flex items-start gap-2 w-full ${getLogStyle(message)}`}
            >
                <span className="text-primary/30 select-none font-bold shrink-0 mt-[1px]">❯</span>
                {time && <span className="text-muted-foreground/30 shrink-0 select-none font-mono text-[10px] mt-[1px]">[{time}]</span>}
                <span className="flex-1 whitespace-pre-wrap font-mono relative leading-relaxed tracking-wide" dangerouslySetInnerHTML={{ __html: formattedMessage }} />
            </motion.div>
        );
    };

    const activeType = SCAN_TYPES.find(t => t.id === scanType)!;

    // ═══════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════
    return (
        <div className="h-screen bg-background text-foreground flex flex-col font-sans overflow-hidden relative">
            {/* Background effects */}
            <FloatingParticles />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-radial from-primary/[0.04] to-transparent rounded-full blur-3xl pointer-events-none" />

            {/* ── Top Nav ── */}
            <nav className="h-16 border-b border-white/[0.04] bg-card/40 backdrop-blur-2xl sticky top-0 z-50 px-5 flex items-center justify-between shrink-0 relative">
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

                <div className="flex items-center gap-4">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-white/[0.04]" onClick={() => {
                            if (projectId) navigate(`/projects/${projectId}`);
                            else window.history.back();
                        }}>
                            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
                        </Button>
                    </motion.div>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/25">
                                <Shield className="w-4.5 h-4.5 text-white" />
                            </div>
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background" />
                        </div>
                        <div>
                            <h1 className="font-bold text-sm tracking-tight leading-none">VAPT Scanner</h1>
                            <p className="text-[9px] text-muted-foreground/60 font-semibold uppercase tracking-[0.2em] mt-0.5">Shannon Engine v3.0</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Live status indicator */}
                    <motion.div
                        animate={isScanning ? { boxShadow: ['0 0 0 0 rgba(var(--primary), 0)', '0 0 0 8px rgba(var(--primary), 0.1)', '0 0 0 0 rgba(var(--primary), 0)'] } : {}}
                        transition={{ duration: 2, repeat: Infinity }}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isScanning
                            ? 'bg-primary/5 border-primary/20 text-primary'
                            : 'bg-white/[0.02] border-white/[0.06] text-muted-foreground/50'
                            }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${isScanning ? 'bg-primary animate-pulse' : 'bg-muted-foreground/20'}`} />
                        <span className="text-[10px] font-bold tracking-wide uppercase">{isScanning ? 'Scanning' : 'Ready'}</span>
                    </motion.div>
                </div>
            </nav>

            {/* ── Main Layout: Sidebar + Workspace ── */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* RIGHT: Workspace */}
                <div className="flex-1 overflow-y-auto relative">
                    <RadarPulse active={isScanning} />

                    <div className="max-w-[1100px] mx-auto p-6 lg:p-8 space-y-6 relative z-10">

                        {/* ── Project Required View ── */}
                        {!projectId && viewMode === 'config' && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.5 }}
                                className="flex flex-col items-center justify-center py-20 text-center relative mt-10"
                            >
                                <motion.div
                                    animate={{ y: [0, -8, 0] }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="relative mb-6"
                                >
                                    <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/10 flex items-center justify-center backdrop-blur-sm">
                                        <Layers className="w-10 h-10 text-amber-500/50" />
                                    </div>
                                    <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-amber-500/5 to-transparent blur-xl" />
                                </motion.div>
                                <h3 className="text-2xl font-bold tracking-tight mb-3">Project Context Required</h3>
                                <p className="text-sm text-muted-foreground/60 max-w-md mx-auto leading-relaxed mb-8">
                                    All scans must be associated with a project for proper vulnerability management and auditing. Please select or create a project to initiate a new scan.
                                </p>
                                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                    <Button
                                        onClick={() => navigate('/projects')}
                                        className="h-12 px-8 text-sm font-bold bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 shadow-2xl shadow-primary/20 rounded-xl transition-all"
                                    >
                                        <Layers className="w-4 h-4 mr-2" /> Select or Create Project
                                    </Button>
                                </motion.div>
                            </motion.div>
                        )}

                        {/* ── Config / Active Scan Workspace ── */}
                        {((projectId && viewMode === 'config') || isScanning) && (
                            <>

                                {/* ── Premium Hero Area ── */}
                                <div className="flex flex-col items-center text-center pb-8 pt-4">
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ duration: 0.5 }}
                                        className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-sky-500/20 p-px mb-6 shadow-2xl shadow-primary/20"
                                    >
                                        <div className="w-full h-full rounded-[15px] bg-card/80 backdrop-blur-xl flex items-center justify-center">
                                            <Shield className="w-8 h-8 text-primary drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]" />
                                        </div>
                                    </motion.div>
                                    <motion.h2
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="text-3xl font-bold tracking-tight mb-3"
                                    >
                                        Enterprise Web Scanner
                                    </motion.h2>
                                    <motion.p
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="text-sm text-muted-foreground/60 max-w-md mx-auto"
                                    >
                                        Deep vulnerability analysis powered by Shannon Engine v3.0. Enter a target to begin active reconnaissance.
                                    </motion.p>
                                </div>

                                {/* ── Target Input Bar ── */}
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.3, type: "spring" }}
                                    className={`relative rounded-3xl overflow-hidden transition-all duration-500 max-w-3xl mx-auto ${isScanning
                                        ? `border border-sky-500/40 shadow-2xl shadow-sky-500/20`
                                        : 'border border-white/10 hover:border-white/20 shadow-2xl shadow-black/40'
                                        }`}
                                >
                                    {/* Animated border glow when scanning */}
                                    {isScanning && (
                                        <motion.div
                                            className={`absolute inset-0 rounded-3xl bg-gradient-to-r from-sky-500/10 to-primary/10`}
                                            animate={{ opacity: [0.05, 0.15, 0.05] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        />
                                    )}

                                    <div className="relative bg-black/40 backdrop-blur-2xl p-3 flex items-center gap-3">
                                        <div className={`ml-3 w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500/30 to-primary/30 p-px shrink-0`}>
                                            <div className="w-full h-full rounded-[15px] bg-card/90 flex items-center justify-center backdrop-blur-md">
                                                <Target className={`w-5 h-5 text-sky-400`} />
                                            </div>
                                        </div>
                                        <Input
                                            placeholder="https://target.api.com"
                                            value={targetUrl}
                                            onChange={(e) => setTargetUrl(e.target.value)}
                                            className="flex-1 border-none shadow-none h-14 text-base focus-visible:ring-0 placeholder:text-muted-foreground/30 bg-transparent font-medium tracking-wide"
                                            onKeyDown={(e) => e.key === 'Enter' && !isScanning && handleStartScan()}
                                            disabled={isScanning}
                                        />
                                        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                                            <Button
                                                onClick={isScanning ? handleStopScan : handleStartScan}
                                                variant={isScanning ? "destructive" : "default"}
                                                className={`h-12 px-8 text-sm font-bold shadow-2xl rounded-xl transition-all mr-1 ${isScanning
                                                    ? 'bg-red-500/80 hover:bg-red-500 shadow-red-500/20'
                                                    : `bg-gradient-to-r from-sky-500 to-primary hover:opacity-90 shadow-primary/20`
                                                    }`}
                                            >
                                                {isScanning
                                                    ? <><Square className="w-4 h-4 mr-2 fill-current" /> Terminate</>
                                                    : <><Play className="w-4 h-4 mr-2 fill-current" /> Launch Scan</>
                                                }
                                            </Button>
                                        </motion.div>
                                    </div>
                                </motion.div>



                                {/* ── Full Modules Scan Panel ── */}
                                <motion.div
                                    initial={{ opacity: 0, y: 12 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.55 }}
                                    className={`rounded-2xl border overflow-hidden mt-4 transition-all duration-300 ${fullModulesEnabled
                                        ? 'bg-purple-500/[0.02] border-purple-500/15 shadow-lg shadow-purple-500/5'
                                        : 'bg-white/[0.01] border-white/[0.04] hover:border-white/[0.06]'
                                        }`}
                                >
                                    <div
                                        className="flex items-center justify-between px-5 py-4 cursor-pointer transition-colors hover:bg-white/[0.02]"
                                        onClick={() => !isScanning && setFullModulesEnabled(!fullModulesEnabled)}
                                    >
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 ${fullModulesEnabled
                                                ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 text-purple-400 shadow-lg shadow-purple-500/10'
                                                : 'bg-white/[0.03] text-muted-foreground/30'
                                                }`}>
                                                <Layers className={`w-4.5 h-4.5 ${fullModulesEnabled ? 'text-purple-400' : ''}`} />
                                            </div>
                                            <div>
                                                <h3 className="text-sm font-bold tracking-tight">{fullModulesEnabled ? 'Specific Full Scan Active' : 'Specific Full Scan'}</h3>
                                                <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                                                    {fullModulesEnabled ? 'Running specific exhaustive modules payload at depth 5' : 'Enable to run the most exhaustive specific scan module payload'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                                            <Switch
                                                checked={fullModulesEnabled}
                                                onCheckedChange={setFullModulesEnabled}
                                                disabled={isScanning}
                                                className="data-[state=checked]:bg-purple-500"
                                            />
                                        </div>
                                    </div>
                                </motion.div>



                                {/* ── Terminal ── */}
                                {(logs.length > 0 || isScanning) && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                        className={`rounded-2xl overflow-hidden border shadow-2xl shadow-black/30 flex flex-col transition-all duration-500 ${terminalExpanded
                                            ? 'fixed inset-4 z-50 h-auto border-primary/20'
                                            : 'h-[420px] border-white/[0.04]'
                                            }`}
                                    >
                                        {/* Terminal Chrome */}
                                        <div className="flex items-center justify-between px-5 py-3 bg-[#0a0e17] border-b border-white/[0.04]">
                                            <div className="flex items-center gap-3">
                                                <div className="flex gap-2">
                                                    <motion.div whileHover={{ scale: 1.3 }} className="w-3 h-3 rounded-full bg-red-500/50 hover:bg-red-500 transition-colors cursor-pointer" />
                                                    <motion.div whileHover={{ scale: 1.3 }} className="w-3 h-3 rounded-full bg-yellow-500/50 hover:bg-yellow-500 transition-colors cursor-pointer" />
                                                    <motion.div whileHover={{ scale: 1.3 }} className="w-3 h-3 rounded-full bg-emerald-500/50 hover:bg-emerald-500 transition-colors cursor-pointer" />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Terminal className="w-3.5 h-3.5 text-primary/40" />
                                                    <span className="text-[10px] font-mono text-white/20 font-medium">
                                                        {activeType.label} — {currentScanId?.substring(0, 12) || 'idle'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <motion.div whileHover={{ scale: 1.1 }}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/15 hover:text-white/40 rounded-lg" onClick={() => setLogs([])}>
                                                        <RefreshCw className="w-3 h-3" />
                                                    </Button>
                                                </motion.div>
                                                <motion.div whileHover={{ scale: 1.1 }}>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-white/15 hover:text-white/40 rounded-lg" onClick={() => setTerminalExpanded(!terminalExpanded)}>
                                                        {terminalExpanded ? <XCircle className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                                                    </Button>
                                                </motion.div>
                                            </div>
                                        </div>

                                        {/* Terminal Body */}
                                        <ScrollArea className="flex-1 bg-[#070b14]" ref={scrollRef}>
                                            <div className="p-5 font-mono text-[11px] leading-relaxed space-y-[2px]">
                                                {logs.map((log, i) => renderTerminalLine(log, i))}
                                                {isScanning && (
                                                    <div className="flex items-center gap-2 mt-3 text-primary/40">
                                                        <motion.span
                                                            className="inline-block w-2 h-4 bg-primary/60 rounded-sm"
                                                            animate={{ opacity: [1, 0.2, 1] }}
                                                            transition={{ duration: 1, repeat: Infinity }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </ScrollArea>

                                        {/* Progress Bar */}
                                        {isScanning && (
                                            <div className="h-1 w-full bg-white/[0.02] relative overflow-hidden">
                                                <motion.div
                                                    className={`h-full bg-gradient-to-r ${activeType.color} shadow-lg`}
                                                    style={{ boxShadow: `0 0 20px hsl(var(--primary) / 0.5)` }}
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${progress}%` }}
                                                    transition={{ duration: 0.8, ease: "easeOut" }}
                                                />
                                                {/* Shimmer effect */}
                                                <motion.div
                                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                                                    animate={{ x: ['-100%', '100%'] }}
                                                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                                />
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* ── Scan Results (inline) ── */}
                                <AnimatePresence>
                                    {scanResult && viewMode === 'results' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 30 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -20 }}
                                            transition={{ duration: 0.5, type: "spring", stiffness: 200, damping: 25 }}
                                        >
                                            <Separator className="my-3 bg-white/[0.03]" />
                                            <ScanReport result={{
                                                id: currentScanId || 'unknown',
                                                target: targetUrl,
                                                status: 'completed',
                                                startedAt: new Date().toISOString(),
                                                findings: scanResult.findings || [],
                                                summary: scanResult.summary || { total: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 }
                                            }} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* ── Empty State (Premium) ── */}
                                {!isScanning && logs.length === 0 && !scanResult && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: 0.5, duration: 0.5 }}
                                        className="flex flex-col items-center justify-center py-20 text-center relative"
                                    >
                                        <motion.div
                                            animate={{ y: [0, -8, 0] }}
                                            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                            className="relative mb-6"
                                        >
                                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/10 flex items-center justify-center backdrop-blur-sm">
                                                <Shield className="w-10 h-10 text-primary/20" />
                                            </div>
                                            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent blur-xl" />
                                        </motion.div>
                                        <h3 className="text-xl font-bold text-foreground/40 mb-2 tracking-tight">Ready to Scan</h3>
                                        <p className="text-xs text-muted-foreground/30 max-w-sm leading-relaxed">
                                            Enter a target URL, select your scan type, and unleash the security engine.
                                            <br />
                                            <span className="text-primary/30">Enable authentication to scan protected areas.</span>
                                        </p>
                                        <div className="flex items-center gap-4 mt-6">
                                            {['XSS', 'SQLi', 'CSRF', 'IDOR', 'RCE'].map((tag, i) => (
                                                <motion.span
                                                    key={tag}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: 0.7 + i * 0.1 }}
                                                    className="text-[9px] font-mono font-bold text-muted-foreground/15 bg-white/[0.015] px-2 py-1 rounded-lg border border-white/[0.03]"
                                                >
                                                    {tag}
                                                </motion.span>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
};

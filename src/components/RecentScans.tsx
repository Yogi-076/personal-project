import { useEffect, useState } from "react";
import Config from '@/config';
import { motion, AnimatePresence } from "framer-motion";
import { History, Clock, ChevronRight, Search, Filter, Trash2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ScanHistoryItem {
    id: string;
    target: string;
    status: "completed" | "running" | "failed" | "pending";
    startedAt: string;
    completedAt?: string;
    summary?: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

interface RecentScansProps {
    onSelect?: (scan: ScanHistoryItem) => void;
}

export const RecentScans = ({ onSelect }: RecentScansProps) => {
    const [history, setHistory] = useState<ScanHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchHistory = async () => {
        try {
            const token = localStorage.getItem('vmt_token');
            const res = await fetch(`${Config.API_URL}/api/scan/history`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    setHistory(data);
                } else {
                    console.error("Scan history API returned non-array:", data);
                    setHistory([]);
                }
            } else {
                console.error("Scan history API failed:", res.status, res.statusText);
            }
        } catch (error) {
            console.error("Failed to fetch history", error);
            setHistory([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        const interval = setInterval(fetchHistory, 15000);
        return () => clearInterval(interval);
    }, []);

    const handleDeleteScan = async (e: React.MouseEvent, scanId: string) => {
        e.stopPropagation(); // prevent row select
        if (!confirm("Are you sure you want to delete this scan log?")) return;

        try {
            const token = localStorage.getItem('vmt_token');
            const res = await fetch(`${Config.API_URL}/api/scan/${scanId}`, { 
                method: 'DELETE',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                setHistory(prev => prev.filter(s => s.id !== scanId));
            } else {
                console.error("Failed to delete scan");
            }
        } catch (error) {
            console.error("Error deleting scan", error);
        }
    };

    const filteredHistory = history.filter(scan => {
        const target = scan?.target || "";
        return target.toLowerCase().includes(searchTerm.toLowerCase());
    });

    if (loading) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="group hover-glow-bg bg-card/50 backdrop-blur-md border border-border/50 rounded-xl overflow-hidden h-full flex flex-col shadow-sm hover:shadow-md transition-all"
        >
            <div className="p-5 border-b border-border/50 bg-secondary/10 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <History className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg leading-none">Activity Log</h3>
                            <p className="text-xs text-muted-foreground mt-1">Recent security assessments</p>
                        </div>
                    </div>

                    <div onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm("Are you sure you want to clear the entire activity log?")) return;
                        try {
                            const token = localStorage.getItem('vmt_token');
                            await fetch(`${Config.API_URL}/api/scan/history`, { 
                                method: 'DELETE',
                                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                            });
                            setHistory([]);
                        } catch (e) { console.error(e); }
                    }} className="p-2 hover:bg-destructive/10 rounded-lg cursor-pointer transition-colors group/delete" title="Clear History">
                        <Trash2 className="w-4 h-4 text-muted-foreground group-hover/delete:text-destructive transition-colors" />
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Filter targets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 bg-background/50 text-sm"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 px-2 py-2">
                <div className="space-y-1 p-1">
                    <AnimatePresence>
                        {filteredHistory.map((scan, i) => (
                            <motion.div
                                key={scan.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => onSelect?.(scan)}
                                className="p-3 rounded-lg hover:bg-white/5 border border-transparent hover:border-white/10 transition-all cursor-pointer group/item relative overflow-hidden"
                            >
                                <div className="flex justify-between items-center mb-1">
                                    <div className="font-semibold text-sm truncate max-w-[180px] text-foreground/90 group-hover/item:text-primary transition-colors">
                                        {(scan.target || "Unknown Target").replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                    </div>
                                    <Badge
                                        variant="outline"
                                        className={`text-[10px] px-2 py-0 h-5 border-0 ${scan.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                            scan.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                                'bg-blue-500/10 text-blue-500 animate-pulse'
                                            }`}
                                    >
                                        {scan.status}
                                    </Badge>
                                </div>

                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-1.5 font-mono">
                                        <Clock className="w-3 h-3" />
                                        {(() => {
                                            try {
                                                if (!scan.startedAt) return "N/A";
                                                const d = new Date(scan.startedAt);
                                                if (isNaN(d.getTime())) return "Invalid Date";
                                                return format(d, 'MMM d, HH:mm');
                                            } catch (e) {
                                                return "Date Error";
                                            }
                                        })()}
                                    </div>

                                    {scan.summary && (scan.summary.total > 0 ? (
                                        <div className="flex items-center gap-2 font-mono font-medium">
                                            {scan.summary.critical + scan.summary.high > 0 &&
                                                <span className="text-red-400">{scan.summary.critical + scan.summary.high} H</span>
                                            }
                                            {scan.summary.medium > 0 &&
                                                <span className="text-amber-400">{scan.summary.medium} M</span>
                                            }
                                            {scan.summary.low > 0 &&
                                                <span className="text-blue-400">{scan.summary.low} L</span>
                                            }
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground/50 italic">No findings</span>
                                    ))}
                                </div>

                                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover/item:opacity-100 transition-all">
                                    <button
                                        onClick={(e) => handleDeleteScan(e, scan.id)}
                                        className="p-1.5 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 rounded transition-colors"
                                        title="Delete Scan Log"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground/50 hover:text-primary transition-colors" />
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {filteredHistory.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No logs found
                        </div>
                    )}
                </div>
            </ScrollArea>
        </motion.div >
    );
};

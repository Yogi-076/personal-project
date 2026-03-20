import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    BarChart3, ShieldAlert, AlertTriangle, ShieldCheck,
    Info, X, Search, Trash2, ExternalLink, Loader2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Config } from "@/config";

interface Finding {
    id: string;
    title: string;
    severity: string;
    cvss?: string;
    cweId?: string;
    url?: string;
    parameter?: string;
    description?: string;
    evidence?: string;
    impact?: string;
    recommendation?: string;
    references?: string;
    addedAt?: string;
    type?: string;
}

interface FindingsDashboardProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onFindingDeleted: () => void;
}

const SEVERITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string; border: string }> = {
    critical: { label: "Critical", icon: <ShieldAlert className="w-4 h-4" />, bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
    high: { label: "High", icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
    medium: { label: "Medium", icon: <AlertTriangle className="w-4 h-4" />, bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
    low: { label: "Low", icon: <ShieldCheck className="w-4 h-4" />, bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
    info: { label: "Info", icon: <Info className="w-4 h-4" />, bg: "bg-slate-500/10", text: "text-slate-400", border: "border-slate-500/30" },
};

export function FindingsDashboard({ projectId, open, onOpenChange, onFindingDeleted }: FindingsDashboardProps) {
    const { toast } = useToast();
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [filterSev, setFilterSev] = useState("all");
    const [selected, setSelected] = useState<Finding | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchFindings = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('vmt_token');
            const res = await fetch(`${Config.API_URL}/api/projects/${projectId}/findings`, {
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) setFindings(await res.json());
        } catch (e) {
            console.error("Findings fetch failed", e);
        } finally {
            setLoading(false);
        }
    }, [projectId]);

    useEffect(() => {
        if (open) fetchFindings();
    }, [open, fetchFindings]);

    const handleDelete = async (id: string, title: string) => {
        setDeleting(id);
        try {
            const token = localStorage.getItem('vmt_token');
            const res = await fetch(`${Config.API_URL}/api/projects/${projectId}/findings/${id}`, { 
                method: "DELETE",
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (res.ok) {
                toast({ title: "Finding deleted", description: `"${title}" removed.` });
                setFindings(prev => prev.filter(f => f.id !== id));
                if (selected?.id === id) setSelected(null);
                onFindingDeleted();
            }
        } catch {
            toast({ variant: "destructive", title: "Delete failed" });
        } finally {
            setDeleting(null);
        }
    };

    // Aggregate counts
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    findings.forEach(f => { const s = f.severity as keyof typeof counts; if (counts[s] !== undefined) counts[s]++; });

    const filtered = findings.filter(f => {
        const matchSev = filterSev === "all" || f.severity === filterSev;
        const matchSearch = !search || f.title.toLowerCase().includes(search.toLowerCase()) || (f.url || "").includes(search);
        return matchSev && matchSearch;
    });

    const cfg = (sev: string) => SEVERITY_CONFIG[sev] || SEVERITY_CONFIG.info;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[900px] border-emerald-500/20 bg-black/95 backdrop-blur-xl max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-emerald-100">
                        <BarChart3 className="w-5 h-5 text-emerald-400" />
                        Findings Dashboard
                    </DialogTitle>
                </DialogHeader>

                {/* Summary Strip */}
                <div className="grid grid-cols-5 gap-2">
                    {Object.entries(counts).map(([sev, count]) => {
                        const c = cfg(sev);
                        return (
                            <button
                                key={sev}
                                onClick={() => setFilterSev(filterSev === sev ? "all" : sev)}
                                className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer ${c.bg} ${c.border} ${filterSev === sev ? "ring-2 ring-white/20" : ""}`}
                            >
                                <div className={`text-xl font-black ${c.text}`}>{count}</div>
                                <div className={`text-[10px] uppercase font-bold ${c.text}/70`}>{c.label}</div>
                            </button>
                        );
                    })}
                </div>

                {/* Search + Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <Input placeholder="Search findings..." className="pl-9 bg-black/50 border-white/10" value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <Select value={filterSev} onValueChange={setFilterSev}>
                        <SelectTrigger className="w-36 bg-black/50 border-white/10">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-950 border-white/10">
                            <SelectItem value="all">All Severity</SelectItem>
                            {Object.entries(SEVERITY_CONFIG).map(([v, c]) => (
                                <SelectItem key={v} value={v}><span className={c.text}>{c.label}</span></SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
                    {/* Finding List */}
                    <div className="w-64 flex-shrink-0 overflow-y-auto custom-scrollbar space-y-1">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
                            </div>
                        ) : filtered.length === 0 ? (
                            <div className="p-6 text-center text-muted-foreground text-sm">
                                {findings.length === 0 ? "No manual findings yet." : "No results found."}
                            </div>
                        ) : filtered.map(f => {
                            const c = cfg(f.severity);
                            return (
                                <div
                                    key={f.id}
                                    onClick={() => setSelected(f)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-white/5 ${selected?.id === f.id ? "bg-white/10 border-white/20" : "border-white/5"}`}
                                >
                                    <div className={`text-xs font-bold uppercase mb-1 flex items-center gap-1 ${c.text}`}>
                                        {c.icon} {c.label}
                                    </div>
                                    <div className="text-sm font-medium text-foreground leading-snug">{f.title}</div>
                                    {f.url && <div className="text-[10px] text-muted-foreground font-mono truncate mt-0.5">{f.url}</div>}
                                </div>
                            );
                        })}
                    </div>

                    {/* Finding Detail */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        {!selected ? (
                            <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-8">
                                <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                                <p className="text-sm">Select a finding to view details</p>
                            </div>
                        ) : (() => {
                            const c = cfg(selected.severity);
                            return (
                                <div className="space-y-4">
                                    {/* Header */}
                                    <div className={`p-4 rounded-xl border ${c.bg} ${c.border}`}>
                                        <div className={`text-xs font-bold uppercase mb-1 flex items-center gap-1 ${c.text}`}>
                                            {c.icon} {c.label}
                                            {selected.cvss && <span className="ml-2 bg-black/30 px-1.5 py-0.5 rounded text-white font-mono">CVSS: {selected.cvss}</span>}
                                            {selected.cweId && <span className="bg-black/30 px-1.5 py-0.5 rounded font-mono">{selected.cweId}</span>}
                                        </div>
                                        <h3 className="text-base font-bold text-white">{selected.title}</h3>
                                        {selected.url && (
                                            <div className="flex items-center gap-1 mt-1.5 text-xs font-mono text-blue-300 bg-black/30 px-2 py-1 rounded">
                                                <ExternalLink className="w-3 h-3" />
                                                <span className="truncate">{selected.url}</span>
                                                {selected.parameter && <Badge variant="outline" className="ml-1 text-[10px] py-0 border-blue-500/30 text-blue-400">param: {selected.parameter}</Badge>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Details */}
                                    {[
                                        { label: "Description", value: selected.description },
                                        { label: "Proof of Concept / Evidence", value: selected.evidence, mono: true },
                                        { label: "Impact", value: selected.impact },
                                        { label: "Recommendation", value: selected.recommendation },
                                        { label: "References", value: selected.references },
                                    ].filter(row => row.value).map(row => (
                                        <div key={row.label} className="space-y-1">
                                            <div className="text-[11px] uppercase font-bold tracking-wider text-slate-500">{row.label}</div>
                                            <div className={`text-sm text-slate-200 whitespace-pre-wrap ${row.mono ? "font-mono bg-black/40 p-3 rounded-lg border border-white/5 text-xs text-slate-300" : ""}`}>
                                                {row.value}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Actions */}
                                    <div className="flex gap-2 pt-2 border-t border-white/5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                            onClick={() => handleDelete(selected.id, selected.title)}
                                            disabled={!!deleting}
                                        >
                                            {deleting === selected.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

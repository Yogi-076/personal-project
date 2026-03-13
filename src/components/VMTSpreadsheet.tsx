import React, { useState, useEffect, useRef, useCallback } from 'react';
import Config from '@/config';
import { io } from "socket.io-client";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ShieldAlert, Share2, Activity, Shield, Copy, Check, Filter, Clock, Search, ExternalLink, Database } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { vmtApi, scannerApi } from "@/lib/api_vmt";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

// --- Types ---
interface Vulnerability {
    id: string;
    project_id: string;
    endpoint: string;
    issue_name: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
    status: string;
    issue_summary: string;
    mitigation: string;
    [key: string]: any;
}

interface VulnerabilityColumn {
    id: string;
    label: string;
    width: number;
    readOnly?: boolean;
    type?: 'text' | 'select';
    options?: string[];
}

const COLUMNS: VulnerabilityColumn[] = [
    { id: 'endpoint', label: 'Endpoint', width: 200 },
    { id: 'issue_name', label: 'Issue Name', width: 250 },
    { id: 'owasp', label: 'OWASP Top 10', width: 200 },
    { id: 'severity', label: 'Severity', width: 100, type: 'select', options: ['Critical', 'High', 'Medium', 'Low', 'Info'] },
    { id: 'cweId', label: 'CWE ID', width: 90 },
    { id: 'cweName', label: 'CWE Name', width: 250 },
    { id: 'cvss', label: 'CVSS', width: 70 },
    { id: 'issue_summary', label: 'Issue Summary', width: 300 },
    { id: 'mitigation', label: 'Mitigation', width: 300 },
    { id: 'status', label: 'Status', width: 120, type: 'select', options: ['Open', 'In Progress', 'Closed', 'Risk Accepted'] },
];

const SnapshotList = ({ projectId, onLoad }: { projectId: string, onLoad: (data: any[]) => void }) => {
    const [snapshots, setSnapshots] = useState<any[]>([]);

    useEffect(() => {
        // Load snapshots for the current project context
        vmtApi.getSnapshots(projectId)
            .then(setSnapshots)
            .catch(console.error);
    }, [projectId]);

    if (snapshots.length === 0) return <p className="text-[10px] text-muted-foreground text-center py-2">No history found</p>;

    return (
        <div className="space-y-1">
            {snapshots.map(snap => (
                <div key={snap.id} className="flex items-center justify-between p-2 rounded bg-white/5 hover:bg-white/10 group">
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-xs font-medium text-white truncate w-32" title={snap.name}>{snap.name}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(snap.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-6 w-6" title="Load" onClick={async () => {
                            if (confirm(`Load snapshot "${snap.name}"? Unsaved changes will be lost.`)) {
                                const fullSnap = await vmtApi.getSnapshot(snap.id);
                                if (fullSnap) onLoad(fullSnap.data);
                                toast.success("Snapshot Loaded");
                            }
                        }}>
                            <Activity className="w-3 h-3 text-cyan-400" />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export const VMTSpreadsheet = ({ initialProjectId }: { initialProjectId?: string }) => {
    const { user } = useAuth();
    const [data, setData] = useState<Vulnerability[]>([]);
    const defaultProjectId = user ? `manual-project-${user.id}` : 'manual-project-default';
    const currentProjectId = initialProjectId || (data.length > 0 ? data[0].project_id : defaultProjectId);
    const [filterSeverity, setFilterSeverity] = useState<string>("All"); // All, Critical, High, Medium, Low, Info
    const [selection, setSelection] = useState<{ start: { row: number, col: number }, end: { row: number, col: number } } | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [reportName, setReportName] = useState("VAPT_Report");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
    const [expansionModal, setExpansionModal] = useState<{ rowId: string, colId: string, value: string } | null>(null);
    const [socket, setSocket] = useState<any>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<any>(null);

    // --- Data Loading & Socket (Preserved) ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const scans = await scannerApi.getHistory();
                let activeProjectId = initialProjectId || defaultProjectId;
                
                // If no initialProjectId but history exists, use first scan
                if (!initialProjectId && scans && scans.length > 0) {
                    activeProjectId = scans[0].id;
                }

                let findingsData = [];
                try {
                    const reportDetail = await scannerApi.getResults(activeProjectId);
                    if (reportDetail.findings) {
                        findingsData = reportDetail.findings.map((f: any) => ({
                            id: f.id,
                            project_id: activeProjectId,
                            endpoint: f.url || f.endpoint || "N/A",
                            issue_name: f.title || f.name || f.issue_name || "Unknown",
                            owasp: f.owasp || f.owasp_category || "",
                            severity: f.severity || f.issue_severity || "Medium",
                            cweId: f.cweId || f.cwe_id || "",
                            cweName: f.cweName || f.cwe_name || "",
                            cvss: f.cvss || f.cvssScore || "",
                            issue_summary: f.description || f.summary || f.issue_summary || "No description provided",
                            mitigation: f.remediation || f.mitigation || "Pending",
                            status: f.status || "Open",
                        }));
                    }
                } catch (e) {
                    try {
                        activeProjectId = defaultProjectId;
                        const defaultScan = await vmtApi.getVulnerabilities(activeProjectId);
                        if (Array.isArray(defaultScan)) {
                            findingsData = defaultScan;
                        } else {
                            const scanObj = defaultScan as any;
                            if (scanObj && scanObj.findings) findingsData = scanObj.findings;
                        }
                    } catch (fallbackErr) { console.error(fallbackErr); }
                }

                if (findingsData.length > 0) setData(findingsData);
                else setData([]);
            } catch (e) {
                console.error("Failed to load VMT data", e);
            }
        };
        loadData();
    }, [initialProjectId]);

    useEffect(() => {
        const newSocket = io(Config.API_URL);
        setSocket(newSocket);
        newSocket.on('row_updated', (updatedRow: Vulnerability) => {
            setData(prev => prev.map(row => row.id === updatedRow.id ? updatedRow : row));
        });
        newSocket.on('row_added', (newRow: Vulnerability) => {
            setData(prev => {
                if (prev.find(r => r.id === newRow.id)) return prev;
                return [...prev, newRow];
            });
        });
        newSocket.on('row_deleted', (id: string) => {
            setData(prev => prev.filter(row => row.id !== id));
        });
        return () => { newSocket.close(); };
    }, []);

    // --- Search & Sort Logic ---
    const filteredAndSortedData = React.useMemo(() => {
        let result = [...data];

        // 1. Filter by Severity
        if (filterSeverity !== 'All') {
            result = result.filter(r => r.severity === filterSeverity);
        }

        // 2. Search Term Filter
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(r =>
                (r.endpoint?.toLowerCase().includes(lowerSearch)) ||
                (r.issue_name?.toLowerCase().includes(lowerSearch)) ||
                (r.issue_summary?.toLowerCase().includes(lowerSearch)) ||
                (r.cweName?.toLowerCase().includes(lowerSearch)) ||
                (r.owasp?.toLowerCase().includes(lowerSearch))
            );
        }

        // 3. Sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const aVal = a[sortConfig.key] || '';
                const bVal = b[sortConfig.key] || '';

                if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [data, filterSeverity, searchTerm, sortConfig]);

    const requestSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // --- Navigation & Selection Logic ---

    // Move selection with bounds checking
    const moveSelection = (dRow: number, dCol: number, extend: boolean) => {
        if (!selection) {
            setSelection({ start: { row: 0, col: 0 }, end: { row: 0, col: 0 } });
            return;
        }

        const newEndRow = Math.max(0, Math.min(data.length - 1, selection.end.row + dRow));
        const newEndCol = Math.max(0, Math.min(COLUMNS.length - 1, selection.end.col + dCol));

        setSelection(prev => {
            if (!prev) return null;
            return {
                start: extend ? prev.start : { row: newEndRow, col: newEndCol },
                end: { row: newEndRow, col: newEndCol }
            };
        });
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (editMode) {
            if (e.key === 'Enter') {
                e.preventDefault();
                setEditMode(false);
                moveSelection(1, 0, false);
                gridRef.current?.focus();
            }
            if (e.key === 'Escape') {
                setEditMode(false);
                gridRef.current?.focus();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                moveSelection(-1, 0, e.shiftKey);
                break;
            case 'ArrowDown':
                e.preventDefault();
                moveSelection(1, 0, e.shiftKey);
                break;
            case 'ArrowLeft':
                e.preventDefault();
                moveSelection(0, -1, e.shiftKey);
                break;
            case 'ArrowRight':
                e.preventDefault();
                moveSelection(0, 1, e.shiftKey);
                break;
            case 'Tab':
                e.preventDefault();
                moveSelection(0, e.shiftKey ? -1 : 1, false);
                break;
            case 'Enter':
                e.preventDefault();
                if (selection) {
                    setEditMode(true);
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (selection) {
                    handleBulkUpdate("");
                }
                break;
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    handleCopy();
                }
                break;
        }
    }, [editMode, selection, data]);

    const handleCopy = () => {
        if (!selection) return;
        const minRow = Math.min(selection.start.row, selection.end.row);
        const maxRow = Math.max(selection.start.row, selection.end.row);
        const minCol = Math.min(selection.start.col, selection.end.col);
        const maxCol = Math.max(selection.start.col, selection.end.col);

        let tsv = "";
        for (let r = minRow; r <= maxRow; r++) {
            const rowData = [];
            for (let c = minCol; c <= maxCol; c++) {
                const colId = COLUMNS[c].id;
                rowData.push(data[r][colId] || "");
            }
            tsv += rowData.join("\t") + "\n";
        }
        navigator.clipboard.writeText(tsv).then(() => {
            toast("Copied to clipboard", { icon: <Copy className="w-3 h-3" /> });
        });
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        if (!selection || editMode) return;
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const rows = text.split(/\r\n|\n|\r/).filter(r => r);

        const startRow = Math.min(selection.start.row, selection.end.row);
        const startCol = Math.min(selection.start.col, selection.end.col);

        const updates: { id: string, field: string, value: string }[] = [];

        rows.forEach((rowStr, rIdx) => {
            const cells = rowStr.split('\t');
            const targetRowIdx = startRow + rIdx;
            if (targetRowIdx >= data.length) return;

            cells.forEach((cellVal, cIdx) => {
                const targetColIdx = startCol + cIdx;
                if (targetColIdx >= COLUMNS.length) return;

                const colId = COLUMNS[targetColIdx].id;
                const rowId = data[targetRowIdx].id;

                if (COLUMNS[targetColIdx].readOnly) return;

                setData(prev => prev.map(r =>
                    r.id === rowId ? { ...r, [colId]: cellVal } : r
                ));

                updates.push({ id: rowId, field: colId, value: cellVal });
            });
        });

        for (const up of updates) {
            const row = data.find(d => d.id === up.id);
            const pid = row ? row.project_id : 'manual-project-default';
            vmtApi.updateVulnerability(up.id, pid, up.field, up.value).catch(console.error);
        }
    };

    const handleBulkUpdate = (val: string) => {
        if (!selection) return;
        const minRow = Math.min(selection.start.row, selection.end.row);
        const maxRow = Math.max(selection.start.row, selection.end.row);
        const minCol = Math.min(selection.start.col, selection.end.col);
        const maxCol = Math.max(selection.start.col, selection.end.col);

        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (COLUMNS[c].readOnly) continue;
                const rowId = data[r].id;
                const colId = COLUMNS[c].id;
                const safeVal = sanitizeString(val, colId === 'issue_summary' || colId === 'mitigation' ? 2000 : 255);
                handleUpdate(rowId, colId, safeVal);
            }
        }
    };

    const handleUpdate = (id: string, field: string, value: string) => {
        let finalValue = value;
        if (field === 'cvss') {
            const num = parseFloat(value);
            if (isNaN(num) || num < 0 || num > 10) finalValue = "";
        }

        const maxLength = (field === 'issue_summary' || field === 'mitigation') ? 2000 : 255;
        const safeValue = sanitizeString(finalValue, maxLength);

        setData(prev => prev.map(row => row.id === id ? { ...row, [field]: safeValue } : row));
        const row = data.find(r => r.id === id);
        const projectId = row ? row.project_id : 'manual-project-default';
        vmtApi.updateVulnerability(id, projectId, field, safeValue).catch(e => {
            console.error(e);
            toast.error("Save failed");
        });
    };

    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        setEditMode(false);
        setIsDragging(true);
        setSelection({
            start: { row: r, col: c },
            end: { row: r, col: c }
        });
        gridRef.current?.focus();
    };

    const handleMouseEnter = (r: number, c: number) => {
        if (isDragging) {
            setSelection(prev => {
                if (!prev) return null;
                return { ...prev, end: { row: r, col: c } };
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (editMode && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editMode]);

    const renderCellContent = (row: Vulnerability, col: VulnerabilityColumn) => {
        const val = row[col.id];
        if (col.id === 'severity') {
            return (
                <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide shadow-sm border",
                    val === 'Critical' ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/10" :
                    val === 'High' ? "bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-orange-500/10" :
                    val === 'Medium' ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10" :
                    val === 'Low' ? "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/10" :
                    "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10"
                )}>
                    {val || 'Info'}
                </span>
            );
        }
        if (col.id === 'status') {
            return (
                <span className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-semibold border uppercase tracking-wider",
                    val === 'Open' ? "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20" :
                    val === 'Closed' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                    "bg-white/5 text-muted-foreground border-white/10"
                )}>
                    {val || 'Open'}
                </span>
            );
        }
        return val;
    };

    return (
        <div className="flex h-full bg-background/20 backdrop-blur-xl relative z-20 overflow-hidden border border-cyber-cyan/20 rounded-xl flex-col shadow-[0_0_40px_-10px_rgba(6,182,212,0.1)]">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 p-3 sm:p-4 border-b border-white/10 bg-black/40 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 text-cyber-cyan font-black px-2 sm:px-3 py-1 sm:py-1.5 bg-cyber-cyan/10 rounded-lg border border-cyber-cyan/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                        <ShieldAlert className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                        <span className="tracking-[0.15em] sm:tracking-[0.2em] text-[9px] sm:text-[10px] uppercase">VMT Matrix</span>
                    </div>
                    <div className="hidden sm:block h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-2 group">
                        <input
                            className="bg-transparent border-none text-[10px] sm:text-xs font-bold text-white/90 focus:outline-none focus:ring-0 rounded px-1 sm:px-2 py-0.5 sm:py-1 w-24 sm:w-36 transition-all group-hover:bg-white/5"
                            value={reportName}
                            onChange={(e) => setReportName(e.target.value)}
                            placeholder="VAPT_SNAPSHOT"
                        />
                        <span className="hidden xs:inline-block text-[8px] sm:text-[9px] text-muted-foreground font-mono bg-white/5 px-1.5 sm:px-2 py-0.5 rounded-full border border-white/5">CSV</span>
                    </div>
                </div>

                <div className="flex-1" />

                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-cyber-cyan/20 text-muted-foreground hover:text-cyber-cyan transition-all rounded-lg"
                        title="Add Empty Row"
                        onClick={async () => {
                            const newRow = {
                                endpoint: "", issue_name: "", severity: "Info", status: "Open",
                                issue_summary: "", mitigation: "", project_id: currentProjectId
                            };
                            const tempId = `temp-${Date.now()}`;
                            const optimisicRow = { ...newRow, id: tempId } as Vulnerability;
                            setData(prev => [...prev, optimisicRow]);

                            try {
                                const saved = await vmtApi.addVulnerability(newRow.project_id, newRow);
                                setData(prev => prev.map(r => r.id === tempId ? saved : r));
                                toast.success("Row Initialized");
                            } catch (e) {
                                console.error(e);
                                toast.error("Database Link Error");
                            }
                        }}>
                        <Plus className="w-4 h-4" />
                    </Button>

                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all rounded-lg"
                        title="Delete Selected Row(s)"
                        onClick={() => {
                            if (!selection) return;
                            const minR = Math.min(selection.start.row, selection.end.row);
                            const maxR = Math.max(selection.start.row, selection.end.row);
                            const rowsToDelete = [];
                            for (let i = minR; i <= maxR; i++) {
                                if (data[i]) rowsToDelete.push(data[i]);
                            }
                            setData(prev => prev.filter((_, idx) => idx < minR || idx > maxR));
                            setSelection(null);
                            rowsToDelete.forEach(row => {
                                vmtApi.deleteVulnerability(row.project_id, row.id).catch(e => console.error("Delete failed", e));
                            });
                        }}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-white px-3 hover:bg-white/10 rounded-lg">
                                <Clock className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">History</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64 bg-slate-900/95 border-white/10 backdrop-blur-xl shadow-2xl">
                            <DropdownMenuLabel className="text-muted-foreground text-[10px] uppercase font-black px-4 py-2">Snapshot Repository</DropdownMenuLabel>
                            <div className="p-3 pt-0 space-y-3">
                                <Button
                                    size="sm"
                                    className="w-full bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/30 rounded-lg h-9 font-bold"
                                    onClick={async () => {
                                        const name = prompt("Snapshot Signature:", `SNAP-${new Date().getTime().toString().slice(-4)}`);
                                        if (name) {
                                            const pid = data.length > 0 ? data[0].project_id : 'manual-project-default';
                                            await vmtApi.saveSnapshot(pid, name, data);
                                            toast.success("Snapshot Commit Successful");
                                        }
                                    }}
                                >
                                    <Plus className="w-3.5 h-3.5 mr-2" /> CREATE SNAPSHOT
                                </Button>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <div className="max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                    <SnapshotList projectId={currentProjectId} onLoad={(snapData) => setData(snapData)} />
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="h-4 w-px bg-white/10" />

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-white px-3 hover:bg-white/10 rounded-lg">
                                <Filter className="w-3.5 h-3.5" />
                                <span className="text-[11px] font-bold uppercase tracking-wider">{filterSeverity === 'All' ? 'Filters' : filterSeverity}</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-56 bg-slate-900/95 border-white/10 backdrop-blur-xl shadow-2xl">
                            <DropdownMenuLabel className="text-muted-foreground text-[10px] uppercase font-black px-4 py-2">Severity Isolation</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuRadioGroup value={filterSeverity} onValueChange={setFilterSeverity}>
                                <DropdownMenuRadioItem value="All" className="text-xs transition-colors focus:bg-white/5">All Findings</DropdownMenuRadioItem>
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuRadioItem value="Critical" className="text-xs text-red-500 focus:bg-red-500/10">Critical High-Risk</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="High" className="text-xs text-orange-500 focus:bg-orange-500/10">High Severity</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Medium" className="text-xs text-amber-500 focus:bg-amber-500/10">Medium Risk</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Low" className="text-xs text-blue-500 focus:bg-blue-500/10">Low Priority</DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="Info" className="text-xs text-emerald-500 focus:bg-emerald-500/10">Informational</DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                <div className="flex items-center gap-3 bg-white/5 p-1 rounded-xl border border-white/10">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 font-bold text-[11px] px-3 rounded-lg transition-all"
                        onClick={() => {
                            const headers = COLUMNS.map(c => c.label).join(",");
                            const rows = data.map(row => COLUMNS.map(c => `"${(row[c.id] || "").toString().replace(/"/g, '""')}"`).join(","));
                            const csvContent = [headers, ...rows].join("\n");
                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement("a");
                            if (link.download !== undefined) {
                                const url = URL.createObjectURL(blob);
                                link.setAttribute("href", url);
                                link.setAttribute("download", `${reportName || 'report'}.csv`);
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                toast.success("Export Complete");
                            }
                        }}
                    >
                        <Check className="w-3.5 h-3.5 mr-2" /> EXCEL EXPORT
                    </Button>

                    <div className="h-4 w-px bg-white/10" />

                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-1 transition-all focus-within:border-cyber-cyan/50 focus-within:shadow-[0_0_10px_rgba(6,182,212,0.1)]">
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <input
                            placeholder="Quick Index..."
                            className="bg-transparent border-none text-[11px] text-white focus:outline-none w-32 placeholder:text-muted-foreground/50 uppercase font-mono"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="ml-auto flex items-center gap-3 pr-2">
                    <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-black border border-emerald-500/20 px-3 py-1 rounded-full bg-emerald-500/5 shadow-[0_0_20px_-5px_rgba(16,185,129,0.3)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse_1.5s_infinite]" />
                        SECURE UPLINK
                    </div>
                    <Button variant="outline" size="sm" className="h-8 border-white/10 hover:border-cyber-cyan/50 text-muted-foreground hover:text-cyber-cyan bg-transparent rounded-lg px-3 transition-all"
                        onClick={() => { 
                            const shareUrl = `${window.location.origin}/vmt/${currentProjectId}`;
                            navigator.clipboard.writeText(shareUrl); 
                            toast.success("Share Link Copied"); 
                        }}>
                        <Share2 className="w-3.5 h-3.5 mr-2" />
                        <span className="text-[11px] font-bold uppercase">Share</span>
                    </Button>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
                {filteredAndSortedData.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-black/20 backdrop-blur-sm relative overflow-hidden group">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="relative z-10 flex flex-col items-center max-w-md"
                        >
                            <div className="w-24 h-24 mb-6 rounded-3xl bg-gradient-to-br from-cyber-cyan/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-2xl">
                                <ShieldAlert className="w-12 h-12 text-cyber-cyan animate-pulse" />
                            </div>
                            <h3 className="text-2xl font-black text-white mb-3 tracking-tight italic uppercase">
                                No Findings <span className="text-cyber-cyan">Detected</span>
                            </h3>
                            <Button
                                className="h-12 bg-cyber-cyan text-black font-black uppercase tracking-widest hover:bg-cyber-cyan/90 transition-all rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                                onClick={async () => {
                                    const targetProjectId = currentProjectId;
                                    const newRow = { endpoint: "", issue_name: "", severity: "Info", status: "Open", issue_summary: "", mitigation: "", project_id: targetProjectId };
                                    const saved = await vmtApi.addVulnerability(targetProjectId, newRow);
                                    setData([saved]);
                                }}
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Create First Row
                            </Button>
                        </motion.div>
                    </div>
                )}

                {filteredAndSortedData.length > 0 && (
                    <div
                        className="flex-1 overflow-auto relative custom-scrollbar outline-none select-none transition-all duration-500"
                        tabIndex={0}
                        ref={gridRef}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        <table className="w-full border-collapse relative min-w-[1400px]">
                            <thead className="sticky top-0 z-10 bg-black/40 backdrop-blur-xl border-b border-cyber-cyan/20 shadow-lg shadow-black/20">
                                <tr>
                                    <th className="w-10 border-r border-b border-white/5 bg-white/5 shrink-0"></th>
                                    {COLUMNS.map((col) => (
                                        <th
                                            key={col.id}
                                            className={cn(
                                                "border-r border-b border-white/5 bg-white/[0.02] px-3 py-2.5 text-[10px] font-black text-cyber-cyan tracking-wider uppercase cursor-pointer hover:bg-white/10",
                                                sortConfig?.key === col.id ? "bg-cyber-cyan/10" : ""
                                            )}
                                            style={{ width: col.width, minWidth: col.width }}
                                            onClick={() => requestSort(col.id)}
                                        >
                                            <div className="flex items-center justify-between gap-1">
                                                <span>{col.label}</span>
                                                {sortConfig?.key === col.id && (
                                                    <span className="text-[8px] text-cyber-cyan/50">
                                                        {sortConfig.direction === 'asc' ? '▲' : '▼'}
                                                    </span>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-black/20">
                                <AnimatePresence mode="popLayout">
                                    {filteredAndSortedData.map((row, rIdx) => (
                                        <motion.tr
                                            key={row.id}
                                            initial={{ opacity: 0, scale: 0.98 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            className="group transition-all duration-300 border-b border-white/[0.03] hover:bg-cyber-cyan/[0.04] active:bg-cyber-cyan/[0.06]"
                                        >
                                            <td className="border-r border-white/5 bg-white/[0.01] w-10 text-center text-[10px] font-mono text-muted-foreground/30 py-2 select-none group-hover:bg-cyber-cyan/5 transition-colors">
                                                {rIdx + 1}
                                            </td>
                                            {COLUMNS.map((col, cIdx) => {
                                                const isSel = selection &&
                                                    rIdx >= Math.min(selection.start.row, selection.end.row) &&
                                                    rIdx <= Math.max(selection.start.row, selection.end.row) &&
                                                    cIdx >= Math.min(selection.start.col, selection.end.col) &&
                                                    cIdx <= Math.max(selection.start.col, selection.end.col);

                                                const isFocused = selection && selection.end.row === rIdx && selection.end.col === cIdx;
                                                const isEditing = isFocused && editMode && !col.readOnly;

                                                return (
                                                    <td
                                                        key={col.id}
                                                        className={cn(
                                                            "border-r border-white/[0.03] px-3 py-2 text-xs relative cursor-cell transition-all duration-200",
                                                            isSel ? "bg-cyber-cyan/15 text-cyber-cyan/90 backdrop-blur-sm" : "",
                                                            isFocused ? "ring-2 ring-inset ring-cyber-cyan/50 shadow-[0_0_25px_rgba(6,182,212,0.3)] z-20 bg-cyber-cyan/10" : "hover:bg-white/[0.03]"
                                                        )}
                                                        onMouseDown={(e) => handleMouseDown(rIdx, cIdx, e)}
                                                        onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                                                        onDoubleClick={() => {
                                                            if (!col.readOnly) {
                                                                if (col.id === 'issue_summary' || col.id === 'mitigation') {
                                                                    setExpansionModal({ rowId: row.id, colId: col.id, value: row[col.id] || "" });
                                                                } else {
                                                                    setSelection({ start: { row: rIdx, col: cIdx }, end: { row: rIdx, col: cIdx } });
                                                                    setEditMode(true);
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        {isEditing ? (
                                                            <div className="absolute inset-0 z-30 p-1 bg-slate-900 shadow-2xl ring-1 ring-cyber-cyan">
                                                                {col.type === 'select' ? (
                                                                    <select
                                                                        autoFocus
                                                                        className="w-full h-full bg-transparent text-cyber-cyan font-bold outline-none text-xs"
                                                                        defaultValue={row[col.id]}
                                                                        onChange={(e) => {
                                                                            handleUpdate(row.id, col.id, e.target.value);
                                                                            setEditMode(false);
                                                                        }}
                                                                        onBlur={() => setEditMode(false)}
                                                                    >
                                                                        {col.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                ) : (
                                                                    <textarea
                                                                        ref={editInputRef}
                                                                        autoFocus
                                                                        className="w-full h-full bg-transparent text-white font-medium outline-none text-xs resize-none"
                                                                        defaultValue={row[col.id]}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') e.stopPropagation();
                                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                                e.preventDefault();
                                                                                handleUpdate(row.id, col.id, e.currentTarget.value);
                                                                                setEditMode(false);
                                                                                gridRef.current?.focus();
                                                                            }
                                                                        }}
                                                                        onBlur={(e) => {
                                                                            handleUpdate(row.id, col.id, e.currentTarget.value);
                                                                            setEditMode(false);
                                                                        }}
                                                                    />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="truncate w-full h-full min-h-[20px] flex items-center">
                                                                {renderCellContent(row, col)}
                                                            </div>
                                                        )}
                                                        {isFocused && !isEditing && (
                                                            <div className="absolute bottom-0 right-0 w-1.5 h-1.5 bg-cyber-cyan cursor-crosshair z-30 shadow-[0_0_5px_rgba(6,182,212,1)]" />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {expansionModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-slate-900 border border-cyber-cyan/30 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-black/40">
                                <h3 className="text-[10px] font-black text-cyber-cyan uppercase tracking-[0.2em] flex items-center gap-2 italic">
                                    <ExternalLink className="w-4 h-4" />
                                    Advanced Matrix Editor [ {COLUMNS.find(c => c.id === expansionModal.colId)?.label} ]
                                </h3>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={() => setExpansionModal(null)}>
                                    <Plus className="w-5 h-5 rotate-45" />
                                </Button>
                            </div>
                            <div className="p-6 flex-1 overflow-hidden">
                                <textarea
                                    autoFocus
                                    className="w-full h-full min-h-[300px] bg-black/30 border border-white/5 rounded-xl p-5 text-slate-200 outline-none focus:border-cyber-cyan/30 focus:ring-4 focus:ring-cyber-cyan/5 transition-all font-sans leading-relaxed resize-none custom-scrollbar"
                                    value={expansionModal.value}
                                    onChange={(e) => setExpansionModal({ ...expansionModal, value: e.target.value })}
                                />
                            </div>
                            <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end gap-3">
                                <Button variant="ghost" className="h-10 px-6 font-bold text-muted-foreground" onClick={() => setExpansionModal(null)}>Discard</Button>
                                <Button className="h-10 px-8 bg-cyber-cyan text-black hover:bg-cyber-cyan/80 font-black uppercase tracking-widest text-[11px] rounded-lg shadow-lg shadow-cyber-cyan/20" onClick={() => {
                                    handleUpdate(expansionModal.rowId, expansionModal.colId, expansionModal.value);
                                    setExpansionModal(null);
                                    toast.success("Matrix Synchronized");
                                }}>Commit Changes</Button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const sanitizeString = (str: string, max: number) => {
    if (!str) return "";
    return str.toString().slice(0, max);
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Config from '@/config';
import { io } from "socket.io-client";
import { cn } from "@/lib/utils";
import { Plus, Trash2, ShieldAlert, Share2, Activity, Shield, Copy, Check, Filter, Clock } from 'lucide-react';
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

const COLUMNS: { id: string, label: string, width: number, readOnly?: boolean }[] = [
    { id: 'id', label: 'ID', width: 60 },
    { id: 'issue_name', label: 'Vulnerability Name', width: 250 },
    { id: 'severity', label: 'Severity', width: 100 },
    { id: 'endpoint', label: 'Endpoint', width: 200 },
    { id: 'status', label: 'Status', width: 120 },
    { id: 'issue_summary', label: 'Summary', width: 300 },
    { id: 'mitigation', label: 'Mitigation', width: 300 },
];

const SnapshotList = ({ onLoad }: { onLoad: (data: any[]) => void }) => {
    const [snapshots, setSnapshots] = useState<any[]>([]);

    useEffect(() => {
        // Load snapshots for default project
        vmtApi.getSnapshots('manual-project-default')
            .then(setSnapshots)
            .catch(console.error);
    }, []);

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

export const VMTSpreadsheet = () => {
    const [data, setData] = useState<Vulnerability[]>([]);
    const [filterSeverity, setFilterSeverity] = useState<string>("All"); // All, Critical, High, Medium, Low, Info
    // Selection state: start (anchor) and end (focus)
    const [selection, setSelection] = useState<{ start: { row: number, col: number }, end: { row: number, col: number } } | null>(null);
    const [editMode, setEditMode] = useState(false);
    const [reportName, setReportName] = useState("VAPT_Report");
    const [socket, setSocket] = useState<any>(null);
    const gridRef = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // --- Data Loading & Socket (Preserved) ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const scans = await scannerApi.getHistory();
                let activeProjectId = 'manual-project-default';
                if (scans && scans.length > 0) activeProjectId = scans[0].id;

                let findingsData = [];
                try {
                    const reportDetail = await scannerApi.getResults(activeProjectId);
                    if (reportDetail.findings) {
                        findingsData = reportDetail.findings.map((f: any) => ({
                            id: f.id,
                            project_id: activeProjectId,
                            issue_name: f.title || f.name || f.issue_name || "Unknown",
                            severity: f.severity || f.issue_severity || "Medium",
                            status: f.status || "Open",
                            endpoint: f.url || f.endpoint || "N/A",
                            issue_summary: f.description || f.issue_summary || "No description provided",
                            mitigation: f.remediation || f.mitigation || "Pending",
                        }));
                    }
                } catch (e) {
                    try {
                        activeProjectId = 'manual-project-default';
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
    }, []);

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

        // Auto-scroll logic could go here
    };

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (editMode) {
            if (e.key === 'Enter') {
                e.preventDefault();
                setEditMode(false);
                // Move down on enter
                moveSelection(1, 0, false);
                gridRef.current?.focus();
            }
            if (e.key === 'Escape') {
                // Cancel edit (revert logic could go here)
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
                    // Focus logic handled in render/effect
                }
                break;
            case 'Delete':
            case 'Backspace':
                if (selection) {
                    // Bulk clear
                    handleBulkUpdate("");
                }
                break;
            case 'c':
                if (e.ctrlKey || e.metaKey) {
                    handleCopy();
                }
                break;
            case 'v':
                if (e.ctrlKey || e.metaKey) {
                    // Paste is usually handled by `onPaste` event, but we can prevent default if needed
                }
                break;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editMode, selection, data]);

    const handleCopy = () => {
        if (!selection) return;
        // Construct TSV string for clipboard (Google Sheets compatible)
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

        // Batch update accumulator
        const updates: { id: string, field: string, value: string }[] = [];

        rows.forEach((rowStr, rIdx) => {
            const cells = rowStr.split('\t');
            const targetRowIdx = startRow + rIdx;
            if (targetRowIdx >= data.length) return; // Don't overflow rows for now

            cells.forEach((cellVal, cIdx) => {
                const targetColIdx = startCol + cIdx;
                if (targetColIdx >= COLUMNS.length) return;

                const colId = COLUMNS[targetColIdx].id;
                const rowId = data[targetRowIdx].id;

                // Skip readOnly
                if (COLUMNS[targetColIdx].readOnly) return;

                // Optimistic local update
                setData(prev => prev.map(r =>
                    r.id === rowId ? { ...r, [colId]: cellVal } : r
                ));

                updates.push({ id: rowId, field: colId, value: cellVal });
            });
        });

        // Send updates to backend
        // In real world, use a bulk update API. Here we iterate (careful with rate limits)
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
                handleUpdate(rowId, colId, val);
            }
        }
    };

    const handleUpdate = (id: string, field: string, value: string) => {
        setData(prev => prev.map(row => row.id === id ? { ...row, [field]: value } : row));
        const row = data.find(r => r.id === id);
        const projectId = row ? row.project_id : 'manual-project-default';
        vmtApi.updateVulnerability(id, projectId, field, value).catch(e => {
            console.error(e);
            toast.error("Save failed");
        });
    };

    // --- Mouse Selection Handlers ---
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (r: number, c: number, e: React.MouseEvent) => {
        if (e.button !== 0) return; // Left click only
        setEditMode(false);
        setIsDragging(true);
        setSelection({
            start: { row: r, col: c },
            end: { row: r, col: c }
        });
        // Important: focus grid to capture keys
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

    // --- Render Logic ---
    useEffect(() => {
        // Focus input when edit mode starts
        if (editMode && editInputRef.current) {
            editInputRef.current.focus();
        }
    }, [editMode]);

    // Calculate selection overlay styles
    const getSelectionStyle = () => {
        if (!selection) return { display: 'none' };
        // We rely on cell dimensions. 
        // We will simple render conditional classes on cells instead of absolute overlay for simplicity first,
        // or we render a box if we knew pixel geometry. Google sheets uses a box.
        // Let's use cell borders for "Selected" look to avoid complex math with table layout.
        return {};
    };

    return (
        <div className="flex h-full bg-background/20 backdrop-blur-xl relative z-20 overflow-hidden border border-cyber-cyan/20 rounded-xl flex-col shadow-[0_0_40px_-10px_rgba(6,182,212,0.1)]">
            {/* Toolbar (Same as before) */}
            <div className="flex items-center gap-3 p-3 border-b border-white/10 bg-background/40 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-2 text-cyber-cyan font-bold px-2 bg-cyber-cyan/5 py-1 rounded border border-cyber-cyan/20">
                    <ShieldAlert className="w-4 h-4" />
                    <span className="tracking-[0.2em] text-xs">VMT MATRIX</span>
                </div>

                <div className="flex items-center gap-2 border-l border-white/10 pl-3 ml-2">
                    <span className="text-[10px] text-muted-foreground font-mono">FILE:</span>
                    <input
                        className="bg-transparent border-none text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-cyber-cyan/50 rounded px-1 w-32"
                        value={reportName}
                        onChange={(e) => setReportName(e.target.value)}
                    />
                    <span className="text-[10px] text-muted-foreground font-mono">.csv</span>
                </div>

                <div className="h-6 w-px bg-white/10 mx-2" />

                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 text-muted-foreground hover:text-white"
                    title="Add Empty Row"
                    onClick={async () => {
                        const newRow = {
                            endpoint: "",
                            issue_name: "",
                            severity: "Info",
                            status: "Open",
                            issue_summary: "",
                            mitigation: "",
                            project_id: data.length > 0 ? data[0].project_id : 'manual-project-default'
                        };

                        const tempId = `temp-${Date.now()}`;
                        const optimisicRow = { ...newRow, id: tempId } as Vulnerability;
                        setData(prev => [...prev, optimisicRow]);

                        try {
                            const saved = await vmtApi.addVulnerability(newRow.project_id, newRow);
                            setData(prev => prev.map(r => r.id === tempId ? saved : r));

                            setTimeout(() => {
                                setData(currentData => {
                                    const idx = currentData.findIndex(r => r.id === saved.id);
                                    if (idx !== -1) {
                                        setSelection({ start: { row: idx, col: 1 }, end: { row: idx, col: 1 } });
                                        setEditMode(true);
                                    }
                                    return currentData;
                                });
                            }, 50);

                            toast.success("Row Added");
                        } catch (e) {
                            console.error(e);
                            toast.error("Failed to save row");
                        }
                    }}><Plus className="w-4 h-4" /></Button>

                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-white/10 text-muted-foreground hover:text-white"
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
                    }}><Trash2 className="w-4 h-4" /></Button>

                <div className="h-6 w-px bg-white/10 mx-2" />

                {/* Snapshots Button */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-white">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="text-xs">History</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-64 bg-black/90 border-white/10 backdrop-blur-xl">
                        <DropdownMenuLabel>ReportSnapshots</DropdownMenuLabel>
                        <div className="p-2 space-y-2">
                            <Button
                                size="sm"
                                className="w-full bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50"
                                onClick={async () => {
                                    const name = prompt("Name this snapshot:", `Report-${new Date().toISOString().split('T')[0]}`);
                                    if (name) {
                                        const pid = data.length > 0 ? data[0].project_id : 'manual-project-default';
                                        await vmtApi.saveSnapshot(pid, name, data);
                                        toast.success("Snapshot Saved");
                                    }
                                }}
                            >
                                <Plus className="w-3 h-3 mr-2" /> Save Current
                            </Button>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <div className="max-h-48 overflow-y-auto space-y-1">
                                <SnapshotList onLoad={(snapData) => setData(snapData)} />
                            </div>
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-6 w-px bg-white/10 mx-2" />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground hover:text-white">
                            <Filter className="w-3.5 h-3.5" />
                            <span className="text-xs">{filterSeverity === 'All' ? 'Filter' : filterSeverity}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 bg-black/90 border-white/10 backdrop-blur-xl">
                        <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-white/10" />
                        <DropdownMenuRadioGroup value={filterSeverity} onValueChange={setFilterSeverity}>
                            <DropdownMenuRadioItem value="All">All Severities</DropdownMenuRadioItem>
                            <DropdownMenuSeparator className="bg-white/10" />
                            <DropdownMenuRadioItem value="Critical" className="text-red-500">Critical</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="High" className="text-orange-500">High</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="Medium" className="text-amber-500">Medium</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="Low" className="text-blue-500">Low</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="Info" className="text-emerald-500">Info</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-6 w-px bg-white/10 mx-2" />


                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 hover:bg-white/10 text-muted-foreground hover:text-green-400 font-mono text-xs"
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
                            toast.success("Report Downloaded", { description: "Opening in Excel..." });
                        }
                    }}
                >
                    <Check className="w-3 h-3 mr-2" /> EXCEL EXPORT
                </Button>

                <div className="ml-auto flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-[10px] text-green-500 font-mono border border-green-500/20 px-2 py-0.5 rounded bg-green-500/5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                        AUTO-SAVED
                    </div>
                    <Button variant="outline" size="sm" className="h-8 border-cyber-cyan/50 text-cyber-cyan"
                        onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link Copied"); }}>
                        <Share2 className="w-3 h-3 mr-2" /> Share
                    </Button>
                </div>
            </div>

            {/* Grid Area */}
            <div
                className="flex-1 overflow-auto relative custom-scrollbar outline-none select-none"
                tabIndex={0}
                ref={gridRef}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <table className="w-full border-collapse relative">
                    <thead className="sticky top-0 z-10 bg-black/40 backdrop-blur-xl border-b border-cyber-cyan/20 shadow-lg shadow-black/20">
                        <tr>
                            <th className="w-10 border-r border-b border-white/5 bg-white/5"></th>
                            {COLUMNS.map((col, idx) => (
                                <th key={col.id} className={cn("border-r border-b border-white/5 bg-white/[0.02] px-2 py-2 text-xs font-bold text-cyber-cyan tracking-wider uppercase shadow-[inset_0_-2px_4px_rgba(0,0,0,0.1)]")} style={{ width: col.width }}>
                                    {col.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-black/20">
                        <AnimatePresence>
                            {data.filter(r => filterSeverity === 'All' || r.severity === filterSeverity).map((row, rIdx) => (
                                <motion.tr
                                    key={row.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2, delay: rIdx * 0.03 }}
                                    className="group transition-all duration-200 hover:bg-cyber-cyan/[0.05]"
                                >
                                    <td className="w-10 bg-white/[0.01] border-r border-b border-white/5 text-center text-[10px] text-muted-foreground group-hover:text-cyber-cyan/70 transition-colors">
                                        {rIdx + 1}
                                    </td>
                                    {COLUMNS.map((col, cIdx) => {
                                        // Selection Logic
                                        const isSelected = selection &&
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
                                                    "border-r border-b border-white/5 px-2 py-1.5 text-sm relative cursor-cell transition-all duration-200",
                                                    isSelected ? "bg-cyber-cyan/10 text-cyber-cyan" : "",
                                                    isFocused ? "ring-1 ring-cyber-cyan shadow-[0_0_15px_rgba(6,182,212,0.3)] z-20 bg-cyber-cyan/5" : "hover:bg-white/5"
                                                )}
                                                onMouseDown={(e) => handleMouseDown(rIdx, cIdx, e)}
                                                onMouseEnter={() => handleMouseEnter(rIdx, cIdx)}
                                                onDoubleClick={() => {
                                                    if (!col.readOnly) {
                                                        setSelection({ start: { row: rIdx, col: cIdx }, end: { row: rIdx, col: cIdx } });
                                                        setEditMode(true);
                                                    }
                                                }}
                                            >
                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        className="w-full h-full bg-black/50 text-cyber-cyan font-semibold outline-none absolute inset-0 px-2 active-input backdrop-blur-sm"
                                                        defaultValue={row[col.id]}
                                                        onKeyDown={(e) => {
                                                            // Stop propagation so grid doesn't catch arrow keys during edit
                                                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') e.stopPropagation();
                                                            if (e.key === 'Enter') {
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
                                                ) : (
                                                    <div className="truncate w-full h-full min-h-[20px] pointer-events-none flex items-center">
                                                        {/* Rich Rendering for Severity & Status */}
                                                        {col.id === 'severity' ? (
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide shadow-sm border",
                                                                row[col.id] === 'Critical' ? "bg-red-500/10 text-red-500 border-red-500/20 shadow-red-500/10" :
                                                                    row[col.id] === 'High' ? "bg-orange-500/10 text-orange-500 border-orange-500/20 shadow-orange-500/10" :
                                                                        row[col.id] === 'Medium' ? "bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-amber-500/10" :
                                                                            row[col.id] === 'Low' ? "bg-blue-500/10 text-blue-500 border-blue-500/20 shadow-blue-500/10" :
                                                                                "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-emerald-500/10"
                                                            )}>{row[col.id] || 'Info'}</span>
                                                        ) : col.id === 'status' ? (
                                                            <span className={cn(
                                                                "px-2 py-0.5 rounded-md text-[10px] font-semibold border",
                                                                row[col.id] === 'Open' ? "bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/20" :
                                                                    row[col.id] === 'Closed' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                                                                        "bg-white/5 text-muted-foreground border-white/10"
                                                            )}>{row[col.id] || 'Unknown'}</span>
                                                        ) : row[col.id]}
                                                    </div>
                                                )}

                                                {/* Google Sheets Bottom Right Handle (Visual only for now) */}
                                                {isFocused && (
                                                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-cyber-cyan z-30 cursor-crosshair"></div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                    </tbody>
                </table>
                {data.length === 0 && (
                    <div className="flex flex-col items-center justify-center p-10 text-muted-foreground space-y-4">
                        <p className="font-mono text-xs">NO VULNERABILITIES FOUND</p>
                        <Button variant="outline" onClick={async () => {
                            const newRow = { endpoint: "/demo", issue_name: "Demo Vuln", severity: "Low", status: "Open", issue_summary: "Demo", mitigation: "Demo", project_id: 'manual-project-default' };
                            await vmtApi.addVulnerability('manual-project-default', newRow);
                        }}>Create First Row</Button>
                    </div>
                )}
            </div>
        </div>
    );
};



import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Download,
    FileText,
    Shield,
    AlertTriangle,
    XCircle,
    Info,
    CheckCircle,
    Search,
    ChevronDown,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VulnerabilityCard } from "./VulnerabilityCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DetailedFinding } from "./DetailedFinding";
import { Badge } from "@/components/ui/badge";

interface ScanResult {
    id: string;
    target: string;
    status: "completed" | "running" | "failed";
    startedAt: string;
    completedAt?: string;
    findings: Vulnerability[];
    summary: {
        total: number;
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
    };
}

interface Vulnerability {
    id: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    type: string;
    url: string;
    parameter?: string;
    evidence: string;
    remediation: string;
    description?: string;
    impact?: string;
    stepsToReproduce?: string;
    curlCommand?: string;
    reproductionUrl?: string;
    payload?: string;
    cvssScore: number;
    cwe?: string;
    owasp?: string;
}

interface GroupedVulnerability {
    type: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    instances: Vulnerability[];
    remediation: string;
    description: string;
    impact: string;
    cvssScore: number;
    cwe?: string;
    owasp?: string;
}

interface ScanReportProps {
    result: ScanResult;
}

// Define the VulnerabilityGroup component
interface VulnerabilityGroupProps {
    group: GroupedVulnerability;
    severityConfig: {
        [key: string]: {
            icon: any;
            color: string;
            bg: string;
            border: string;
            label: string;
        };
    };
}

const VulnerabilityGroup = ({ group, severityConfig }: VulnerabilityGroupProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedInstanceId, setExpandedInstanceId] = useState<string | null>(null);
    const severity = group.severity?.toLowerCase() || "info";
    const config = severityConfig[severity as keyof typeof severityConfig] || severityConfig.info;
    const Icon = config.icon;

    return (
        <Card className={`${config.bg} ${config.border} transition-all hover:shadow-md border-l-4`}>
            <div
                className="flex flex-row items-center justify-between cursor-pointer py-4 px-6"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <div className={`p-2 rounded-lg ${config.color} bg-background border shadow-sm`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <CardTitle className="text-base font-semibold text-foreground">{group.type}</CardTitle>
                            <Badge variant="outline" className={`${config.color} ${config.bg} bg-opacity-20 border-opacity-30 ${config.border}`}>
                                {config.label}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            {group.instances.length} instances • Max CVSS: {(group.cvssScore || 0).toFixed(1)}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
                </div>
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden bg-background/50 border-t"
                    >
                        <CardContent className="pt-6 pb-6 px-6 space-y-6">

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Description</h5>
                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                        {group.description || group.instances[0]?.description || "No description provided."}
                                    </p>
                                </div>
                                <div>
                                    <h5 className="text-xs font-bold text-muted-foreground uppercase mb-2">Impact</h5>
                                    <p className="text-sm text-foreground/90 leading-relaxed">
                                        {group.impact || group.instances[0]?.impact || "Impact assessment unavailable."}
                                    </p>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h5 className="text-xs font-bold text-muted-foreground uppercase">Affected Locations</h5>
                                <div className="rounded-md border bg-card">
                                    {group.instances.map((inst, i) => (
                                        <div key={inst.id} className="border-b last:border-0 group">
                                            <div
                                                className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors flex items-center justify-between"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedInstanceId(expandedInstanceId === inst.id ? null : inst.id);
                                                }}
                                            >
                                                <div className="flex-1 overflow-hidden pr-4">
                                                    <div className="font-mono text-sm text-foreground truncate flex items-center gap-2">
                                                        {expandedInstanceId === inst.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                                        {inst.url}
                                                    </div>
                                                    {inst.parameter && (
                                                        <div className="text-xs text-muted-foreground mt-1 ml-5">
                                                            Param: <span className="bg-muted px-1.5 py-0.5 rounded border">{inst.parameter}</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="font-mono text-xs font-semibold">
                                                    CVSS: {(Number(inst.cvssScore) || 0).toFixed(1)}
                                                </div>
                                            </div>

                                            <AnimatePresence>
                                                {expandedInstanceId === inst.id && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: "auto" }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="px-4 pb-4 overflow-hidden bg-muted/10 border-t border-dashed"
                                                    >
                                                        <div className="pt-4 ml-5">
                                                            <DetailedFinding finding={inst} />
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                                <h5 className="text-xs font-bold text-emerald-600 mb-2 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Remediation
                                </h5>
                                <p className="text-sm text-foreground/90 leading-relaxed font-medium">
                                    {group.remediation}
                                </p>
                            </div>
                        </CardContent>
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
    );
};

const NoFindings = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground bg-card border border-dashed rounded-xl">
        <div className="p-4 rounded-full bg-muted mb-4">
            <CheckCircle className="w-8 h-8 text-emerald-500" />
        </div>
        <p className="text-lg font-semibold text-foreground">All Clear</p>
        <p className="text-sm">No findings match your criteria.</p>
    </div>
);

export const ScanReport = ({ result }: ScanReportProps) => {
    const [filter, setFilter] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");
    const severityConfig = {
        critical: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", label: "Critical" },
        high: { icon: AlertTriangle, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "High" },
        medium: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", label: "Medium" },
        low: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Low" },
        info: { icon: CheckCircle, color: "text-gray-400", bg: "bg-gray-500/10", border: "border-gray-500/20", label: "Info" },
    };

    const getSeverityConfig = (sev: string) => {
        const s = (sev || "info").toLowerCase();
        return severityConfig[s as keyof typeof severityConfig] || severityConfig.info;
    };

    const handleExport = () => {
        const reportData = JSON.stringify(result, null, 2);
        const blob = new Blob([reportData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `security-report-${result.id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handlePrint = () => {
        window.print();
    };

    const [isGrouped, setIsGrouped] = useState(true);

    const filteredFindings = result.findings.filter((v) => {
        const matchFilter = filter === "all" || v.severity === filter;
        const matchSearch =
            v.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
            v.url.toLowerCase().includes(searchQuery.toLowerCase());
        return matchFilter && matchSearch;
    });

    // Grouping Logic
    const groupedFindings = filteredFindings.reduce((acc: { [key: string]: GroupedVulnerability }, curr) => {
        if (!acc[curr.type]) {
            acc[curr.type] = {
                type: curr.type,
                severity: curr.severity,
                instances: [],
                remediation: curr.remediation,
                description: curr.description || "No description provided.",
                impact: curr.impact || "No impact assessment provided.",
                cvssScore: curr.cvssScore
            };
        }
        acc[curr.type].instances.push(curr);
        if (curr.cvssScore > acc[curr.type].cvssScore) {
            acc[curr.type].cvssScore = curr.cvssScore;
            acc[curr.type].severity = curr.severity;
        }
        return acc;
    }, {});

    const groups = Object.values(groupedFindings);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8 print:space-y-4 font-sans"
        >
            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 md:items-start md:justify-between bg-card/40 backdrop-blur-md p-6 rounded-2xl border border-white/[0.05] shadow-lg print:border-none print:p-0">
                <div>
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-sky-500/20 flex items-center justify-center border border-primary/20 shadow-inner print:hidden">
                            <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <h2 className="text-2xl font-extrabold text-foreground tracking-tight print:text-black">
                            Assessment Report
                        </h2>
                    </div>
                    <div className="flex flex-col gap-1.5 pl-1">
                        <p className="text-muted-foreground text-sm font-medium">Target: <span className="text-foreground tracking-wide font-mono bg-white/[0.03] px-2 py-0.5 rounded">{result.target}</span></p>
                        <p className="text-xs text-muted-foreground/60 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                            Completed: {(() => {
                                const dStr = result.completedAt || result.startedAt;
                                if (!dStr) return "Date Unavailable";
                                const d = new Date(dStr);
                                return isNaN(d.getTime()) ? "Invalid Date" : d.toLocaleString();
                            })()}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3 print:hidden">
                    <Button variant="outline" size="sm" onClick={handleExport}>
                        <Download className="w-4 h-4 mr-2" />
                        Export JSON
                    </Button>
                    <Button
                        size="sm"
                        onClick={handlePrint}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        Print Report
                    </Button>
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs defaultValue="overview" className="w-full space-y-6">
                <TabsList className="bg-muted p-1 rounded-lg w-full md:w-auto grid grid-cols-2">
                    <TabsTrigger value="overview">Executive Summary</TabsTrigger>
                    <TabsTrigger value="findings">Technical Findings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Summary Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                            { label: "Total Issues", value: result.summary.total, severity: "all" },
                            { label: "Critical", value: result.summary.critical, severity: "critical" },
                            { label: "High", value: result.summary.high, severity: "high" },
                            { label: "Medium", value: result.summary.medium, severity: "medium" },
                            { label: "Low", value: result.summary.low, severity: "low" },
                        ].map((stat, i) => {
                            const isActive = filter === stat.severity;
                            const config = stat.severity !== "all" ? getSeverityConfig(stat.severity) : { color: 'text-foreground', border: 'border-border', bg: 'bg-transparent' };

                            return (
                                <Card
                                    key={stat.label}
                                    className={`cursor-pointer transition-all duration-300 overflow-hidden relative ${isActive ? `ring-1 ring-offset-0 ${config.bg} bg-opacity-20 ${config.border}` : 'bg-card/40 border-white/[0.04] hover:bg-card hover:border-white/[0.08]'}`}
                                    onClick={() => setFilter(stat.severity)}
                                >
                                    {isActive && <div className={`absolute inset-0 bg-gradient-to-br from-transparent to-${stat.severity === 'all' ? 'primary/10' : config.color.split('-')[1] + '-500/10'}`} />}
                                    <CardContent className="p-6 flex flex-col items-center justify-center text-center relative z-10">
                                        <div className={`text-4xl font-black mb-2 tracking-tighter drop-shadow-sm ${stat.severity === 'all' ? 'text-foreground' : config.color}`}>{stat.value}</div>
                                        <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/70">{stat.label}</div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {/* Recommendations Section */}
                    <Card className="border-l-4 border-l-sky-500 bg-card/30 border-y-white/[0.02] border-r-white/[0.02] backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Security Best Practices
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    {[
                                        "Perform regular security assessments",
                                        "Keep all dependencies updated"
                                    ].map((rec, i) => (
                                        <div key={i} className="flex gap-3 text-xs text-muted-foreground items-start font-medium">
                                            <div className="h-1.5 w-1.5 rounded-full bg-sky-500/50 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                                            {rec}
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-3">
                                    {[
                                        "Implement CSP and HSTS headers",
                                        "Follow OWASP ASVS guidelines"
                                    ].map((rec, i) => (
                                        <div key={i} className="flex gap-3 text-xs text-muted-foreground items-start font-medium">
                                            <div className="h-1.5 w-1.5 rounded-full bg-sky-500/50 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                                            {rec}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="findings" className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* Findings List */}
                        <div className="lg:col-span-12 space-y-6">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-lg font-semibold flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-primary" />
                                        Findings Details {filter !== "all" && <span className="text-muted-foreground text-sm font-normal">({getSeverityConfig(filter).label})</span>}
                                    </h3>
                                    <div className="flex items-center gap-2 px-3 py-1 rounded-full border bg-muted/30">
                                        <label className="text-xs font-semibold text-muted-foreground cursor-pointer select-none" htmlFor="group-view">Grouped View</label>
                                        <input
                                            id="group-view"
                                            type="checkbox"
                                            checked={isGrouped}
                                            onChange={(e) => setIsGrouped(e.target.checked)}
                                            className="w-4 h-4 accent-primary cursor-pointer"
                                        />
                                    </div>
                                </div>

                                <div className="relative w-full md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search findings..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 bg-card"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4">
                                {isGrouped ? (
                                    groups.length > 0 ? (
                                        groups.map((group: GroupedVulnerability) => (
                                            <VulnerabilityGroup key={group.type} group={group} severityConfig={severityConfig} />
                                        ))
                                    ) : (
                                        <NoFindings />
                                    )
                                ) : (
                                    filteredFindings.length > 0 ? (
                                        filteredFindings.map((vulnerability, index) => (
                                            <motion.div
                                                key={vulnerability.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                            >
                                                <VulnerabilityCard vulnerability={vulnerability} />
                                            </motion.div>
                                        ))
                                    ) : (
                                        <NoFindings />
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </motion.div>
    );
};

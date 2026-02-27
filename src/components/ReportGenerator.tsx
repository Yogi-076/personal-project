import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileText, Loader2, Download, AlertTriangle, Lock, Shield } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface ReportGeneratorProps {
    projectId: string;
    projectTitle: string;
    currentVersion?: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const SECTION_OPTIONS = [
    { id: "cover", label: "Cover Page with Project Details", default: true },
    { id: "executive", label: "Executive Summary", default: true },
    { id: "scope", label: "Scope & Methodology", default: true },
    { id: "findings", label: "Detailed Vulnerability Writeups", default: true },
    { id: "cvss", label: "CVSS Score Breakdown", default: true },
    { id: "recommendations", label: "Recommendations & Remediation Steps", default: true },
    { id: "compliance", label: "Compliance Mapping (OWASP / CWE)", default: true },
    { id: "conclusion", label: "Conclusion & Sign-off", default: true },
    { id: "appendix", label: "Appendix with Raw Scan Output (optional)", default: false },
    { id: "retest", label: "Retest Checklist (optional)", default: false },
];

const REPORT_TYPES = [
    { value: "executive", label: "Executive Summary", desc: "For management/client (non-technical)" },
    { value: "technical", label: "Technical Report", desc: "Full details for dev/security team" },
    { value: "combined", label: "Combined Report", desc: "Both executive + technical sections" },
    { value: "compliance", label: "Compliance Report", desc: "Mapped to OWASP / ISO27001 / PCI-DSS" },
];

const CONFIDENTIALITY = [
    { value: "confidential", label: "Confidential" },
    { value: "strictly-confidential", label: "Strictly Confidential" },
    { value: "internal", label: "Internal Use Only" },
];

export function ReportGenerator({ projectId, projectTitle, currentVersion = 0, open, onOpenChange, onSuccess }: ReportGeneratorProps) {
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [generatedFilename, setGeneratedFilename] = useState<string | null>(null);

    const [reportType, setReportType] = useState("combined");
    const [confidentiality, setConfidentiality] = useState("confidential");

    const initialSections: Record<string, boolean> = {};
    SECTION_OPTIONS.forEach(s => { initialSections[s.id] = s.default; });
    const [sections, setSections] = useState(initialSections);

    const toggleSection = (id: string) => setSections(prev => ({ ...prev, [id]: !prev[id] }));

    const nextVersion = currentVersion + 1;
    const versionLabel = `v${nextVersion}.0`;

    const handleGenerate = async () => {
        setIsGenerating(true);
        setDownloadUrl(null);
        try {
            const activeSections = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);

            const res = await fetch('http://localhost:3001/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    format: 'pdf',
                    reportType,
                    confidentiality,
                    sections: activeSections,
                    version: nextVersion
                })
            });

            if (!res.ok) throw new Error("Failed to generate report");

            const data = await res.json();
            const url = `http://localhost:3001/api/projects/${projectId}/reports/${data.filename}`;
            setDownloadUrl(url);
            setGeneratedFilename(data.filename);

            toast({
                title: `📄 Report Generated — ${versionLabel}`,
                description: `Your VAPT report for "${projectTitle}" is ready.`
            });
            onSuccess();

        } catch (e: any) {
            toast({ variant: "destructive", title: "Generation Error", description: e.message || "An error occurred." });
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDownload = () => {
        if (downloadUrl) {
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = generatedFilename || 'vapt-report.pdf';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleClose = () => {
        setDownloadUrl(null);
        setGeneratedFilename(null);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[680px] border-indigo-500/20 bg-black/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-100">
                        <FileText className="w-5 h-5 text-indigo-400" />
                        Generate VAPT Report
                        <span className="ml-auto text-xs font-mono bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">{versionLabel}</span>
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Configure and compile the security assessment report for <strong className="text-slate-200">{projectTitle}</strong>.
                    </DialogDescription>
                </DialogHeader>

                {!downloadUrl ? (
                    <div className="py-4 space-y-6">
                        {/* Report Type */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-slate-200 uppercase tracking-wider">1. Report Type</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {REPORT_TYPES.map(rt => (
                                    <button
                                        key={rt.value}
                                        onClick={() => setReportType(rt.value)}
                                        className={`p-3 rounded-lg border text-left transition-all ${reportType === rt.value ? "border-indigo-500/60 bg-indigo-600/20" : "border-white/10 hover:border-white/20 hover:bg-white/5"}`}
                                    >
                                        <div className="text-sm font-semibold text-foreground">{rt.label}</div>
                                        <div className="text-xs text-muted-foreground mt-0.5">{rt.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sections */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-slate-200 uppercase tracking-wider">2. Include Sections</Label>
                            <div className="bg-black/40 p-4 rounded-xl border border-white/5 space-y-3">
                                {SECTION_OPTIONS.map(s => (
                                    <div key={s.id} className="flex items-center space-x-3">
                                        <Checkbox
                                            id={`sec-${s.id}`}
                                            checked={sections[s.id]}
                                            onCheckedChange={() => toggleSection(s.id)}
                                            className="border-indigo-500/50 data-[state=checked]:bg-indigo-600"
                                        />
                                        <Label htmlFor={`sec-${s.id}`} className={`cursor-pointer ${s.default ? "text-slate-200" : "text-muted-foreground"}`}>
                                            {s.label}
                                        </Label>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Confidentiality */}
                        <div className="space-y-3">
                            <Label className="text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                <Lock className="w-3.5 h-3.5" /> 3. Confidentiality Level
                            </Label>
                            <RadioGroup value={confidentiality} onValueChange={setConfidentiality} className="flex gap-3">
                                {CONFIDENTIALITY.map(c => (
                                    <div key={c.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all flex-1 justify-center ${confidentiality === c.value ? "border-indigo-500/60 bg-indigo-600/20" : "border-white/10"}`}>
                                        <RadioGroupItem value={c.value} id={`conf-${c.value}`} />
                                        <Label htmlFor={`conf-${c.value}`} className="cursor-pointer text-xs font-medium">{c.label}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </div>

                        {/* Warning */}
                        <div className="flex items-start gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200">
                            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-xs">
                                <strong>Confidentiality Notice:</strong> Reports containing sensitive vulnerability data should be transmitted securely and only shared with authorized personnel.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
                        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mb-2">
                            <Shield className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-emerald-50">Report Ready — {versionLabel}</h3>
                        <p className="text-sm text-slate-400 max-w-[320px]">
                            Your comprehensive VAPT assessment report has been generated and securely saved to the project vault.
                        </p>
                        <div className="text-xs font-mono text-slate-500 bg-black/40 px-3 py-1.5 rounded border border-white/5">
                            {generatedFilename}
                        </div>
                    </div>
                )}

                <DialogFooter className="sm:justify-between border-t border-white/5 pt-4">
                    <Button variant="ghost" onClick={handleClose} className="text-slate-400 hover:text-white">
                        {downloadUrl ? "Close" : "Cancel"}
                    </Button>
                    {!downloadUrl ? (
                        <Button disabled={isGenerating} onClick={handleGenerate} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20">
                            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                            {isGenerating ? "Compiling PDF..." : `Generate ${versionLabel}`}
                        </Button>
                    ) : (
                        <Button onClick={handleDownload} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20">
                            <Download className="w-4 h-4 mr-2" />
                            Download PDF Report
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

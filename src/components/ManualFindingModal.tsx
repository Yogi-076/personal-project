import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Config } from "@/config";

interface ManualFindingModalProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

const SEVERITY_OPTIONS = [
    { value: "critical", label: "🔴 Critical", color: "text-red-500" },
    { value: "high", label: "🟠 High", color: "text-orange-500" },
    { value: "medium", label: "🟡 Medium", color: "text-amber-500" },
    { value: "low", label: "🟢 Low", color: "text-blue-500" },
    { value: "info", label: "ℹ️ Info", color: "text-slate-400" },
];

export function ManualFindingModal({ projectId, open, onOpenChange, onSuccess }: ManualFindingModalProps) {
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        title: "",
        severity: "high",
        cvss: "",
        cweId: "",
        url: "",
        parameter: "",
        description: "",
        evidence: "",
        impact: "",
        recommendation: "",
        references: "",
    });

    const handleChange = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title.trim()) {
            toast({ variant: "destructive", title: "Title is required" });
            return;
        }
        setIsSubmitting(true);
        try {
            const token = localStorage.getItem('vmt_token');
            const res = await fetch(`${Config.API_URL}/api/projects/${projectId}/findings`, {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                },
                body: JSON.stringify(form),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Failed to save finding");
            }

            toast({
                title: "✅ Manual Finding Added",
                description: `"${form.title}" has been saved to this project.`,
            });

            // Reset form
            setForm({ title: "", severity: "high", cvss: "", cweId: "", url: "", parameter: "", description: "", evidence: "", impact: "", recommendation: "", references: "" });

            onOpenChange(false);
            onSuccess();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[720px] border-orange-500/20 bg-black/95 backdrop-blur-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-orange-100">
                        <AlertTriangle className="w-5 h-5 text-orange-400" />
                        Add Manual Finding
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Document a vulnerability discovered manually. All fields except Title and Severity are optional.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    {/* Title + Severity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="m-title">Title <span className="text-red-500">*</span></Label>
                            <Input id="m-title" required placeholder="e.g. SQL Injection in Login Form" className="bg-black/50 border-white/10" value={form.title} onChange={e => handleChange("title", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Severity <span className="text-red-500">*</span></Label>
                            <Select value={form.severity} onValueChange={v => handleChange("severity", v)}>
                                <SelectTrigger className="bg-black/50 border-white/10">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-950 border-white/10">
                                    {SEVERITY_OPTIONS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>
                                            <span className={s.color}>{s.label}</span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* CVSS + CWE */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="m-cvss">CVSS Score</Label>
                            <Input id="m-cvss" placeholder="e.g. 9.8" className="bg-black/50 border-white/10" value={form.cvss} onChange={e => handleChange("cvss", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="m-cwe">CWE ID</Label>
                            <Input id="m-cwe" placeholder="e.g. CWE-89" className="bg-black/50 border-white/10" value={form.cweId} onChange={e => handleChange("cweId", e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="m-param">Vulnerable Parameter</Label>
                            <Input id="m-param" placeholder="e.g. username" className="bg-black/50 border-white/10" value={form.parameter} onChange={e => handleChange("parameter", e.target.value)} />
                        </div>
                    </div>

                    {/* URL */}
                    <div className="space-y-2">
                        <Label htmlFor="m-url">Affected URL</Label>
                        <Input id="m-url" placeholder="https://target.com/login" className="bg-black/50 border-white/10 font-mono text-sm" value={form.url} onChange={e => handleChange("url", e.target.value)} />
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="m-desc">Description</Label>
                        <Textarea id="m-desc" placeholder="Describe the vulnerability, how it was found, and its nature..." className="bg-black/50 border-white/10 min-h-[80px]" value={form.description} onChange={e => handleChange("description", e.target.value)} />
                    </div>

                    {/* Evidence / PoC */}
                    <div className="space-y-2">
                        <Label htmlFor="m-evidence">Proof of Concept / Evidence</Label>
                        <Textarea id="m-evidence" placeholder="Payload: ' OR 1=1 --&#10;Response showed: Welcome, admin!" className="bg-black/50 border-white/10 font-mono text-xs min-h-[80px]" value={form.evidence} onChange={e => handleChange("evidence", e.target.value)} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Impact */}
                        <div className="space-y-2">
                            <Label htmlFor="m-impact">Impact</Label>
                            <Textarea id="m-impact" placeholder="Attacker can bypass authentication..." className="bg-black/50 border-white/10 min-h-[70px]" value={form.impact} onChange={e => handleChange("impact", e.target.value)} />
                        </div>

                        {/* Recommendation */}
                        <div className="space-y-2">
                            <Label htmlFor="m-rec">Recommendation</Label>
                            <Textarea id="m-rec" placeholder="Use parameterized queries..." className="bg-black/50 border-white/10 min-h-[70px]" value={form.recommendation} onChange={e => handleChange("recommendation", e.target.value)} />
                        </div>
                    </div>

                    {/* References */}
                    <div className="space-y-2">
                        <Label htmlFor="m-refs">References</Label>
                        <Input id="m-refs" placeholder="e.g. OWASP A03:2021, https://cwe.mitre.org/data/definitions/89" className="bg-black/50 border-white/10 text-sm" value={form.references} onChange={e => handleChange("references", e.target.value)} />
                    </div>

                    <DialogFooter className="border-t border-white/5 pt-4">
                        <Button variant="ghost" type="button" onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white">Cancel</Button>
                        <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white">
                            {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ShieldAlert className="w-4 h-4 mr-2" />}
                            {isSubmitting ? "Saving..." : "Save Finding"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

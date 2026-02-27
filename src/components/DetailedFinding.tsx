
import {
    AlertTriangle,
    CheckCircle,
    Info,
    XCircle,
    Terminal,
    Shield,
    Activity,
    FileCode,
    ChevronRight,
    Copy,
    Sparkles,
    Loader2,
    Bot
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";

interface DetailedFindingProps {
    finding: {
        id: string;
        severity: "critical" | "high" | "medium" | "low" | "info";
        type: string;
        issue_name?: string;
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
    };
}




// ... inside the component
export const DetailedFinding = ({ finding }: DetailedFindingProps) => {
    const [explanation, setExplanation] = useState<string | null>(null);
    const [isExplaining, setIsExplaining] = useState(false);

    const handleExplain = async () => {
        if (explanation) return;
        setIsExplaining(true);
        try {
            const res = await fetch('http://localhost:3001/api/ai/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vuln: finding.issue_name || finding.type,
                    desc: finding.description,
                    impact: finding.impact
                })
            });
            const data = await res.json();
            setExplanation(data.explanation);
        } catch (e) {
            console.error(e);
            toast({ title: "Explanation Failed", description: "AI could not reach the server.", variant: "destructive" });
        } finally {
            setIsExplaining(false);
        }
    };

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: "Copied",
            description: `${label} copied to clipboard`,
        });
    };

    const getSeverityColor = (sev: string) => {
        switch (sev.toLowerCase()) {
            case "critical": return "text-red-400 bg-red-500/10 border-red-500/20";
            case "high": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
            case "medium": return "text-amber-400 bg-amber-500/10 border-amber-500/20";
            case "low": return "text-blue-400 bg-blue-500/10 border-blue-500/20";
            default: return "text-gray-400 bg-gray-500/10 border-gray-500/20";
        }
    };

    const sevColor = getSeverityColor(finding.severity);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Meta */}
            <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
                <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className={`${sevColor} border uppercase px-2 py-0.5 text-[10px] tracking-wider font-bold`}>
                            {finding.severity}
                        </Badge>
                        <span className="text-xs text-muted-foreground font-mono mr-2">CVSS: {finding.cvssScore.toFixed(1)}</span>

                        {finding.cwe && (
                            <Badge variant="secondary" className="text-[10px] h-5 font-mono bg-slate-500/10 text-slate-400 border-slate-500/20">
                                {finding.cwe}
                            </Badge>
                        )}
                        {finding.owasp && (
                            <Badge variant="secondary" className="text-[10px] h-5 font-mono bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                                {finding.owasp}
                            </Badge>
                        )}
                    </div>
                    <h3 className="text-lg font-bold leading-tight flex items-center gap-2">
                        {finding.type}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-foreground/80 font-mono bg-black/40 border border-white/[0.05] px-2 py-1 rounded w-fit max-w-full truncate shadow-inner">
                        <span className="text-primary/70">GET</span>
                        <span className="truncate">{finding.url}</span>
                    </div>
                </div>
            </div>

            {/* Core Analysis Grid */}
            <div className="grid md:grid-cols-2 gap-6">

                {/* Left Column: Context */}
                <div className="space-y-6">
                    <Card className="bg-card/30 backdrop-blur-sm border-white/[0.05] shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                <Activity className="w-4 h-4" /> Impact Analysis
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <h4 className="text-xs font-bold mb-1">Description</h4>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {finding.description || "No detailed description available."}
                                </p>

                                <div className="mt-3">
                                    {!explanation ? (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-7 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10 gap-1.5"
                                            onClick={handleExplain}
                                            disabled={isExplaining}
                                        >
                                            {isExplaining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                            {isExplaining ? "Analyzing..." : "Explain Like I'm 5"}
                                        </Button>
                                    ) : (
                                        <div className="bg-purple-500/10 border border-purple-500/20 rounded p-3 animate-in fade-in zoom-in-95 duration-300">
                                            <div className="flex items-center gap-2 mb-1 text-purple-400 font-bold text-xs uppercase tracking-wider">
                                                <Bot className="w-3.5 h-3.5" /> ELI5 Analysis
                                            </div>
                                            <p className="text-sm text-foreground/90 italic">
                                                "{explanation}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <Separator className="opacity-50" />
                            <div>
                                <h4 className="text-xs font-bold mb-1 text-red-500/90">Business Impact</h4>
                                <p className="text-sm text-foreground/80 leading-relaxed">
                                    {finding.impact || "Impact assessment pending."}
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                                <Shield className="w-4 h-4" /> Remediation
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                {finding.remediation}
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Technical Proof */}
                <div className="space-y-6">
                    {(finding.stepsToReproduce || finding.curlCommand) && (
                        <Card className="bg-card/30 backdrop-blur-sm border-white/[0.05] shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Reproduction Steps
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {finding.stepsToReproduce && (
                                    <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                        {finding.stepsToReproduce}
                                    </div>
                                )}
                                {finding.remediation && finding.reproductionUrl && (
                                    <div className="mt-2">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-bold uppercase text-muted-foreground">Reproduction URL</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(finding.reproductionUrl!, "URL")}>
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="bg-muted/40 p-2 rounded border border-border/50 text-xs font-mono break-all text-blue-500 hover:bg-muted/60 transition-colors cursor-pointer" onClick={() => window.open(finding.reproductionUrl, '_blank')}>
                                            {(() => {
                                                if (!finding.payload) return finding.reproductionUrl;

                                                let targetPayload = finding.payload;
                                                // Check for encoded version if raw is not present
                                                if (!finding.reproductionUrl?.includes(targetPayload)) {
                                                    const encoded = encodeURIComponent(targetPayload);
                                                    if (finding.reproductionUrl?.includes(encoded)) {
                                                        targetPayload = encoded;
                                                    } else {
                                                        return finding.reproductionUrl;
                                                    }
                                                }

                                                const parts = finding.reproductionUrl.split(targetPayload);
                                                return (
                                                    <span>
                                                        {parts.map((part, i) => (
                                                            <span key={i}>
                                                                {part}
                                                                {i < parts.length - 1 && (
                                                                    <span className="font-bold text-red-500 bg-red-500/10 px-0.5 rounded border border-red-500/20">
                                                                        {targetPayload}
                                                                    </span>
                                                                )}
                                                            </span>
                                                        ))}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                )}
                                {finding.curlCommand && (
                                    <div className="mt-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold uppercase text-muted-foreground">Curl Command</span>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(finding.curlCommand!, "Command")}>
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        </div>
                                        <div className="bg-black/90 p-3 rounded-md border border-white/10 font-mono text-xs text-green-400 overflow-x-auto whitespace-pre-wrap break-all shadow-inner">
                                            {finding.curlCommand}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card className="bg-black/20 border-white/[0.05] shadow-inner overflow-hidden">
                        <CardHeader className="pb-2 bg-muted/20 border-b border-border/10">
                            <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                <span className="flex items-center gap-2"><Terminal className="w-4 h-4" /> Proof of Concept & Evidence</span>
                                {finding.payload && (
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(finding.payload!, "Payload")}>
                                        <Copy className="w-3 h-3" />
                                    </Button>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 font-mono text-xs">
                            {finding.payload && (
                                <div className="p-4 border-b border-border/10">
                                    <div className="text-[10px] uppercase text-muted-foreground mb-1.5 font-bold">Payload</div>
                                    <div className="bg-black/10 p-2 rounded text-red-400 break-all select-all">
                                        {finding.payload}
                                    </div>
                                </div>
                            )}

                            {finding.evidence && (
                                <div className="p-4">
                                    <div className="text-[10px] uppercase text-muted-foreground mb-1.5 font-bold">Proof (Matching Response)</div>
                                    <div className="bg-black/10 p-2 rounded text-foreground/70 whitespace-pre-wrap break-all max-h-[200px] overflow-y-auto select-all">
                                        {finding.evidence}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {finding.parameter && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border/50">
                            <FileCode className="w-4 h-4 text-primary" />
                            <span className="text-sm text-muted-foreground">Vulnerable Parameter:</span>
                            <code className="text-sm font-mono font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                                {finding.parameter}
                            </code>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
    Shield, ShieldCheck, ShieldAlert, Globe, Search, 
    CheckCircle2, AlertCircle, Info, Lock, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import Config from '@/config';

interface HeaderAssessment {
    value: string;
    present: boolean;
    recommendation?: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'none';
}

const SECURITY_HEADERS_META: Record<string, { description: string, recommendation: string }> = {
    'strict-transport-security': {
        description: 'Ensures the browser only communicates over HTTPS.',
        recommendation: 'Set to "max-age=31536000; includeSubDomains; preload".'
    },
    'content-security-policy': {
        description: 'Prevents XSS and other injection attacks by restricting resource loading.',
        recommendation: 'Implement a strict CSP restricting script sources.'
    },
    'x-frame-options': {
        description: 'Prevents clickjacking attacks.',
        recommendation: 'Set to "SAMEORIGIN" or "DENY".'
    },
    'x-content-type-options': {
        description: 'Prevents MIME-type sniffing.',
        recommendation: 'Set to "nosniff".'
    },
    'referrer-policy': {
        description: 'Controls how much referrer information is shared.',
        recommendation: 'Set to "strict-origin-when-cross-origin".'
    },
    'permissions-policy': {
        description: 'Restricts use of browser features (camera, mic, etc.).',
        recommendation: 'Define a policy restricting unnecessary features.'
    },
    'x-xss-protection': {
        description: 'Legacy header for enabling browser XSS filtering.',
        recommendation: 'Set to "1; mode=block" (though CSP is preferred).'
    }
};

export const HeaderChecker = () => {
    const { toast } = useToast();
    const [target, setTarget] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Record<string, HeaderAssessment> | null>(null);
    const [score, setScore] = useState(0);

    const analyzeHeaders = async () => {
        if (!target) {
            toast({ title: "Target Required", description: "Please enter a URL to analyze.", variant: "destructive" });
            return;
        }

        setLoading(true);
        try {
            const formattedUrl = target.startsWith('http') ? target : `http://${target}`;
            const res = await fetch(`${Config.API_URL}/api/tools/analyze-headers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: formattedUrl })
            });

            if (res.ok) {
                const data = await res.json();
                const processedResults: Record<string, HeaderAssessment> = {};
                let passedCount = 0;
                const totalSecurityHeaders = Object.keys(SECURITY_HEADERS_META).length;

                Object.entries(data).forEach(([key, val]: [string, any]) => {
                    const meta = SECURITY_HEADERS_META[key];
                    if (meta) {
                        const isPresent = val.present;
                        if (isPresent) passedCount++;
                        
                        processedResults[key] = {
                            value: val.value || 'N/A',
                            present: isPresent,
                            description: meta.description,
                            recommendation: meta.recommendation,
                            severity: !isPresent ? 'high' : 'none'
                        };
                    } else {
                        processedResults[key] = {
                            value: val.value || 'N/A',
                            present: val.present,
                            description: 'General Header',
                            severity: 'none'
                        };
                    }
                });

                // Ensure all security headers are represented
                Object.keys(SECURITY_HEADERS_META).forEach(h => {
                    if (!processedResults[h]) {
                        processedResults[h] = {
                            value: 'Missing',
                            present: false,
                            description: SECURITY_HEADERS_META[h].description,
                            recommendation: SECURITY_HEADERS_META[h].recommendation,
                            severity: 'high'
                        };
                    }
                });

                setResults(processedResults);
                setScore(Math.round((passedCount / totalSecurityHeaders) * 100));
                
                toast({
                    title: "Analysis Complete",
                    description: `Security Score: ${Math.round((passedCount / totalSecurityHeaders) * 100)}/100`,
                });
            } else {
                const err = await res.json();
                toast({ title: "Analysis Failed", description: err.error || "Unknown error", variant: "destructive" });
            }
        } catch (error) {
            console.error(error);
            toast({ title: "Connection Error", description: "Backend server is unreachable.", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full font-mono">
            {/* Mission Control */}
            <Card className="flex-none border-cyber-cyan/30 bg-black/40 backdrop-blur-xl">
                <CardHeader className="py-4 border-b border-cyber-cyan/10">
                    <CardTitle className="flex items-center gap-3 text-cyber-cyan tracking-tighter text-lg">
                        <Shield className="w-5 h-5" />
                        HEADER-CHECKER V1.0
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="flex-1 relative group">
                            <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground group-hover:text-cyber-cyan transition-colors" />
                            <Input
                                placeholder="https://target.com"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                                className="pl-10 h-10 bg-black/20 border-white/10 focus-visible:ring-cyber-cyan/50 font-mono text-xs"
                                onKeyDown={(e) => e.key === 'Enter' && analyzeHeaders()}
                            />
                        </div>
                        <Button 
                            className="bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-cyber-cyan border border-cyber-cyan/50 h-10 px-8 font-bold"
                            onClick={analyzeHeaders}
                            disabled={loading}
                        >
                            {loading ? (
                                <Zap className="w-4 h-4 animate-spin mr-2" />
                            ) : (
                                <Search className="w-4 h-4 mr-2" />
                            )}
                            SCAN HEADERS
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {results && (
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-hidden">
                    {/* Score Panel */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <Card className="border-cyber-cyan/20 bg-background/40 backdrop-blur-xl h-full">
                            <CardHeader className="py-4 border-b border-white/5">
                                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Security Posture</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center p-8 text-center h-[calc(100%-60px)]">
                                <div className="relative mb-6">
                                    <svg className="w-32 h-32 transform -rotate-90">
                                        <circle
                                            cx="64" cy="64" r="58"
                                            fill="transparent"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            className="text-white/5"
                                        />
                                        <circle
                                            cx="64" cy="64" r="58"
                                            fill="transparent"
                                            stroke="currentColor"
                                            strokeWidth="8"
                                            strokeDasharray={364}
                                            strokeDashoffset={364 - (364 * score) / 100}
                                            className={score >= 80 ? "text-green-500" : score >= 50 ? "text-amber-500" : "text-red-500"}
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <span className="text-3xl font-black">{score}</span>
                                        <span className="text-xs text-muted-foreground ml-1">%</span>
                                    </div>
                                </div>
                                <h3 className="text-lg font-bold mb-2">
                                    {score >= 80 ? "SECURE" : score >= 50 ? "WARNING" : "VULNERABLE"}
                                </h3>
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    Target has implemented {Object.values(results).filter(r => r.present && SECURITY_HEADERS_META[Object.keys(results).find(k => results[k] === r) || '']).length} of {Object.keys(SECURITY_HEADERS_META).length} recommended security headers.
                                </p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Details Panel */}
                    <div className="lg:col-span-8 h-full overflow-hidden">
                        <Card className="border-white/10 bg-background/40 backdrop-blur-xl h-full flex flex-col">
                            <CardHeader className="py-4 border-b border-white/5 flex-none">
                                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Header Audit</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0 flex-1 overflow-hidden">
                                <ScrollArea className="h-full">
                                    <div className="p-6 space-y-4">
                                        {Object.entries(results).map(([header, data]) => {
                                            const isSecurityHeader = !!SECURITY_HEADERS_META[header];
                                            return (
                                                <div key={header} className={cn(
                                                    "p-4 rounded-lg border transition-all",
                                                    data.present ? "bg-green-500/5 border-green-500/20" : 
                                                    isSecurityHeader ? "bg-red-500/5 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.05)]" :
                                                    "bg-white/5 border-white/10"
                                                )}>
                                                    <div className="flex items-start justify-between gap-4 mb-2">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-bold text-foreground font-mono">{header}</span>
                                                                {isSecurityHeader && (
                                                                    <Badge variant="outline" className="text-[9px] h-4 px-1 border-cyber-cyan/30 text-cyber-cyan">
                                                                        SECURITY
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-muted-foreground">{data.description}</p>
                                                        </div>
                                                        {data.present ? (
                                                            <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-bold">
                                                                <CheckCircle2 className="w-3.5 h-3.5" /> PASSED
                                                            </div>
                                                        ) : isSecurityHeader ? (
                                                            <div className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold">
                                                                <AlertCircle className="w-3.5 h-3.5" /> MISSING
                                                            </div>
                                                        ) : null}
                                                    </div>

                                                    <div className="bg-black/40 rounded p-3 mb-2">
                                                        <pre className="text-xs text-cyber-cyan font-mono break-all whitespace-pre-wrap">
                                                            {data.value}
                                                        </pre>
                                                    </div>

                                                    {!data.present && data.recommendation && (
                                                        <div className="mt-3 flex items-start gap-2 text-[10px] bg-red-500/10 p-2 rounded border border-red-500/20">
                                                            <Info className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="font-bold text-red-300 mr-2">FIX:</span>
                                                                <span className="text-red-200/80">{data.recommendation}</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {!results && !loading && (
                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/30 space-y-4 pt-12">
                    <div className="relative">
                        <div className="absolute inset-0 bg-cyber-cyan/10 blur-3xl rounded-full" />
                        <ShieldAlert className="w-20 h-20 relative z-10 animate-pulse" />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-sm tracking-widest uppercase">Target Analysis Required</p>
                        <p className="text-xs font-mono mt-2">Enter coordinates above to audit mission-critical headers</p>
                    </div>
                </div>
            )}
        </div>
    );
};

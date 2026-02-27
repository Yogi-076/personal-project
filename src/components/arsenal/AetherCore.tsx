import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Globe, Search, Server, MapPin, Wifi, Layers, Code, Database, Lock } from "lucide-react";
import { motion } from "framer-motion";
import Config from "@/config";

interface AssetData {
    ip: string;
    location: string;
    org: string;
    ports: number[];
    vulns: string[];
    tech: string[];
}

export const AetherCore = () => {
    const [target, setTarget] = useState('');
    const [shodanKey, setShodanKey] = useState('');
    const [scanning, setScanning] = useState(false);
    const [data, setData] = useState<AssetData | null>(null);

    const handleScan = async () => {
        if (!target) return;
        setScanning(true);
        setData(null);

        try {
            const res = await fetch(`${Config.API_URL}/api/tools/aether/scan`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ target, shodanKey })
            });

            if (res.ok) {
                const result = await res.json();
                setData({
                    ip: result.ip,
                    location: result.location,
                    org: result.org,
                    ports: result.ports,
                    vulns: result.vulns,
                    tech: result.tech
                });
            } else {
                console.error("Scan failed");
            }
        } catch (e) {
            console.error("Connection error", e);
        } finally {
            setScanning(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-320px)] min-h-[600px] font-sans relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none -z-10" />

            {/* Control Panel */}
            <div className="lg:col-span-4 space-y-6">
                <Card className="border-cyan-500/30 bg-black/40 backdrop-blur-xl">
                    <CardHeader className="border-b border-white/5 pb-4">
                        <CardTitle className="flex items-center gap-2 text-cyan-400 font-mono text-xl">
                            <Globe className="w-5 h-5 animate-pulse" /> AETHER CORE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs uppercase text-muted-foreground tracking-widest">Target Entity</label>
                            <Input
                                placeholder="domain.com or IP"
                                className="bg-black/50 border-white/10 font-mono text-cyan-200"
                                value={target}
                                onChange={(e) => setTarget(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs uppercase text-muted-foreground tracking-widest flex items-center justify-between">
                                <span>Shodan API Key</span>
                                <Badge variant="outline" className="text-[10px] h-4 border-cyan-500/30 text-cyan-500">OPTIONAL</Badge>
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                                <Input
                                    placeholder="Enter to override System Key (Optional)"
                                    className="pl-9 bg-black/50 border-white/10 font-mono text-cyan-200 placeholder:text-muted-foreground/40"
                                    value={shodanKey}
                                    onChange={(e) => setShodanKey(e.target.value)}
                                />
                            </div>
                            <Button
                                className="w-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/20"
                                onClick={handleScan}
                                disabled={scanning}
                            >
                                {scanning ? "SCANNING ETHER..." : "INITIATE PASSIVE RECON"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tech Stack Visualization */}
                {data && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                        <Card className="border-white/10 bg-black/40">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-mono text-muted-foreground uppercase">Detected Technologies</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-wrap gap-2">
                                {data.tech.map((t, i) => (
                                    <Badge key={i} variant="secondary" className="bg-white/5 hover:bg-white/10 text-cyan-200 border-cyan-500/20">
                                        {t}
                                    </Badge>
                                ))}
                            </CardContent>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* Visualizer / Map */}
            <div className="lg:col-span-8">
                <Card className="h-full border-cyan-500/20 bg-background/60 backdrop-blur-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#083344_1px,transparent_1px),linear-gradient(to_bottom,#083344_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

                    <CardContent className="h-full p-0 flex items-center justify-center relative">
                        {!data && !scanning && (
                            <div className="text-center space-y-4 opacity-50">
                                <Wifi className="w-24 h-24 mx-auto text-cyan-900" />
                                <p className="font-mono text-sm text-cyan-700 uppercase tracking-widest">Awaiting Signal</p>
                            </div>
                        )}

                        {scanning && (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-64 h-64 border-4 border-cyan-500/20 rounded-full animate-ping" />
                                <div className="w-48 h-48 border-4 border-cyan-500/40 rounded-full animate-ping delay-75" />
                                <div className="w-32 h-32 border-4 border-cyan-500/60 rounded-full animate-ping delay-150" />
                            </div>
                        )}

                        {data && !scanning && (
                            <div className="grid grid-cols-2 gap-8 w-full max-w-2xl z-10 p-8">
                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-cyan-950/50 rounded-lg border border-cyan-500/30">
                                            <Server className="w-8 h-8 text-cyan-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase text-muted-foreground">IP Address</div>
                                            <div className="text-2xl font-mono text-white">{data.ip}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-purple-950/50 rounded-lg border border-purple-500/30">
                                            <MapPin className="w-8 h-8 text-purple-400" />
                                        </div>
                                        <div>
                                            <div className="text-xs uppercase text-muted-foreground">Location</div>
                                            <div className="text-xl font-mono text-white">{data.location}</div>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.1 }} className="space-y-4">
                                    <div className="p-4 bg-black/60 rounded-xl border border-white/10">
                                        <div className="text-xs uppercase text-muted-foreground mb-3">Open Ports</div>
                                        <div className="flex flex-wrap gap-2">
                                            {data.ports.map(p => (
                                                <div key={p} className="px-3 py-1 bg-green-500/10 text-green-400 border border-green-500/30 rounded font-mono text-sm">
                                                    {p}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="p-4 bg-black/60 rounded-xl border border-white/10">
                                        <div className="text-xs uppercase text-muted-foreground mb-3">Organization</div>
                                        <div className="font-mono text-cyan-200">{data.org}</div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

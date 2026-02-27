import { useEffect, useState, useRef } from 'react';
import { Shield, Activity, Lock, Globe, Server, AlertTriangle, CheckCircle } from 'lucide-react';

export const SecurityHUD = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const logContainerRef = useRef<HTMLDivElement>(null);

    // Simulated VAPT logs
    const possibleLogs = [
        "[SYSTEM] Initializing VajraScan Core...",
        "[NET] Scanning port 443 (HTTPS)... OPEN",
        "[AUTH] Verifying handshake protocols...",
        "[VULN] CVE-2024-8972 check... CLEAN",
        "[AI] Moltbot heuristic engine loaded...",
        "[WARN] Suspicious packet from IP 192.168.X.X",
        "[BLOCK] XSS payload intercepted",
        "[SQL] Injection attempt neutralized",
        "[SYSTEM] Encryption keys rotated",
        "[NET] Latency check: 12ms",
        "[SCAN] Wappalyzer fingerprinting complete",
        "[MODULE] Loading ZAP integration...",
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            const randomLog = possibleLogs[Math.floor(Math.random() * possibleLogs.length)];
            const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
            setLogs(prev => [`[${timestamp}] ${randomLog}`, ...prev.slice(0, 8)]);
        }, 1500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full max-w-lg p-6 font-mono text-sm relative">

            {/* Center HUD Decoration */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-violet-500/10 rounded-full animate-spin-slow pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-dashed border-fuchsia-500/10 rounded-full animate-reverse-spin pointer-events-none" />

            <div className="relative z-10 grid grid-cols-2 gap-4">

                {/* Status Card */}
                <div className="col-span-2 bg-black/40 backdrop-blur-md border border-violet-500/30 rounded-lg p-4 shadow-[0_0_15px_rgba(139,92,246,0.1)]">
                    <div className="flex items-center justify-between mb-3 border-b border-violet-500/20 pb-2">
                        <span className="text-violet-400 font-bold flex items-center gap-2">
                            <Shield className="h-4 w-4" /> SYSTEM STATUS
                        </span>
                        <span className="text-green-500 animate-pulse text-xs">● ONLINE</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-violet-900/10 p-2 rounded border border-violet-500/10">
                            <div className="text-xs text-slate-400">THREAT LEVEL</div>
                            <div className="text-green-400 font-bold text-lg">LOW</div>
                        </div>
                        <div className="bg-violet-900/10 p-2 rounded border border-violet-500/10">
                            <div className="text-xs text-slate-400">ACTIVE SCANS</div>
                            <div className="text-fuchsia-400 font-bold text-lg">42</div>
                        </div>
                        <div className="bg-violet-900/10 p-2 rounded border border-violet-500/10">
                            <div className="text-xs text-slate-400">DEFENSE</div>
                            <div className="text-violet-400 font-bold text-lg">100%</div>
                        </div>
                    </div>
                </div>

                {/* Live Logs */}
                <div className="col-span-2 row-span-2 bg-black/60 backdrop-blur-md border-l-2 border-l-fuchsia-500 border-y border-r border-slate-800 rounded-r-lg p-4 h-48 overflow-hidden relative">
                    <div className="flex items-center gap-2 mb-2 text-fuchsia-400 text-xs uppercase tracking-widest font-semibold">
                        <Activity className="h-3 w-3" /> Live Event Stream
                    </div>
                    <div className="space-y-1.5" ref={logContainerRef}>
                        {logs.map((log, i) => (
                            <div key={i} className={`text-xs truncate transition-all duration-300 ${i === 0 ? 'text-white font-semibold' : 'text-slate-500'}`}>
                                <span className="opacity-50 mr-2">{'>'}</span>{log}
                            </div>
                        ))}
                    </div>
                    {/* Scan line effect */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-500/5 to-transparent h-[10px] w-full animate-scan-fast pointer-events-none" />
                </div>

                {/* Quick Stats Mini Cards */}
                <div className="bg-black/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 flex items-center gap-3">
                    <Server className="h-8 w-8 text-purple-400 bg-purple-500/10 p-1.5 rounded" />
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase">Server Load</div>
                        <div className="text-sm font-mono text-white">12% / 64GB</div>
                    </div>
                </div>

                <div className="bg-black/40 backdrop-blur-sm border border-slate-700/50 rounded-lg p-3 flex items-center gap-3">
                    <Globe className="h-8 w-8 text-indigo-400 bg-indigo-500/10 p-1.5 rounded" />
                    <div>
                        <div className="text-[10px] text-slate-400 uppercase">Global Nodes</div>
                        <div className="text-sm font-mono text-white">8/12 ACTIVE</div>
                    </div>
                </div>

            </div>
        </div>
    );
};

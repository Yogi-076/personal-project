import { motion } from "framer-motion";
import { Shield, ArrowRight, Terminal, Cpu, Zap, Activity, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";

const SCANNERS = ["Wapiti", "OWASP ZAP", "Nuclei", "SAST Engine", "Shodan API", "Katana"];

const TERMINAL_LINES = [
  { delay: 0, text: "$ vajrascan init --project VAPT-2025-0042", color: "text-primary" },
  { delay: 900, text: "✓ Workspace created. Loading engines...", color: "text-emerald-400" },
  { delay: 1700, text: "→ Launching Wapiti DAST scanner...", color: "text-slate-400" },
  { delay: 2500, text: "→ Executing Nuclei templates [CVE 2024]...", color: "text-slate-400" },
  { delay: 3200, text: "⚠ [CRITICAL] SQL Injection found: /login", color: "text-red-400" },
  { delay: 4000, text: "⚠ [HIGH]     Missing HSTS header", color: "text-orange-400" },
  { delay: 4700, text: "✓ AI analysis complete. Generating PDF...", color: "text-emerald-400" },
  { delay: 5400, text: "📄 VAPT_Report_v1.0_20250225.pdf saved.", color: "text-primary" },
];

function TerminalStrip() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(prev => [...prev, i]), line.delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="mt-12 mx-auto max-w-2xl rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/60">
      {/* Terminal chrome bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1a1a2e] border-b border-white/10">
        <span className="w-3 h-3 rounded-full bg-red-500/80" />
        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
        <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
        <span className="ml-3 text-xs font-mono text-slate-500 tracking-widest">VAJRASCAN — SECURE SHELL</span>
      </div>
      <div className="bg-[#0d0d1a] p-4 font-mono text-xs space-y-1.5 min-h-[160px]">
        {TERMINAL_LINES.map((line, i) =>
          visibleLines.includes(i) ? (
            <motion.p
              key={i}
              className={line.color}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.25 }}
            >
              {line.text}
            </motion.p>
          ) : null
        )}
        {visibleLines.length > 0 && visibleLines.length < TERMINAL_LINES.length && (
          <span className="terminal-cursor text-primary">&nbsp;</span>
        )}
      </div>
    </div>
  );
}

export const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden aurora-bg noise-texture">

      {/* Hero grid overlay */}
      <div className="absolute inset-0 hero-grid-overlay opacity-70 pointer-events-none" />

      {/* Ambient orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full bg-violet-600/8 blur-[100px] pointer-events-none" />

      <div className="container relative z-10 px-4 py-24 text-center">

        {/* Pre-badge */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm text-xs font-mono text-primary tracking-widest"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          ENTERPRISE VAPT PLATFORM — v2.0
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
        >
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-[0.9]">
            <span className="block text-white">Next-Gen</span>
            <span className="block text-gradient-cyber drop-shadow-[0_0_40px_hsl(199_89%_48%/0.35)]">
              Security
            </span>
            <span className="block text-white">Intelligence</span>
          </h1>
        </motion.div>

        {/* Sub-headline */}
        <motion.p
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          AI-orchestrated vulnerability assessment. Multi-engine scanning.{" "}
          <strong className="text-foreground font-semibold">Real-time threat analysis.</strong> Generate
          professional VAPT reports in seconds — not days.
        </motion.p>

        {/* Scanner engine tags */}
        <motion.div
          className="flex flex-wrap justify-center gap-2 mb-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {SCANNERS.map((s, i) => (
            <span
              key={s}
              className="px-3 py-1 text-[11px] font-mono font-semibold rounded-full border border-white/10 bg-white/5 text-slate-300 hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all duration-200 cursor-default"
            >
              {s}
            </span>
          ))}
        </motion.div>

        {/* CTA Row */}
        <motion.div
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
        >
          <Link to="/dashboard">
            <Button
              size="lg"
              className="btn-cyber h-14 px-10 rounded-2xl text-base font-bold shadow-xl shadow-primary/25 group"
            >
              <Shield className="w-5 h-5 mr-2.5" />
              Launch Console
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            className="h-14 px-10 rounded-2xl text-base border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-slate-200 backdrop-blur-sm"
            onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
          >
            <Activity className="w-4 h-4 mr-2" />
            See It In Action
          </Button>
        </motion.div>

        {/* Live Terminal Strip */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.9 }}
        >
          <TerminalStrip />
        </motion.div>

        {/* Bottom stat strip */}
        <motion.div
          className="mt-16 grid grid-cols-3 gap-8 max-w-xl mx-auto pt-10 border-t border-white/5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.1 }}
        >
          {[
            { icon: <Cpu className="w-4 h-4" />, value: "6+", label: "Scan Engines" },
            { icon: <Zap className="w-4 h-4" />, value: "AI-First", label: "Risk Analysis" },
            { icon: <Globe className="w-4 h-4" />, value: "Self-Hosted", label: "Sovereign Deploy" },
          ].map(stat => (
            <div key={stat.label} className="text-center group">
              <div className="flex items-center justify-center gap-1.5 text-primary mb-1 group-hover:scale-110 transition-transform">
                {stat.icon}
                <span className="text-xl font-black text-foreground font-mono">{stat.value}</span>
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold group-hover:text-primary/70 transition-colors">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent pointer-events-none" />
    </section>
  );
};

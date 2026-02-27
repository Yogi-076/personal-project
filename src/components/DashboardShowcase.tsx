import { motion } from "framer-motion";
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Activity,
  Server,
  Globe,
  Shield
} from "lucide-react";

const mockVulnerabilities = [
  { type: "SQL Injection", severity: "critical", endpoint: "/api/users", cvss: 9.8 },
  { type: "XSS Stored", severity: "high", endpoint: "/comments", cvss: 7.5 },
  { type: "CSRF Token Missing", severity: "medium", endpoint: "/settings", cvss: 5.4 },
  { type: "Info Disclosure", severity: "low", endpoint: "/debug", cvss: 3.1 },
];

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical": return "text-red-400 bg-red-400/10 border-red-400/30";
    case "high": return "text-orange-400 bg-orange-400/10 border-orange-400/30";
    case "medium": return "text-amber-400 bg-amber-400/10 border-amber-400/30";
    case "low": return "text-green-400 bg-green-400/10 border-green-400/30";
    default: return "text-muted-foreground bg-muted";
  }
};

export const DashboardShowcase = () => {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div 
          className="w-[800px] h-[800px] rounded-full blur-3xl opacity-20"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 60%)" }}
        />
      </div>

      <div className="container max-w-6xl relative">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono text-primary uppercase tracking-wider">Interactive Dashboard</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-foreground">Real-time </span>
            <span className="text-gradient">Analysis Platform</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Monitor vulnerability scans, track findings, and generate comprehensive 
            security reports from a unified command center.
          </p>
        </motion.div>

        {/* Dashboard Mockup */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          {/* Main Dashboard Container */}
          <div className="relative bg-card/80 backdrop-blur-xl rounded-2xl border border-border overflow-hidden shadow-2xl">
            {/* Window Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-xs font-mono text-muted-foreground">VAPT Framework — Security Dashboard</span>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6">
              {/* Stats Row */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { icon: Shield, label: "Scans Complete", value: "24", color: "text-primary" },
                  { icon: XCircle, label: "Critical", value: "3", color: "text-red-400" },
                  { icon: AlertTriangle, label: "High/Medium", value: "12", color: "text-amber-400" },
                  { icon: CheckCircle2, label: "Resolved", value: "18", color: "text-green-400" },
                ].map((stat) => (
                  <motion.div
                    key={stat.label}
                    className="p-4 rounded-lg bg-muted/30 border border-border"
                    whileHover={{ scale: 1.02 }}
                  >
                    <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                    <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </motion.div>
                ))}
              </div>

              {/* Active Scan Indicator */}
              <div className="flex items-center gap-4 p-4 rounded-lg border border-primary/30 bg-primary/5 mb-6">
                <div className="relative">
                  <Server className="w-8 h-8 text-primary" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-ping" />
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">Active Scan</span>
                    <span className="text-xs font-mono text-primary">IN PROGRESS</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    <span className="font-mono">https://target-domain.com</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary font-mono">67%</div>
                  <div className="text-xs text-muted-foreground">Endpoints scanned</div>
                </div>
              </div>

              {/* Vulnerability Table */}
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border">
                  <h3 className="font-semibold text-sm">Recent Findings</h3>
                </div>
                <div className="divide-y divide-border">
                  {mockVulnerabilities.map((vuln, index) => (
                    <motion.div
                      key={index}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      viewport={{ once: true }}
                    >
                      <span className={`px-2 py-1 rounded text-xs font-mono uppercase border ${getSeverityColor(vuln.severity)}`}>
                        {vuln.severity}
                      </span>
                      <span className="font-medium text-foreground flex-1">{vuln.type}</span>
                      <code className="text-sm text-muted-foreground font-mono">{vuln.endpoint}</code>
                      <span className="font-mono text-sm text-primary">CVSS {vuln.cvss}</span>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Floating Elements */}
          <motion.div
            className="absolute -top-4 -right-4 px-3 py-2 rounded-lg glass border border-primary/30"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <span className="text-xs font-mono text-primary">🔒 Secure Connection</span>
          </motion.div>

          <motion.div
            className="absolute -bottom-4 -left-4 px-3 py-2 rounded-lg glass border border-green-400/30"
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <span className="text-xs font-mono text-green-400">✓ TLS 1.3 Verified</span>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

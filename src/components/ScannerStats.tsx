import { motion } from "framer-motion";
import { Shield, Activity, Bug, Server, Zap, Globe, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface ScannerStatsProps {
    totalScans: number;
    activeScans: number;
    totalVulnerabilities: number;
}

export const ScannerStats = ({ totalScans = 0, activeScans = 0, totalVulnerabilities = 0 }: ScannerStatsProps) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
                title="Total Assessments"
                value={(totalScans || 0).toString()}
                icon={<Shield className="w-6 h-6 text-primary" />}
                trend="+12% this week"
                trendUp={true}
                color="primary"
                delay={0}
            />
            <StatsCard
                title="Active Operations"
                value={(activeScans || 0).toString()}
                icon={<Activity className="w-6 h-6 text-emerald-400" />}
                subValue={activeScans > 0 ? "Processing" : "Idle"}
                color="emerald"
                delay={0.1}
                active={activeScans > 0}
            />
            <StatsCard
                title="Vulnerabilities"
                value={(totalVulnerabilities || 0).toString()}
                icon={<Bug className="w-6 h-6 text-red-500" />}
                trend="Requires Attention"
                trendUp={false}
                color="red"
                delay={0.2}
            />
            <StatsCard
                title="Engine Status"
                value="Online"
                icon={<Server className="w-6 h-6 text-purple-400" />}
                subValue="v3.2.1-stable"
                color="purple"
                delay={0.3}
            />
        </div>
    );
};

const StatsCard = ({ title, value, icon, trend, trendUp, className, subValue, color, delay, active }: any) => {
    const gradients: any = {
        primary: "from-primary/20 via-primary/5 to-transparent",
        emerald: "from-emerald-500/20 via-emerald-500/5 to-transparent",
        red: "from-red-500/20 via-red-500/5 to-transparent",
        purple: "from-purple-500/20 via-purple-500/5 to-transparent",
    };

    const borders: any = {
        primary: "group-hover:border-primary/50",
        emerald: "group-hover:border-emerald-500/50",
        red: "group-hover:border-red-500/50",
        purple: "group-hover:border-purple-500/50",
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.5 }}
        >
            <Card className={`relative overflow-hidden bg-card border-border/50 transition-all duration-300 hover:shadow-lg group ${borders[color]} ${active ? 'ring-1 ring-emerald-500/50' : ''}`}>
                <div className={`absolute inset-0 bg-gradient-to-br ${gradients[color]} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                <CardContent className="p-6 relative z-10">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 rounded-lg bg-background/50 border border-border/50 backdrop-blur-sm">
                            {icon}
                        </div>
                        {active && (
                            <span className="flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                        )}
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground tracking-wide uppercase text-xs">{title}</p>
                        <div className="flex items-baseline gap-2">
                            <h3 className="text-3xl font-bold font-mono tracking-tight text-foreground">{value}</h3>
                            {subValue && <span className="text-xs font-medium text-muted-foreground font-mono bg-secondary/50 px-2 py-0.5 rounded">{subValue}</span>}
                        </div>
                    </div>

                    {trend && (
                        <div className={`mt-4 text-xs font-medium flex items-center gap-1 ${trendUp ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {trendUp ? <Zap className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                            {trend}
                        </div>
                    )}
                </CardContent>
            </Card>
        </motion.div>
    );
};

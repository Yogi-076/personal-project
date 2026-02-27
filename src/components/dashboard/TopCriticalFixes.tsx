
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface Finding {
    id: string;
    issue_name: string;
    severity: string;
    endpoint: string;
    project_id: string;
}

interface TopCriticalFixesProps {
    findings: Finding[];
}

export const TopCriticalFixes = ({ findings }: TopCriticalFixesProps) => {
    const navigate = useNavigate();

    // Filter for Critical/High and take top 3
    const criticalFindings = findings
        .filter((f) => f.severity.toLowerCase() === "critical" || f.severity.toLowerCase() === "high")
        .slice(0, 3);

    if (criticalFindings.length === 0) {
        return (
            <Card className="border-green-500/20 bg-green-500/5 mb-8">
                <CardContent className="flex items-center justify-between p-6">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-full">
                            <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-green-400">System Secure</h3>
                            <p className="text-sm text-green-300/70">No critical vulnerabilities detected. Great job!</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-red-500/30 bg-red-950/10 mb-8 overflow-hidden relative">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none" />
            <CardHeader className="border-b border-red-500/10 bg-red-950/20 pb-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-red-500 font-bold tracking-tight">
                        <AlertTriangle className="w-5 h-5 animate-pulse" />
                        ATTENTION REQUIRED: TOP 3 CRITICAL FIXES
                    </CardTitle>
                    <Badge variant="outline" className="border-red-500/50 text-red-400 bg-red-500/10 animate-pulse">
                        URGENT
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="divide-y divide-red-500/10">
                    {criticalFindings.map((finding, idx) => (
                        <div key={finding.id} className="flex items-center justify-between p-4 hover:bg-red-500/5 transition-colors group">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-full bg-red-500/10 flex items-center justify-center font-bold text-red-500 border border-red-500/20">
                                    {idx + 1}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-red-100 group-hover:text-red-400 transition-colors">
                                        {finding.issue_name}
                                    </h4>
                                    <p className="text-xs text-red-300/60 font-mono mt-0.5">
                                        {finding.endpoint}
                                    </p>
                                </div>
                            </div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 gap-2 group-hover:translate-x-1 transition-all"
                                onClick={() => navigate(`/report/${finding.id}`)} // Assuming detail view routing
                            >
                                Fix Now <ArrowRight className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

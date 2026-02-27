import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Shield, Users, Database, Activity, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Mock Data Types
type OrgSummary = {
    id: string;
    name: string;
    plan: string;
    users: number;
    modules: string[];
};

const PlatformAdmin = () => {
    const { user, role, organization } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [orgs, setOrgs] = useState<OrgSummary[]>([]);

    // Guard: Only allow if role is 'owner' (simulation of Super Admin for demo)
    // In real implementation, check for specific 'platform_admin' flag or email
    useEffect(() => {
        // Ensuring we don't block the demo user
        if (!user) return;
        // For demo purposes, we treat the Demo User as Admin
    }, [user]);

    // Fetch Orgs (Mock for now, would be GET /api/admin/organizations)
    useEffect(() => {
        setOrgs([
            { id: "demo-org-id", name: "Demo Organization", plan: "Enterprise", users: 1, modules: ["dast_core", "sast_pro", "vmt_enterprise"] },
            { id: "acme-corp", name: "Acme Corp", plan: "Pro", users: 5, modules: ["dast_core"] },
            { id: "cyber-dyne", name: "CyberDyne Systems", plan: "Free", users: 2, modules: [] },
        ]);
    }, []);

    const toggleModule = (orgId: string, module: string, currentStatus: boolean) => {
        // API Call would go here: POST /api/admin/entitlements
        toast({
            title: currentStatus ? "Module Revoked" : "Module Granted",
            description: `${module} access updated for organization.`,
        });

        setOrgs(prev => prev.map(o => {
            if (o.id === orgId) {
                const newModules = currentStatus
                    ? o.modules.filter(m => m !== module)
                    : [...o.modules, module];
                return { ...o, modules: newModules };
            }
            return o;
        }));
    };

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Shield className="w-8 h-8 text-red-500" />
                            Platform Administration
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Manage tenants, provisioning, and system-wide configurations.
                        </p>
                    </div>
                    <Button variant="outline" onClick={() => navigate("/dashboard")}>
                        Back to App
                    </Button>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tenants</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold">{orgs.length}</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">Active Licenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-cyber-cyan">
                                {orgs.reduce((acc, o) => acc + o.modules.length, 0)}
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground">System Health</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center gap-2 text-green-400 font-bold text-lg">
                                <Activity className="w-5 h-5" /> Operational
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Database Management Link */}
                <Card className="border-cyber-purple/20 bg-cyber-purple/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-cyber-purple" /> Database Schema & Migration
                        </CardTitle>
                        <CardDescription>
                            Review the active database schema or run migration scripts.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="p-4 bg-muted/50 rounded-lg font-mono text-xs text-muted-foreground">
                            public.organizations • public.entitlements • public.modules
                        </div>
                    </CardContent>
                </Card>

                {/* Tenant Table */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold">Tenant Management</h2>
                    <div className="grid gap-4">
                        {orgs.map((org) => (
                            <Card key={org.id} className="overflow-hidden">
                                <div className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">

                                    {/* Org Info */}
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex items-center gap-3 mb-1">
                                            <h3 className="font-bold text-lg">{org.name}</h3>
                                            <Badge variant={org.plan === 'Enterprise' ? 'default' : 'secondary'}>
                                                {org.plan}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Users className="w-3 h-3" /> {org.users} Users
                                            </span>
                                            <span className="font-mono text-xs">ID: {org.id}</span>
                                        </div>
                                    </div>

                                    {/* Module Toggles */}
                                    <div className="flex flex-wrap items-center gap-6">
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={org.modules.includes('dast_core')}
                                                onCheckedChange={(c) => toggleModule(org.id, 'dast_core', !c)}
                                            />
                                            <span className="text-sm">DAST Scanner</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={org.modules.includes('sast_pro')}
                                                onCheckedChange={(c) => toggleModule(org.id, 'sast_pro', !c)}
                                            />
                                            <span className="text-sm">SAST Pro</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Switch
                                                checked={org.modules.includes('vmt_enterprise')}
                                                onCheckedChange={(c) => toggleModule(org.id, 'vmt_enterprise', !c)}
                                            />
                                            <span className="text-sm">VMT</span>
                                        </div>
                                    </div>

                                </div>
                            </Card>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default PlatformAdmin;

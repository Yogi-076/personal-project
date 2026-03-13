import { Home, LayoutGrid, FileText, BarChart3, Settings, LogOut, Shield, Calculator, Wrench, Archive, ShieldAlert, X, Plus, Globe } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export function AppSidebar({ mobileOpen = false, setMobileOpen }: { mobileOpen?: boolean, setMobileOpen?: (val: boolean) => void }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut } = useAuth();

    const handleLogout = async () => {
        await signOut();
        navigate("/auth");
    };

    const menuItems = [
        { icon: Home, label: "Dashboard", path: "/dashboard" },
        { icon: LayoutGrid, label: "Projects", path: "/projects" }, // Changed to LayoutGrid to match Dashboard
        { icon: Archive, label: "VMT Matrix", path: "/vmt" },
        { icon: FileText, label: "Reports", path: "/reports" },
        { icon: Globe, label: "Scanner", path: "/scanner" }, // Changed to Globe to match Dashboard
        { icon: Wrench, label: "Arsenal", path: "/tools" },
    ];

    return (
        <>
            {/* Overlay for mobile */}
            {mobileOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setMobileOpen && setMobileOpen(false)} />
            )}
            <div className={`w-64 h-screen bg-black/95 border-r border-white/10 shrink-0 flex-col transition-transform duration-300 z-50 ${mobileOpen ? 'fixed inset-y-0 left-0 flex translate-x-0 lg:static' : 'hidden lg:flex lg:static translate-x-0'}`}>
                {/* Header */}
                <div className="p-6 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Shield className="w-8 h-8 text-cyber-cyan" />
                        <div>
                            <h2 className="text-cyber-cyan font-bold tracking-widest text-sm">VAPT</h2>
                            <p className="text-xs text-muted-foreground">FRAMEWORK</p>
                        </div>
                    </div>
                    {mobileOpen && (
                        <button className="lg:hidden text-white/50 hover:text-white transition-colors" onClick={() => setMobileOpen && setMobileOpen(false)}>
                            <X className="w-6 h-6" />
                        </button>
                    )}
                </div>

                {/* Action Button */}
                <div className="px-4 py-2">
                    <button 
                        onClick={() => navigate('/dashboard?createProject=true')}
                        className="w-full group flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all font-bold text-sm shadow-[0_0_20px_-5px_rgba(6,182,212,0.2)]"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Project</span>
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                    {menuItems.map((item) => {
                        const Icon = item.icon as any;
                        const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');

                        return (
                            <button
                                key={item.label}
                                onClick={() => {
                                    console.log("Navigating to:", item.path);
                                    navigate(item.path);
                                }}
                                className={`w-full group flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${isActive
                                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_-5px_var(--primary)]"
                                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
                                    }`}
                            >
                                <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`} />
                                <span>{item.label}</span>
                            </button>
                        );
                    })}
                </nav>

                {/* Logout */}
                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                    >
                        <LogOut className="w-5 h-5" />
                        <span className="font-medium">Logout</span>
                    </button>
                </div>
            </div>
        </>
    );
}

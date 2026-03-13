import { VMTSpreadsheet } from "@/components/VMTSpreadsheet";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { LoadingScreen } from "@/components/LoadingScreen";

const VMT = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const { projectId } = useParams();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            navigate("/auth");
        }
    }, [user, loading, navigate]);

    if (loading) {
        return <LoadingScreen />;
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen flex w-full bg-transparent">
            {/* Sidebar */}
            <AppSidebar mobileOpen={sidebarOpen} setMobileOpen={setSidebarOpen} />

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-black/20 backdrop-blur-3xl shrink-0">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            className="text-muted-foreground hover:text-cyber-cyan transition-all lg:hidden active:scale-90"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-black text-white tracking-widest flex items-center gap-3">
                                <span className="w-1.5 h-6 bg-cyber-cyan rounded-full animate-pulse shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
                                VAPT MATRIX <span className="text-cyber-cyan italic font-light opacity-50">ORCHESTRATOR</span>
                            </h1>
                            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.3em] ml-4 mt-0.5 opacity-40">Tactical Security Analysis Environment</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end pr-4 border-r border-white/5">
                            <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest opacity-40">AUTH_PRINCIPAL</span>
                            <span className="text-[11px] text-cyber-cyan font-bold lowercase">{user?.email || 'ANONYMOUS_ANALYST'}</span>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center text-cyber-cyan font-black text-xs shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                            {user?.email?.[0].toUpperCase() || 'A'}
                        </div>
                    </div>
                </div>

                {/* VMT Content */}
                <div className="flex-1 p-4 pt-0 overflow-hidden min-w-0 min-h-0">
                    <VMTSpreadsheet initialProjectId={projectId} />
                </div>
            </main>
        </div>
    );
};

export default VMT;

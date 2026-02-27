import { VMTSpreadsheet } from "@/components/VMTSpreadsheet";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu } from "lucide-react";

const VMT = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        if (!loading && !user) {
            navigate("/auth");
        }
    }, [user, loading, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-cyber-cyan">Loading...</div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="min-h-screen flex w-full bg-transparent">
            {/* Sidebar */}
            {sidebarOpen && <AppSidebar />}

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <div className="p-4 flex items-center justify-between border-b border-white/10 bg-background/80 backdrop-blur-xl">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="text-white hover:text-cyber-cyan transition-colors"
                        >
                            <Menu className="w-6 h-6" />
                        </button>
                        <h1 className="text-xl font-bold text-white tracking-widest pl-2 border-l-2 border-cyber-cyan">
                            VULNERABILITY MANAGEMENT TOOL
                        </h1>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        User: <span className="text-cyber-cyan">{user?.email || 'Security Analyst'}</span>
                    </div>
                </div>

                {/* VMT Content */}
                <div className="flex-1 p-4 pt-0 overflow-hidden">
                    <VMTSpreadsheet />
                </div>
            </main>
        </div>
    );
};

export default VMT;

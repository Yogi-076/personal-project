import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { session, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex bg-zinc-950 h-screen w-screen items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    if (!session) {
        return <Navigate to="/auth" replace />;
    }

    return <>{children}</>;
};

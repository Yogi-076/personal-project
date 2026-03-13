import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ScannerProvider } from "@/contexts/ScannerContext";
import { ParticleBackground } from "@/components/ParticleBackground";
import { DarkGradientBackground } from "@/components/DarkGradientBackground";
import { motion, AnimatePresence } from "framer-motion";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import { Scanner } from "./pages/Scanner";
import Tools from "./pages/Tools";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import VMT from "./pages/VMT";
import JWTMaster from "./pages/JWTMaster";
import { NativeChatbot } from "@/components/NativeChatbot";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import PlatformAdmin from "./pages/PlatformAdmin";
import Projects from "./pages/Projects";
import ProjectDetails from "./pages/ProjectDetails";

const queryClient = new QueryClient();

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="w-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />

          {/* Dashboard & Sub-routes */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/vmt" element={<ProtectedRoute><VMT /></ProtectedRoute>} />
          <Route path="/vmt/:projectId" element={<ProtectedRoute><VMT /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/tools" element={<ProtectedRoute><Tools /></ProtectedRoute>} />

          {/* [NEW] VAPT Project Management Routing */}
          <Route path="/projects" element={<ProtectedRoute><Projects /></ProtectedRoute>} />
          <Route path="/projects/:id" element={<ProtectedRoute><ProjectDetails /></ProtectedRoute>} />
          <Route
            path="/scanner"
            element={
              <ProtectedRoute>
                <Scanner />
              </ProtectedRoute>
            }
          />
          <Route path="/jwt-master" element={<JWTMaster />} />
          <Route path="/platform-admin" element={<ProtectedRoute><PlatformAdmin /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <div className="min-h-screen bg-background relative overflow-hidden">
        {/* Global theme background - appears on all pages */}
        <DarkGradientBackground />
        <ParticleBackground />

        <div className="relative z-10">
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthProvider>
              <ScannerProvider>
                <AnimatedRoutes />
                <NativeChatbot />
              </ScannerProvider>
            </AuthProvider>
          </BrowserRouter>
        </div>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

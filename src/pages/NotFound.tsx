import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, Home, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background aurora-bg noise-texture flex items-center justify-center p-6">
            <div className="relative max-w-md w-full text-center space-y-8">
                {/* Visual Glitch/Icon Area */}
                <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", damping: 20 }}
                    className="relative inline-block"
                >
                    <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full animate-pulse" />
                    <div className="relative w-24 h-24 rounded-3xl bg-black/40 backdrop-blur-xl border border-primary/30 flex items-center justify-center shadow-2xl">
                        <ShieldAlert className="w-12 h-12 text-primary" />
                    </div>
                    <motion.div 
                        className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full border-2 border-background"
                        animate={{ y: [0, -5, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        404
                    </motion.div>
                </motion.div>

                <div className="space-y-3">
                    <motion.h1 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-4xl font-black tracking-tighter text-white"
                    >
                        SECTION <span className="text-gradient-cyber">REDACTED</span>
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="text-muted-foreground text-sm font-medium leading-relaxed"
                    >
                        The requested intelligence vector does not exist or has been purged from the mainframe.
                    </motion.p>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4"
                >
                    <Button 
                        onClick={() => navigate(-1)} 
                        variant="ghost" 
                        className="w-full sm:w-auto rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/10 h-11 px-6 font-bold text-xs tracking-widest"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        RETREAT
                    </Button>
                    <Button 
                        onClick={() => navigate('/')} 
                        className="btn-cyber w-full sm:w-auto rounded-xl h-11 px-8 font-black text-xs tracking-widest shadow-lg shadow-primary/20"
                    >
                        <Home className="w-4 h-4 mr-2" />
                        RETURN HOME
                    </Button>
                </motion.div>

                {/* Footer status */}
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="pt-8 flex items-center justify-center gap-2"
                >
                    <span className="w-2 h-2 rounded-full bg-primary/40 animate-ping" />
                    <span className="text-[10px] font-mono text-primary/40 uppercase tracking-[0.3em]">System Offline</span>
                </motion.div>
            </div>
        </div>
    );
};

export default NotFound;

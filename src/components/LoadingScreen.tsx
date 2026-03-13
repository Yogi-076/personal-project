import { motion } from "framer-motion";
import { Shield } from "lucide-react";

export const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background aurora-bg noise-texture">
            {/* Ambient orbs */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/10 blur-[100px] pointer-events-none animate-pulse" />

            <div className="relative flex flex-col items-center">
                {/* Rotating ring */}
                <motion.div
                    className="absolute inset-0 w-24 h-24 rounded-3xl border-2 border-primary/20"
                    animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />

                {/* Logo container */}
                <motion.div
                    className="w-24 h-24 rounded-3xl bg-black/40 backdrop-blur-xl border border-primary/30 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)]"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.5 }}
                >
                    <Shield className="w-10 h-10 text-primary animate-pulse" />
                </motion.div>

                {/* Text animation */}
                <div className="mt-8 flex flex-col items-center">
                    <motion.div
                        className="text-lg font-black tracking-[0.3em] text-white uppercase"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                    >
                        Vajra<span className="text-primary">Scan</span>
                    </motion.div>
                    <motion.div
                        className="mt-2 text-[10px] font-mono text-primary/60 uppercase tracking-[0.5em] flex items-center gap-2"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                    >
                        <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                        Synchronizing Matrix
                    </motion.div>
                </div>
            </div>

            {/* Bottom Progress loader line */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5 overflow-hidden">
                <motion.div
                    className="h-full bg-primary shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
        </div>
    );
};

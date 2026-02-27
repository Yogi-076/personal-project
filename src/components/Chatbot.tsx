import React, { useState, useEffect } from 'react';
import Config from '@/config';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { MessageCircle, Minimize2, Maximize2, X, Shield, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export const Chatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [iframeKey, setIframeKey] = useState(0);
    const { user } = useAuth();

    // Automatically close the chatbot when a user logs out
    useEffect(() => {
        if (!user) {
            setIsOpen(false);
        }
    }, [user]);

    // Refresh iframe when opening to ensure clean state
    useEffect(() => {
        if (isOpen) {
            setIframeKey(prev => prev + 1);
        }
    }, [isOpen]);

    // Don't render anything if not logged in
    if (!user) return null;

    return (
        <div className={cn(
            "fixed z-50 flex flex-col items-end transition-all duration-300",
            isMaximized ? "inset-4" : "bottom-6 right-6"
        )}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{
                            opacity: 1,
                            scale: 1,
                            y: 0,
                            width: isMaximized ? "100%" : "480px",
                            height: isMaximized ? "100%" : "700px"
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className={cn(
                            "relative flex flex-col overflow-hidden",
                            "bg-gradient-to-br from-slate-950/95 via-rose-950/95 to-slate-950/95",
                            "border border-red-500/30 rounded-2xl shadow-2xl",
                            "backdrop-blur-2xl",
                            isMaximized ? "w-full h-full" : "w-[480px] h-[700px] mb-4"
                        )}
                        style={{
                            boxShadow: "0 0 60px rgba(220, 38, 38, 0.15), 0 0 120px rgba(185, 28, 28, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)"
                        }}
                    >
                        {/* Animated gradient background overlay */}
                        <div className="absolute inset-0 opacity-30">
                            <div className="absolute inset-0 bg-gradient-to-br from-red-600/20 via-transparent to-rose-600/20 animate-pulse" />
                            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-red-400/50 to-transparent" />
                        </div>

                        {/* Header */}
                        <div className="relative px-5 py-4 border-b border-red-500/20 bg-gradient-to-r from-slate-900/80 to-slate-800/80 backdrop-blur-md">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {/* Animated icon */}
                                    <div className="relative">
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 blur-md opacity-75 animate-pulse" />
                                        <div className="relative w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 via-red-950 to-slate-900 flex items-center justify-center shadow-lg ring-2 ring-red-400/30 overflow-hidden p-0.5">
                                            <img src="/pluto-avatar.png" alt="Pluto" className="w-full h-full object-cover" />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white tracking-tight text-lg">Pluto</h3>
                                            <span className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-gradient-to-r from-red-500/20 to-rose-500/20 text-red-300 rounded-full border border-red-400/30">
                                                VAPT
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <motion.span
                                                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                                                animate={{
                                                    boxShadow: [
                                                        "0 0 8px rgba(52, 211, 153, 0.5)",
                                                        "0 0 16px rgba(52, 211, 153, 0.8)",
                                                        "0 0 8px rgba(52, 211, 153, 0.5)"
                                                    ]
                                                }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            />
                                            <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400/90 flex items-center gap-1">
                                                Online
                                                <Zap className="w-2.5 h-2.5" />
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setIsMaximized(!isMaximized)}
                                        className="p-2 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                                        aria-label={isMaximized ? "Restore" : "Maximize"}
                                    >
                                        {isMaximized ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
                                    </button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 border border-transparent hover:border-red-400/30"
                                        onClick={() => setIsOpen(false)}
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* WebChat Iframe */}
                        <div className="relative flex-1 bg-slate-950/50">
                            <iframe
                                key={iframeKey}
                                src={`${Config.CHATBOT_URL}?token=moltbot&theme=dark&sessionId=main`}
                                className="w-full h-full border-none"
                                title="Pluto AI Assistant"
                                allow="camera; microphone; clipboard-read; clipboard-write;"
                            />
                        </div>

                        {/* Footer accent */}
                        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-400/30 to-transparent" />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Action Button */}
            <motion.button
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative h-16 w-16 rounded-full flex items-center justify-center transition-all duration-300",
                    "bg-gradient-to-tr from-red-600 via-rose-600 to-red-700",
                    "shadow-2xl hover:shadow-red-500/50",
                    isOpen ? "rotate-90 scale-0 opacity-0 hidden" : "scale-100 opacity-100"
                )}
                style={{
                    boxShadow: "0 10px 40px rgba(220, 38, 38, 0.4), 0 0 20px rgba(244, 63, 94, 0.3)"
                }}
            >
                {/* Animated ring */}
                <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-400/50"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 0, 0.5]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                />

                {/* Glow effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-white/20 to-transparent" />

                {/* Icon */}
                <MessageCircle className="w-8 h-8 text-white relative z-10 drop-shadow-lg" />

                {/* Notification badge */}
                <motion.div
                    className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </motion.div>
            </motion.button>

            {/* Tooltip */}
            {!isOpen && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: isHovered ? 1 : 0, y: isHovered ? 0 : 10 }}
                    className="absolute -top-14 right-0 px-4 py-2 rounded-xl bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-xl border border-red-400/30 shadow-xl"
                    style={{
                        boxShadow: "0 10px 30px rgba(220, 38, 38, 0.2)"
                    }}
                >
                    <p className="text-sm font-semibold text-white whitespace-nowrap flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-red-400" />
                        Ask Pluto
                        <span className="text-red-400">→</span>
                    </p>
                    <div className="absolute -bottom-1 right-6 w-2 h-2 bg-slate-900 border-r border-b border-red-400/30 rotate-45" />
                </motion.div>
            )}
        </div>
    );
};

import React, { useState, useEffect, useRef } from 'react';
import Config from '@/config';
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Minimize2, Maximize2, X, Shield, Zap, Send, Bot, RefreshCw, Trash2, Terminal, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    isTyping?: boolean;
}

export const NativeChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            text: 'Hello! I am **Pluto**, your AI Security Analyst.\n\nI can help you:\n- 🚀 Run vulnerability scans\n- 🔍 Analyze security reports\n- 🛡️ Create WAF rules\n\n_How can I assist you today?_',
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    // Auto-scroll
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, isLoading]);

    // Cleanup on logout
    useEffect(() => {
        if (!user) setIsOpen(false);
    }, [user]);

    const handleSendMessage = async (e?: React.FormEvent) => {
        e?.preventDefault();
        sendMessage(inputValue);
    };

    const sendMessage = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            text: text,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${Config.API_URL}/api/chat`, {
                message: userMsg.text,
                sessionId: user?.id || 'guest-session'
            });

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: response.data.text,
                timestamp: new Date()
            };
            setMessages(prev => [...prev, botMsg]);

        } catch (error) {
            console.error('Chat error:', error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: '⚠️ **Connection Error**: I could not reach the Gemini API. \n\nPlease check your network or API Key.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearHistory = () => {
        setMessages([
            {
                id: Date.now().toString(),
                role: 'assistant',
                text: 'History cleared. Ready for a fresh start! 🧹',
                timestamp: new Date()
            }
        ]);
        // Ideally verify with backend to clear session context too
    };

    // Quick Actions
    const quickActions = [
        { label: "Status", cmd: "System Status", icon: <Zap className="w-3 h-3" /> },
        { label: "Scan History", cmd: "Show recent scans", icon: <RefreshCw className="w-3 h-3" /> },
        { label: "Help", cmd: "What can you do?", icon: <Shield className="w-3 h-3" /> },
    ];

    if (!user) return null;

    return (
        <div className={cn(
            "fixed z-50 flex flex-col items-end transition-all duration-300 pointer-events-none",
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
                            width: isMaximized ? "100%" : "450px",
                            height: isMaximized ? "100%" : "700px"
                        }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: "spring", damping: 30, stiffness: 350 }}
                        className={cn(
                            "pointer-events-auto flex flex-col overflow-hidden",
                            "bg-slate-950/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl",
                            isMaximized ? "w-full h-full" : "mb-4"
                        )}
                        style={{
                            boxShadow: "0 0 40px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.05)"
                        }}
                    >
                        {/* 1. Header with Gradient and Glow */}
                        <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/5 bg-gradient-to-r from-red-950/40 via-transparent to-transparent">

                            <div className="flex items-center gap-3.5">
                                {/* Logo Wrapper */}
                                <div className="relative group">
                                    <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-red-600 to-amber-600 opacity-75 blur transition duration-200 group-hover:opacity-100 animate-pulse" />
                                    <div className="relative w-10 h-10 rounded-full bg-slate-950 flex items-center justify-center border border-white/10 ring-1 ring-white/5 overflow-hidden">
                                        <img src="/pluto-avatar.png" alt="Pluto" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-slate-950 rounded-full" />
                                </div>

                                <div className="flex flex-col">
                                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                        Pluto AI
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 font-medium">BETA</span>
                                    </h3>
                                    <span className="text-xs text-slate-400 font-medium tracking-wide">Security Analyst</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    onClick={clearHistory}
                                    title="Clear History"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                    onClick={() => setIsMaximized(!isMaximized)}
                                >
                                    {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                    onClick={() => setIsOpen(false)}
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* 2. Messages Area (Rich Text) */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
                            {messages.map((msg) => (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    key={msg.id}
                                    className={cn(
                                        "flex w-full gap-3",
                                        msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                                    )}
                                >
                                    {/* Avatar */}
                                    <div className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 border shadow-sm mt-0.5 overflow-hidden",
                                        msg.role === 'user'
                                            ? "bg-slate-800 border-slate-700 text-slate-400"
                                            : "bg-slate-950 border-red-500/30"
                                    )}>
                                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <img src="/pluto-avatar.png" className="w-full h-full object-cover" alt="Pluto" />}
                                    </div>

                                    {/* Bubble */}
                                    <div className={cn(
                                        "max-w-[85%] rounded-2xl px-5 py-3.5 text-sm shadow-sm",
                                        msg.role === 'user'
                                            ? "bg-slate-800 text-white rounded-tr-none border border-slate-700"
                                            : "bg-slate-900/50 text-slate-200 rounded-tl-none border border-slate-800"
                                    )}>
                                        <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-slate-950 prose-pre:border prose-pre:border-slate-800 prose-sm max-w-none">
                                            {/* Render Markdown */}
                                            {msg.role === 'assistant' ? (
                                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                    {msg.text}
                                                </ReactMarkdown>
                                            ) : (
                                                <span className="whitespace-pre-wrap">{msg.text}</span>
                                            )}
                                        </div>
                                        <div className="mt-2 text-[10px] opacity-40 font-medium">
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </div>
                                </motion.div>
                            ))}

                            {/* Loading Indicator */}
                            {isLoading && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex w-full gap-3"
                                >
                                    <div className="w-8 h-8 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center shrink-0">
                                        <Bot className="w-4 h-4 text-red-500 animate-pulse" />
                                    </div>
                                    <div className="bg-slate-900/50 border border-slate-800 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" />
                                    </div>
                                </motion.div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* 3. Footer: Quick Actions & Input */}
                        <div className="p-4 bg-slate-950 border-t border-white/10 space-y-3">
                            {/* Quick Actions */}
                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                                {quickActions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(action.cmd)}
                                        disabled={isLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-red-500/30 hover:text-red-400 text-xs font-medium text-slate-400 transition-all whitespace-nowrap"
                                    >
                                        {action.icon}
                                        {action.label}
                                    </button>
                                ))}
                            </div>

                            {/* Input Form */}
                            <form onSubmit={handleSendMessage} className="relative group">
                                <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-red-500/20 to-amber-500/20 opacity-0 group-hover:opacity-100 transition duration-500 blur-sm" />
                                <div className="relative flex items-center gap-2 bg-slate-900 rounded-xl border border-white/10 px-1 py-1 focus-within:ring-1 focus-within:ring-red-500/50 focus-within:border-red-500/50 transition-all">
                                    <div className="pl-3">
                                        <Terminal className="w-4 h-4 text-slate-500" />
                                    </div>
                                    <Input
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        placeholder="Type a command or ask a question..."
                                        className="bg-transparent border-none shadow-none focus-visible:ring-0 text-white placeholder:text-slate-600 h-10"
                                        disabled={isLoading}
                                    />
                                    <Button
                                        type="submit"
                                        size="icon"
                                        disabled={!inputValue.trim() || isLoading}
                                        className={cn(
                                            "h-9 w-9 rounded-lg transition-all duration-200",
                                            inputValue.trim()
                                                ? "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_15px_rgba(220,38,38,0.5)]"
                                                : "bg-slate-800 text-slate-500"
                                        )}
                                    >
                                        <Send className="w-4 h-4" />
                                    </Button>
                                </div>
                            </form>

                            <div className="text-center">
                                <span className="text-[10px] text-slate-600 bg-slate-900/50 px-2 py-0.5 rounded-full border border-white/5">
                                    Powered by <strong>Gemini 1.5 Flash</strong> &bull; VAPT Framework v2.0
                                </span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Floating Toggle Button (Always visible when closed) */}
            <motion.button
                layoutId="chatbot-trigger"
                onClick={() => setIsOpen(!isOpen)}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={cn(
                    "pointer-events-auto relative h-16 w-16 rounded-full flex items-center justify-center transition-all bg-slate-950 border border-white/10 shadow-2xl group",
                    isOpen ? "rotate-90 scale-0 opacity-0 hidden" : "scale-100 opacity-100"
                )}
            >
                {/* Rotating Border Effect */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-red-600 to-amber-600 blur opacity-40 group-hover:opacity-100 transition duration-500" />

                <div className="relative h-full w-full rounded-full bg-slate-900 flex items-center justify-center border border-white/5 overflow-hidden">
                    {/* Inner content */}
                    <img src="/pluto-avatar.png" className="w-full h-full object-cover relative z-10" alt="Chat" />

                    {/* Shine effect */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent translate-y-full group-hover:translate-y-[-100%] transition-transform duration-700" />
                </div>

                {/* Verified Badge */}
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-950 rounded-full flex items-center justify-center animate-pulse">
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                </span>
            </motion.button>
        </div>
    );
};

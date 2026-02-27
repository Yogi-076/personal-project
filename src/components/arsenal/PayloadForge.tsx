import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Sword, Copy, Search, Shield, Zap, Target, Bug,
    FileCode, Terminal, Globe, Lock, ChevronDown,
    CheckCircle2, Flame, Sparkles, TrendingUp
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
    encodePayload,
    ENCODING_OPTIONS,
    getBypassLevelLabel,
    getBypassLevelColor,
    getCategoryColor,
    type EncodingContext
} from "@/lib/payloadEncoder";

interface Payload {
    id: string;
    category: string;
    payload: string;
    bypass_level: number;
    target_os: string;
    waf_signatures: string[];
    tags: string[];
    context: string;
    success_count: number;
}

const CATEGORY_ICONS: Record<string, typeof Sword> = {
    'XSS': Zap,
    'SQLi': Bug,
    'LFI': FileCode,
    'SSRF': Globe,
    'XXE': Terminal,
    'SSTI': Flame,
    'Command Injection': Terminal,
    'Auth Bypass': Lock,
};

const API_BASE = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Fuzzy search removed - using server-side search


// Payload Card Component
function PayloadCard({ payload, onCopy }: { payload: Payload; onCopy: (text: string, label: string) => void }) {
    const [expanded, setExpanded] = useState(false);
    const [showEncodings, setShowEncodings] = useState(false);
    const Icon = CATEGORY_ICONS[payload.category] || Target;

    const quickEncodings: { ctx: EncodingContext; label: string }[] = [
        { ctx: 'plain', label: 'RAW' },
        { ctx: 'url', label: 'URL' },
        { ctx: 'base64', label: 'B64' },
        { ctx: 'hex', label: 'HEX' },
    ];

    return (
        <div className="group relative bg-black/40 border border-white/[0.06] rounded-lg hover:border-purple-500/30 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/5 overflow-hidden">
            {/* Bypass Level Indicator Bar */}
            <div
                className="absolute top-0 left-0 right-0 h-[2px]"
                style={{
                    background: `linear-gradient(90deg, ${payload.bypass_level >= 4 ? '#ef4444' : payload.bypass_level >= 2 ? '#f59e0b' : '#22c55e'
                        } 0%, transparent 100%)`,
                    opacity: 0.6,
                }}
            />

            <div className="p-4 space-y-3">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="flex-shrink-0 w-7 h-7 rounded-md bg-white/5 flex items-center justify-center">
                            <Icon className="w-3.5 h-3.5 text-purple-400" />
                        </div>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${getCategoryColor(payload.category)}`}>
                            {payload.category}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border ${getBypassLevelColor(payload.bypass_level)}`}>
                            L{payload.bypass_level} · {getBypassLevelLabel(payload.bypass_level)}
                        </Badge>
                    </div>
                    {payload.success_count > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-green-400/70">
                            <TrendingUp className="w-3 h-3" />
                            <span>{payload.success_count}</span>
                        </div>
                    )}
                </div>

                {/* Payload Text */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full text-left"
                >
                    <pre className={`font-mono text-xs text-green-300/90 bg-black/50 rounded px-3 py-2.5 border border-white/[0.04] whitespace-pre-wrap break-all leading-relaxed ${!expanded ? 'max-h-[72px] overflow-hidden' : ''}`}>
                        {payload.payload}
                    </pre>
                    {!expanded && payload.payload.length > 100 && (
                        <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronDown className="w-3 h-3" />expand
                        </div>
                    )}
                </button>

                {/* Tags */}
                <div className="flex flex-wrap gap-1">
                    {payload.waf_signatures?.map((w, i) => (
                        <Badge key={`waf-${i}`} variant="outline" className="text-[9px] px-1 py-0 border-red-500/20 text-red-400/70 bg-red-500/5">
                            <Shield className="w-2.5 h-2.5 mr-0.5" />{w}
                        </Badge>
                    ))}
                    {payload.tags?.slice(0, 4).map((tag, i) => (
                        <Badge key={`tag-${i}`} variant="outline" className="text-[9px] px-1 py-0 border-white/10 text-muted-foreground">
                            {tag}
                        </Badge>
                    ))}
                    {payload.tags?.length > 4 && (
                        <span className="text-[9px] text-muted-foreground">+{payload.tags.length - 4}</span>
                    )}
                </div>

                {/* Quick Copy Actions */}
                <div className="flex items-center gap-1.5 pt-1">
                    {quickEncodings.map(({ ctx, label }) => (
                        <Button
                            key={ctx}
                            variant="outline"
                            size="sm"
                            className="h-6 text-[10px] px-2 border-white/10 hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 font-mono transition-all"
                            onClick={() => onCopy(encodePayload(payload.payload, ctx), label)}
                        >
                            <Copy className="w-2.5 h-2.5 mr-1" />{label}
                        </Button>
                    ))}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2 border-white/10 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-300 font-mono ml-auto transition-all"
                        onClick={() => setShowEncodings(!showEncodings)}
                    >
                        <Sparkles className="w-2.5 h-2.5 mr-1" />MORE
                    </Button>
                </div>

                {/* Extended Encoding Panel */}
                {showEncodings && (
                    <div className="grid grid-cols-3 gap-1 pt-1 border-t border-white/5 animate-in slide-in-from-top-2 duration-200">
                        {ENCODING_OPTIONS.filter(o => !quickEncodings.find(q => q.ctx === o.value)).map(opt => (
                            <Button
                                key={opt.value}
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[9px] px-1.5 hover:bg-white/5 hover:text-white font-mono justify-start"
                                onClick={() => onCopy(encodePayload(payload.payload, opt.value), opt.shortLabel)}
                            >
                                <Copy className="w-2.5 h-2.5 mr-1 flex-shrink-0" />{opt.shortLabel}
                            </Button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Main Apex-Vault Component
export const PayloadForge = () => {
    const { toast } = useToast();
    const [payloads, setPayloads] = useState<Payload[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, categories: 0, wafPayloads: 0 });

    // Pagination state
    const [offset, setOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const LIMIT = 50;

    const searchInputRef = useRef<HTMLInputElement>(null);
    const observer = useRef<IntersectionObserver | null>(null);

    // Last element ref for infinite scroll
    const lastPayloadRef = useCallback((node: HTMLDivElement) => {
        if (loading) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setOffset(prev => prev + LIMIT);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, hasMore]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setOffset(0);
            setPayloads([]);
            setHasMore(true);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Reset on category change
    useEffect(() => {
        setOffset(0);
        setPayloads([]);
        setHasMore(true);
    }, [activeCategory]);

    // Fetch payloads
    const fetchPayloads = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('limit', LIMIT.toString());
            params.set('offset', offset.toString());

            if (activeCategory !== 'all') params.set('category', activeCategory);
            if (debouncedSearch) params.set('search', debouncedSearch);

            const res = await fetch(`${API_BASE}/api/payloads?${params}`);
            const data = await res.json();

            setPayloads(prev => {
                // If offset is 0, replace. Else append.
                if (offset === 0) return data.payloads || [];
                // Filter duplicates just in case
                const newPayloads = data.payloads || [];
                const existingIds = new Set(prev.map(p => p.id));
                return [...prev, ...newPayloads.filter((p: Payload) => !existingIds.has(p.id))];
            });

            setCategories(data.categories || []);
            setStats({
                total: data.total || 0,
                categories: data.categories?.length || 0,
                wafPayloads: 0, // removed to avoid heavy calc on client
            });

            setHasMore((data.payloads?.length || 0) === LIMIT);

        } catch (error) {
            console.error('[Apex-Vault] Failed to fetch payloads:', error);
            toast({
                title: "Connection Error",
                description: "Could not connect to Apex-Vault API.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [activeCategory, debouncedSearch, offset, toast]);

    useEffect(() => {
        fetchPayloads();
    }, [fetchPayloads]);

    // Keyboard shortcut: Ctrl+K to focus search
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    const handleCopy = useCallback((text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast({
            title: `Copied ${label}`,
            description: text.length > 60 ? text.slice(0, 60) + '…' : text,
            className: "bg-green-900/80 text-green-100 border-green-500/30 backdrop-blur font-mono",
        });
    }, [toast]);

    return (
        <div className="h-full flex flex-col gap-4 overflow-hidden">
            {/* Header Bar */}
            <div className="flex-none flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <Sword className="w-4.5 h-4.5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold tracking-wide text-white flex items-center gap-2">
                            APEX-VAULT
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-purple-500/30 text-purple-400 font-mono">
                                v2.0
                            </Badge>
                        </h2>
                        <p className="text-[10px] text-muted-foreground font-mono">
                            {stats.total} payloads · {stats.categories} categories · {stats.wafPayloads} WAF bypasses
                        </p>
                    </div>
                </div>

                {/* Search */}
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                        ref={searchInputRef}
                        placeholder='Search payloads, tags, WAF... (Ctrl+K)'
                        className="pl-9 h-8 text-xs font-mono bg-black/40 border-white/10 focus:border-purple-500/50 placeholder:text-muted-foreground/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground hover:text-white px-1.5 py-0.5 rounded bg-white/5"
                        >
                            ESC
                        </button>
                    )}
                </div>
            </div>

            {/* Category Tabs */}
            <div className="flex-none">
                <Tabs value={activeCategory} onValueChange={setActiveCategory}>
                    <TabsList className="w-full bg-black/30 border border-white/5 p-0.5 h-auto flex flex-wrap gap-0.5 justify-start">
                        <TabsTrigger
                            value="all"
                            className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 font-mono text-[10px] px-2.5 py-1 border border-transparent data-[state=active]:border-purple-500/30"
                        >
                            <Target className="w-3 h-3 mr-1.5" /> ALL
                        </TabsTrigger>
                        {categories.map(cat => {
                            const CatIcon = CATEGORY_ICONS[cat] || Target;
                            return (
                                <TabsTrigger
                                    key={cat}
                                    value={cat}
                                    className="data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300 font-mono text-[10px] px-2.5 py-1 border border-transparent data-[state=active]:border-purple-500/30"
                                >
                                    <CatIcon className="w-3 h-3 mr-1.5" /> {cat.toUpperCase()}
                                </TabsTrigger>
                            );
                        })}
                    </TabsList>
                </Tabs>
            </div>

            {/* Payload Grid */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 custom-scrollbar">
                {loading && payloads.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="flex flex-col items-center gap-3">
                            <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                            <span className="text-xs text-muted-foreground font-mono">Loading Apex-Vault...</span>
                        </div>
                    </div>
                ) : payloads.length === 0 ? (
                    <div className="flex items-center justify-center h-48">
                        <div className="text-center space-y-2">
                            <Shield className="w-8 h-8 text-muted-foreground mx-auto" />
                            <p className="text-sm text-muted-foreground">No payloads found</p>
                            <p className="text-xs text-muted-foreground/60 font-mono">
                                {searchQuery ? 'Try a different search query' : 'Start the backend server to load payloads'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {payloads.map((p, index) => {
                            if (index === payloads.length - 1) {
                                return <div ref={lastPayloadRef} key={p.id}><PayloadCard payload={p} onCopy={handleCopy} /></div>;
                            }
                            return <div key={p.id}><PayloadCard payload={p} onCopy={handleCopy} /></div>;
                        })}
                        {loading && (
                            <div className="col-span-full py-4 text-center">
                                <div className="inline-block w-6 h-6 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                            </div>
                        )}
                        {!hasMore && payloads.length > 0 && (
                            <div className="col-span-full py-4 text-center text-[10px] text-muted-foreground font-mono opacity-50">
                                End of arsenal
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            {!loading && payloads.length > 0 && (
                <div className="flex-none flex items-center justify-between px-1 py-1 border-t border-white/5">
                    <span className="text-[10px] text-muted-foreground font-mono">
                        Showing {payloads.length} of {stats.total} payloads
                        {searchQuery && ` · Filtered by "${searchQuery}"`}
                    </span>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-green-500" />
                            Engine Ready
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

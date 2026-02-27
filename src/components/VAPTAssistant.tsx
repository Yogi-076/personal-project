import React, { useState } from 'react';
import { Sparkles, Calculator, FileText, CheckCircle, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { vmtApi } from '@/lib/api_vmt';
import { useToast } from '@/hooks/use-toast';

interface VAPTAssistantProps {
    onInsertFinding?: (finding: string) => void;
    currentVulnerability?: any;
}

export const VAPTAssistant: React.FC<VAPTAssistantProps> = ({
    onInsertFinding,
    currentVulnerability
}) => {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string>('');
    const { toast } = useToast();

    const handleGenerateFinding = async () => {
        if (!input.trim()) {
            toast({ title: 'Error', description: 'Please describe the vulnerability', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            const response = await vmtApi.generateFinding(
                input,
                currentVulnerability?.endpoint,
                currentVulnerability?.severity
            );
            setResult(response.finding);
            toast({ title: 'Success', description: 'Vulnerability finding generated!' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to generate finding', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleCalculateCVSS = async () => {
        if (!currentVulnerability?.issue_name) {
            toast({ title: 'Error', description: 'Select a vulnerability first', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            const response = await vmtApi.calculateCVSS({
                vulnerability: currentVulnerability.issue_name,
                attackVector: 'Network',
                complexity: 'Low',
                privileges: 'None',
                userInteraction: 'None',
                scope: 'Unchanged',
                impacts: {
                    confidentiality: 'High',
                    integrity: 'High',
                    availability: 'High'
                }
            });
            setResult(`CVSS Score: ${response.score}\nVector: ${response.vector}\n\n${response.justification || ''}`);
            toast({ title: 'Success', description: 'CVSS score calculated!' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to calculate CVSS', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleImproveText = async () => {
        if (!input.trim()) {
            toast({ title: 'Error', description: 'Enter text to improve', variant: 'destructive' });
            return;
        }

        setLoading(true);
        try {
            const response = await vmtApi.improveText(input, 'technical');
            setResult(response.improved);
            toast({ title: 'Success', description: 'Text improved!' });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to improve text', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleVAPTChat = async () => {
        if (!input.trim()) return;

        setLoading(true);
        try {
            const context = currentVulnerability
                ? `Current Vulnerability: ${currentVulnerability.issue_name} at ${currentVulnerability.endpoint}`
                : undefined;

            const response = await vmtApi.vaptChat(input, context);
            setResult(response.reply);
        } catch (error) {
            toast({ title: 'Error', description: 'AI chat failed', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-black/90 backdrop-blur-xl border-l border-white/10">
            {/* Header */}
            <div className="p-4 border-b border-white/10">
                <div className="flex items-center gap-2 text-cyber-purple">
                    <Sparkles className="w-5 h-5" />
                    <h3 className="font-bold tracking-wider">VAPT AI ASSISTANT</h3>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                    Powered by security intelligence
                </p>
            </div>

            {/* Quick Actions */}
            <div className="p-4 border-b border-white/10 space-y-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-auto py-2 flex flex-col items-center gap-1 bg-cyber-purple/10 border-cyber-purple/30 hover:bg-cyber-purple/20"
                        onClick={handleGenerateFinding}
                        disabled={loading}
                    >
                        <FileText className="w-4 h-4" />
                        <span className="text-[10px]">Generate Finding</span>
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="h-auto py-2 flex flex-col items-center gap-1 bg-cyber-cyan/10 border-cyber-cyan/30 hover:bg-cyber-cyan/20"
                        onClick={handleCalculateCVSS}
                        disabled={loading}
                    >
                        <Calculator className="w-4 h-4" />
                        <span className="text-[10px]">Calculate CVSS</span>
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="h-auto py-2 flex flex-col items-center gap-1 bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                        onClick={handleImproveText}
                        disabled={loading}
                    >
                        <Wand2 className="w-4 h-4" />
                        <span className="text-[10px]">Improve Text</span>
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        className="h-auto py-2 flex flex-col items-center gap-1 bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20"
                        onClick={handleVAPTChat}
                        disabled={loading}
                    >
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-[10px]">Ask AI</span>
                    </Button>
                </div>
            </div>

            {/* Input Area */}
            <div className="p-4 border-b border-white/10">
                <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe vulnerability, ask questions, or paste text to improve..."
                    className="min-h-[100px] bg-black/50 border-white/10 text-white resize-none focus:border-cyber-cyan"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && e.ctrlKey) {
                            handleVAPTChat();
                        }
                    }}
                />
                <p className="text-[9px] text-muted-foreground mt-1">
                    Press Ctrl+Enter to chat, or use quick actions above
                </p>
            </div>

            {/* Result Area */}
            <div className="flex-1 p-4 overflow-auto custom-scrollbar">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="flex flex-col items-center gap-2">
                            <div className="w-8 h-8 border-2 border-cyber-purple border-t-transparent rounded-full animate-spin" />
                            <p className="text-xs text-muted-foreground">AI Processing...</p>
                        </div>
                    </div>
                ) : result ? (
                    <div className="space-y-2">
                        <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                            <pre className="text-xs text-white whitespace-pre-wrap font-mono">
                                {result}
                            </pre>
                        </div>
                        {onInsertFinding && (
                            <Button
                                size="sm"
                                className="w-full bg-cyber-purple hover:bg-cyber-purple/80"
                                onClick={() => onInsertFinding(result)}
                            >
                                Insert into Report
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-full text-center">
                        <div className="space-y-2">
                            <Sparkles className="w-12 h-12 text-cyber-purple/30 mx-auto" />
                            <p className="text-xs text-muted-foreground">
                                Use quick actions or type a message to get started
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

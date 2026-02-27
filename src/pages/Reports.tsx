import { useState, useEffect, Component, type ReactNode, type ErrorInfo } from 'react';
import { useToast } from "@/hooks/use-toast";
import { RecentScans } from '@/components/RecentScans';
import { ScanReport } from '@/components/ScanReport';
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Menu, FileText, ArrowLeft, AlertTriangle } from "lucide-react";
import { scannerApi } from '@/lib/api_vmt';
import { Button } from "@/components/ui/button";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Reports Page Crash:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="h-screen w-full flex items-center justify-center bg-background text-red-500">
                    <div className="text-center p-8 border border-red-500/20 rounded-xl bg-red-500/5 max-w-2xl">
                        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold mb-2">Reports Module Failed</h2>
                        <p className="text-muted-foreground mb-4">An unexpected error occurred while loading the reports interface.</p>
                        <pre className="bg-black/50 p-4 rounded text-left text-xs font-mono overflow-auto max-h-[200px] mb-4 text-red-300">
                            {this.state.error?.toString()}
                        </pre>
                        <Button onClick={() => window.location.reload()} variant="destructive">
                            Reload Application
                        </Button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const ReportsContent = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [selectedScan, setSelectedScan] = useState<any>(null);
    const [scanResult, setScanResult] = useState<any>(null);

    useEffect(() => {
        if (!loading && !user) navigate("/auth");
    }, [user, loading, navigate]);

    const handleSelectScan = async (scan: any) => {
        setSelectedScan(scan);
        setScanResult(null); // Clear previous result while loading

        try {
            const resultsData = await scannerApi.getResults(scan.id);
            setScanResult(resultsData);
        } catch (error) {
            toast({
                title: "Error",
                description: "Could not load report details.",
                variant: "destructive"
            });
        }
    };

    if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen flex w-full bg-background">
            {sidebarOpen && <AppSidebar />}

            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
                {/* Header */}
                <div className="h-16 border-b bg-background/95 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-muted rounded-md">
                            <Menu className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded bg-blue-600/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                                <FileText className="w-5 h-5" />
                            </div>
                            <h1 className="font-bold text-lg tracking-tight">Security Reports</h1>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">

                        {/* Left Column: Scan List */}
                        <div className="lg:col-span-4 h-full flex flex-col">
                            <div className="bg-card rounded-xl border shadow-sm p-4 h-full flex flex-col">
                                <h3 className="font-semibold mb-4 px-2">Scan History</h3>
                                <div className="flex-1 overflow-hidden">
                                    {/* We reuse RecentScans but it needs to fit this container */}
                                    <RecentScans onSelect={handleSelectScan} />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Report Details */}
                        <div className="lg:col-span-8 h-full overflow-hidden flex flex-col">
                            {scanResult ? (
                                <div className="h-full overflow-auto pr-2 custom-scrollbar pb-10">
                                    <ScanReport result={scanResult} />
                                </div>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed rounded-xl bg-muted/10">
                                    <FileText className="w-16 h-16 mb-4 opacity-20" />
                                    <p className="font-medium">Select a scan report from the list</p>
                                    <p className="text-sm opacity-60">View detailed findings and remediation steps</p>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </div>
    );
};

const Reports = () => (
    <ErrorBoundary>
        <ReportsContent />
    </ErrorBoundary>
);

export default Reports;

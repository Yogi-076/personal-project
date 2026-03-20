import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, X, Loader2, FileImage, FileText, File, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Config } from "@/config";

interface EvidenceUploadModalProps {
    projectId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

function getFileIcon(filename: string) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext || '')) return <FileImage className="w-5 h-5 text-blue-400" />;
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return <FileText className="w-5 h-5 text-orange-400" />;
    return <File className="w-5 h-5 text-slate-400" />;
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function EvidenceUploadModal({ projectId, open, onOpenChange, onSuccess }: EvidenceUploadModalProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadDone, setUploadDone] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const arr = Array.from(files);
        setSelectedFiles(prev => {
            const existing = new Set(prev.map(f => f.name));
            return [...prev, ...arr.filter(f => !existing.has(f.name))];
        });
    };

    const removeFile = (name: string) => setSelectedFiles(prev => prev.filter(f => f.name !== name));

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFiles(e.dataTransfer.files);
    };

    const handleUpload = async () => {
        if (selectedFiles.length === 0) {
            toast({ variant: "destructive", title: "No files selected" });
            return;
        }
        setIsUploading(true);
        try {
            const formData = new FormData();
            selectedFiles.forEach(f => formData.append("files", f));

            const token = localStorage.getItem('vmt_token');
            const res = await fetch(`${Config.API_URL}/api/projects/${projectId}/evidence`, {
                method: "POST",
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Upload failed");
            }

            const data = await res.json();
            toast({
                title: "📎 Evidence Uploaded",
                description: data.message,
            });
            setUploadDone(true);
            setSelectedFiles([]);
            onSuccess();
        } catch (e: any) {
            toast({ variant: "destructive", title: "Upload Error", description: e.message });
        } finally {
            setIsUploading(false);
        }
    };

    const handleClose = () => {
        setUploadDone(false);
        setSelectedFiles([]);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[560px] border-slate-500/20 bg-black/95 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-100">
                        <Paperclip className="w-5 h-5 text-slate-400" />
                        Upload Evidence
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Attach screenshots, logs, or any supporting files to this project.
                    </DialogDescription>
                </DialogHeader>

                {!uploadDone ? (
                    <div className="py-4 space-y-4">
                        {/* Drop Zone */}
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${isDragging ? "border-blue-500 bg-blue-500/10" : "border-white/10 hover:border-white/30 hover:bg-white/5"}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <Upload className="w-10 h-10 mx-auto mb-3 text-slate-500" />
                            <p className="text-sm font-medium text-slate-200">Drop files here or click to browse</p>
                            <p className="text-xs text-muted-foreground mt-1">Images, PDFs, logs, up to 20MB each (max 20 files)</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                className="hidden"
                                onChange={e => handleFiles(e.target.files)}
                            />
                        </div>

                        {/* File List */}
                        {selectedFiles.length > 0 && (
                            <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
                                {selectedFiles.map(file => (
                                    <div key={file.name} className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg border border-white/10 group">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {getFileIcon(file.name)}
                                            <div className="min-w-0">
                                                <div className="text-sm font-medium truncate">{file.name}</div>
                                                <div className="text-xs text-muted-foreground">{formatBytes(file.size)}</div>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 h-7 w-7 p-0" onClick={() => removeFile(file.name)}>
                                            <X className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="py-10 flex flex-col items-center text-center space-y-3">
                        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-bold text-emerald-50">Evidence Uploaded</h3>
                        <p className="text-sm text-slate-400">Files have been securely saved to the project vault.</p>
                    </div>
                )}

                <DialogFooter className="border-t border-white/5 pt-4">
                    <Button variant="ghost" onClick={handleClose} className="text-slate-400 hover:text-white">
                        {uploadDone ? "Close" : "Cancel"}
                    </Button>
                    {!uploadDone && (
                        <Button onClick={handleUpload} disabled={isUploading || selectedFiles.length === 0} className="bg-slate-700 hover:bg-slate-600 text-white">
                            {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                            {isUploading ? "Uploading..." : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ""}`}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

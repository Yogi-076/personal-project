
import React, { useState } from "react";
import { Plus, Trash2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type RecordType = "A" | "AAAA" | "CNAME" | "TXT" | "MX" | "NS" | "SRV" | "CAA";
type TTL = "1/2 hour" | "1 hour" | "12 hours" | "24 hours";

interface DNSRecord {
    id: string;
    type: RecordType;
    name: string;
    value: string;
    ttl: TTL;
}

export const NewRecords = () => {
    const { toast } = useToast();
    const [records, setRecords] = useState<DNSRecord[]>([
        { id: "1", type: "A", name: "@", value: "", ttl: "1/2 hour" },
    ]);

    const addRecord = () => {
        const newRecord: DNSRecord = {
            id: crypto.randomUUID(),
            type: "A",
            name: "",
            value: "",
            ttl: "1/2 hour",
        };
        setRecords([...records, newRecord]);
    };

    const removeRecord = (id: string) => {
        if (records.length === 1) {
            // Optional: Clear the last record instead of removing if you want to keep one row always
            // setRecords([{ id: crypto.randomUUID(), type: "A", name: "", value: "", ttl: "1/2 hour" }]);
            // For now, let's allow removing all, or just keep it as is.
            // The UI usually implies you can delete any row, but often keeps one.
            // Let's allow deleting, but if empty show a message or button to add.
        }
        setRecords(records.filter((r) => r.id !== id));
    };

    const updateRecord = (id: string, field: keyof DNSRecord, value: string) => {
        setRecords(
            records.map((r) => (r.id === id ? { ...r, [field]: value } : r))
        );
    };

    const handleSave = () => {
        // Validate
        const invalid = records.find(r => !r.name || !r.value);
        if (invalid) {
            toast({
                title: "Validation Error",
                description: "All fields marked with * are required.",
                variant: "destructive"
            });
            return;
        }

        console.log("Saving records:", records);
        toast({
            title: "Records Saved",
            description: `Successfully configured ${records.length} new record(s) for vajrascan.online`,
        });
    };

    return (
        <Card className="w-full bg-card/50 backdrop-blur-sm border-border">
            <CardHeader>
                <CardTitle>New Records</CardTitle>
                <CardDescription>
                    Select a record type from the dropdown menu to add a new record for <strong>vajrascan.online</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {records.map((record) => (
                    <div
                        key={record.id}
                        className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-4 rounded-lg bg-background/50 border border-border/50 hover:border-primary/20 transition-colors"
                    >
                        {/* Type */}
                        <div className="md:col-span-2 space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                                Type <span className="text-red-400">*</span>
                            </label>
                            <Select
                                value={record.type}
                                onValueChange={(val) => updateRecord(record.id, "type", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Type" />
                                </SelectTrigger>
                                <SelectContent>
                                    {["A", "AAAA", "CNAME", "TXT", "MX", "NS"].map((t) => (
                                        <SelectItem key={t} value={t}>
                                            {t}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Name */}
                        <div className="md:col-span-4 space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                                Name <span className="text-red-400">*</span>
                            </label>
                            <Input
                                placeholder="@ or www"
                                value={record.name}
                                onChange={(e) => updateRecord(record.id, "name", e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* Value */}
                        <div className="md:col-span-4 space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                                Value <span className="text-red-400">*</span>
                            </label>
                            <Input
                                placeholder={record.type === 'A' ? "192.0.2.1" : "Value"}
                                value={record.value}
                                onChange={(e) => updateRecord(record.id, "value", e.target.value)}
                                className="font-mono text-sm"
                            />
                        </div>

                        {/* TTL */}
                        <div className="md:col-span-1 space-y-2">
                            <label className="text-xs font-medium text-muted-foreground">
                                TTL
                            </label>
                            <Select
                                value={record.ttl}
                                onValueChange={(val) => updateRecord(record.id, "ttl", val)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="TTL" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="1/2 hour">1/2 hour</SelectItem>
                                    <SelectItem value="1 hour">1 hour</SelectItem>
                                    <SelectItem value="12 hours">12 hours</SelectItem>
                                    <SelectItem value="24 hours">24 hours</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Actions */}
                        <div className="md:col-span-1 flex justify-end pb-0.5">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeRecord(record.id)}
                                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}

                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border">
                    <Button
                        variant="outline"
                        onClick={addRecord}
                        className="w-full sm:w-auto border-dashed border-primary/30 hover:border-primary/50 text-primary hover:bg-primary/5"
                    >
                        <Plus className="w-4 h-4 mr-2" />
                        Add More Records
                    </Button>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button variant="ghost" onClick={() => setRecords([])} className="w-full sm:w-auto">
                            Cancel
                        </Button>
                        <Button onClick={handleSave} className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                            <Save className="w-4 h-4 mr-2" />
                            Save Records
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


import { motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewRecords } from "@/components/NewRecords";

const Records = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen relative p-4 lg:p-8 max-w-7xl mx-auto z-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-8"
            >
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/dashboard')}
                        className="rounded-full hover:bg-primary/10"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">DNS Management</h1>
                        <p className="text-muted-foreground">Configure domain records for your assets</p>
                    </div>
                </div>

                {/* Content */}
                <NewRecords />
            </motion.div>
        </div>
    );
};

export default Records;

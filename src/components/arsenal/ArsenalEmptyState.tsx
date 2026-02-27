import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

export const ArsenalEmptyState = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 border-2 border-dashed border-primary/20 rounded-xl bg-card/30 backdrop-blur-sm">
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-6"
            >
                <Wrench className="w-12 h-12 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-cyber-purple mb-3">
                Arsenal is Empty
            </h2>
            <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                Your advanced exploitation suite is ready to be built. Select a prompt or start creating new tools to populate your arsenal.
            </p>

            <div className="flex gap-4">
                <Button className="bg-primary hover:bg-primary/90">
                    Create New Tool
                </Button>
            </div>
        </div>
    );
};

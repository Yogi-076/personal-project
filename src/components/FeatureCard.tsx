import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export const FeatureCard = ({ icon: Icon, title, description, index }: FeatureCardProps) => {
  return (
    <motion.div
      className="group relative p-6 rounded-xl bg-card/50 backdrop-blur-sm border border-border hover:border-violet-500/50 transition-all duration-300 flex flex-col h-full hover:shadow-[0_0_30px_rgba(167,139,250,0.15)] hover:-translate-y-1"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      viewport={{ once: true }}
    >

      {/* Subtle Hover Effect */}
      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: "radial-gradient(circle at 50% 0%, hsl(var(--primary) / 0.05) 0%, transparent 50%)",
        }}
      />

      {/* Icon Container */}
      <div className="w-12 h-12 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
        <Icon className="w-6 h-6 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-auto">
          {description}
        </p>
      </div>

      {/* Terminal Prompt - Always at bottom */}
      <div className="mt-4 pt-4 border-t border-border">
        <code className="text-xs font-mono text-primary/70 block truncate">
          <span className="text-muted-foreground">$</span> module.{title.toLowerCase().replace(/\s+/g, '_')}
        </code>
      </div>
    </motion.div>
  );
};



import { motion } from "framer-motion";
import {
  Globe,
  Scan,
  Database,
  Layout,
  ArrowRight,
  Settings,
  FileText
} from "lucide-react";

const architectureSteps = [
  {
    icon: Globe,
    title: "Target Definition",
    description: "Define scan scope and target URLs",
    color: "text-primary",
  },
  {
    icon: Scan,
    title: "Intelligent Crawling",
    description: "Map application structure",
    color: "text-cyber-blue",
  },
  {
    icon: Settings,
    title: "Payload Injection",
    description: "Execute security test cases",
    color: "text-cyber-orange",
  },
  {
    icon: Database,
    title: "Data Processing",
    description: "Analyze and score findings",
    color: "text-cyber-purple",
  },
  {
    icon: Layout,
    title: "Dashboard Display",
    description: "Interactive visualization",
    color: "text-primary",
  },
  {
    icon: FileText,
    title: "Report Generation",
    description: "Export detailed reports",
    color: "text-success",
  },
];

export const ArchitectureSection = () => {
  return (
    <section className="relative py-24 px-4 bg-muted/20">
      <div className="container max-w-6xl">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/5 mb-6">
            <span className="text-xs font-mono text-primary uppercase tracking-wider">System Architecture</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-foreground">How It </span>
            <span className="text-gradient">Works</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A streamlined workflow from target definition to comprehensive security reporting.
          </p>
        </motion.div>

        {/* Architecture Flow */}
        <div className="relative">
          {/* Connection Line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2 hidden lg:block" />

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {architectureSteps.map((step, index) => (
              <motion.div
                key={step.title}
                className="relative"
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="flex flex-col items-center text-center group">
                  {/* Icon Circle */}
                  <motion.div
                    className="relative w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center mb-4 group-hover:border-primary/50 transition-colors z-10"
                    whileHover={{ scale: 1.1 }}
                  >
                    <step.icon className={`w-7 h-7 ${step.color}`} />

                    {/* Step Number */}
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                  </motion.div>

                  {/* Arrow (between items) */}
                  {index < architectureSteps.length - 1 && (
                    <ArrowRight className="absolute top-7 -right-3 w-6 h-6 text-primary/30 hidden lg:block z-0" />
                  )}

                  {/* Text */}
                  <h4 className="font-semibold text-foreground text-sm mb-1 group-hover:text-primary transition-colors">
                    {step.title}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Technical Details */}
        <motion.div
          className="mt-16 grid md:grid-cols-3 gap-6"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          {[
            {
              title: "Scanner Core",
              description: "Multi-threaded scanning engine with configurable payloads and detection modules.",
              code: "scanner.init(config)",
            },
            {
              title: "Database Layer",
              description: "Persistent storage for scan results, vulnerability data, and historical analysis.",
              code: "db.findings.store()",
            },
            {
              title: "API Controller",
              description: "RESTful interface enabling automation, CI/CD integration, and third-party tools.",
              code: "api.v1/scan/start",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="p-6 rounded-xl bg-card border border-border hover:border-primary/30 transition-colors"
            >
              <h4 className="font-semibold text-foreground mb-2">{item.title}</h4>
              <p className="text-sm text-muted-foreground mb-4">{item.description}</p>
              <code className="block px-3 py-2 rounded bg-muted/50 text-xs font-mono text-primary">
                {item.code}
              </code>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

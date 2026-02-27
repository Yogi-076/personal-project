import { motion } from "framer-motion";
import {
  Globe,
  BarChart3,
  Zap,
  FileSearch,
  Terminal,
  Eye,
  Server,
  Code2
} from "lucide-react";
import { FeatureCard } from "./FeatureCard";

const features = [
  {
    icon: Globe,
    title: "Multi-Vector Scanning",
    description: "Orchestrated DAST scanning utilizing multiple engines for maximum coverage of vulnerability vectors.",
  },
  {
    icon: Zap,
    title: "AI-Powered Risk Analysis",
    description: "Integrated AI engine leveraging LLMs for intelligent false-positive reduction and contextual remediation.",
  },
  {
    icon: Eye,
    title: "Passive Reconnaissance",
    description: "Deep OSINT capabilities for non-intrusive footprinting and tech stack analysis.",
  },
  {
    icon: Server,
    title: "Sovereign Infrastructure",
    description: "Self-contained, Dockerized environment ensuring complete data privacy and control over your security data.",
  },
  {
    icon: Code2,
    title: "SAST Code Analysis",
    description: "Static Application Security Testing to identify hardcoded secrets and logic flaws in source code.",
  },
  {
    icon: BarChart3,
    title: "Real-time CVSS Scoring",
    description: "Dynamic risk assessment with industry-standard CVSS metrics updated in real-time as vulnerabilities are found.",
  },
  {
    icon: Terminal,
    title: "API & Fuzzing Arsenal",
    description: "Advanced payload injection and fuzzing capabilities targeting REST APIs and hidden web services.",
  },
  {
    icon: FileSearch,
    title: "Interactive Reporting",
    description: "Comprehensive, filterable reports with executive summaries and detailed technical evidence.",
  },
];

export const FeaturesSection = () => {
  return (
    <section className="relative py-24 px-4">
      <div className="container max-w-6xl">
        {/* Section Header */}
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/5 mb-6">
            <span className="text-xs font-mono text-violet-400 uppercase tracking-wider">Operational Matrix</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-foreground">System </span>
            <span className="text-gradient bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-fuchsia-600">Capabilities</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A modular framework designed for thorough web application security assessment
            with enterprise-grade scanning capabilities.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
};

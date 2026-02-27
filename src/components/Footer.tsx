import { Shield, Github, Mail, ExternalLink } from "lucide-react";

export const Footer = () => {
  return (
    <footer className="relative py-12 px-4 border-t border-border">
      <div className="container max-w-6xl">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo & Project Name */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="font-semibold text-foreground">VAPT Framework</span>
              <p className="text-xs text-muted-foreground">Web Application Security Testing</p>
            </div>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="#"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Github className="w-4 h-4" />
              <span>Repository</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Documentation</span>
            </a>
            <a
              href="#"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>Contact</span>
            </a>
          </div>

          {/* Tech Stack */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Built with</span>
            <div className="flex items-center gap-2">
              {["Node.js", "React", "Puppeteer", "Wappalyzer"].map((tech) => (
                <span
                  key={tech}
                  className="px-2 py-1 text-xs font-mono text-primary/70 bg-primary/5 border border-primary/20 rounded"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-6 border-t border-border text-center">
          <p className="text-xs text-muted-foreground font-mono">
            © 2024 — Web Application Security Testing Framework & Interactive Analysis Platform
          </p>
        </div>
      </div>
    </footer>
  );
};

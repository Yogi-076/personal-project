import { motion } from "framer-motion";
import { Shield, Menu, X, LogOut, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Dashboard", href: "#dashboard" },
  { label: "Architecture", href: "#architecture" },
  { label: "Documentation", href: "#docs" },
];

export const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 px-4 pt-4"
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="container max-w-screen-xl mx-auto">
        <div
          className={`flex items-center justify-between px-6 py-3 rounded-2xl border transition-all duration-500 ${scrolled
              ? "bg-black/80 backdrop-blur-xl border-white/8 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              : "bg-black/30 backdrop-blur-md border-white/[0.06]"
            }`}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/30 flex items-center justify-center group-hover:border-primary/60 transition-all duration-300 shadow-[0_0_12px_hsl(199_89%_48%/0.15)]">
              <Shield className="w-5 h-5 text-primary" />
              {/* Subtle pulse ring */}
              <span className="absolute inset-0 rounded-xl border border-primary/20 scale-110 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-black text-lg tracking-tight">
                <span className="text-gradient-cyber">Vajra</span>
                <span className="text-foreground">Scan</span>
              </span>
              <span className="text-[9px] font-mono text-primary/60 tracking-[0.15em] uppercase">VAPT Framework</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 rounded-lg hover:bg-white/5 group"
              >
                {link.label}
                <span className="absolute bottom-1 left-4 right-4 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-center" />
              </a>
            ))}
          </div>

          {/* CTA */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link to="/dashboard">
                  <Button
                    size="sm"
                    className="btn-cyber h-9 px-5 rounded-xl text-sm shadow-lg shadow-primary/20"
                  >
                    <Zap className="w-3.5 h-3.5 mr-1.5" />
                    Launch Console
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleSignOut}
                  className="h-9 w-9 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-xl"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="h-9 px-4 text-muted-foreground hover:text-foreground">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="btn-cyber h-9 px-5 rounded-xl shadow-lg shadow-primary/20">
                    Get Started →
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-white/5 transition-colors"
            onClick={() => setIsOpen(!isOpen)}
          >
            <motion.div animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </motion.div>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <motion.div
            className="md:hidden mt-2 p-5 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/10 shadow-2xl"
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-sm text-muted-foreground hover:text-primary transition-colors py-2.5 px-3 rounded-lg hover:bg-white/5"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-3 mt-2 border-t border-white/10 space-y-2">
                {user ? (
                  <>
                    <Link to="/dashboard" onClick={() => setIsOpen(false)}>
                      <Button className="w-full btn-cyber rounded-xl">
                        <Zap className="w-4 h-4 mr-2" /> Launch Console
                      </Button>
                    </Link>
                    <Button variant="ghost" onClick={handleSignOut} className="w-full text-red-400 hover:bg-red-500/10">
                      <LogOut className="w-4 h-4 mr-2" /> Sign Out
                    </Button>
                  </>
                ) : (
                  <Link to="/auth" onClick={() => setIsOpen(false)}>
                    <Button className="w-full btn-cyber rounded-xl">Get Started →</Button>
                  </Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
};

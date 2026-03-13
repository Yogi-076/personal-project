import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
// import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
// import { ThemeSupa } from "@supabase/auth-ui-shared";
// import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MatrixRain } from "@/components/MatrixRain";
import { SecurityHUD } from "@/components/SecurityHUD";
import { Eye, EyeOff, Lock, Shield, ShieldAlert, ShieldCheck, User as UserIcon, Mail, Laptop } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { validateEmail, validateUsername, sanitizeString } from "@/lib/validation";

const Auth = () => {
  const navigate = useNavigate();
  const { session, signIn, signUp, demoLogin } = useAuth();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, feedback: "" });

  const validatePassword = (pass: string) => {
    let score = 0;
    let feedback = "";

    if (pass.length === 0) return { score: 0, feedback: "" };
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score < 2) feedback = "Very Weak - Use 8+ chars and mixed types";
    else if (score < 3) feedback = "Weak - Needs more variety";
    else if (score < 4) feedback = "Moderate - Add symbols/numbers";
    else if (score < 5) feedback = "Strong - Good password";
    else feedback = "Very Strong - Excellent";

    return { score, feedback };
  };

  const onPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    if (!isLogin) {
      setPasswordStrength(validatePassword(val));
    }
  };

  useEffect(() => {
    if (session) {
      toast({
        title: "Access Granted",
        description: "Welcome back to the command center.",
        variant: "default",
        className: "border-green-500 text-green-500 bg-black"
      });
      navigate("/dashboard");
    }
  }, [session, navigate, toast]);

  // Mouse tilt effect for the card
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const card = cardRef.current;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate rotation (-10 to 10 degrees)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateX = ((y - centerY) / centerY) * -5; // Invert Y
    const rotateY = ((x - centerX) / centerX) * 5;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    }
  };

  return (
    <div className="container relative min-h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0 overflow-hidden bg-black">

      {/* LEFT PANEL: Video Hero */}
      <div className="relative hidden h-full flex-col p-10 text-white dark:border-r border-slate-800 lg:flex overflow-hidden">

        {/* Background Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0 opacity-60"
          style={{ filter: "hue-rotate(15deg) contrast(1.2)" }}
        >
          <source src="https://videos.pexels.com/video-files/3129671/3129671-uhd_2560_1440_30fps.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>

        {/* Deep Overlay for Readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-slate-900/80 to-slate-900/40 z-0 mix-blend-multiply" />
        <div className="absolute inset-0 bg-blue-900/20 z-0 mix-blend-overlay" />

        {/* Animated Cyber Grid Overlay */}
        <div
          className="absolute inset-0 opacity-30 z-0"
          style={{
            backgroundImage: "linear-gradient(#0ea5e9 1px, transparent 1px), linear-gradient(90deg, #0ea5e9 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            transform: "perspective(500px) rotateX(60deg) translateY(0) translateZ(-100px)",
            animation: "grid-flow 15s linear infinite"
          }}
        />

        {/* Content Container */}
        <div className="relative z-20 flex items-center text-xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 drop-shadow-lg">
          <div className="mr-3 h-10 w-10 flex items-center justify-center rounded-lg bg-black/40 border border-cyan-500/50 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-6 w-6 text-cyan-400 animate-pulse"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          VajraScan SaaS
        </div>

        {/* CENTER DECORATION: Security HUD */}
        <div className="relative z-20 flex-1 flex items-center justify-center w-full">
          <SecurityHUD />
        </div>

        <div className="relative z-20 mt-auto mb-10">
          <div className="group relative rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur-xl transition-all duration-500 hover:bg-black/60 hover:border-cyan-500/40 hover:shadow-[0_0_40px_rgba(6,182,212,0.15)] hover:-translate-y-1">
            <div className="absolute -left-1 top-6 h-12 w-1.5 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-r-full shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
            <blockquote className="space-y-4">
              <p className="text-lg leading-relaxed text-slate-200 font-light tracking-wide">
                "In an era of relentless cyber threats, <span className="text-cyan-400 font-semibold drop-shadow-sm">VajraScan</span> provides the automated intelligence we need to stay ahead of the curve."
              </p>
              <footer className="text-sm font-semibold flex items-center gap-4 pt-2">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-700 flex items-center justify-center text-xs text-white shadow-lg ring-2 ring-white/10">SD</div>
                <div>
                  <div className="text-white text-base">Sofia Davis</div>
                  <div className="text-xs text-cyan-400/80 font-mono tracking-wider">CISO • TECH CORP GLOBAL</div>
                </div>
              </footer>
            </blockquote>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Interaction Area */}
      <div className="relative lg:p-8 w-full h-full flex items-center justify-center bg-black/90">
        {/* Matrix Rain Background - Subtle */}
        <MatrixRain />

        <div
          className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px] relative z-10 p-4 perspective-1000"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Glass Login Card */}
          <motion.div
            ref={cardRef}
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="transition-transform duration-100 ease-out preserve-3d"
          >
            <Card className="border border-white/10 shadow-[0_0_80px_-20px_rgba(14,165,233,0.3)] bg-slate-950/40 backdrop-blur-3xl relative overflow-hidden group rounded-3xl">
              {/* Card Top Highlight */}
              <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40" />

              <CardHeader className="text-center space-y-3 pb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  className="mx-auto w-14 h-14 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-2 border border-blue-500/20 group-hover:border-blue-500/50 transition-colors shadow-inner"
                >
                  <Shield className="h-7 w-7 text-blue-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <CardTitle className="text-3xl font-black tracking-tighter text-white uppercase">
                    {isLogin ? "IDENTITY AUTH" : "CREATE OPERATOR"}
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-[10px] font-mono uppercase tracking-[0.2em] mt-2">
                    {isLogin ? "Access the secure mainframe" : "Register new security credentials"}
                  </CardDescription>
                </motion.div>
              </CardHeader>

              <CardContent className="pt-2">
                <div className="w-full space-y-6">
                  <div className="flex border-b border-white/5 mb-6">
                    <button
                      onClick={() => setIsLogin(true)}
                      className={cn(
                        "flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 relative",
                        isLogin ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                      )}
                    >
                      Login
                      {isLogin && <motion.div layoutId="auth-tab" className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                    </button>
                    <button
                      onClick={() => setIsLogin(false)}
                      className={cn(
                        "flex-1 pb-3 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 relative",
                        !isLogin ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'
                      )}
                    >
                      Sign Up
                      {!isLogin && <motion.div layoutId="auth-tab" className="absolute bottom-[-2px] left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />}
                    </button>
                  </div>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (!email || !password) return toast({ title: "Error", description: "Email and password are required", variant: "destructive" });

                    try {
                      const cleanEmail = sanitizeString(email, 100);
                      const cleanUsername = sanitizeString(username, 30);

                      if (!validateEmail(cleanEmail)) {
                        return toast({ title: "Invalid Email", description: "Please enter a valid email endpoint", variant: "destructive" });
                      }

                      if (isLogin) {
                        await signIn(cleanEmail, password);
                        toast({ title: "Success", description: "Logged in successfully" });
                        navigate("/dashboard");
                      } else {
                        if (username && !validateUsername(cleanUsername)) {
                          return toast({ title: "Invalid Alias", description: "Username must be 3-30 alphanumeric characters", variant: "destructive" });
                        }
                        if (passwordStrength.score < 3) {
                          return toast({ title: "Weak Security Key", description: "Please improve your password strength", variant: "destructive" });
                        }
                        await signUp(cleanEmail, password, cleanUsername || cleanEmail.split('@')[0]);
                        toast({ title: "Success", description: "Account created successfully" });
                        navigate("/dashboard");
                      }
                    } catch (err: any) {
                      toast({ title: "Authentication Failed", description: err.message || "An error occurred", variant: "destructive" });
                    }
                  }} className="space-y-4">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={isLogin ? 'login-fields' : 'signup-fields'}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="space-y-4"
                      >
                        {!isLogin && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">Operator Alias</label>
                            <div className="relative group/input">
                              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within/input:text-blue-500 transition-colors" />
                              <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Your unique handle"
                                className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all hover:bg-black/60"
                              />
                            </div>
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">Email Endpoint</label>
                          <div className="relative group/input">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within/input:text-blue-500 transition-colors" />
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="operator@mainframe.com"
                              className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all hover:bg-black/60"
                              autoComplete="email"
                              required
                            />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 px-1">Security Key</label>
                          <div className="relative group/pass">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-600 group-focus-within/pass:text-blue-500 transition-colors" />
                            <input
                              type={showPassword ? "text" : "password"}
                              value={password}
                              onChange={onPasswordChange}
                              placeholder="••••••••••••"
                              className="w-full bg-black/40 border border-white/5 rounded-xl pl-10 pr-12 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all hover:bg-black/60"
                              autoComplete={isLogin ? "current-password" : "new-password"}
                              required
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-blue-400 transition-colors focus:outline-none p-1 rounded-lg"
                            >
                              {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                          {!isLogin && password.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              className="mt-3 space-y-2 px-1"
                            >
                              <div className="flex justify-between items-center text-[9px] font-black tracking-[0.2em] mb-1">
                                <span className={cn(
                                  passwordStrength.score <= 2 ? "text-red-500" :
                                    passwordStrength.score <= 3 ? "text-amber-500" : "text-emerald-500"
                                )}>
                                  STRENGTH: {passwordStrength.feedback.toUpperCase()}
                                </span>
                                <span className="text-slate-500">{passwordStrength.score}/5</span>
                              </div>
                              <div className="flex gap-1.5 h-1">
                                {[1, 2, 3, 4, 5].map((level) => (
                                  <div
                                    key={level}
                                    className={cn(
                                      "h-full flex-1 rounded-full transition-all duration-700",
                                      level <= passwordStrength.score
                                        ? passwordStrength.score <= 2 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                                          passwordStrength.score <= 3 ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]" :
                                            "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                        : "bg-white/5"
                                    )}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <button
                        type="submit"
                        disabled={!isLogin && passwordStrength.score < 3}
                        className={cn(
                          "w-full h-11 font-black text-[11px] tracking-[0.2em] rounded-xl transition-all mt-4 flex items-center justify-center gap-2 shadow-2xl uppercase",
                          !isLogin && passwordStrength.score < 3
                            ? "bg-slate-900 text-slate-700 cursor-not-allowed border border-white/5"
                            : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20 active:bg-blue-700 border border-blue-400/20"
                        )}
                      >
                        {!isLogin && passwordStrength.score < 3 && <ShieldAlert size={16} />}
                        {isLogin ? "INITIALIZE UPLINK" : "DEPLOY OPERATOR"}
                      </button>
                    </motion.div>
                  </form>
                </div>
              </CardContent>

              {/* Card Footer Decoration */}
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </Card>
          </motion.div>

          <div className="text-center text-xs text-slate-500 font-mono">
            SECURE CONNECTION • 256-BIT ENCRYPTION • <span className="text-green-500">SYSTEM ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

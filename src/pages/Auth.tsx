import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Auth as SupabaseAuth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { MatrixRain } from "@/components/MatrixRain";
import { SecurityHUD } from "@/components/SecurityHUD";

const Auth = () => {
  const navigate = useNavigate();
  const { session, demoLogin } = useAuth();
  const { toast } = useToast();
  const cardRef = useRef<HTMLDivElement>(null);

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
          <div
            ref={cardRef}
            className="transition-transform duration-100 ease-out preserve-3d"
          >
            <Card className="border border-white/10 shadow-[0_0_50px_-12px_rgba(14,165,233,0.25)] bg-slate-950/60 backdrop-blur-xl relative overflow-hidden group">
              {/* Card Top Highlight */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50" />

              <CardHeader className="text-center space-y-2 pb-2">
                <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-2 border border-blue-500/20 group-hover:border-blue-500/50 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <CardTitle className="text-3xl font-bold tracking-tight text-white">
                  Welcome Back
                </CardTitle>
                <CardDescription className="text-slate-400 text-base">
                  Authenticate to access the <span className="text-blue-400">secure mainframe</span>.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <SupabaseAuth
                  supabaseClient={supabase}
                  appearance={{
                    theme: ThemeSupa,
                    variables: {
                      default: {
                        colors: {
                          brand: '#3b82f6', // bright blue
                          brandAccent: '#2563eb', // deeper blue
                          brandButtonText: 'white',
                          defaultButtonBackground: '#1e293b',
                          defaultButtonBackgroundHover: '#334155',
                          inputBackground: 'rgba(15, 23, 42, 0.6)',
                          inputBorder: '#334155',
                          inputText: '#e2e8f0',
                          inputPlaceholder: '#64748b',
                        },
                        fontSizes: {
                          baseBodySize: '14px',
                          baseInputSize: '15px',
                          baseLabelSize: '14px',
                          baseButtonSize: '15px',
                        },
                        space: {
                          buttonPadding: '12px 16px',
                          inputPadding: '12px 16px',
                        },
                        radii: {
                          borderRadiusButton: '8px',
                          buttonBorderRadius: '8px',
                          inputBorderRadius: '8px',
                        },
                      }
                    },
                    style: {
                      button: { borderColor: 'rgba(255,255,255,0.1)' },
                      input: { borderColor: 'rgba(255,255,255,0.1)' },
                    }
                  }}
                  theme="dark"
                  providers={[]}
                />

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-700" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-slate-950 px-2 text-slate-500">Security Override</span>
                  </div>
                </div>

                <button
                  onClick={async (e) => {
                    e.preventDefault(); // Prevent accidental form submission
                    console.log("Initiating Developer Override...");

                    toast({
                      title: "Bypassing protocols...",
                      description: "Initiating emergency developer access override.",
                      className: "bg-amber-950 text-amber-500 border-amber-900"
                    });

                    // Simulate processing delay
                    await new Promise(resolve => setTimeout(resolve, 800));

                    if (!session) {
                      console.log("No session found. Executing demoLogin()...");
                      await demoLogin();
                    } else {
                      console.log("Session already exists:", session.user.email);
                      navigate("/dashboard");
                    }
                  }}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs py-2 rounded border border-slate-700 transition-colors flex items-center justify-center gap-2 group cursor-pointer"
                  id="demo-login-btn"
                >
                  <span className="h-2 w-2 rounded-full bg-amber-500 group-hover:animate-ping" />
                  INITIATE_DEV_ACCESS_PROTOCOL
                </button>
              </CardContent>

              {/* Card Footer Decoration */}
              <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            </Card>
          </div>

          <div className="text-center text-xs text-slate-500 font-mono">
            SECURE CONNECTION • 256-BIT ENCRYPTION • <span className="text-green-500">SYSTEM ONLINE</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;

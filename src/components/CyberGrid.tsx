import { useEffect, useRef } from "react";

export const CyberGrid = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];

    // Cyberpunk Theme Colors
    const colors = [
      "rgba(139, 92, 246, 0.8)", // Violet
      "rgba(219, 39, 119, 0.8)", // Pink
      "rgba(6, 182, 212, 0.8)",  // Cyan (accent)
    ];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initParticles();
    };

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      baseSize: number;
      color: string;
      pulseRate: number;
      pulse: number;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.vx = (Math.random() - 0.5) * 0.3; // Slower, smoother movement
        this.vy = (Math.random() - 0.5) * 0.3;
        this.baseSize = Math.random() * 2 + 1;
        this.size = this.baseSize;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.pulseRate = 0.02 + Math.random() * 0.03;
        this.pulse = Math.random() * Math.PI * 2;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        // Bounce off edges
        if (this.x < 0 || this.x > canvas!.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas!.height) this.vy *= -1;

        // Pulse effect
        this.pulse += this.pulseRate;
        this.size = this.baseSize + Math.sin(this.pulse) * 0.5;
      }

      draw() {
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, Math.max(0, this.size), 0, Math.PI * 2);
        ctx.fillStyle = this.color;

        // Add glow to particle
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0; // Reset
      }
    }

    const initParticles = () => {
      particles = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 12000); // Slightly denser
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    let mouse = { x: 0, y: 0 };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const drawConnections = () => {
      if (!ctx) return;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(139, 92, 246, ${1 - distance / 150})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();

            // Triangulation: Check for a third particle to form a triangle
            for (let k = j + 1; k < particles.length; k++) {
              const dx2 = particles[j].x - particles[k].x;
              const dy2 = particles[j].y - particles[k].y;
              const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

              const dx3 = particles[i].x - particles[k].x;
              const dy3 = particles[i].y - particles[k].y;
              const distance3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);

              if (distance2 < 150 && distance3 < 150) {
                ctx.beginPath();
                ctx.fillStyle = `rgba(139, 92, 246, 0.03)`; // Very subtle fill
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.lineTo(particles[k].x, particles[k].y);
                ctx.closePath();
                ctx.fill();
              }
            }
          }
        }

        // Connect particles to mouse
        const dx = particles[i].x - mouse.x;
        const dy = particles[i].y - mouse.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 250) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(236, 72, 153, ${1 - distance / 250})`; // Pink connection for mouse
          ctx.lineWidth = 0.8;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    };

    const animate = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((particle) => {
        particle.update();
        particle.draw();
      });

      drawConnections();
      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", handleMouseMove);
    resizeCanvas();
    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
      {/* Canvas for Particle Network */}
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Overlay Gradients for Depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent opacity-50" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-900/20 via-transparent to-transparent opacity-40" />

      {/* Soft Grid Overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(hsl(var(--primary)) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
};

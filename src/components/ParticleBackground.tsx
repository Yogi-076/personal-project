import { useEffect, useRef } from 'react';

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    originalX: number;
    originalY: number;
}

export const ParticleBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Set canvas size
        const setCanvasSize = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = parent.clientHeight;
            } else {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
            }
        };
        setCanvasSize();
        window.addEventListener('resize', setCanvasSize);

        // Track mouse position
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };
        window.addEventListener('mousemove', handleMouseMove);

        // Particle settings - Professional & Cyber 
        const particleCount = 80; // Increased count
        const particles: Particle[] = [];
        const connectionDistance = 140;
        const mouseDistance = 180; // Interaction radius

        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            particles.push({
                x,
                y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 1.5 + 1.0,
                originalX: x,
                originalY: y,
            });
        }

        // Animation loop
        let animationFrameId: number;
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Update and draw particles
            particles.forEach((particle, i) => {
                // Base movement
                particle.x += particle.vx;
                particle.y += particle.vy;

                // Mouse interaction - subtle repulsion/attraction
                const dx = mouseRef.current.x - particle.x;
                const dy = mouseRef.current.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < mouseDistance) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouseDistance - distance) / mouseDistance;
                    const directionMultiplier = -0.5; // Repel

                    particle.vx += forceDirectionX * force * directionMultiplier * 0.05;
                    particle.vy += forceDirectionY * force * directionMultiplier * 0.05;
                }

                // Bounce off edges with damping
                if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
                if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

                // Speed limit
                const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
                const maxSpeed = 1.0;
                if (speed > maxSpeed) {
                    particle.vx = (particle.vx / speed) * maxSpeed;
                    particle.vy = (particle.vy / speed) * maxSpeed;
                }

                // Keep particles in bounds
                particle.x = Math.max(0, Math.min(canvas.width, particle.x));
                particle.y = Math.max(0, Math.min(canvas.height, particle.y));

                // Draw particle
                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
                ctx.fillStyle = 'hsl(199 89% 48% / 0.6)'; // Primary Blue
                ctx.fill();

                // Draw connections
                for (let j = i + 1; j < particles.length; j++) {
                    const dx2 = particles[j].x - particle.x;
                    const dy2 = particles[j].y - particle.y;
                    const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

                    if (dist2 < connectionDistance) {
                        ctx.beginPath();
                        ctx.moveTo(particle.x, particle.y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        const opacity = (1 - dist2 / connectionDistance) * 0.15;
                        ctx.strokeStyle = `hsl(199 89% 48% / ${opacity})`;
                        ctx.lineWidth = 1;
                        ctx.stroke();
                    }
                }

                // Connect to mouse if close
                if (distance < mouseDistance) {
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(mouseRef.current.x, mouseRef.current.y);
                    const opacity = (1 - distance / mouseDistance) * 0.2;
                    ctx.strokeStyle = `hsl(199 89% 48% / ${opacity})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            });

            animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        return () => {
            window.removeEventListener('resize', setCanvasSize);
            window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 pointer-events-none"
            style={{ zIndex: 0 }}
        />
    );
};

import { useEffect, useRef } from 'react';

export const MatrixRain = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

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

        // Matrix settings
        const fontSize = 14;
        const columns = Math.ceil(canvas.width / fontSize);
        const drops: number[] = new Array(columns).fill(1);

        // "Binary" + "Hex" characters for that hacker look
        const chars = '0101010101XYZ01010198012345';

        let animationFrameId: number;

        const draw = () => {
            // Semi-transparent black background to create trail effect
            ctx.fillStyle = 'rgba(10, 10, 15, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = '#0ea5e9'; // Tailwind 'sky-500' / Brand Blue
            ctx.font = `${fontSize}px 'Fira Code', monospace`;

            for (let i = 0; i < drops.length; i++) {
                // Random character
                const text = chars.charAt(Math.floor(Math.random() * chars.length));

                // x = column index * font size
                // y = drop value * font size
                const x = i * fontSize;
                const y = drops[i] * fontSize;

                // Randomly brighter characters for "glint" effect
                if (Math.random() > 0.98) {
                    ctx.fillStyle = '#7dd3fc'; // sky-300 (brighter)
                    ctx.fillText(text, x, y);
                    ctx.fillStyle = '#0ea5e9'; // reset
                } else {
                    ctx.fillText(text, x, y);
                }

                // Reset drop to top randomly
                if (y > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }

                drops[i]++;
            }
            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            window.removeEventListener('resize', setCanvasSize);
            cancelAnimationFrame(animationFrameId);
        };
    }, []);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 opacity-20"
        />
    );
};

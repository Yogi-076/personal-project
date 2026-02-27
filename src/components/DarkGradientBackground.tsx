import { CyberGrid } from "./CyberGrid";

export const DarkGradientBackground = () => {
    return (
        <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
            {/* Professional Dark Navy Gradient */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(135deg, hsl(222 47% 5%) 0%, hsl(220 42% 11%) 50%, hsl(217 33% 8%) 100%)',
                }}
            />

            {/* Subtle overlay for depth */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'radial-gradient(ellipse at top, hsl(199 89% 48% / 0.05) 0%, transparent 50%)',
                }}
            />
        </div>
    );
};

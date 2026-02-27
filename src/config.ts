
// Centralized Configuration for VAPT Framework
// This allows switching between Localhost and Production (vajrascan.online) easily.

export const Config = {
    // Uses VITE_API_URL env var if set, otherwise defaults to localhost.
    API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3001',

    // Chatbot URL: Defaults to direct local port for stability. Override for Prod.
    // Use localhost as per original configuration, ensuring trailing slash for asset loading
    CHATBOT_URL: import.meta.env.VITE_CHATBOT_URL || 'http://localhost:18789/__moltbot__/a2ui/',

    // Feature Flags
    ENABLE_MOCK_DATA: import.meta.env.VITE_ENABLE_MOCK === 'true',

    // Deployment
    DOMAIN: 'vajrascan.online',
};

export default Config;

const { GoogleGenerativeAI } = require("@google/generative-ai");
const storage = require('../utils/storage');
const wapitiService = require('../services/wapitiService');
const zapService = require('../services/zapService');

class AIService {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (!this.apiKey) {
            console.error('[AIService] GEMINI_API_KEY is missing!');
        }

        // Initialize Gemini if key exists
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            // Use gemini-flash-latest which is confirmed working for this key
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            this.modelName = "gemini-1.5-flash"; // Default
            this.modelsToTry = ["gemini-2.0-flash", "gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-flash-latest", "gemini-flash-latest", "gemini-1.5-pro", "gemini-pro"];
        }

        this.chatSessions = new Map();
    }

    async processMessage(sessionId, message, context = {}) {
        try {
            if (!this.apiKey) {
                return this.mockResponse("⚠️ System Error: Gemini API Key is missing. Please configure GEMINI_API_KEY in the .env file.");
            }

            // Get or create chat session
            // Get or create chat session
            let chat = this.chatSessions.get(sessionId);
            if (!chat) {
                // Try initializing with fallback models
                for (const modelName of this.modelsToTry) {
                    try {
                        const model = this.genAI.getGenerativeModel({
                            model: modelName,
                            systemInstruction: "You are Pluto, an advanced AI Security Analyst for the VAPT Framework..."
                        });

                        // Validating model by checking basic chat start (API doesn't validate until first call usually)
                        // But let's assume if startChat works, we are good? No, checking logic inside loop

                        chat = model.startChat({
                            history: [
                                { role: "user", parts: [{ text: "System: Initialize Security Analyst Persona." }] },
                                { role: "model", parts: [{ text: "Pluto AI Online. Ready to assist." }] },
                            ],
                        });

                        this.chatSessions.set(sessionId, chat);
                        this.modelName = modelName;
                        console.log(`[AIService] Successfully initialized with model: ${modelName}`);
                        break; // Success
                    } catch (e) {
                        console.warn(`[AIService] Failed to init model ${modelName}: ${e.message}`);
                    }
                }

                if (!chat) return this.mockResponse("⚠️ Failed to initialize AI session with any available Gemini model.");
            }

            // Construct Contextual Prompt
            let systemContext = "";
            let recentScans = [];
            try {
                recentScans = await storage.getAllScans();
                if (recentScans && Array.isArray(recentScans)) {
                    recentScans = recentScans.slice(0, 3);
                } else {
                    recentScans = [];
                }
            } catch (e) {
                console.warn('[AIService] Failed to retrieve scan context:', e.message);
                recentScans = [];
            }

            if (recentScans.length > 0) {
                systemContext += "\n[Current System State]: \n";
                recentScans.forEach(scan => {
                    systemContext += `- Scan ${scan.id ? scan.id.substring(0, 6) : 'Unknown'} (${scan.type}) on ${scan.target}: Status=${scan.status}, Findings=${scan.findings?.length || 0}\n`;
                });
            }

            const fullPrompt = message + (systemContext ? `\n\n${systemContext}` : "");

            console.log(`[AIService] Sending message to Gemini (Session: ${sessionId})`);

            // Try sending message
            const result = await chat.sendMessage(fullPrompt);
            const response = await result.response;
            return { text: response.text() };

        } catch (error) {
            console.error('[AIService] Gemini Error:', error.message);
            // Fallback to Mock Response explicitly on any error (404, 403, 500)
            return this.mockResponse(null, message);
        }
    }

    // Mock/Rule-based responses for offline mode
    mockResponse(errorMsg, userMessage) {
        if (errorMsg) return { text: errorMsg };

        const msg = (userMessage || "").toLowerCase();

        // Simple heuristic responses
        if (msg.includes('hello') || msg.includes('hi')) {
            return { text: "**Pluto (Offline Mode):**\nHello! I am currently running in offline resiliency mode because the Gemini API is unreachable (Error 404/403). \n\nI can still help you:\n- **Start a scan** (Type: 'scan example.com')\n- **Check status** (Type: 'status')" };
        }
        if (msg.includes('scan')) {
            return { text: "**Pluto (Offline Mode):**\nTo start a scan, please use the Dashboard 'New Scan' button, or ensure your API Key is valid to enable voice commands." };
        }
        if (msg.includes('status')) {
            return { text: "**Pluto (Offline Mode):**\nI cannot perform live checks offline, but you can view the Scan History panel on the left." };
        }

        return { text: "**Pluto (Offline Mode):**\nI received your message: _\"" + userMessage + "\"_\n\nHowever, I cannot process complex queries without the Gemini API connection. Please check your API Key configuration." };
    }

    // Function to clear history if needed
    clearSession(sessionId) {
        this.chatSessions.delete(sessionId);
    }
}

module.exports = new AIService();

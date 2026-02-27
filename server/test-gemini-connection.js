const { GoogleGenerativeAI } = require("@google/generative-ai");

async function testGemini() {
    const apiKey = "AIzaSyBPTeXSoUpvHRXf78G0AHl0PHv45zONc_0"; // Key from start-pluto.bat
    const modelName = "gemini-flash-latest"; // Model from aiService.js

    console.log("Testing Gemini Connection...");
    console.log(`Key: ${apiKey.substring(0, 10)}...`);
    console.log(`Model: ${modelName}`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        console.log("Sending prompt: 'Hello'...");
        const result = await model.generateContent("Hello");
        const response = await result.response;
        const text = response.text();

        console.log("SUCCESS! Response received:");
        console.log(text);
    } catch (error) {
        console.error("FAILED!");
        console.error("Error Name:", error.name);
        console.error("Error Message:", error.message);
        if (error.response) {
            console.error("Error Status:", error.response.status);
            console.error("Error Status Text:", error.response.statusText);
        }

        // Suggest fix if model is wrong
        console.log("\n--- Troubleshooting ---");
        if (error.message.includes("404") || error.message.includes("not found")) {
            console.log("POSSIBLE CAUSE: Invalid Model Name. Trying 'gemini-1.5-flash'...");
            await testModel(apiKey, "gemini-1.5-flash");
        }
    }
}

async function testModel(apiKey, modelName) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent("Hello via " + modelName);
        console.log(`SUCCESS with ${modelName}!`);
    } catch (e) {
        console.error(`FAILED with ${modelName}:`, e.message);
    }
}

testGemini();

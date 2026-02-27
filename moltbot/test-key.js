const apiKey = "AIzaSyBPTeXSoUpvHRXf78G0AHl0PHv45zONc_0";
// Note: API expects "models/gemini-2.0-flash" or just "gemini-2.0-flash" depending on endpoint.
// For v1beta/models/...:generateContent it usually takes the ID.
const modelId = "gemini-flash-latest";
const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

const payload = {
    contents: [{
        parts: [{ text: "Hello, are you working?" }]
    }]
};

console.log(`Testing Generation with ${modelId}...`);

fetch(url, {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
})
    .then(async response => {
        console.log("Status:", response.status);
        const data = await response.json();
        if (!response.ok) {
            console.error("Error:", JSON.stringify(data, null, 2));
        } else {
            console.log("Success! Response:", JSON.stringify(data, null, 2));
        }
    })
    .catch(error => {
        console.error("Network Error:", error);
    });

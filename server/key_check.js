const key = "AIzaSyBPTeXSoUpvHRXf78G0AHl0PHv45zONc_0";
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${key}`;

console.log(`Testing Generation with gemini-flash-latest...`);

async function test() {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Hello AI" }] }]
            })
        });
        const data = await response.json();

        if (response.ok) {
            console.log("✅ Generation Successful!");
            console.log("Response:", data.candidates?.[0]?.content?.parts?.[0]?.text);
        } else {
            console.log("❌ Generation Failed!");
            console.log("Status:", response.status);
            console.log("Error:", JSON.stringify(data, null, 2));
        }
    } catch (e) {
        console.error("Network Error:", e.message);
    }
}

test();

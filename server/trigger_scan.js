// Native fetch in Node 22

// Check if fetch is available (Node 18+), otherwise fallback or user http module.
// Using native fetch for Node 22 (confirmed in logs previously)

async function run() {
    try {
        console.log('Sending start request...');
        const res = await fetch('http://localhost:3001/api/scan/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target: 'http://testphp.vulnweb.com' })
        });

        console.log('Status:', res.status);
        if (res.ok) {
            const data = await res.json();
            console.log('Scan started:', data);
        } else {
            console.log('Error:', await res.text());
        }
    } catch (e) {
        console.error('Request failed:', e);
    }
}

run();

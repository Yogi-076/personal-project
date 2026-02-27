const https = require('https');

const apiKey = 'AIzaSyBPTeXSoUpvHRXf78G0AHl0PHv45zONc_0';
const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

https.get(url, (res) => {
    console.log(`Status: ${res.statusCode}`);
    if (res.statusCode !== 200) {
        console.log('FAIL');
        process.exit(1);
    }

    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const models = json.models || [];
            console.log(`Success. Found ${models.length} models.`);
            const flash = models.find(m => m.name.includes('flash'));
            if (flash) console.log(`Flash model found: ${flash.name}`);
        } catch (e) {
            console.log('Invalid JSON response');
        }
    });
}).on('error', (e) => {
    console.log(`Error: ${e.message}`);
    process.exit(1);
});

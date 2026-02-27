const express = require('express');
const app = express();
const port = 3333;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('<h1>Vulnerable App</h1><a href="/login?next=/dashboard">Login</a><a href="/search?q=test">Search</a>');
});

// Reflected XSS
app.get('/search', (req, res) => {
    const q = req.query.q || '';
    res.send(`<h1>Results for ${q}</h1>`); // Vulnerable!
});

// SQLi
app.get('/api/user', (req, res) => {
    const id = req.query.id;
    if (id && id.includes("'")) {
        res.status(500).send("SQL syntax error near '''"); // Simulated SQL error
    } else {
        res.json({ id: 1, name: "Admin" });
    }
});

// IDOR/Auth Bypass
app.get('/api/profile/:id', (req, res) => {
    // No auth check!
    res.json({ id: req.params.id, secret: "SuperSecretData" });
});

app.listen(port, () => {
    console.log(`Vulnerable server running at http://localhost:${port}`);
});

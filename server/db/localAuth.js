const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');

const dbPath = path.join(__dirname, 'vapt_auth.sqlite');

// Create the database if it doesn't exist
const db = new sqlite3.Database(dbPath);

// Initialize tables
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            org_name TEXT,
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

const JWT_SECRET = process.env.JWT_SECRET || 'vapt-default-secret-key-change-in-production';
const SALT_ROUNDS = 10;

const localAuth = {
    // Basic UUID generator
    generateUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    registerUser: async (email, password, userData) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Password strength validation (safeguard)
                let score = 0;
                if (password.length >= 8) score++;
                if (/[A-Z]/.test(password)) score++;
                if (/[a-z]/.test(password)) score++;
                if (/[0-9]/.test(password)) score++;
                if (/[^A-Za-z0-9]/.test(password)) score++;

                if (score < 3) {
                    return reject(new Error('Password does not meet security requirements.'));
                }

                // Check if user exists
                db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
                    if (err) return reject(err);
                    if (row) return reject(new Error('User with this email already exists'));

                    // Hash password
                    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
                    const id = localAuth.generateUUID();

                    const stmt = db.prepare(`
                        INSERT INTO users (id, email, password_hash, username, first_name, last_name, org_name, role)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `);

                    stmt.run(
                        id,
                        email,
                        passwordHash,
                        userData.username || email.split('@')[0],
                        userData.firstName || '',
                        userData.lastName || '',
                        userData.orgName || '',
                        userData.role || 'user',
                        function (err) {
                            if (err) return reject(err);

                            const user = {
                                id,
                                email,
                                username: userData.username || email.split('@')[0],
                                role: userData.role || 'user'
                            };

                            const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
                            resolve({ user, token });
                        }
                    );
                    stmt.finalize();
                });
            } catch (err) {
                reject(err);
            }
        });
    },

    loginUser: async (email, password) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
                if (err) return reject(err);
                if (!user) return reject(new Error('Invalid email or password'));

                const isValid = await bcrypt.compare(password, user.password_hash);
                if (!isValid) return reject(new Error('Invalid email or password'));

                const userData = {
                    id: user.id,
                    email: user.email,
                    username: user.username,
                    role: user.role
                };

                const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
                resolve({ user: userData, token });
            });
        });
    },

    verifyToken: (token) => {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (err) {
            return null;
        }
    },

    getUserById: (id) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT id, email, username, role FROM users WHERE id = ?`, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
    }
};

module.exports = localAuth;

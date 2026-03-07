/**
 * Auth Routes — Supabase auth endpoints + Gray-Box auth testing helpers.
 * Mounted at root in index.js.
 */
'use strict';

const express = require('express');
const router = express.Router();
// const supabase = require('../utils/supabaseClient'); // Bypassed
const authBridge = require('../services/authBridge');
const { requireModule } = require('../middleware/saasMiddleware');
const localAuth = require('../db/localAuth');

// ── Register ─────────────────────────────────────────────────────────────────
router.post('/auth/register', async (req, res) => {
    console.log('[Auth] Register attempt:', req.body?.email);
    try {
        let { email, password, username, firstName, lastName, orgName } = req.body || {};
        username = username || orgName;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        // Password strength validation
        let score = 0;
        if (password.length >= 8) score++;
        if (/[A-Z]/.test(password)) score++;
        if (/[a-z]/.test(password)) score++;
        if (/[0-9]/.test(password)) score++;
        if (/[^A-Za-z0-9]/.test(password)) score++;

        if (score < 3) {
            return res.status(400).json({
                error: 'Weak password: Must be at least 8 characters long and include a mix of uppercase, lowercase, numbers, and special characters.'
            });
        }


        const { user, token } = await localAuth.registerUser(email, password, { username, firstName, lastName, orgName });

        res.json({
            message: 'Registration successful.',
            user,
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message || 'Registration failed' });
    }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
    console.log('[Auth] Login attempt:', req.body?.email);
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const { user, token } = await localAuth.loginUser(email, password);

        res.json({
            token,
            user
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message || 'Login failed' });
    }
});

// ── Current User ──────────────────────────────────────────────────────────────
router.get('/auth/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = localAuth.verifyToken(token);
        if (!decoded) {
            return res.status(401).json({ error: 'Invalid token' });
        }

        const user = await localAuth.getUserById(decoded.id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        res.json(user);

    } catch (error) {
        console.error('Auth check error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ── Gray-Box: Test Login Credentials ─────────────────────────────────────────
router.post('/api/auth/test-login', requireModule('dast_core'), async (req, res) => {
    try {
        const { loginUrl, username, password, selectors } = req.body || {};

        if (!loginUrl || !username || !password) {
            return res.status(400).json({ error: 'Login URL, username, and password are required' });
        }

        console.log(`[Auth Test] Testing login for ${loginUrl}`);

        const result = await authBridge.getAuthHeaders(
            loginUrl, username, password,
            selectors || {},
            { headless: false, timeout: 30000 }
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'Login successful',
                cookieCount: result.fullCookies.length,
                hasJWT: !!result.jwtHeader,
                finalUrl: result.finalUrl
            });
        } else {
            res.status(401).json({ success: false, error: result.error });
        }

    } catch (error) {
        console.error('[Auth Test] Error:', error);
        res.status(500).json({ error: 'Login test failed', details: error.message });
    }
});

// ── Gray-Box: Validate CSS Selectors ─────────────────────────────────────────
router.post('/api/auth/validate-selectors', requireModule('dast_core'), async (req, res) => {
    try {
        const { loginUrl, selectors } = req.body || {};

        if (!loginUrl || !selectors) {
            return res.status(400).json({ error: 'Login URL and selectors are required' });
        }

        const result = await authBridge.validateSelectors(loginUrl, selectors);
        res.json(result);

    } catch (error) {
        console.error('[Selector Validation] Error:', error);
        res.status(500).json({ error: 'Selector validation failed', details: error.message });
    }
});

module.exports = router;

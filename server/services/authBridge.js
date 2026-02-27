// server/services/authBridge.js
const { chromium } = require('playwright');

/**
 * VajraScan Auth-Bridge Service
 * Performs browser-based login automation and returns session headers
 * Supports: Cookies, JWT tokens, LocalStorage, SessionStorage
 */

class AuthBridge {
    constructor() {
        this.browser = null;
        this.context = null;
    }

    /**
     * Main entry point: Performs login and returns session data
     */
    async getAuthHeaders(loginUrl, username, password, selectors = {}, options = {}) {
        console.log(`[AuthBridge] 🚀 Initiating Login on: ${loginUrl}`);

        const headless = options.headless !== false;
        const timeout = options.timeout || 30000;

        try {
            this.browser = await chromium.launch({
                headless,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });

            this.context = await this.browser.newContext({
                ignoreHTTPSErrors: true,
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            });

            const page = await this.context.newPage();

            // Navigate to login page
            await page.goto(loginUrl, {
                waitUntil: 'networkidle',
                timeout
            });

            console.log(`[AuthBridge] Page loaded: ${page.url()}`);
            const preLoginUrl = page.url();

            // --- FIND FIELDS ---
            const userField = await this._findField(page, 'username', selectors.user);
            const passField = await this._findField(page, 'password', selectors.pass);
            const submitBtn = await this._findButton(page, selectors.btn);

            if (!userField) throw new Error('Could not find username/email input field. Try providing custom CSS selectors.');
            if (!passField) throw new Error('Could not find password input field. Try providing custom CSS selectors.');
            if (!submitBtn) throw new Error('Could not find submit/login button. Try providing custom CSS selectors.');

            // --- PERFORM LOGIN ---
            console.log('[AuthBridge] Filling credentials...');

            // Clear fields first, then type (more reliable than fill for SPAs)
            await userField.click();
            await userField.fill('');
            await userField.type(username, { delay: 50 });

            await passField.click();
            await passField.fill('');
            await passField.type(password, { delay: 50 });

            // Small delay to let JS validation run
            await page.waitForTimeout(500);

            // Click submit and wait for network activity
            console.log('[AuthBridge] Submitting login form...');

            // Use Promise.race — some logins don't navigate, they just do XHR
            await Promise.race([
                Promise.all([
                    page.waitForNavigation({ timeout: 15000 }).catch(() => null),
                    submitBtn.click()
                ]),
                page.waitForTimeout(15000)
            ]);

            // Wait for any post-login redirects, XHR, or JS execution
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => { });
            await page.waitForTimeout(3000);

            // --- EXTRACT SESSION DATA ---
            console.log('[AuthBridge] Extracting session data...');

            const cookies = await this.context.cookies();
            const localStorageStr = await page.evaluate(() => {
                try { return JSON.stringify(window.localStorage); } catch { return '{}'; }
            });
            const sessionStorageStr = await page.evaluate(() => {
                try { return JSON.stringify(window.sessionStorage); } catch { return '{}'; }
            });

            // Format cookies
            const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');

            // Extract JWT from multiple sources
            let jwt = null;
            const localData = JSON.parse(localStorageStr || '{}');
            const sessionData = JSON.parse(sessionStorageStr || '{}');

            // Check localStorage
            jwt = localData.token || localData.access_token || localData.authToken || localData.jwt
                || localData.auth_token || localData.id_token;

            // Check sessionStorage
            if (!jwt) {
                jwt = sessionData.token || sessionData.access_token || sessionData.authToken
                    || sessionData.auth_token || sessionData.id_token;
            }

            // Check cookies for JWT-like values
            if (!jwt) {
                const jwtCookie = cookies.find(c =>
                    ['token', 'access_token', 'auth_token', 'jwt', 'session_token'].includes(c.name) ||
                    (c.value && c.value.startsWith('eyJ'))
                );
                if (jwtCookie) jwt = jwtCookie.value;
            }

            // --- CHECK LOGIN SUCCESS ---
            const postLoginUrl = page.url();
            const urlChanged = postLoginUrl !== preLoginUrl;
            const hasCookies = cookies.length > 0;
            const hasJwt = !!jwt;
            const hasSessionData = Object.keys(localData).length > 0 || Object.keys(sessionData).length > 0;

            console.log(`[AuthBridge] Post-login state: url_changed=${urlChanged}, cookies=${cookies.length}, jwt=${hasJwt}, storage_entries=${Object.keys(localData).length + Object.keys(sessionData).length}`);

            // Login is successful if ANY session indicator exists
            const loginSuccess = hasCookies || hasJwt || urlChanged || hasSessionData;

            if (!loginSuccess) {
                // Check for error messages on page
                const errorText = await page.evaluate(() => {
                    const errorEls = document.querySelectorAll('.error, .alert-danger, .error-message, [role="alert"], .invalid-feedback');
                    return Array.from(errorEls).map(el => el.textContent.trim()).filter(t => t).join('; ');
                }).catch(() => '');

                const errMsg = errorText
                    ? `Login failed: ${errorText}`
                    : 'Login failed: No session data obtained. The page may require custom CSS selectors.';
                throw new Error(errMsg);
            }

            await this.cleanup();

            const result = {
                success: true,
                cookieHeader: cookieString ? `Cookie: ${cookieString}` : '',
                jwtHeader: jwt ? `Authorization: Bearer ${jwt}` : null,
                fullCookies: cookies,
                localStorage: localData,
                sessionStorage: sessionData,
                finalUrl: postLoginUrl,
                timestamp: new Date().toISOString()
            };

            console.log(`[AuthBridge] ✅ Login successful! ${cookies.length} cookies` + (jwt ? ' + JWT' : ''));
            return result;

        } catch (error) {
            console.error(`[AuthBridge] ❌ Error: ${error.message}`);
            await this.cleanup();
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Find a form field using custom selector or smart detection
     */
    async _findField(page, type, customSelector) {
        // If custom selector provided, use it directly
        if (customSelector) {
            const el = page.locator(customSelector).first();
            if (await el.isVisible().catch(() => false)) return el;
        }

        if (type === 'password') {
            // Password fields are straightforward
            const selectors = [
                'input[type="password"]',
                'input[name*="pass" i]',
                'input[id*="pass" i]',
                'input[placeholder*="password" i]',
                'input[aria-label*="password" i]'
            ];
            for (const sel of selectors) {
                const el = page.locator(sel).first();
                if (await el.isVisible().catch(() => false)) {
                    console.log(`[AuthBridge] Found password field: ${sel}`);
                    return el;
                }
            }
        } else {
            // Username/email fields
            const selectors = [
                'input[type="email"]',
                'input[name="email"]',
                'input[name="username"]',
                'input[id="email"]',
                'input[id="username"]',
                'input[name*="email" i]',
                'input[name*="user" i]',
                'input[id*="email" i]',
                'input[id*="user" i]',
                'input[placeholder*="email" i]',
                'input[placeholder*="user" i]',
                'input[aria-label*="email" i]',
                'input[aria-label*="user" i]',
                'input[type="text"]' // Last resort: first text input
            ];
            for (const sel of selectors) {
                const el = page.locator(sel).first();
                if (await el.isVisible().catch(() => false)) {
                    console.log(`[AuthBridge] Found username field: ${sel}`);
                    return el;
                }
            }
        }

        return null;
    }

    /**
     * Find the submit/login button
     */
    async _findButton(page, customSelector) {
        if (customSelector) {
            const el = page.locator(customSelector).first();
            if (await el.isVisible().catch(() => false)) return el;
        }

        const selectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Log in")',
            'button:has-text("Login")',
            'button:has-text("Sign in")',
            'button:has-text("Sign In")',
            'button:has-text("Submit")',
            'button:has-text("Continue")',
            '[role="button"]:has-text("Log in")',
            '[role="button"]:has-text("Login")',
            '[role="button"]:has-text("Sign in")',
            'a:has-text("Log in")',
            'a:has-text("Login")',
            'a:has-text("Sign in")',
            'form button', // Any button inside a form
        ];

        for (const sel of selectors) {
            try {
                const el = page.locator(sel).first();
                if (await el.isVisible().catch(() => false)) {
                    console.log(`[AuthBridge] Found submit button: ${sel}`);
                    return el;
                }
            } catch (e) {
                // Skip invalid selectors
            }
        }

        return null;
    }

    /**
     * Test login with provided selectors (validation endpoint)
     */
    async validateSelectors(loginUrl, selectors) {
        try {
            this.browser = await chromium.launch({ headless: true });
            this.context = await this.browser.newContext({ ignoreHTTPSErrors: true });
            const page = await this.context.newPage();

            await page.goto(loginUrl, { waitUntil: 'networkidle', timeout: 15000 });

            const results = {
                user: await page.locator(selectors.user).first().isVisible().catch(() => false),
                pass: await page.locator(selectors.pass).first().isVisible().catch(() => false),
                btn: await page.locator(selectors.btn).first().isVisible().catch(() => false)
            };

            await this.cleanup();

            return {
                success: true,
                valid: results.user && results.pass && results.btn,
                details: results
            };

        } catch (error) {
            await this.cleanup();
            return { success: false, error: error.message };
        }
    }

    /**
     * Cleanup browser resources
     */
    async cleanup() {
        try {
            if (this.context) await this.context.close();
            if (this.browser) await this.browser.close();
        } catch (e) {
            console.error('[AuthBridge] Cleanup error:', e.message);
        }
        this.context = null;
        this.browser = null;
    }
}

module.exports = new AuthBridge();

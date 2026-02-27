/**
 * wafBypass.js — WAF Evasion Utility for VajraScan
 * 
 * Provides User-Agent rotation, header randomization, request jitter,
 * payload encoding, and WAF detection to evade Cloudflare, AWS WAF,
 * Akamai, ModSecurity, etc.
 */

// ── Real Browser User-Agent Pool ──
const USER_AGENTS = [
    // Chrome (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    // Chrome (Mac)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
    // Chrome (Linux)
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    // Firefox (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
    // Firefox (Mac)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Firefox (Linux)
    'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0',
    // Safari (Mac)
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
    // Edge (Windows)
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
    // Mobile Chrome
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    // Mobile Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
];

// ── Accept Header Variants ──
const ACCEPT_VARIANTS = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'text/html, application/xhtml+xml, application/xml;q=0.9, image/webp, */*;q=0.8',
    '*/*',
];

// ── Accept-Language Variants ──
const LANG_VARIANTS = [
    'en-US,en;q=0.9',
    'en-US,en;q=0.5',
    'en-GB,en-US;q=0.9,en;q=0.8',
    'en-US,en;q=0.9,fr;q=0.8',
    'en,en-US;q=0.9',
    'en-US,en;q=0.8,de;q=0.5',
];

// ── Accept-Encoding Variants ──
const ENCODING_VARIANTS = [
    'gzip, deflate, br',
    'gzip, deflate, br, zstd',
    'gzip, deflate',
    'br, gzip, deflate',
];

// ── WAF Detection Signatures ──
const WAF_SIGNATURES = {
    cloudflare: {
        headers: ['cf-ray', 'cf-cache-status', 'cf-request-id'],
        bodyPatterns: ['cloudflare', 'cf-browser-verification', 'ray id', 'attention required'],
    },
    akamai: {
        headers: ['x-akamai-transformed', 'akamai-grn'],
        bodyPatterns: ['akamai', 'access denied', 'reference #'],
    },
    awsWaf: {
        headers: ['x-amzn-requestid', 'x-amz-cf-id'],
        bodyPatterns: ['aws', 'request blocked', 'waf'],
    },
    modSecurity: {
        headers: [],
        bodyPatterns: ['modsecurity', 'mod_security', 'not acceptable', 'security rule'],
    },
    imperva: {
        headers: ['x-iinfo'],
        bodyPatterns: ['incapsula', 'imperva', 'incident id'],
    },
    f5BigIP: {
        headers: ['x-cnection', 'bigipserver'],
        bodyPatterns: ['the requested url was rejected', 'please consult with your administrator'],
    }
};

class WafBypass {
    constructor() {
        this._lastRequestTime = 0;
        this._detectedWaf = null;
        this._requestCount = 0;
        this._blockedCount = 0;
    }

    // ═══════════════════════════════════════════
    // User-Agent Rotation
    // ═══════════════════════════════════════════

    /**
     * Get a random real-browser User-Agent string
     */
    getRandomUA() {
        return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
    }

    // ═══════════════════════════════════════════
    // Full Header Randomization
    // ═══════════════════════════════════════════

    /**
     * Generate a complete set of realistic browser headers
     * @param {string} [targetUrl] - Target URL for Referer/Origin generation
     * @returns {Object} Complete header set mimicking a real browser
     */
    getRandomHeaders(targetUrl) {
        const ua = this.getRandomUA();
        const isChrome = ua.includes('Chrome') && !ua.includes('Edg');
        const isFirefox = ua.includes('Firefox');

        const headers = {
            'User-Agent': ua,
            'Accept': ACCEPT_VARIANTS[Math.floor(Math.random() * ACCEPT_VARIANTS.length)],
            'Accept-Language': LANG_VARIANTS[Math.floor(Math.random() * LANG_VARIANTS.length)],
            'Accept-Encoding': ENCODING_VARIANTS[Math.floor(Math.random() * ENCODING_VARIANTS.length)],
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        };

        // Add Chrome-specific client hints
        if (isChrome) {
            const majorVersion = ua.match(/Chrome\/(\d+)/)?.[1] || '120';
            headers['Sec-CH-UA'] = `"Not_A Brand";v="8", "Chromium";v="${majorVersion}", "Google Chrome";v="${majorVersion}"`;
            headers['Sec-CH-UA-Mobile'] = ua.includes('Mobile') ? '?1' : '?0';
            headers['Sec-CH-UA-Platform'] = ua.includes('Windows') ? '"Windows"' : ua.includes('Mac') ? '"macOS"' : '"Linux"';
            headers['Sec-Fetch-Dest'] = 'document';
            headers['Sec-Fetch-Mode'] = 'navigate';
            headers['Sec-Fetch-Site'] = 'none';
            headers['Sec-Fetch-User'] = '?1';
        }

        // Add DNT header randomly (some real browsers send it)
        if (Math.random() > 0.5) {
            headers['DNT'] = '1';
        }

        // Add Referer from target domain (looks like intra-site navigation)
        if (targetUrl) {
            try {
                const urlObj = new URL(targetUrl);
                if (Math.random() > 0.3) {
                    headers['Referer'] = urlObj.origin + '/';
                    headers['Origin'] = urlObj.origin;
                }
            } catch { /* skip */ }
        }

        return headers;
    }

    // ═══════════════════════════════════════════
    // Request Jitter (Anti-Rate-Limit)
    // ═══════════════════════════════════════════

    /**
     * Apply random delay between requests to avoid rate-limit detection.
     * @param {number} [minMs=150] - Minimum delay in ms
     * @param {number} [maxMs=600] - Maximum delay in ms
     */
    async applyJitter(minMs = 150, maxMs = 600) {
        const now = Date.now();
        const elapsed = now - this._lastRequestTime;
        const delay = Math.floor(Math.random() * (maxMs - minMs)) + minMs;

        if (elapsed < delay) {
            await new Promise(r => setTimeout(r, delay - elapsed));
        }

        this._lastRequestTime = Date.now();
    }

    // ═══════════════════════════════════════════
    // Payload Encoding (WAF Filter Evasion)
    // ═══════════════════════════════════════════

    /**
     * Apply random encoding transformations to a payload to evade WAF signature matching.
     * @param {string} payload - Original attack payload
     * @returns {string} Encoded payload variant
     */
    encodePayload(payload) {
        if (!payload || typeof payload !== 'string') return payload;

        const techniques = [
            // Double URL encode
            (p) => encodeURIComponent(encodeURIComponent(p)),
            // Mixed case
            (p) => p.split('').map(c => Math.random() > 0.5 ? c.toUpperCase() : c.toLowerCase()).join(''),
            // Unicode substitution for common chars
            (p) => p.replace(/</g, '\u003c').replace(/>/g, '\u003e').replace(/'/g, '\u0027'),
            // Null byte insertion (for older WAFs)
            (p) => p.replace(/([<>"'])/g, '%00$1'),
            // Tab/newline insertion
            (p) => p.replace(/(script)/gi, 'scr\tipt').replace(/(select)/gi, 'sel\tect'),
            // HTML entity encoding for angle brackets
            (p) => p.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
            // Original (no encoding - sometimes the simplest bypass)
            (p) => p,
        ];

        return techniques[Math.floor(Math.random() * techniques.length)](payload);
    }

    // ═══════════════════════════════════════════
    // WAF Detection
    // ═══════════════════════════════════════════

    /**
     * Detect which WAF (if any) is protecting a target from a response.
     * @param {Object} response - { statusCode, headers, body }
     * @returns {string|null} WAF name or null
     */
    detectWaf(response) {
        if (!response) return null;

        const { statusCode, headers = {}, body = '' } = response;
        const lowerBody = (body || '').toLowerCase();
        const headerKeys = Object.keys(headers).map(k => k.toLowerCase());

        // Only check on block-like responses
        if (statusCode === 403 || statusCode === 406 || statusCode === 429 || statusCode === 503) {
            for (const [wafName, sigs] of Object.entries(WAF_SIGNATURES)) {
                // Check header signatures
                for (const headerSig of sigs.headers) {
                    if (headerKeys.includes(headerSig.toLowerCase())) {
                        this._detectedWaf = wafName;
                        this._blockedCount++;
                        return wafName;
                    }
                }

                // Check body signatures
                for (const bodyPattern of sigs.bodyPatterns) {
                    if (lowerBody.includes(bodyPattern.toLowerCase())) {
                        this._detectedWaf = wafName;
                        this._blockedCount++;
                        return wafName;
                    }
                }
            }
        }

        // Check headers even on 200 for passive WAF detection
        for (const [wafName, sigs] of Object.entries(WAF_SIGNATURES)) {
            for (const headerSig of sigs.headers) {
                if (headerKeys.includes(headerSig.toLowerCase())) {
                    this._detectedWaf = wafName;
                    return wafName;
                }
            }
        }

        this._requestCount++;
        return null;
    }

    /**
     * Check if current response indicates a WAF block
     * @param {Object} response - { statusCode, headers, body }
     * @returns {boolean}
     */
    isBlocked(response) {
        if (!response) return false;
        const { statusCode } = response;
        // Common WAF block codes
        if ([403, 406, 429, 503].includes(statusCode)) {
            return this.detectWaf(response) !== null;
        }
        return false;
    }

    /**
     * Get adaptive delay based on WAF behavior
     * Higher delays when blocks are detected
     */
    getAdaptiveDelay() {
        if (this._blockedCount > 5) return { min: 2000, max: 5000 };
        if (this._blockedCount > 2) return { min: 1000, max: 3000 };
        if (this._detectedWaf) return { min: 300, max: 1000 };
        return { min: 150, max: 600 };
    }

    /**
     * Get scan stats for logging
     */
    getStats() {
        return {
            detectedWaf: this._detectedWaf,
            totalRequests: this._requestCount,
            blockedRequests: this._blockedCount,
        };
    }

    /**
     * Reset state for a new scan
     */
    reset() {
        this._lastRequestTime = 0;
        this._detectedWaf = null;
        this._requestCount = 0;
        this._blockedCount = 0;
    }
}

module.exports = WafBypass;

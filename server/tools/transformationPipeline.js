/**
 * Apex-Vault: Transformation Pipeline
 * Multi-stage payload transformation engine with WAF-aware encoding.
 */

// --- Encoding Functions ---

function urlEncode(payload) {
    return encodeURIComponent(payload);
}

function doubleUrlEncode(payload) {
    return encodeURIComponent(encodeURIComponent(payload));
}

function base64Encode(payload) {
    return Buffer.from(payload).toString('base64');
}

function hexEncode(payload) {
    return Array.from(Buffer.from(payload))
        .map(b => '\\x' + b.toString(16).padStart(2, '0'))
        .join('');
}

function unicodeEncode(payload) {
    return Array.from(payload)
        .map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
        .join('');
}

function htmlEntityEncode(payload) {
    return payload.replace(/[&<>"'\/]/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;',
        '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
    }[c] || c));
}

function htmlEntityDecimalEncode(payload) {
    return Array.from(payload)
        .map(c => '&#' + c.charCodeAt(0) + ';')
        .join('');
}

function fromCharCodeEncode(payload) {
    const codes = Array.from(payload).map(c => c.charCodeAt(0)).join(',');
    return `String.fromCharCode(${codes})`;
}

function jsOctalEncode(payload) {
    return Array.from(payload)
        .map(c => '\\' + c.charCodeAt(0).toString(8).padStart(3, '0'))
        .join('');
}

// --- Context-Specific Transformers ---

const XSS_CONTEXT_TRANSFORMS = {
    attr: (p) => `">${p}`,
    href: (p) => `javascript:${p.replace(/<\/?script>/gi, '')}`,
    script: (p) => p.replace(/<\/?script>/gi, ''),
    innerHTML: (p) => p,
};

const SQLI_CONTEXT_TRANSFORMS = {
    WHERE: (p) => p,
    'ORDER BY': (p) => p.replace(/^'?\s*(UNION|SELECT)/i, '') || p,
    UNION: (p) => p,
};

// --- The Weaponize Engine ---

function weaponize(payload, options = {}) {
    const {
        context = 'raw',
        category = 'XSS',
        waf = false,
        encodings = [],
        maxVariations = 10,
    } = options;

    const variations = [];

    // 1. Raw payload
    variations.push({
        label: 'Raw',
        payload: payload,
        encoding: 'none',
    });

    // 2. Context-specific transform
    if (category === 'XSS' && XSS_CONTEXT_TRANSFORMS[context]) {
        const ctx = XSS_CONTEXT_TRANSFORMS[context](payload);
        if (ctx !== payload) {
            variations.push({
                label: `Context: ${context}`,
                payload: ctx,
                encoding: 'context',
            });
        }
    }
    if (category === 'SQLi' && SQLI_CONTEXT_TRANSFORMS[context]) {
        const ctx = SQLI_CONTEXT_TRANSFORMS[context](payload);
        if (ctx !== payload) {
            variations.push({
                label: `Context: ${context}`,
                payload: ctx,
                encoding: 'context',
            });
        }
    }

    // 3. Standard encodings
    const encodingMap = {
        url: { fn: urlEncode, label: 'URL Encoded' },
        'double-url': { fn: doubleUrlEncode, label: 'Double URL Encoded' },
        base64: { fn: base64Encode, label: 'Base64' },
        hex: { fn: hexEncode, label: 'Hex Escaped' },
        unicode: { fn: unicodeEncode, label: 'Unicode Escaped' },
        html: { fn: htmlEntityEncode, label: 'HTML Entities' },
        'html-decimal': { fn: htmlEntityDecimalEncode, label: 'HTML Decimal' },
        'fromcharcode': { fn: fromCharCodeEncode, label: 'String.fromCharCode' },
        'js-octal': { fn: jsOctalEncode, label: 'JS Octal' },
    };

    // If specific encodings requested, use those
    const toApply = encodings.length > 0
        ? encodings
        : ['url', 'double-url', 'base64', 'hex', 'unicode', 'html', 'html-decimal', 'fromcharcode'];

    for (const enc of toApply) {
        if (encodingMap[enc] && variations.length < maxVariations) {
            try {
                variations.push({
                    label: encodingMap[enc].label,
                    payload: encodingMap[enc].fn(payload),
                    encoding: enc,
                });
            } catch (e) {
                // Skip encoding errors
            }
        }
    }

    // 4. WAF evasion combos
    if (waf && variations.length < maxVariations) {
        try {
            // Double URL on the context-transformed version
            const ctxPayload = variations.find(v => v.encoding === 'context')?.payload || payload;
            variations.push({
                label: 'WAF Evasion (Double-URL + Context)',
                payload: doubleUrlEncode(ctxPayload),
                encoding: 'waf-double-url',
            });
        } catch (e) { /* skip */ }
    }

    return variations.slice(0, maxVariations);
}

// --- Single Encode Function ---

function encodePayload(payload, context) {
    const encoders = {
        url: urlEncode,
        'double-url': doubleUrlEncode,
        base64: base64Encode,
        hex: hexEncode,
        unicode: unicodeEncode,
        html: htmlEntityEncode,
        'html-decimal': htmlEntityDecimalEncode,
        fromcharcode: fromCharCodeEncode,
        'js-octal': jsOctalEncode,
        plain: (p) => p,
    };

    const encoder = encoders[context] || encoders.plain;
    return encoder(payload);
}

module.exports = {
    weaponize,
    encodePayload,
    urlEncode,
    doubleUrlEncode,
    base64Encode,
    hexEncode,
    unicodeEncode,
    htmlEntityEncode,
    htmlEntityDecimalEncode,
    fromCharCodeEncode,
    jsOctalEncode,
};

/**
 * Apex-Vault: Client-Side Payload Encoder
 * Pure client-side transformation utility for instant copy actions.
 */

export type EncodingContext = 'url' | 'double-url' | 'base64' | 'hex' | 'unicode' | 'html' | 'html-decimal' | 'fromcharcode' | 'js-octal' | 'plain';

export function encodePayload(payload: string, context: EncodingContext): string {
    switch (context) {
        case 'url':
            return encodeURIComponent(payload);
        case 'double-url':
            return encodeURIComponent(encodeURIComponent(payload));
        case 'base64':
            return btoa(unescape(encodeURIComponent(payload)));
        case 'hex':
            return Array.from(new TextEncoder().encode(payload))
                .map(b => '\\x' + b.toString(16).padStart(2, '0'))
                .join('');
        case 'unicode':
            return Array.from(payload)
                .map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
                .join('');
        case 'html':
            return payload.replace(/[&<>"'\/]/g, c => {
                const map: Record<string, string> = {
                    '&': '&amp;', '<': '&lt;', '>': '&gt;',
                    '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'
                };
                return map[c] || c;
            });
        case 'html-decimal':
            return Array.from(payload)
                .map(c => '&#' + c.charCodeAt(0) + ';')
                .join('');
        case 'fromcharcode':
            return `String.fromCharCode(${Array.from(payload).map(c => c.charCodeAt(0)).join(',')})`;
        case 'js-octal':
            return Array.from(new TextEncoder().encode(payload))
                .map(b => '\\' + b.toString(8).padStart(3, '0'))
                .join('');
        case 'plain':
        default:
            return payload;
    }
}

export const ENCODING_OPTIONS: { value: EncodingContext; label: string; shortLabel: string }[] = [
    { value: 'plain', label: 'Raw (No Encoding)', shortLabel: 'RAW' },
    { value: 'url', label: 'URL Encode', shortLabel: 'URL' },
    { value: 'double-url', label: 'Double URL Encode', shortLabel: '2×URL' },
    { value: 'base64', label: 'Base64', shortLabel: 'B64' },
    { value: 'hex', label: 'Hex Escape', shortLabel: 'HEX' },
    { value: 'unicode', label: 'Unicode Escape', shortLabel: 'UNI' },
    { value: 'html', label: 'HTML Entities', shortLabel: 'HTML' },
    { value: 'html-decimal', label: 'HTML Decimal', shortLabel: 'DEC' },
    { value: 'fromcharcode', label: 'String.fromCharCode', shortLabel: 'CHR' },
    { value: 'js-octal', label: 'JS Octal', shortLabel: 'OCT' },
];

export function getBypassLevelLabel(level: number): string {
    const labels = ['Basic', 'Low', 'Medium', 'High', 'Advanced', 'Elite'];
    return labels[Math.min(level, 5)] || 'Unknown';
}

export function getBypassLevelColor(level: number): string {
    const colors = [
        'bg-green-500/20 text-green-400 border-green-500/30',
        'bg-blue-500/20 text-blue-400 border-blue-500/30',
        'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'bg-red-500/20 text-red-400 border-red-500/30',
        'bg-purple-500/20 text-purple-400 border-purple-500/30',
    ];
    return colors[Math.min(level, 5)] || colors[0];
}

export function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
        'XSS': 'bg-red-500/20 text-red-400 border-red-500/30',
        'SQLi': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
        'LFI': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        'SSRF': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
        'XXE': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
        'SSTI': 'bg-violet-500/20 text-violet-400 border-violet-500/30',
        'Command Injection': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
        'Auth Bypass': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

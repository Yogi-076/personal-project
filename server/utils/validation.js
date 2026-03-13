/**
 * Shared Validation Utilities for VajraScan Framework (Backend)
 */
'use strict';

const REGEX = {
    EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
    URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)?\/?$/,
    ALPHANUMERIC_ID: /^[a-zA-Z0-9._-]+$/,
    CVSS: /^10(\.0)?$|^[0-9](\.[0-9])?$/
};

function validateEmail(email) {
    if (!email) return false;
    return REGEX.EMAIL.test(String(email).toLowerCase());
}

function validateUrl(url) {
    if (!url) return false;
    return REGEX.URL.test(String(url));
}

function validateUsername(username) {
    if (!username) return false;
    return username.length >= 3 && username.length <= 30 && REGEX.ALPHANUMERIC_ID.test(username);
}

function sanitizeString(str, maxLength = 2000) {
    if (typeof str !== 'string') return "";
    return str.trim().slice(0, maxLength);
}

module.exports = {
    REGEX,
    validateEmail,
    validateUrl,
    validateUsername,
    sanitizeString
};

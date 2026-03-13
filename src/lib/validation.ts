/**
 * Shared Validation Utilities for VajraScan Framework
 */

export const REGEX = {
    // RFC 5322 compliant email regex
    EMAIL: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

    // URL regex supporting protocol-relative or fully qualified URLs
    URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)?\/?$/,

    // Alphanumeric with underscores/dots
    ALPHANUMERIC_ID: /^[a-zA-Z0-9._-]+$/,

    // CVSS Score (0.0 to 10.0)
    CVSS: /^10(\.0)?$|^[0-9](\.[0-9])?$/
};

export const validateEmail = (email: string): boolean => {
    return REGEX.EMAIL.test(email);
};

export const validateUrl = (url: string): boolean => {
    return REGEX.URL.test(url);
};

export const validateUsername = (username: string): boolean => {
    return username.length >= 3 && username.length <= 30 && REGEX.ALPHANUMERIC_ID.test(username);
};

export const sanitizeString = (str: string, maxLength: number = 2000): string => {
    if (!str) return "";
    return str.trim().slice(0, maxLength);
};

const SECRET_PATTERNS = [
    /sk-[a-z0-9]{12,}/gi,
    /\b(?:api[_-]?key|token|secret)\b\s*[:=]\s*["']?[a-z0-9._-]{8,}["']?/gi,
    /https?:\/\/[^\s]+/gi,
];
export function redactForExternalMode(input, modeName) {
    if (modeName !== "external_safe_mode") {
        return input;
    }
    return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, "[redacted]"), input);
}

// Match the web import preflight (4,000,000 base64 characters ≈ 3 MB).
// The JSON request needs additional room under the API gateway's body limit.
export const MAX_SCAN_PDF_BASE64 = 4_000_000;
export const MAX_SCAN_PDF_BYTES = 3_000_000;

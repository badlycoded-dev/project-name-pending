//const crypto = require('../components/module')
const config = require("../config/config");

const ALGORITHM  = "aes-256-gcm";
const IV_BYTES   = 12;
const ENCODING   = "hex";

function loadKey() {
    const raw = config.SECRET;
    if (!raw) {
        throw new Error(
            "[encryption] SECRET is not set. " +
            "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
        );
    }
    // SHA-256 always produces exactly 32 bytes — works regardless of secret format,
    // length, or whether it contains non-hex characters.
    return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format (hex, joined by ":"): <iv>:<authTag>:<ciphertext>
 *
 * @param   {string} plaintext
 * @returns {string}
 */
function use(plaintext) {
    if (typeof plaintext !== "string") {
        throw new TypeError(`[encryption] use() expects a string, got ${typeof plaintext}`);
    }

    const key = loadKey();
    const iv  = crypto.randomBytes(IV_BYTES);

    const cipher    = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag   = cipher.getAuthTag();

    return [iv.toString(ENCODING), authTag.toString(ENCODING), encrypted.toString(ENCODING)].join(":");
}

/**
 * Decrypts a token produced by use().
 *
 * @param   {string} token
 * @returns {string}
 */
function parse(token) {
    if (typeof token !== "string") {
        throw new TypeError(`[encryption] parse() expects a string, got ${typeof token}`);
    }

    const parts = token.split(":");
    if (parts.length !== 3) {
        throw new Error("[encryption] parse() received a malformed token.");
    }

    const [ivHex, tagHex, cipherHex] = parts;

    const key       = loadKey();
    const iv        = Buffer.from(ivHex,     ENCODING);
    const authTag   = Buffer.from(tagHex,    ENCODING);
    const encrypted = Buffer.from(cipherHex, ENCODING);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    try {
        const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
        return decrypted.toString("utf8");
    } catch {
        throw new Error("[encryption] Decryption failed — data may be corrupted or tampered with.");
    }
}

/**
 * One-way SHA-256 hash. Use for indexed lookups (e.g. emails) without storing plaintext.
 * @param   {string} value
 * @returns {string} 64-char hex digest
 */
function hash(value) {
    if (typeof value !== "string") {
        throw new TypeError(`[encryption] hash() expects a string, got ${typeof value}`);
    }
    return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/**
 * Timing-safe string comparison. Use instead of === when comparing tokens or hashes.
 * @param   {string} a
 * @param   {string} b
 * @returns {boolean}
 */
function compare_s(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Generates a cryptographically secure random token.
 * @param   {number} [bytes=32]
 * @returns {string} hex string
 */
function genT(bytes = 32) {
    return crypto.randomBytes(bytes).toString("hex");
}

module.exports = { use, parse, hash, compare_s, genT };
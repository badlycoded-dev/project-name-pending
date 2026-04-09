/**
 * idToken.js
 * Wraps the existing AES-256-GCM module to encode/decode MongoDB ObjectIds
 * as opaque tokens so raw _id values never appear in URLs or responses.
 *
 * Encode: ObjectId string → encrypted hex token (sent to client)
 * Decode: token          → ObjectId string       (used server-side only)
 */

const mdl          = require('./module');
const errorHandler = require('./errorHandler');

/**
 * Encrypts a MongoDB ObjectId string into an opaque token.
 * @param {string} id - MongoDB ObjectId as string
 * @returns {string} opaque token
 */
function encodeId(id) {
    return mdl.use(String(id));
}

/**
 * Decrypts a token back to a MongoDB ObjectId string.
 * Throws if the token is malformed or tampered.
 * @param {string} token
 * @returns {string} MongoDB ObjectId string
 */
function decodeId(token) {
    return mdl.parse(token);
}

/**
 * Express middleware.
 * Reads req.body.ref (or req.headers['x-ref'] as fallback),
 * decrypts it, and writes the result to req.params.id so that
 * existing controllers that read req.params.id work unchanged.
 *
 * Returns 400 if no token is provided, 422 if decryption fails.
 */
function resolveId(req, res, next) {
    const token = req.body?.ref || req.headers['x-ref'];
    if (!token) {
        return errorHandler(res, 400, 'Missing resource reference (body.ref or x-ref header)');
    }
    try {
        req.params.id = decodeId(token);
        next();
    } catch {
        errorHandler(res, 422, 'Invalid or tampered resource reference');
    }
}

/**
 * Recursively replaces every _id field in a plain object/array with an
 * encrypted token, so callers receive opaque refs instead of raw ObjectIds.
 * Operates on plain objects (call .toObject() on Mongoose docs first).
 *
 * @param {any} obj
 * @returns {any}
 */
function maskIds(obj) {
    if (Array.isArray(obj)) return obj.map(maskIds);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            if (k === '_id' || k === 'id') {
                out[k] = v ? encodeId(String(v)) : v;
            } else {
                out[k] = maskIds(v);
            }
        }
        return out;
    }
    return obj;
}

module.exports = { encodeId, decodeId, resolveId, maskIds };
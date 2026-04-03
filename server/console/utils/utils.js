const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const User = require('../models/mongo.users');
const Role = require('../models/mongo.roles');
const config = require('../config/config');
const errorHandler = require('./errorHandler');

// Hierarchy: lower index = less access
const ACCESS_LEVELS = ['default', 'create', 'tutor', 'quality', 'manage', 'admin', 'root'];

// Tutor sub-rank hierarchy (ascending)
const TUTOR_RANKS = ['assistant', 'teacher', 'lecturer', 'instructor', 'tutor', 'professor'];

/**
 * Creates a signed JWT.
 * @param {Object} payload - User document
 * @param {string} secret
 * @param {Object} [options] - jwt.sign options (e.g. { expiresIn })
 * @param {boolean} [useTemplate=true] - Use standard userId/email/role shape
 * @returns {string}
 */
module.exports.createToken = (payload, secret, options, useTemplate = true) => {
    const claims = useTemplate
        ? { userId: payload._id, email: payload.email, role: payload.role }
        : { _: payload };

    return jwt.sign(claims, secret, options || { expiresIn: config.JWT_EXPIRES_IN });
};

/**
 * Verifies a JWT and returns the matching user document, or null on failure.
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
module.exports.parseToken = async (token) => {
    try {
        const decoded = jwt.verify(token, config.JWT_SECRET);
        return await User.findById(decoded.userId) || null;
    } catch (err) {
        console.error('parseToken error:', err.message);
        return null;
    }
};

/**
 * Issues a fresh token reusing the identity from an existing (possibly expired) token,
 * or falls back to req.body.data._id.
 * @param {import('express').Request} req
 * @returns {Promise<string|null>}
 */
module.exports.extendToken = async (req) => {
    try {
        const raw = req.headers.authorization?.split(' ')[1];
        let userId;

        if (raw && raw !== 'undefined') {
            const decoded = jwt.verify(raw, config.JWT_SECRET, { ignoreExpiration: true });
            userId = decoded.userId;
        } else if (req.body?.data?._id) {
            userId = req.body.data._id;
        } else {
            return null;
        }

        const user = await User.findById(userId);
        if (!user) return null;

        return jwt.sign(
            { userId: user._id, email: user.email, role: user.role },
            config.JWT_SECRET,
            { expiresIn: config.JWT_EXPIRES_IN }
        );
    } catch (err) {
        console.error('extendToken error:', err.message);
        return null;
    }
};

/**
 * Hashes a password with bcrypt. Generates a random password if none is provided.
 * @param {string} [password]
 * @returns {Promise<{ hash: string, password: string }>}
 */
module.exports.generatePasswordHash = async (password) => {
    if (!password) {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        password = Array.from(
            { length: config.PASSWORD_LENGTH },
            () => chars[Math.floor(Math.random() * chars.length)]
        ).join('');
    }
    const hash = await bcrypt.hash(password, 12);
    return { hash, password };
};

/**
 * Returns true if userLevel meets or exceeds the required permission level.
 * @param {string} accessLevel
 * @param {string} permission
 * @returns {boolean}
 */
const comparePermission = (accessLevel, permission) => {
    if (!accessLevel) return false;
    const ai = ACCESS_LEVELS.indexOf(accessLevel);
    const pi = ACCESS_LEVELS.indexOf(permission);
    if (ai === -1 || pi === -1) return accessLevel === permission;
    return ai >= pi;
};

/**
 * Returns true if userRank meets or exceeds the required tutor rank.
 * @param {string} userRank
 * @param {string} minRank
 * @returns {boolean}
 */
module.exports.checkTutorRank = (userRank, minRank) => {
    if (!userRank || !minRank) return false;
    const ui = TUTOR_RANKS.indexOf(userRank);
    const mi = TUTOR_RANKS.indexOf(minRank);
    if (ui === -1 || mi === -1) return false;
    return ui >= mi;
};

module.exports.TUTOR_RANKS = TUTOR_RANKS;
module.exports.ACCESS_LEVELS = ACCESS_LEVELS;

/**
 * Express middleware factory — verifies JWT and checks role permission.
 * @param {string} permission - Minimum required access level
 * @returns {import('express').RequestHandler}
 */
module.exports.validate = (permission) => async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) return errorHandler(res, 401, 'No token provided');

        const decoded = jwt.verify(token, config.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        if (!user) return errorHandler(res, 404, 'ACCESS DENIED: User not found');

        const role = await Role.findById(user.role);
        if (!role) return errorHandler(res, 404, 'ACCESS DENIED: Role not found');

        if (comparePermission(role.accessLevel, permission)) {
            next();
        } else {
            errorHandler(res, 403, `ACCESS DENIED: requires '${permission}' level`);
        }
    } catch (err) {
        errorHandler(res, 500, err.message);
    }
};
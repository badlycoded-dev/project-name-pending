require('dotenv').config();

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL SELECTION: Automatically select ports and URLs based on USE_HTTPS
// ═══════════════════════════════════════════════════════════════════════════
const useHttps = process.env.USE_HTTPS === 'true';

// Determine protocol and ports
const serverHost = process.env.SERVER_HOST || 'localhost';

// Select port based on protocol
const rtcPort = useHttps
    ? parseInt(process.env.RTC_PORT_HTTPS || '5051', 10)
    : parseInt(process.env.RTC_PORT_HTTP || '5050', 10);

// Construct service URLs dynamically from SERVER_HOST
const apiUrl = useHttps
    ? `https://${serverHost}:${process.env.API_PORT_HTTPS || '4043'}/api`
    : `http://${serverHost}:${process.env.API_PORT_HTTP || '4040'}/api`;

const rtcUrl = useHttps
    ? `https://${serverHost}:${process.env.RTC_PORT_HTTPS || '5051'}`
    : `http://${serverHost}:${process.env.RTC_PORT_HTTP || '5050'}`;

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Build allowed origins from environment or SERVER_HOST
// ═══════════════════════════════════════════════════════════════════════════
function buildAllowedOrigins(host, https, rtcPort) {
    const proto = https ? 'https' : 'http';
    const webPort = https ? (process.env.WEB_PORT_HTTPS || '4004') : (process.env.WEB_PORT_HTTP || '4000');

    // Explicit list always allowed
    const explicit = new Set([
        proto + '://' + host + ':' + webPort,
        'http://localhost:3000', 'http://localhost:4000', 'http://localhost:4004',
        'https://localhost:3000', 'https://localhost:4000', 'https://localhost:4004',
        'http://127.0.0.1:3000', 'http://127.0.0.1:4000', 'http://127.0.0.1:4004',
        'https://127.0.0.1:3000', 'https://127.0.0.1:4000', 'https://127.0.0.1:4004',
    ]);

    if (process.env.ALLOWED_ORIGINS) {
        process.env.ALLOWED_ORIGINS.split(',').forEach(function(o) {
            var t = o.trim(); if (t) explicit.add(t);
        });
    }

    // Build a regex that matches any port on SERVER_HOST
    var escapedHost = host.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    var hostRegex = new RegExp('^https?://' + escapedHost + '(:\\d+)?$');

    return function corsOrigin(origin, callback) {
        // No origin = same-origin request or server-to-server — always allow
        if (!origin) return callback(null, true);
        // Exact match
        if (explicit.has(origin)) return callback(null, true);
        // Any port on SERVER_HOST — covers VPN/LAN access on any port
        if (hostRegex.test(origin)) return callback(null, true);
        console.warn('[CORS] Blocked: ' + origin);
        return callback(null, false);
    };
}

module.exports = {
    // ─────────────────────────────────────────────────────────────────────
    // Protocol & Port Configuration
    // ─────────────────────────────────────────────────────────────────────
    USE_HTTPS:              useHttps,
    PORT:                   rtcPort || parseInt(process.env.PORT, 10) || 5050,

    // Service URLs (for internal references and logging)
    SERVICE_URLS: {
        API:                apiUrl,
        RTC:                rtcUrl,
    },

    // ─────────────────────────────────────────────────────────────────────
    // JWT & Authentication
    // ─────────────────────────────────────────────────────────────────────
    JWT_SECRET:             process.env.JWT_SECRET || 'Z3H@u8E#375Q[hKxAprDFGmERb05',

    // ─────────────────────────────────────────────────────────────────────
    // CORS Configuration
    // ─────────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS:        buildAllowedOrigins(serverHost, useHttps, rtcPort),

    // ─────────────────────────────────────────────────────────────────────
    // Database Configuration
    // ─────────────────────────────────────────────────────────────────────
    MONGO_URI:              process.env.MONGO_URI || null,

    // ─────────────────────────────────────────────────────────────────────
    // ICE Servers (STUN/TURN for WebRTC)
    // ─────────────────────────────────────────────────────────────────────
    ICE_SERVERS: [
        ...((process.env.STUN_URLS || 'stun:stun.l.google.com:19302').split(',').map(url => ({ urls: url.trim() }))),
        ...(process.env.TURN_URL ? [{
            urls:       process.env.TURN_URL,
            username:   process.env.TURN_USERNAME || '',
            credential: process.env.TURN_CREDENTIAL || ''
        }] : [])
    ]
};

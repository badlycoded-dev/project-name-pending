require('dotenv').config();

// ═══════════════════════════════════════════════════════════════════════════
// PROTOCOL SELECTION: Automatically select ports and URLs based on USE_HTTPS
// ═══════════════════════════════════════════════════════════════════════════
const useHttps = (process.env.USE_HTTPS === 'true');

// Determine protocol and ports
const protocol = useHttps ? 'https' : 'http';
const serverHost = process.env.SERVER_HOST || 'localhost';

// Select port based on protocol
const apiPort = useHttps
    ? parseInt(process.env.API_PORT_HTTPS || '4043', 10)
    : parseInt(process.env.API_PORT_HTTP || '4040', 10);

// Construct service URLs dynamically from SERVER_HOST
const apiUrl = useHttps
    ? `https://${serverHost}:${process.env.API_PORT_HTTPS || '4043'}/api`
    : `http://${serverHost}:${process.env.API_PORT_HTTP || '4040'}/api`;

const rtcUrl = useHttps
    ? `https://${serverHost}:${process.env.RTC_PORT_HTTPS || '5051'}`
    : `http://${serverHost}:${process.env.RTC_PORT_HTTP || '5050'}`;

const webUrl = useHttps
    ? `https://${serverHost}:${process.env.WEB_PORT_HTTPS || '4004'}`
    : `http://${serverHost}:${process.env.WEB_PORT_HTTP || '4000'}`;

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Build allowed origins from environment or SERVER_HOST
// ═══════════════════════════════════════════════════════════════════════════
function buildAllowedOrigins(host, https, apiPort) {
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
    PORT:                   apiPort || process.env.PORT || 4040,

    // Service URLs (for internal references and logging)
    SERVICE_URLS: {
        API:                apiUrl,
        RTC:                rtcUrl,
        WEB:                webUrl
    },

    // ─────────────────────────────────────────────────────────────────────
    // Database Configuration
    // ─────────────────────────────────────────────────────────────────────
    DB:                     process.env.DB_DRIVER || 'mongo',
    DB_NAME:                process.env.DB_NAME || 'P_01',
    DB_URL:                 process.env.DB_URL || process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb+srv://mishanja:qwerty123@cluster0.oewbabf.mongodb.net/?appName=Cluster0',
    DO_RECONNECT:           process.env.DO_RECONNECT === 'true',

    // ─────────────────────────────────────────────────────────────────────
    // JWT & Security
    // ─────────────────────────────────────────────────────────────────────
    SECRET:                 process.env.SECRET || '#K!x1$iSzC%Cs5uk:n7b8wcvM6pZlg6T.Uif9QBCIz2p7o3V:S!aMXEsDYtEG@BG',
    JWT_SECRET:             process.env.JWT_SECRET || 'Z3H@u8E#375Q[hKxAprDFGmERb05',
    JWT_EXPIRES_IN:         parseInt(process.env.JWT_EXPIRES_IN, 10) || 14400,
    PASSWORD_LENGTH:        parseInt(process.env.PASSWORD_LENGTH, 10) || 16,

    // ─────────────────────────────────────────────────────────────────────
    // CORS Configuration
    // ─────────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS:        buildAllowedOrigins(serverHost, useHttps, apiPort),
};

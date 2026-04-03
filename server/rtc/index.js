require('dotenv').config()

const express    = require('express')
const http       = require('http')
const { Server } = require('socket.io')
const cors       = require('cors')

const config           = require('./config')
const { socketAuth }   = require('./auth')
const registerHandlers = require('./handlers')
const rooms            = require('./rooms')
const roomsRouter      = require('./routes.rooms')

const app    = express()
const server = http.createServer(app)

// ── MongoDB (optional) ────────────────────────────────────────────────────────
if (config.MONGO_URI) {
    const mongoose = require('mongoose')
    mongoose.connect(config.MONGO_URI)
        .then(() => console.log('[mongo] connected'))
        .catch(e => console.error('[mongo] connection error:', e.message))
}

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
    cors: {
        origin:      '*',
        methods:     ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling']
})

// JWT auth for every socket connection
io.use(socketAuth)

// Attach io to express app so route handlers can access it
app.set('io', io)

// In-memory circular log (last 500 lines)
global.__rtcLog = []
const origLog  = console.log.bind(console)
const origWarn = console.warn.bind(console)
const origErr  = console.error.bind(console)
const pushLog  = (level, ...args) => {
    const line = { ts: new Date().toISOString(), level, msg: args.map(String).join(' ') }
    global.__rtcLog.push(line)
    if (global.__rtcLog.length > 500) global.__rtcLog.shift()
}
console.log   = (...a) => { pushLog('info',  ...a); origLog(...a)  }
console.warn  = (...a) => { pushLog('warn',  ...a); origWarn(...a) }
console.error = (...a) => { pushLog('error', ...a); origErr(...a)  }

// Register all signaling event handlers
registerHandlers(io)

// ── REST ──────────────────────────────────────────────────────────────────────
// app.use(cors({
//     //origin: config.ALLOWED_ORIGINS,
//     origin: true,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     maxAge: 86400
// }))
// app.options(true, cors({
//     //origin: config.ALLOWED_ORIGINS,
//     origin: true,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
// }))
app.use(express.json())

// Health check
app.get('/health', (_req, res) => {
    res.json({
        status:    'ok',
        uptime:    process.uptime(),
        rooms:     rooms.listAll(),
        timestamp: new Date().toISOString()
    })
})

// ICE server config (public — clients fetch before connecting)
app.get('/ice-config', (_req, res) => {
    res.json({ iceServers: config.ICE_SERVERS })
})

// Room management REST API
// POST   /rooms              — create / upsert a room (returns joinPath)
// GET    /rooms/:roomId      — get room settings
// PATCH  /rooms/:roomId      — update room settings
// GET    /rooms/by-session/:sessionId — look up room for a session
app.use('/rooms', roomsRouter)

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(config.PORT, () => {
    const protocol = config.USE_HTTPS ? 'HTTPS' : 'HTTP';
    const url = config.USE_HTTPS 
        ? `wss://localhost:${config.PORT}`
        : `ws://localhost:${config.PORT}`;
    
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`RTC signaling server listening on ${url}`);
    console.log(`Protocol: ${protocol} | Port: ${config.PORT}`);
    console.log(`API URL: ${config.SERVICE_URLS.API}`);
    console.log(`RTC URL: ${config.SERVICE_URLS.RTC}`);
    console.log(`\n[CORS] Configured for these origins:`);
    // config.ALLOWED_ORIGINS.forEach(origin => {
    //     console.log(`       ✓ ${origin}`);
    // });
    console.log(`       ✓ *`);
    console.log(`Mongo: ${config.MONGO_URI ? 'enabled' : 'disabled (in-memory only)'}`);
    console.log(`${'═'.repeat(70)}\n`);
})

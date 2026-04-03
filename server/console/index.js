require('dotenv').config()

const express    = require('express')
const bodyParser = require('body-parser')
const passport   = require('passport')
const morgan     = require('morgan')
const cors       = require('cors')

const config      = require('./config/config')
const restRouter  = require('./routes/rest')
const { loadAPI, useAPI } = require('./utils/connectionHandler')
const logger      = require('./utils/logger')

global.appState = {
    server:    { status: 'ok' },
    db:        { status: 'ok' },
    launchTime: Date.now(),
    API: { name: '', config: '', module: null }
}

const app = express()

// // ── CORS Configuration ───────────────────────────────────────────────────────
// // Uses dynamic ALLOWED_ORIGINS from config (set from SERVER_HOST + localhost fallbacks)
// app.use(cors({
//     origin: config.ALLOWED_ORIGINS,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
//     maxAge: 86400
// }))
// // Handle preflight for all routes explicitly
// app.options(true, cors({
//     origin: config.ALLOWED_ORIGINS,
//     credentials: true,
//     methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
//     allowedHeaders: ['Content-Type', 'Authorization'],
// }))
app.use(passport.initialize())
require('./middleware/passport')(passport)
app.use(morgan('dev'))
app.use((req, _res, next) => { logger.logRequest(req); next() })
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

loadAPI()
useAPI()
global.appState.API.module.use()

app.use('/api', restRouter)

const protocol = config.USE_HTTPS ? 'HTTPS' : 'HTTP';
const url = config.USE_HTTPS 
    ? `https://${process.env.SERVER_HOST}:${config.PORT}`
    : `http://${process.env.SERVER_HOST}:${config.PORT}`;

app.listen(config.PORT, () => {
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`REST Server started at ${url}`);
    console.log(`Protocol: ${protocol} | Port: ${config.PORT}`);
    console.log(`API URL: ${config.SERVICE_URLS.API}`);
    console.log(`RTC URL: ${config.SERVICE_URLS.RTC}`);
    console.log(`WEB URL: ${config.SERVICE_URLS.WEB}`);
    console.log(`\n[CORS] Configured for these origins:`);
    // config.ALLOWED_ORIGINS.forEach(origin => {
    //     console.log(`       ✓ ${origin}`);
    // });
    console.log(`       ✓ *`);
    console.log(`${'═'.repeat(70)}\n`);
})
const fs   = require('fs')
const path = require('path')

const LOGS_DIR = path.join(__dirname, '../storage/logs')

function ensureLogsDir() {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true })
}

ensureLogsDir()

const COLORS = {
    INFO:    '\x1b[36m',
    ERROR:   '\x1b[31m',
    WARN:    '\x1b[33m',
    REQUEST: '\x1b[35m',
    DATA:    '\x1b[32m',
    RESET:   '\x1b[0m'
}

function timestamp() {
    return new Date().toISOString().replace('T', ' ').slice(0, 23)
}

function logFilePath() {
    const date = new Date().toISOString().slice(0, 10)
    return path.join(LOGS_DIR, `app-${date}.log`)
}

function write(level, message, data = null) {
    try {
        let entry = `[${timestamp()}] [${level}] ${message}`
        if (data !== null) entry += `\n  Data: ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}`
        entry += '\n'
        fs.appendFileSync(logFilePath(), entry)
        console.log(`${COLORS[level] || COLORS.RESET}[${timestamp()}] [${level}] ${message}${COLORS.RESET}`)
    } catch (err) {
        console.error('Logger write error:', err)
    }
}

module.exports = {
    logRequest: (req) => write('REQUEST', `${req.method} ${req.originalUrl}`, { ip: req.ip, userAgent: req.get('user-agent') }),
    logData:    (msg, data)  => write('DATA', msg, data),
    logInfo:    (msg, data)  => write('INFO', msg, data),
    logWarn:    (msg, data)  => write('WARN', msg, data),
    logError:   (msg, error) => write('ERROR', msg, { message: error?.message || String(error), stack: error?.stack }),

    readLogs(date = 'today', lines = null) {
        try {
            const d    = date === 'today' ? new Date().toISOString().slice(0, 10) : date
            const file = path.join(LOGS_DIR, `app-${d}.log`)
            if (!fs.existsSync(file)) return `No logs found for ${d}`
            const content = fs.readFileSync(file, 'utf8')
            return lines ? content.split('\n').filter(Boolean).slice(-lines).join('\n') : content
        } catch (err) {
            console.error('Error reading logs:', err)
            return ''
        }
    },

    getLogFiles() {
        try {
            ensureLogsDir()
            return fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log')).sort().reverse()
        } catch (err) {
            console.error('Error listing log files:', err)
            return []
        }
    },

    clearOldLogs(days = 30) {
        try {
            ensureLogsDir()
            const cutoff = Date.now() - days * 24 * 60 * 60 * 1000
            fs.readdirSync(LOGS_DIR).forEach(file => {
                const filePath = path.join(LOGS_DIR, file)
                if (fs.statSync(filePath).mtime.getTime() < cutoff) {
                    fs.unlinkSync(filePath)
                    write('INFO', `Deleted old log file: ${file}`)
                }
            })
        } catch (err) {
            write('ERROR', 'Error clearing old logs', { message: err?.message })
        }
    },

    getTimestamp: timestamp
}
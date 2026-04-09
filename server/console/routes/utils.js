const router  = require('express').Router()
const passport = require('passport')
const jwt     = require('jsonwebtoken')
const os      = require('os')
const { validate, validateDynamic } = require('../utils/utils')
const utilC   = require('../controllers/utils')
const { readLogs, getLogFiles } = require('../utils/logger')
const config  = require('../config/config')

const auth = passport.authenticate('jwt', { session: false })

function sseHeaders(res) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    res.flushHeaders()
}

function sseWrite(res, data) {
    res.write(`data: ${JSON.stringify(data)}\n\n`)
}

function verifyTokenParam(raw) {
    if (!raw) return null
    const token = raw.includes(' ') ? raw.split(' ')[1] : raw
    try { return jwt.verify(token, config.JWT_SECRET) } catch { return null }
}

router.get('/status', auth, validateDynamic('manage'), utilC.getStatusInfo)

router.get('/logs', auth, validateDynamic('manage'), (req, res) => {
    try {
        const { date = 'today', lines } = req.query
        res.json({ date, logs: readLogs(date, lines ? parseInt(lines) : null) })
    } catch (e) {
        res.status(500).json({ message: 'Error fetching logs' })
    }
})

router.get('/logs/files', auth, validateDynamic('manage'), (req, res) => {
    try {
        res.json({ files: getLogFiles() })
    } catch (e) {
        res.status(500).json({ message: 'Error fetching log files' })
    }
})

router.get('/status/stream', async (req, res) => {
    if (!verifyTokenParam(req.query.token)) return res.status(401).end()

    sseHeaders(res)

    const Course = require('../models/mongo.courses')
    const User   = require('../models/mongo.users')

    const sendStatus = async () => {
        try {
            let counts = { userCount: 0, courseCount: 0, sessionCount: 0,
                activeSessionCount: 0, groupCount: 0, assignmentCount: 0,
                pendingSubmissionCount: 0, upcomingMeetings: [] }

            if (global.appState.db.status === 'connected') {
                const Session    = require('../models/mongo.sessions')
                const Group      = require('../models/mongo.groups')
                const Assignment = require('../models/mongo.assignments')
                const now  = new Date()
                const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

                const [u, c, s, sa, g, a] = await Promise.all([
                    User.countDocuments({}),
                    Course.countDocuments({}),
                    Session.countDocuments({}),
                    Session.countDocuments({ status: 'active' }),
                    Group.countDocuments({}),
                    Assignment.countDocuments({})
                ])
                counts = { userCount: u, courseCount: c, sessionCount: s,
                    activeSessionCount: sa, groupCount: g, assignmentCount: a,
                    pendingSubmissionCount: 0, upcomingMeetings: [] }

                const groupsWithPending = await Group.find(
                    { 'assignments.submissions.status': 'pending' },
                    { 'assignments.submissions.$': 1 }
                ).lean()
                groupsWithPending.forEach(gr => {
                    gr.assignments?.forEach(as => {
                        counts.pendingSubmissionCount += (as.submissions || []).filter(s => s.status === 'pending').length
                    })
                })

                const activeSessions = await Session.find(
                    { status: 'active', 'schedule.datetime': { $gte: now, $lte: soon } },
                    { schedule: 1, courseId: 1 }
                ).populate('courseId', 'trans').lean()

                activeSessions.forEach(sess => {
                    sess.schedule?.forEach(m => {
                        const d = new Date(m.datetime)
                        if (d >= now && d <= soon) {
                            counts.upcomingMeetings.push({
                                title:       m.title,
                                datetime:    m.datetime,
                                durationMin: m.durationMin,
                                meetingLink: m.meetingLink,
                                courseTitle: sess.courseId?.trans?.[0]?.title || '—'
                            })
                        }
                    })
                })
                counts.upcomingMeetings.sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
                counts.upcomingMeetings = counts.upcomingMeetings.slice(0, 5)
            }

            sseWrite(res, {
                status:     global.appState.server.status,
                db_status:  global.appState.db.status,
                uptime:     os.uptime(),
                launchTime: global.appState.launchTime,
                ...counts
            })
        } catch (e) {
            sseWrite(res, { error: e.message })
        }
    }

    sendStatus()
    const interval = setInterval(sendStatus, 5000)
    req.on('close', () => clearInterval(interval))
})

router.get('/logs/stream', (req, res) => {
    if (!verifyTokenParam(req.query.token)) return res.status(401).end()

    sseHeaders(res)

    const { date = 'today', lines = 100 } = req.query
    const parsedLines = parseInt(lines) || 100

    const sendLogs = () => {
        try {
            sseWrite(res, { date, logs: readLogs(date, parsedLines) })
        } catch (e) {
            sseWrite(res, { error: e.message })
        }
    }

    sendLogs()
    const interval = setInterval(sendLogs, 2000)
    req.on('close', () => clearInterval(interval))
})

module.exports = router
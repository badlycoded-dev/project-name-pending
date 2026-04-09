const Sessions = require('../models/mongo.sessions')
const Courses = require('../models/mongo.courses')
const Levels = require('../models/mongo.levels')
const Roles = require('../models/mongo.roles')
const fileHandler = require('../utils/fileHandler')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')

const MANAGE_LEVELS = ['manage', 'admin', 'root']

async function getRequester(req) {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return null
    return utils.parseToken(token)
}

async function getAccessLevel(user) {
    const role = await Roles.findById(user.role)
    return role?.accessLevel || 'default'
}

function isTutorInSession(session, userId) {
    return (
        session.hostTutor.toString() === userId.toString() ||
        session.coTutors.some(ct => ct.userId.toString() === userId.toString())
    )
}

module.exports.getAll = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        const query = MANAGE_LEVELS.includes(level)
            ? {}
            : { $or: [{ hostTutor: requester._id }, { 'coTutors.userId': requester._id }] }

        const sessions = await Sessions.find(query)
            .populate('courseId', 'trans base_lang level direction courseType isPrivateCopy')
            .populate('privateCopyId', 'trans base_lang')
            .populate('hostTutor', 'nickname email tutorRank')
            .populate('coTutors.userId', 'nickname email tutorRank')
            .sort({ createdAt: -1 })

        res.status(200).json({ data: sessions })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.getById = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
            .populate('courseId', 'trans base_lang level direction courseType isPrivateCopy links volumes')
            .populate('privateCopyId', 'trans base_lang links volumes')
            .populate('hostTutor', 'nickname email tutorRank')
            .populate('coTutors.userId', 'nickname email tutorRank')

        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        if (!isTutorInSession(session, requester._id) && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not authorized')

        res.status(200).json({ data: session })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.create = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (level !== 'tutor' && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Tutor access level required')

        const { courseId, courseType, coTutors = [], restrictionIgnored = false } = req.body
        if (!courseId) return errorHandler(res, 400, 'courseId is required')

        const course = await Courses.findById(courseId)
        if (!course) return errorHandler(res, 404, 'Course not found')

        let rankOverrides = []

        if (level === 'tutor') {
            const levelDoc = await Levels.findOne({ levelName: course.level })
            if (levelDoc?.minTutorRank && !utils.checkTutorRank(requester.tutorRank, levelDoc.minTutorRank)) {
                if (restrictionIgnored && MANAGE_LEVELS.includes(level)) {
                    rankOverrides.push({ tutorId: requester._id, overriddenBy: requester._id, overriddenAt: new Date() })
                } else if (restrictionIgnored) {
                    return errorHandler(res, 403, 'Only manage+ can override rank restrictions')
                } else {
                    return errorHandler(res, 403,
                        `This course requires at least '${levelDoc.minTutorRank}' sub-rank. Your rank: '${requester.tutorRank || 'none'}'.`
                    )
                }
            }
        }

        const session = await new Sessions({
            courseId,
            courseType:            courseType || course.courseType,
            hostTutor:             requester._id,
            coTutors:              coTutors.map(ct => ({
                userId:      ct.userId,
                canGrade:    ct.canGrade    ?? true,
                canSchedule: ct.canSchedule ?? true,
                canEditCopy: ct.canEditCopy ?? false
            })),
            rankOverrides,
            restrictionIgnored:    rankOverrides.length > 0,
            restrictionOverrideBy: rankOverrides.length > 0 ? requester._id : null,
            status:    'draft',
            createdAt: new Date(),
            updatedAt: new Date()
        }).save()

        res.status(201).json({ message: 'Session created', data: session })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.update = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only the host tutor or manage+ can update this session')

        const update = { updatedAt: new Date() }
        for (const field of ['status', 'schedule', 'deadlines', 'coTutors', 'copyEditAllowed', 'courseType']) {
            if (req.body[field] !== undefined) update[field] = req.body[field]
        }

        const updated = await Sessions.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
        res.status(200).json({ message: 'Session updated', data: updated })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.overrideRank = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only host tutor or manage+ can grant rank overrides')

        const { tutorId } = req.body
        if (!tutorId) return errorHandler(res, 400, 'tutorId is required')

        if (!isTutorInSession(session, tutorId))
            return errorHandler(res, 400, 'Target user is not a tutor in this session')

        const alreadyOverridden = (session.rankOverrides || []).some(ro => ro.tutorId.toString() === tutorId.toString())
        if (alreadyOverridden) return errorHandler(res, 409, 'This tutor already has a rank override for this session')

        await Sessions.findByIdAndUpdate(req.params.id, {
            $push: { rankOverrides: { tutorId, overriddenBy: requester._id, overriddenAt: new Date() } },
            $set:  { restrictionIgnored: true, restrictionOverrideBy: requester._id, updatedAt: new Date() }
        })

        res.status(200).json({ message: `Rank restriction overridden for tutor ${tutorId}` })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.revokeRankOverride = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only host tutor or manage+ can revoke rank overrides')

        const { tutorId } = req.body
        if (!tutorId) return errorHandler(res, 400, 'tutorId is required')

        await Sessions.findByIdAndUpdate(req.params.id, {
            $pull: { rankOverrides: { tutorId } },
            $set:  { updatedAt: new Date() }
        })

        const updated = await Sessions.findById(req.params.id)
        if ((updated.rankOverrides || []).length === 0) {
            await Sessions.findByIdAndUpdate(req.params.id, {
                $set: { restrictionIgnored: false, restrictionOverrideBy: null }
            })
        }

        res.status(200).json({ message: `Rank override revoked for tutor ${tutorId}` })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.createPrivateCopy = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        const isCoTutor = session.coTutors.some(
            ct => ct.userId.toString() === requester._id.toString() && ct.canEditCopy
        )

        if (!isHost && !isCoTutor && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not authorized to create a private copy for this session')

        if (level === 'tutor' && !utils.checkTutorRank(requester.tutorRank, 'tutor'))
            return errorHandler(res, 403, 'Only tutor/professor sub-rank can create private copies')

        const originalCourse = await Courses.findById(session.courseId)
        if (!originalCourse) return errorHandler(res, 404, 'Original course not found')

        const isOwner = originalCourse.userId.toString() === requester._id.toString()
        if (!isOwner && !session.copyEditAllowed)
            return errorHandler(res, 403, 'You must own this course to create a private copy, or the host must enable copyEditAllowed')

        if (session.privateCopyId)
            return errorHandler(res, 409, 'A private copy already exists for this session')

        const copyData = originalCourse.toObject()
        delete copyData._id
        Object.assign(copyData, {
            isPrivateCopy: true,
            original:      { courseId: originalCourse._id, ownedBy: originalCourse.userId },
            userId:        requester._id,
            status:        'editing',
            comments:      [],
            ratingsList:   [],
            ratings:       0,
            createdAt:     new Date(),
            updatedAt:     new Date()
        })

        const privateCopy = await new Courses(copyData).save()
        const copyResult = fileHandler.copyCourseTutor(originalCourse._id.toString(), requester._id.toString())

        await Sessions.findByIdAndUpdate(req.params.id, {
            $set: { privateCopyId: privateCopy._id, updatedAt: new Date() }
        })

        res.status(201).json({
            message: `Private copy created (${copyResult.copied} file(s) copied)`,
            data: { privateCopyId: privateCopy._id }
        })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.archive = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only host tutor or manage+ can archive this session')

        if (session.status === 'archived')
            return errorHandler(res, 409, 'Session is already archived')

        await Sessions.findByIdAndUpdate(req.params.id, { $set: { status: 'archived', updatedAt: new Date() } })
        res.status(200).json({ message: 'Session archived', data: { _id: session._id } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.remove = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only host tutor or manage+ can delete this session')

        if (session.status !== 'completed')
            return errorHandler(res, 409, `Session must be completed before deletion. Current status: '${session.status}'.`)

        const Groups = require('../models/mongo.groups')
        const Assignments = require('../models/mongo.assignments')

        const groups = await Groups.find({ sessionId: session._id })
        const groupIds = groups.map(g => g._id)

        if (groupIds.length > 0) await Assignments.deleteMany({ groupId: { $in: groupIds } })
        await Groups.deleteMany({ sessionId: session._id })
        await Sessions.deleteOne({ _id: session._id })

        res.status(200).json({ message: 'Session permanently deleted', data: { _id: session._id, groupsDeleted: groups.length } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.getExpandedSchedule = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        if (!isTutorInSession(session, requester._id) && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not authorized')

        const horizon = new Date()
        horizon.setMonth(horizon.getMonth() + 6)

        const expanded = []

        for (const entry of session.schedule) {
            const base = entry.toObject ? entry.toObject() : { ...entry }

            if (!entry.isRecurring) {
                expanded.push({ ...base, occurrenceDate: entry.datetime, isExpanded: false })
                continue
            }

            const { frequency, endDate, maxOccurrences } = entry.recurrence || {}
            const limit = endDate ? new Date(endDate) : horizon
            let cursor = new Date(entry.datetime)
            let count = 0
            const maxCount = maxOccurrences || 52

            while (cursor <= limit && count < maxCount) {
                expanded.push({ ...base, occurrenceDate: new Date(cursor), isExpanded: true })
                count++

                switch (frequency) {
                    case 'daily':     cursor.setDate(cursor.getDate() + 1); break
                    case 'weekly':    cursor.setDate(cursor.getDate() + 7); break
                    case 'biweekly':  cursor.setDate(cursor.getDate() + 14); break
                    case 'monthly':   cursor.setMonth(cursor.getMonth() + 1); break
                    default:          cursor.setDate(cursor.getDate() + 7)
                }
            }
        }

        expanded.sort((a, b) => new Date(a.occurrenceDate) - new Date(b.occurrenceDate))
        res.status(200).json({ data: expanded })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.reassignHost = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (!MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only manage/admin/root can reassign session host')

        const session = await Sessions.findById(req.params.id)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const { newHostId } = req.body
        if (!newHostId) return errorHandler(res, 400, 'newHostId is required')

        const Users = require('../models/mongo.users')
        const newHost = await Users.findById(newHostId)
        if (!newHost) return errorHandler(res, 404, 'New host user not found')

        const newHostLevel = await getAccessLevel(newHost)
        if (!['tutor', 'manage', 'admin', 'root'].includes(newHostLevel))
            return errorHandler(res, 400, 'New host must have at least tutor access level')

        const updated = await Sessions.findByIdAndUpdate(
            req.params.id,
            { $set: { hostTutor: newHostId, updatedAt: new Date() } },
            { new: true }
        ).populate('hostTutor', 'nickname email tutorRank')
            .populate('courseId', 'trans base_lang level direction courseType')

        res.status(200).json({ message: 'Session host reassigned', data: updated })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.prune = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (!MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only manage+ can prune sessions')

        const { olderThanDays = 90, statuses = ['archived', 'completed'] } = req.body
        if (!Array.isArray(statuses) || statuses.some(s => !['archived', 'completed'].includes(s)))
            return errorHandler(res, 400, 'statuses must be array of archived/completed')

        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - parseInt(olderThanDays, 10))

        const Groups = require('../models/mongo.groups')
        const Assignments = require('../models/mongo.assignments')

        const toDelete = await Sessions.find({
            status: { $in: statuses },
            updatedAt: { $lt: cutoff }
        }).select('_id')

        const ids = toDelete.map(s => s._id)
        if (ids.length === 0) return res.status(200).json({ message: 'No sessions matched', deleted: 0 })

        const groups = await Groups.find({ sessionId: { $in: ids } })
        const groupIds = groups.map(g => g._id)
        if (groupIds.length > 0) await Assignments.deleteMany({ groupId: { $in: groupIds } })
        await Groups.deleteMany({ sessionId: { $in: ids } })
        await Sessions.deleteMany({ _id: { $in: ids } })

        res.status(200).json({ message: `Pruned ${ids.length} session(s)`, deleted: ids.length, groupsDeleted: groups.length })
    } catch (e) { errorHandler(res, 500, e) }
}

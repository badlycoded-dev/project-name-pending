const Assignments = require('../models/mongo.assignments')
const Groups = require('../models/mongo.groups')
const Sessions = require('../models/mongo.sessions')
const Courses = require('../models/mongo.courses')
const Roles = require('../models/mongo.roles')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')
const fileHandler = require('../utils/fileHandler')
const path = require('path')
const fs = require('fs')

const MANAGE_LEVELS = ['manage', 'admin', 'root']
const STORAGE_ROOT = path.join(__dirname, '../../storage/data')

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

function computeOverdueDeduction(markScale, custom = null) {
    if (custom !== null && custom !== undefined) return parseFloat(custom)
    return ['12', '100'].includes(markScale) ? 2 : 1
}

function moveUploadedFiles(files, sessionId) {
    return files.map(f => {
        const destDir = path.join(STORAGE_ROOT, 'assignments', sessionId.toString())
        fs.mkdirSync(destDir, { recursive: true })
        const destPath = path.join(destDir, f.filename)
        fs.renameSync(f.path, destPath)
        return {
            url:          `/api/files/assignments/${sessionId}/${f.filename}`,
            filename:     f.filename,
            originalName: f.originalname
        }
    })
}

module.exports.getByGroup = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { groupId } = req.query
        if (!groupId) return errorHandler(res, 400, 'groupId is required')

        const group = await Groups.findById(groupId)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        const isTutor = MANAGE_LEVELS.includes(level) || isTutorInSession(session, requester._id)
        const isMember = group.members.some(m => m.userId.toString() === requester._id.toString())

        if (!isTutor && !isMember) return errorHandler(res, 403, 'Not authorized')

        const assignments = await Assignments.find({ groupId })
            .populate('createdBy', 'nickname')
            .sort({ createdAt: 1 })

        res.status(200).json({ data: assignments })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.create = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (level !== 'tutor' && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Tutor access level required')

        const {
            sessionId, groupId, courseId, title, description,
            dueAt, markScale, maxMark, customOverdueDeduction
        } = req.body

        if (!sessionId || !groupId || !courseId || !title || !dueAt || !markScale || !maxMark)
            return errorHandler(res, 400, 'sessionId, groupId, courseId, title, dueAt, markScale, maxMark are required')

        if (!['5', '12', '100', 'custom'].includes(markScale))
            return errorHandler(res, 400, 'markScale must be 5, 12, 100, or custom')

        const session = await Sessions.findById(sessionId)
        if (!session) return errorHandler(res, 404, 'Session not found')

        if (!isTutorInSession(session, requester._id) && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not a tutor in this session')

        const group = await Groups.findById(groupId)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const customDed = customOverdueDeduction !== undefined && customOverdueDeduction !== ''
            ? parseFloat(customOverdueDeduction) : null

        const assignment = await new Assignments({
            sessionId, groupId, courseId,
            title:       title.trim(),
            description: description || '',
            taskFiles:   moveUploadedFiles(req.files || [], sessionId),
            dueAt:       new Date(dueAt),
            markScale,
            maxMark:     parseFloat(maxMark),
            overdueDeduction:       computeOverdueDeduction(markScale, customDed),
            customOverdueDeduction: customDed,
            createdBy:   requester._id,
            createdAt:   new Date(),
            updatedAt:   new Date()
        }).save()

        await Groups.findByIdAndUpdate(groupId, {
            $push: {
                assignments: {
                    assignmentId:     assignment._id,
                    assignmentNumber: group.assignments.length + 1,
                    submissions:      []
                }
            },
            $set: { updatedAt: new Date() }
        })

        res.status(201).json({ message: 'Assignment created', data: assignment })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.update = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const assignment = await Assignments.findById(req.params.id)
        if (!assignment) return errorHandler(res, 404, 'Assignment not found')

        const session = await Sessions.findById(assignment.sessionId)
        const level = await getAccessLevel(requester)
        if (!isTutorInSession(session, requester._id) && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not authorized')

        const group = await Groups.findById(assignment.groupId)
        const entry = group?.assignments.find(a => a.assignmentId.toString() === assignment._id.toString())
        const hasSubmissions = (entry?.submissions?.length || 0) > 0

        const update = { updatedAt: new Date() }

        for (const field of ['title', 'description', 'dueAt']) {
            if (req.body[field] !== undefined) update[field] = req.body[field]
        }

        // Handle file removals first
        let currentFiles = [...(assignment.taskFiles || [])]
        if (req.body.removeFiles) {
            try {
                const toRemove = JSON.parse(req.body.removeFiles)
                toRemove.forEach(filename => {
                    const filePath = path.join(STORAGE_ROOT, 'assignments', assignment.sessionId.toString(), filename)
                    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
                })
                currentFiles = currentFiles.filter(f => !toRemove.includes(f.filename))
            } catch (e) { /* ignore parse errors */ }
        }

        if ((req.files || []).length > 0) {
            const newFiles = moveUploadedFiles(req.files, assignment.sessionId)
            update.taskFiles = [...currentFiles, ...newFiles]
        } else if (req.body.removeFiles) {
            update.taskFiles = currentFiles
        }

        if (req.body.customOverdueDeduction !== undefined) {
            const customDed = req.body.customOverdueDeduction !== ''
                ? parseFloat(req.body.customOverdueDeduction) : null
            update.customOverdueDeduction = customDed
            if (!hasSubmissions) {
                update.overdueDeduction = computeOverdueDeduction(
                    req.body.markScale || assignment.markScale, customDed
                )
            }
        }

        if (!hasSubmissions) {
            if (req.body.markScale) {
                update.markScale = req.body.markScale
                update.overdueDeduction = computeOverdueDeduction(req.body.markScale)
            }
            if (req.body.maxMark !== undefined) update.maxMark = parseFloat(req.body.maxMark)
        }

        const updated = await Assignments.findByIdAndUpdate(
            req.params.id, { $set: update }, { new: true }
        )

        res.status(200).json({ message: 'Assignment updated', data: updated })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.place = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (level === 'tutor') {
            if (!utils.checkTutorRank(requester.tutorRank, 'tutor'))
                return errorHandler(res, 403, 'Only tutor/professor sub-rank can place assignments in course content')
        } else if (!MANAGE_LEVELS.includes(level)) {
            return errorHandler(res, 403, 'Not authorized')
        }

        const assignment = await Assignments.findById(req.params.id)
        if (!assignment) return errorHandler(res, 404, 'Assignment not found')

        const session = await Sessions.findById(assignment.sessionId)
        if (!isTutorInSession(session, requester._id) && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not a tutor in this session')

        const { type, targetId } = req.body
        if (!type || !targetId) return errorHandler(res, 400, 'type and targetId are required')

        await Assignments.findByIdAndUpdate(req.params.id, {
            $set: { 'placedIn.type': type, 'placedIn.targetId': targetId, updatedAt: new Date() }
        })

        res.status(200).json({ message: 'Assignment placed in course content' })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.remove = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const assignment = await Assignments.findById(req.params.id)
        if (!assignment) return errorHandler(res, 404, 'Assignment not found')

        const session = await Sessions.findById(assignment.sessionId)
        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only the host tutor or manage+ can delete assignments')

        await Groups.findByIdAndUpdate(assignment.groupId, {
            $pull: { assignments: { assignmentId: assignment._id } },
            $set:  { updatedAt: new Date() }
        })

        await Assignments.deleteOne({ _id: assignment._id })
        res.status(200).json({ message: 'Assignment deleted', data: { _id: assignment._id } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.removeTaskFile = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const assignment = await Assignments.findById(req.params.id)
        if (!assignment) return errorHandler(res, 404, 'Assignment not found')

        const session = await Sessions.findById(assignment.sessionId)
        const level = await getAccessLevel(requester)
        if (!isTutorInSession(session, requester._id) && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Not authorized')

        const { filename } = req.params
        const filePath = path.join(STORAGE_ROOT, 'assignments', assignment.sessionId.toString(), filename)
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

        const updated = await Assignments.findByIdAndUpdate(
            req.params.id,
            { $pull: { taskFiles: { filename } }, $set: { updatedAt: new Date() } },
            { new: true }
        )

        res.status(200).json({ message: 'Task file removed', data: updated })
    } catch (e) { errorHandler(res, 500, e) }
}
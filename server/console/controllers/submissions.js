const Groups = require('../models/mongo.groups')
const Assignments = require('../models/mongo.assignments')
const Sessions = require('../models/mongo.sessions')
const Roles = require('../models/mongo.roles')
const fileHandler = require('../utils/fileHandler')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')
const path = require('path')
const fs = require('fs')

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

// Overdue deduction kicks in at 00:00 of the day after the deadline
function isOverdue(dueAt) {
    const sanctionStart = new Date(dueAt)
    sanctionStart.setDate(sanctionStart.getDate() + 1)
    sanctionStart.setHours(0, 0, 0, 0)
    return new Date() >= sanctionStart
}

module.exports.getSubmissions = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { groupId, assignmentId } = req.params

        const group = await Groups.findById(groupId)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        const isTutor = MANAGE_LEVELS.includes(level) || isTutorInSession(session, requester._id)

        const entry = group.assignments.find(a => a.assignmentId.toString() === assignmentId)
        if (!entry) return errorHandler(res, 404, 'Assignment not in this group')

        let submissions = entry.submissions || []

        if (!isTutor) {
            const isMember = group.members.some(m => m.userId.toString() === requester._id.toString())
            if (!isMember) return errorHandler(res, 403, 'Not authorized')
            submissions = submissions.filter(s => s.studentId.toString() === requester._id.toString())
        }

        res.status(200).json({ data: submissions })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.submit = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { groupId, assignmentId } = req.params

        const group = await Groups.findById(groupId)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const isMember = group.members.some(
            m => m.userId.toString() === requester._id.toString() && m.status === 'active'
        )
        if (!isMember) return errorHandler(res, 403, 'You are not an active member of this group')

        const assignment = await Assignments.findById(assignmentId)
        if (!assignment) return errorHandler(res, 404, 'Assignment not found')

        const entry = group.assignments.find(a => a.assignmentId.toString() === assignmentId)
        if (!entry) return errorHandler(res, 404, 'Assignment not in this group')

        const existing = (entry.submissions || []).find(
            s => s.studentId.toString() === requester._id.toString()
        )

        if (existing) {
            const beforeDeadline = new Date() <= assignment.dueAt
            const wasDeclined = existing.status === 'declined'
            if (!beforeDeadline && !wasDeclined)
                return errorHandler(res, 409, 'Re-submission is only allowed before the deadline or if your submission was declined')
        }

        if (!req.file) return errorHandler(res, 400, 'A zip file is required')

        const overdue = isOverdue(assignment.dueAt)
        const { fullPath } = fileHandler.buildSubmissionPath(
            requester._id.toString(),
            groupId,
            group.courseId.toString(),
            entry.assignmentNumber,
            requester.nickname
        )

        fs.renameSync(req.file.path, fullPath)

        const submission = {
            studentId:    requester._id,
            filePath:     fullPath,
            submittedAt:  new Date(),
            isOverdue:    overdue,
            resubmitCount: existing ? (existing.resubmitCount || 0) + 1 : 0,
            status:       'pending',
            mark:         null,
            feedback:     '',
            gradedBy:     null,
            gradedAt:     null
        }

        if (existing) {
            await Groups.findOneAndUpdate(
                { _id: groupId, 'assignments.assignmentId': assignmentId, 'assignments.submissions.studentId': requester._id },
                { $set: { 'assignments.$[a].submissions.$[s]': submission } },
                { arrayFilters: [{ 'a.assignmentId': assignment._id }, { 's.studentId': requester._id }] }
            )
        } else {
            await Groups.findOneAndUpdate(
                { _id: groupId, 'assignments.assignmentId': assignmentId },
                {
                    $push: { 'assignments.$[a].submissions': submission },
                    $set:  { updatedAt: new Date() }
                },
                { arrayFilters: [{ 'a.assignmentId': assignment._id }] }
            )
        }

        res.status(201).json({
            message: overdue ? 'Submitted (overdue — mark may be reduced)' : 'Submitted successfully',
            data: { filePath: fullPath, isOverdue: overdue }
        })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.grade = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { groupId, assignmentId, studentId } = req.params

        const group = await Groups.findById(groupId)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)

        const isHost = session.hostTutor.toString() === requester._id.toString()
        const coEntry = session.coTutors.find(ct => ct.userId.toString() === requester._id.toString())
        const canGrade = isHost || coEntry?.canGrade || MANAGE_LEVELS.includes(level)
        if (!canGrade) return errorHandler(res, 403, 'Not authorized to grade submissions')

        const { mark, feedback, status } = req.body
        if (!['approved', 'declined'].includes(status))
            return errorHandler(res, 400, 'status must be approved or declined')

        const assignment = await Assignments.findById(assignmentId)
        if (!assignment) return errorHandler(res, 404, 'Assignment not found')

        const entry = group.assignments.find(a => a.assignmentId.toString() === assignmentId)
        const submission = entry?.submissions.find(s => s.studentId.toString() === studentId)
        if (!submission) return errorHandler(res, 404, 'Submission not found')

        const effectiveDeduction = assignment.customOverdueDeduction != null
            ? assignment.customOverdueDeduction
            : assignment.overdueDeduction

        let finalMark = parseFloat(mark)
        if (submission.isOverdue && status === 'approved') {
            finalMark = Math.max(0, finalMark - effectiveDeduction)
        }
        finalMark = Math.min(finalMark, assignment.maxMark)

        await Groups.findOneAndUpdate(
            {
                _id: groupId,
                'assignments.assignmentId': assignment._id,
                'assignments.submissions.studentId': submission.studentId
            },
            {
                $set: {
                    'assignments.$[a].submissions.$[s].mark':     finalMark,
                    'assignments.$[a].submissions.$[s].feedback': feedback || '',
                    'assignments.$[a].submissions.$[s].status':   status,
                    'assignments.$[a].submissions.$[s].gradedBy': requester._id,
                    'assignments.$[a].submissions.$[s].gradedAt': new Date()
                }
            },
            { arrayFilters: [{ 'a.assignmentId': assignment._id }, { 's.studentId': submission.studentId }] }
        )

        res.status(200).json({
            message: `Submission ${status}`,
            data: {
                mark:             finalMark,
                overdueDeduction: submission.isOverdue ? effectiveDeduction : 0,
                wasOverdue:       submission.isOverdue
            }
        })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.downloadSubmission = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { groupId, assignmentId, studentId } = req.params

        const group = await Groups.findById(groupId)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)

        const isTutor = MANAGE_LEVELS.includes(level) || isTutorInSession(session, requester._id)
        const isSelf = requester._id.toString() === studentId
        if (!isTutor && !isSelf) return errorHandler(res, 403, 'Not authorized to download this submission')

        const entry = group.assignments.find(a => a.assignmentId.toString() === assignmentId)
        const sub = entry?.submissions.find(s => s.studentId.toString() === studentId)
        if (!sub) return errorHandler(res, 404, 'Submission not found')
        if (!fs.existsSync(sub.filePath)) return errorHandler(res, 404, 'Submission file not found on disk')

        res.download(sub.filePath, path.basename(sub.filePath))
    } catch (e) { errorHandler(res, 500, e) }
}
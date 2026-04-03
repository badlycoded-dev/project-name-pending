const Groups = require('../models/mongo.groups')
const Sessions = require('../models/mongo.sessions')
const Users = require('../models/mongo.users')
const Roles = require('../models/mongo.roles')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')

async function getRequester(req) {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return null
    return utils.parseToken(token)
}

async function getAccessLevel(user) {
    const role = await Roles.findById(user.role)
    return role?.accessLevel || 'default'
}

const MANAGE_LEVELS = ['manage', 'admin', 'root']

function isTutorInSession(session, userId) {
    return (
        session.hostTutor.toString() === userId.toString() ||
        session.coTutors.some(ct => ct.userId.toString() === userId.toString())
    )
}

function canAccessSession(session, requester, level) {
    return MANAGE_LEVELS.includes(level) || isTutorInSession(session, requester._id)
}

module.exports.getBySession = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { sessionId } = req.query
        if (!sessionId) return errorHandler(res, 400, 'sessionId is required')

        const session = await Sessions.findById(sessionId)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        if (!canAccessSession(session, requester, level))
            return errorHandler(res, 403, 'Not authorized')

        const groups = await Groups.find({ sessionId })
            .populate('members.userId', 'nickname email tutorRank')
            .populate('members.addedBy', 'nickname')
            .populate('assignments.assignmentId', 'title dueAt markScale maxMark')
            .sort({ createdAt: -1 })

        res.status(200).json({ data: groups })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.getById = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const group = await Groups.findById(req.params.id)
            .populate('members.userId', 'nickname email')
            .populate('members.addedBy', 'nickname')
            .populate('assignments.assignmentId', 'title description dueAt markScale maxMark overdueDeduction taskFiles')

        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        const isMember = group.members.some(
            m => m.userId._id?.toString() === requester._id.toString()
        )

        if (!canAccessSession(session, requester, level) && !isMember)
            return errorHandler(res, 403, 'Not authorized')

        res.status(200).json({ data: group })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.create = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const { sessionId, name } = req.body
        if (!sessionId || !name) return errorHandler(res, 400, 'sessionId and name are required')

        const session = await Sessions.findById(sessionId)
        if (!session) return errorHandler(res, 404, 'Session not found')

        const level = await getAccessLevel(requester)
        if (!canAccessSession(session, requester, level))
            return errorHandler(res, 403, 'Not authorized')

        const courseId = session.privateCopyId || session.courseId

        const group = await new Groups({
            sessionId,
            courseId,
            name:     name.trim(),
            members:  [],
            assignments: [],
            createdAt: new Date(),
            updatedAt: new Date()
        }).save()

        res.status(201).json({ message: 'Group created', data: group })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.addMember = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const group = await Groups.findById(req.params.id)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        if (!canAccessSession(session, requester, level))
            return errorHandler(res, 403, 'Not authorized')

        const { emailOrNickname } = req.body
        if (!emailOrNickname) return errorHandler(res, 400, 'emailOrNickname is required')

        const student = await Users.findOne({
            $or: [{ email: emailOrNickname }, { nickname: emailOrNickname }]
        })
        if (!student) return errorHandler(res, 404, 'User not found')

        const alreadyMember = group.members.some(m => m.userId.toString() === student._id.toString())
        if (alreadyMember) return errorHandler(res, 409, 'User is already a member of this group')

        if (session.courseType !== 'HOSTED') {
            const ownsCourse = (student.courses || []).some(
                c => c._id.toString() === session.courseId.toString()
            )
            if (!ownsCourse)
                return errorHandler(res, 403, `This is a ${session.courseType} course — student must own it before joining`)
        }

        await Groups.findByIdAndUpdate(req.params.id, {
            $push: { members: { userId: student._id, addedBy: requester._id, status: 'active', joinedAt: new Date() } },
            $set:  { updatedAt: new Date() }
        })

        await Users.findByIdAndUpdate(student._id, { $addToSet: { groups: group._id } })

        res.status(200).json({ message: `${student.nickname} added to group`, data: { userId: student._id, nickname: student.nickname } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.updateMemberStatus = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const group = await Groups.findById(req.params.id)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        if (!canAccessSession(session, requester, level))
            return errorHandler(res, 403, 'Not authorized')

        const { status } = req.body
        if (!['active', 'dropped', 'completed'].includes(status))
            return errorHandler(res, 400, 'status must be active, dropped, or completed')

        await Groups.findOneAndUpdate(
            { _id: req.params.id, 'members.userId': req.params.userId },
            { $set: { 'members.$.status': status, updatedAt: new Date() } }
        )

        res.status(200).json({ message: 'Member status updated' })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.removeMember = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const group = await Groups.findById(req.params.id)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        if (!canAccessSession(session, requester, level))
            return errorHandler(res, 403, 'Not authorized')

        await Groups.findByIdAndUpdate(req.params.id, {
            $pull: { members: { userId: req.params.userId } },
            $set:  { updatedAt: new Date() }
        })

        await Users.findByIdAndUpdate(req.params.userId, { $pull: { groups: group._id } })

        res.status(200).json({ message: 'Member removed from group' })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.remove = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const group = await Groups.findById(req.params.id)
        if (!group) return errorHandler(res, 404, 'Group not found')

        const session = await Sessions.findById(group.sessionId)
        const level = await getAccessLevel(requester)
        const isHost = session.hostTutor.toString() === requester._id.toString()
        if (!isHost && !MANAGE_LEVELS.includes(level))
            return errorHandler(res, 403, 'Only the host tutor or manage+ can delete a group')

        const memberIds = group.members.map(m => m.userId)
        if (memberIds.length > 0) {
            await Users.updateMany({ _id: { $in: memberIds } }, { $pull: { groups: group._id } })
        }

        await Groups.deleteOne({ _id: group._id })
        res.status(200).json({ message: 'Group deleted', data: { _id: group._id } })
    } catch (e) { errorHandler(res, 500, e) }
}
// Get all groups where requester is a member (student view)
module.exports.getMyGroups = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const groups = await Groups.find({ 'members.userId': requester._id })
            .populate('members.userId', 'nickname email')
            .populate('assignments.assignmentId', 'title dueAt markScale maxMark')
            .sort({ createdAt: -1 })

        res.status(200).json({ data: groups })
    } catch (e) { errorHandler(res, 500, e) }
}
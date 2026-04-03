const crypto = require('crypto')
const Keys = require('../models/mongo.keys')
const Users = require('../models/mongo.users')
const Courses = require('../models/mongo.courses')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const segment = () =>
        Array.from({ length: 5 }, () => chars[crypto.randomInt(0, chars.length)]).join('')
    return `${segment()}-${segment()}-${segment()}`
}

async function generateUniqueCode(maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
        const code = generateCode()
        if (!(await Keys.findOne({ code }))) return code
    }
    throw new Error('Could not generate a unique key code, please try again')
}

module.exports.listAll = async (req, res) => {
    try {
        const keys = await Keys.find({})
            .populate('courseIds', 'trans base_lang')
            .populate('createdBy', 'nickname')
            .populate('redeemedBy', 'nickname')
            .sort({ createdAt: -1 })

        const data = keys.map(k => ({
            _id:        k._id,
            code:       k.code,
            note:       k.note,
            courses:    k.courseIds.map(c => ({ _id: c._id, title: c.trans?.[0]?.title || '(untitled)' })),
            createdBy:  k.createdBy?.nickname || 'unknown',
            redeemedBy: k.redeemedBy?.nickname || null,
            redeemedAt: k.redeemedAt,
            expiresAt:  k.expiresAt,
            createdAt:  k.createdAt,
            isRedeemed: k.redeemedBy != null,
            isExpired:  k.expiresAt != null && new Date() > k.expiresAt
        }))

        res.status(200).json({ data })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.generate = async (req, res) => {
    try {
        const requester = await utils.parseToken(req.headers.authorization.split(' ')[1])
        if (!requester) return errorHandler(res, 401, 'Invalid token')

        const { courseIds, amount = 1, note = '', expiresAt } = req.body

        if (!Array.isArray(courseIds) || courseIds.length === 0)
            return errorHandler(res, 400, 'courseIds must be a non-empty array')

        const qty = Math.min(Math.max(parseInt(amount, 10) || 1, 1), 100)

        const foundCourses = await Courses.find({ _id: { $in: courseIds } })
        if (foundCourses.length !== courseIds.length)
            return errorHandler(res, 404, 'One or more course IDs not found')

        const expiry = expiresAt ? new Date(expiresAt) : null
        if (expiry && isNaN(expiry.getTime()))
            return errorHandler(res, 400, 'Invalid expiresAt date')

        const created = []
        for (let i = 0; i < qty; i++) {
            const code = await generateUniqueCode()
            const key = await new Keys({
                code,
                courseIds,
                createdBy: requester._id,
                note:      note.trim(),
                expiresAt: expiry
            }).save()
            created.push({ _id: key._id, code: key.code })
        }

        res.status(201).json({ message: `${qty} key(s) generated`, data: created })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.deleteKey = async (req, res) => {
    try {
        const key = await Keys.findById(req.params.id)
        if (!key) return errorHandler(res, 404, 'Key not found')
        if (key.redeemedBy) return errorHandler(res, 409, 'Cannot delete a redeemed key')

        await Keys.deleteOne({ _id: key._id })
        res.status(200).json({ message: 'Key deleted', data: { _id: key._id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.redeem = async (req, res) => {
    try {
        const requester = await utils.parseToken(req.headers.authorization.split(' ')[1])
        if (!requester) return errorHandler(res, 401, 'Invalid token')

        const code = (req.body.code || '').trim().toUpperCase()
        if (!code) return errorHandler(res, 400, 'Code is required')

        const key = await Keys.findOne({ code }).populate('courseIds', 'trans base_lang links')
        if (!key) return errorHandler(res, 404, 'Key not found')
        if (key.redeemedBy) return errorHandler(res, 409, 'This key has already been redeemed')
        if (key.expiresAt && new Date() > key.expiresAt)
            return errorHandler(res, 410, 'This key has expired')

        const user = await Users.findById(requester._id)
        if (!user) return errorHandler(res, 404, 'User not found')

        const alreadyOwned = new Set((user.courses || []).map(c => c._id.toString()))
        const newEntries = key.courseIds
            .filter(c => !alreadyOwned.has(c._id.toString()))
            .map(c => ({ _id: c._id, process: 0 }))

        await Users.findByIdAndUpdate(user._id, { $push: { courses: { $each: newEntries } } })
        await Keys.findByIdAndUpdate(key._id, { $set: { redeemedBy: user._id, redeemedAt: new Date() } })

        const unlockedCourses = key.courseIds.map(c => ({
            _id:       c._id,
            title:     c.trans?.[0]?.title || '(untitled)',
            thumbnail: c.links?.find(l => l.description?.toLowerCase() === 'course thumbnail')?.url || null
        }))

        res.status(200).json({
            message: `Key redeemed — ${unlockedCourses.length} course(s) added to your library`,
            data: {
                alreadyOwned:  key.courseIds.length - newEntries.length,
                newlyUnlocked: newEntries.length,
                courses:       unlockedCourses
            }
        })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getMyKeys = async (req, res) => {
    try {
        const requester = await utils.parseToken(req.headers.authorization.split(' ')[1])
        if (!requester) return errorHandler(res, 401, 'Invalid token')

        const keys = await Keys.find({ redeemedBy: requester._id })
            .populate('courseIds', 'trans base_lang')
            .sort({ redeemedAt: -1 })

        const data = keys.map(k => ({
            _id:        k._id,
            code:       k.code,
            courses:    k.courseIds.map(c => ({ _id: c._id, title: c.trans?.[0]?.title || '(untitled)' })),
            redeemedAt: k.redeemedAt
        }))

        res.status(200).json({ data })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
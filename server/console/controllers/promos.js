const Promos = require('../models/mongo.promos')
const Courses = require('../models/mongo.courses')
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
    if (!user) return 'default'
    const role = await Roles.findById(user.role)
    return role?.accessLevel || 'default'
}

const CAN_CREATE = ['create', 'quality', 'manage', 'admin', 'root']
const CAN_MANAGE = ['manage', 'admin', 'root']

module.exports.listAll = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (!CAN_CREATE.includes(level)) return errorHandler(res, 403, 'Insufficient permissions')

        const filter = CAN_MANAGE.includes(level) ? {} : { createdBy: requester._id }

        const promos = await Promos.find(filter)
            .populate('courseIds', 'trans base_lang')
            .populate('createdBy', 'nickname')
            .sort({ createdAt: -1 })

        const data = promos.map(p => ({
            _id:          p._id,
            code:         p.code,
            note:         p.note,
            discountType: p.discountType,
            discountValue: p.discountValue,
            courses:      p.courseIds.map(c => ({ _id: c._id, title: c.trans?.[0]?.title || '(untitled)' })),
            createdBy:    p.createdBy?.nickname || 'unknown',
            maxUses:      p.maxUses,
            usedCount:    p.usedCount,
            expiresAt:    p.expiresAt,
            active:       p.active,
            createdAt:    p.createdAt,
            isExpired:    p.expiresAt && new Date() > p.expiresAt,
            isExhausted:  p.maxUses !== null && p.usedCount >= p.maxUses
        }))

        res.status(200).json({ data })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.create = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const level = await getAccessLevel(requester)
        if (!CAN_CREATE.includes(level))
            return errorHandler(res, 403, 'Insufficient permissions')

        const { code, courseIds, discountType, discountValue, maxUses, expiresAt, note } = req.body

        if (!code?.trim()) return errorHandler(res, 400, 'Code is required')
        if (!['percent', 'flat'].includes(discountType))
            return errorHandler(res, 400, 'discountType must be "percent" or "flat"')

        const dv = parseFloat(discountValue)
        if (isNaN(dv) || dv <= 0) return errorHandler(res, 400, 'discountValue must be a positive number')
        if (discountType === 'percent' && dv > 100)
            return errorHandler(res, 400, 'Percent discount cannot exceed 100')

        const ids = Array.isArray(courseIds) ? courseIds : []
        if (ids.length > 0) {
            const found = await Courses.find({ _id: { $in: ids } })
            if (found.length !== ids.length)
                return errorHandler(res, 404, 'One or more course IDs not found')

            if (!CAN_MANAGE.includes(level)) {
                const notOwned = found.filter(c => c.userId.toString() !== requester._id.toString())
                if (notOwned.length > 0)
                    return errorHandler(res, 403, 'You can only create promos for your own courses')
            }
        }

        const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '')
        if (await Promos.findOne({ code: cleanCode }))
            return errorHandler(res, 409, `Code "${cleanCode}" is already taken`)

        const expiry = expiresAt ? new Date(expiresAt) : null
        if (expiry && isNaN(expiry.getTime())) return errorHandler(res, 400, 'Invalid expiresAt date')

        const promo = await new Promos({
            code:          cleanCode,
            createdBy:     requester._id,
            courseIds:     ids,
            discountType,
            discountValue: dv,
            maxUses:       maxUses ? parseInt(maxUses) : null,
            expiresAt:     expiry,
            note:          note?.trim() || ''
        }).save()

        res.status(201).json({ message: 'Promo created', data: { _id: promo._id, code: promo.code } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.toggle = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const promo = await Promos.findById(req.params.id)
        if (!promo) return errorHandler(res, 404, 'Promo not found')

        const level = await getAccessLevel(requester)
        const isOwner = promo.createdBy.toString() === requester._id.toString()
        if (!isOwner && !CAN_MANAGE.includes(level))
            return errorHandler(res, 403, 'Not authorized')

        promo.active = !promo.active
        await promo.save()

        res.status(200).json({ message: `Promo ${promo.active ? 'enabled' : 'disabled'}`, data: { active: promo.active } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.deletePromo = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const promo = await Promos.findById(req.params.id)
        if (!promo) return errorHandler(res, 404, 'Promo not found')

        const level = await getAccessLevel(requester)
        const isOwner = promo.createdBy.toString() === requester._id.toString()
        if (!isOwner && !CAN_MANAGE.includes(level))
            return errorHandler(res, 403, 'Not authorized')

        await Promos.deleteOne({ _id: promo._id })
        res.status(200).json({ message: 'Promo deleted', data: { _id: promo._id } })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.validate = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const code = (req.body.code || '').trim().toUpperCase()
        const { courseId } = req.body

        if (!code)     return errorHandler(res, 400, 'Code is required')
        if (!courseId) return errorHandler(res, 400, 'courseId is required')

        const course = await Courses.findById(courseId)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const promo = await Promos.findOne({ code })
        if (!promo)         return res.status(200).json({ valid: false, reason: 'Code not found' })
        if (!promo.active)  return res.status(200).json({ valid: false, reason: 'This promo is inactive' })
        if (promo.expiresAt && new Date() > promo.expiresAt)
            return res.status(200).json({ valid: false, reason: 'This promo has expired' })
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses)
            return res.status(200).json({ valid: false, reason: 'This promo has reached its usage limit' })

        const appliesToCourse = promo.courseIds.length === 0 ||
            promo.courseIds.some(id => id.toString() === courseId)

        if (!appliesToCourse)
            return res.status(200).json({ valid: false, reason: 'This promo does not apply to this course' })

        const alreadyUsed = promo.usages.some(
            u => u.userId.toString() === requester._id.toString() && u.courseId.toString() === courseId
        )
        if (alreadyUsed)
            return res.status(200).json({ valid: false, reason: 'You have already used this promo for this course' })

        const price = course.price || 0
        const discount = promo.discountType === 'percent'
            ? parseFloat((price * promo.discountValue / 100).toFixed(2))
            : Math.min(promo.discountValue, price)
        const finalPrice = Math.max(0, parseFloat((price - discount).toFixed(2)))

        res.status(200).json({
            valid: true,
            code:  promo.code,
            discountType:  promo.discountType,
            discountValue: promo.discountValue,
            originalPrice: price,
            discount,
            finalPrice
        })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.apply = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const code = (req.body.code || '').trim().toUpperCase()
        const { courseId } = req.body
        if (!code || !courseId) return errorHandler(res, 400, 'code and courseId are required')

        const course = await Courses.findById(courseId)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const promo = await Promos.findOne({ code })
        if (!promo || !promo.active) return errorHandler(res, 400, 'Invalid promo code')
        if (promo.expiresAt && new Date() > promo.expiresAt) return errorHandler(res, 410, 'Promo expired')
        if (promo.maxUses !== null && promo.usedCount >= promo.maxUses)
            return errorHandler(res, 409, 'Promo usage limit reached')

        const appliesToCourse = promo.courseIds.length === 0 ||
            promo.courseIds.some(id => id.toString() === courseId)
        const courseByCreator = course.userId.toString() === promo.createdBy.toString()
        if (!appliesToCourse || !courseByCreator)
            return errorHandler(res, 400, 'Promo does not apply to this course')

        const alreadyUsed = promo.usages.some(
            u => u.userId.toString() === requester._id.toString() && u.courseId.toString() === courseId
        )
        if (alreadyUsed) return errorHandler(res, 409, 'You have already used this promo for this course')

        const user = await Users.findById(requester._id)
        const alreadyOwns = (user.courses || []).some(c => c._id.toString() === courseId)
        if (!alreadyOwns) {
            await Users.findByIdAndUpdate(user._id, { $push: { courses: { _id: courseId, process: 0 } } })
        }

        await Promos.findByIdAndUpdate(promo._id, {
            $push: { usages: { userId: requester._id, courseId, usedAt: new Date() } },
            $inc:  { usedCount: 1 }
        })

        const price = course.price || 0
        const discount = promo.discountType === 'percent'
            ? parseFloat((price * promo.discountValue / 100).toFixed(2))
            : Math.min(promo.discountValue, price)
        const finalPrice = Math.max(0, parseFloat((price - discount).toFixed(2)))

        res.status(200).json({
            message: 'Promo applied — course added to your library',
            data: {
                courseId,
                courseTitle:   course.trans?.[0]?.title || '(untitled)',
                originalPrice: price,
                discount,
                finalPrice,
                alreadyOwned:  alreadyOwns
            }
        })
    } catch (e) { errorHandler(res, 500, e) }
}
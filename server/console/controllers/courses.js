const Courses = require('../models/mongo.courses')
const Users = require('../models/mongo.users')
const Roles = require('../models/mongo.roles')
const utils = require('../utils/utils')
const fileHandler = require('../utils/fileHandler')
const linkFilter = require('../utils/linkFilter')
const errorHandler = require('../utils/errorHandler')

async function getAccessLevel(req) {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return 'default'
    try {
        const requester = await utils.parseToken(token)
        if (!requester?.role) return 'default'
        const role = await Roles.findById(requester.role)
        return role?.accessLevel || 'default'
    } catch (_) {
        return 'default'
    }
}

async function getRequester(req) {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return null
    return utils.parseToken(token)
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

module.exports.getAll = async (req, res) => {
    try {
        const level = await getAccessLevel(req)
        const courses = await Courses.find({})
        res.status(200).json({ data: linkFilter.filterCoursesData(courses, level) })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getById = async (req, res) => {
    try {
        const level = await getAccessLevel(req)
        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')
        res.status(200).json({ data: linkFilter.filterCourseData(course, level) })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.create = async (req, res) => {
    try {
        const base_lang = req.body.base_lang || 'en'
        const add_langs = Array.isArray(req.body.add_langs) ? req.body.add_langs : []

        let trans
        if (Array.isArray(req.body.trans) && req.body.trans.length > 0) {
            trans = req.body.trans.map((t, i) => ({
                title:       t.title || '',
                description: t.description || '',
                skills:      Array.isArray(t.skills) ? t.skills : [],
                ...(i > 0 && Array.isArray(t.volumes) ? { volumes: t.volumes } : {})
            }))
        } else {
            const baseTitle = req.body.title || ''
            const defaultSkills = baseTitle
                ? [`Master the core concepts of ${baseTitle.toLowerCase()}`, 'Learn and build real-world projects']
                : []
            trans = [{ title: baseTitle, description: req.body.description || '', skills: [...defaultSkills, ...(Array.isArray(req.body.skills) ? req.body.skills : [])] }]
            add_langs.forEach(() => trans.push({ title: '', description: '', skills: [] }))
        }

        const course = await new Courses({
            userId:    req.body.userId,
            base_lang,
            add_langs,
            trans,
            price:     req.body.price || 0,
            ratings:   req.body.ratings || 0,
            followers: 0,
            level:     req.body.level,
            direction: req.body.direction,
            volumes:   [],
            links:     [],
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).save()

        res.status(201).json({ message: 'Course created successfully', data: course })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.update = async (req, res) => {
    try {
        const course = await Courses.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    userId:     req.body.userId,
                    status:     req.body.status,
                    courseType: req.body.courseType,
                    direction:  req.body.direction,
                    level:      req.body.level,
                    base_lang:  req.body.base_lang,
                    add_langs:  Array.isArray(req.body.add_langs) ? req.body.add_langs : [],
                    trans:      Array.isArray(req.body.trans)
                        ? req.body.trans.map((t, i) => ({
                            title:       t.title || '',
                            description: t.description || '',
                            skills:      Array.isArray(t.skills) ? t.skills : [],
                            // Base lang (idx 0) volumes live at top-level; non-base langs store their own
                            ...(i > 0 && Array.isArray(t.volumes) ? { volumes: t.volumes } : {})
                          }))
                        : [],
                    ratings:   req.body.ratings,
                    followers: req.body.followers,
                    price:     req.body.price,
                    volumes:   req.body.volumes,
                    links:     req.body.links,
                    updatedAt: Date.now()
                }
            },
            { new: true }
        )
        res.status(200).json({ message: 'Course updated successfully', data: course })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.remove = async (req, res) => {
    try {
        fileHandler.deleteCourseDirectory(req.params.id)
        await Courses.deleteOne({ _id: req.params.id })
        res.status(200).json({ message: 'Course deleted successfully', data: { _id: req.params.id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

// ── Files ─────────────────────────────────────────────────────────────────────

module.exports.listCourseFiles = (req, res) => fileHandler.listCourseFiles(req, res)
module.exports.getCourseFile   = (req, res) => fileHandler.sendCourseFile(req, res)

module.exports.uploadCourseFile = [
    fileHandler.uploadCourseFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

            const course = await Courses.findById(req.params.id)
            if (!course) {
                fileHandler.deleteCourseFile(req.params.id, req.file.filename)
                return res.status(404).json({ message: 'Course not found' })
            }

            const isThumbnail = req.query.thumbnail === 'true' || req.body.isThumbnail === 'true'
            let linkObject

            if (isThumbnail) {
                const renamed = fileHandler.renameThumbnail(req.params.id, req.file.filename)
                if (!renamed) {
                    fileHandler.deleteCourseFile(req.params.id, req.file.filename)
                    return res.status(500).json({ message: 'Failed to process thumbnail' })
                }
                linkObject = fileHandler.buildThumbnailLink(req.params.id)
                const otherLinks = (course.links || []).filter(
                    l => !(l.type === 'image' && l.description?.toLowerCase() === 'course thumbnail')
                )
                await Courses.findByIdAndUpdate(req.params.id, { $set: { links: [linkObject, ...otherLinks] } })
            } else {
                linkObject = {
                    type:        fileHandler.getFileType(req.file.mimetype),
                    url:         `/api/manage/courses/${req.params.id}/files/${req.file.filename}`,
                    filename:    req.file.filename,
                    accessLevel: 'default',
                    description: req.file.originalname
                }
                await Courses.findByIdAndUpdate(req.params.id, {
                    $set: { links: [...(course.links || []), linkObject] }
                })
            }

            res.status(200).json({ message: 'File uploaded successfully', data: { courseId: course._id, filename: req.file.filename, link: linkObject } })
        } catch (e) {
            if (req.file) fileHandler.deleteCourseFile(req.params.id, req.file.filename)
            errorHandler(res, 500, e)
        }
    },
    fileHandler.handleUploadError
]

module.exports.uploadCourseFiles = [
    fileHandler.uploadCourseFiles,
    async (req, res) => {
        try {
            if (!req.files?.length) return res.status(400).json({ message: 'No files uploaded' })

            const course = await Courses.findById(req.params.id)
            if (!course) {
                req.files.forEach(f => fileHandler.deleteCourseFile(req.params.id, f.filename))
                return res.status(404).json({ message: 'Course not found' })
            }

            const fileLinks = req.files.map(f => ({
                type:        fileHandler.getFileType(f.mimetype),
                url:         `/api/manage/courses/${req.params.id}/files/${f.filename}`,
                filename:    f.filename,
                accessLevel: 'default',
                description: f.originalname,
                lang:        req.query.lang || req.body.lang || null
            }))

            const newLinks = [...(course.links || []), ...fileLinks]
            await Courses.findByIdAndUpdate(req.params.id, { $set: { links: newLinks } })

            res.status(200).json({
                message: `${req.files.length} files uploaded successfully`,
                data: { courseId: course._id, files: req.files.map(f => ({ filename: f.filename, originalName: f.originalname, size: f.size })), links: newLinks }
            })
        } catch (e) {
            if (req.files) req.files.forEach(f => fileHandler.deleteCourseFile(req.params.id, f.filename))
            errorHandler(res, 500, e)
        }
    },
    fileHandler.handleUploadError
]

module.exports.updateCourseFile = [
    fileHandler.uploadCourseFile,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

            const course = await Courses.findById(req.params.id)
            if (!course) {
                fileHandler.deleteCourseFile(req.params.id, req.file.filename)
                return res.status(404).json({ message: 'Course not found' })
            }

            const oldFilename = req.params.filename
            if (oldFilename && oldFilename !== req.file.filename) {
                fileHandler.deleteCourseFile(req.params.id, oldFilename)
            }

            res.status(200).json({
                message: 'File updated successfully',
                data: { courseId: course._id, oldFilename, newFilename: req.file.filename, originalName: req.file.originalname, size: req.file.size }
            })
        } catch (e) {
            if (req.file) fileHandler.deleteCourseFile(req.params.id, req.file.filename)
            errorHandler(res, 500, e)
        }
    },
    fileHandler.handleUploadError
]

module.exports.deleteCourseFile = async (req, res) => {
    try {
        const course = await Courses.findById(req.params.id)
        if (!course) return res.status(404).json({ message: 'Course not found' })

        const { filename } = req.params
        const deleted = fileHandler.deleteCourseFile(req.params.id, filename)
        if (!deleted) return res.status(404).json({ message: 'File not found' })

        const updatedLinks = (course.links || []).filter(l => {
            if (typeof l === 'string') return !l.includes(filename)
            return l?.filename !== filename
        })
        await Courses.findByIdAndUpdate(req.params.id, { $set: { links: updatedLinks } })

        res.status(200).json({ message: 'File deleted successfully', data: { courseId: course._id, filename } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.deleteAllCourseFiles = async (req, res) => {
    try {
        const course = await Courses.findById(req.params.id)
        if (!course) return res.status(404).json({ message: 'Course not found' })

        const deleted = fileHandler.deleteCourseDirectory(req.params.id)
        if (!deleted) return res.status(404).json({ message: 'No files found to delete' })

        await Courses.findByIdAndUpdate(req.params.id, { $set: { links: [] } })
        res.status(200).json({ message: 'All course files deleted successfully', data: { courseId: course._id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

// ── Ratings ───────────────────────────────────────────────────────────────────

module.exports.getMyRating = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const entry = (course.ratingsList || []).find(r => r.userId.toString() === requester._id.toString())

        res.status(200).json({
            data: {
                courseId:   course._id,
                avgRating:  course.ratings || 0,
                totalVotes: (course.ratingsList || []).length,
                myRating:   entry ? entry.value : null
            }
        })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.rateById = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const value = parseInt(req.body.value, 10)
        if (isNaN(value) || value < 1 || value > 5)
            return errorHandler(res, 400, 'Rating must be an integer between 1 and 5')

        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const user = await Users.findById(requester._id)
        if (!user) return errorHandler(res, 404, 'User not found')

        const ownsCourse = (user.courses || []).some(c => c._id?.toString() === course._id.toString())
        if (!ownsCourse) return errorHandler(res, 403, 'You must own this course to rate it')

        const ratingsList = course.ratingsList || []
        const existingIdx = ratingsList.findIndex(r => r.userId.toString() === requester._id.toString())

        if (existingIdx >= 0) {
            ratingsList[existingIdx].value = value
            ratingsList[existingIdx].createdAt = new Date()
        } else {
            ratingsList.push({ userId: requester._id, value, createdAt: new Date() })
        }

        const avgRating = parseFloat(
            (ratingsList.reduce((sum, r) => sum + r.value, 0) / ratingsList.length).toFixed(2)
        )

        await Courses.findByIdAndUpdate(course._id, { $set: { ratingsList, ratings: avgRating } })

        res.status(200).json({
            message: existingIdx >= 0 ? 'Rating updated' : 'Rating submitted',
            data: { courseId: course._id, myRating: value, avgRating, totalVotes: ratingsList.length }
        })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

// ── Comments ──────────────────────────────────────────────────────────────────

module.exports.getComments = async (req, res) => {
    try {
        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const comments = course.comments || []
        const uniqueIds = [...new Set(comments.map(c => c.userId.toString()))]
        const users = await Users.find({ _id: { $in: uniqueIds } }).select('_id nickname')
        const nicknames = Object.fromEntries(users.map(u => [u._id.toString(), u.nickname]))

        const data = comments.map(c => ({
            _id:      c._id,
            userId:   c.userId,
            nickname: nicknames[c.userId.toString()] || 'Unknown user',
            date:     c.date,
            text:     c.text
        }))

        res.status(200).json({ data })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.addComment = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const text = (req.body.text || '').trim()
        if (!text) return errorHandler(res, 400, 'Comment text is required')
        if (text.length > 4000) return errorHandler(res, 400, 'Comment must be 4000 characters or fewer')

        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const isCreator = course.userId.toString() === requester._id.toString()
        const ownsCourse = (requester.courses || []).some(c => c._id?.toString() === course._id.toString())
        if (!isCreator && !ownsCourse)
            return errorHandler(res, 403, 'You must own this course to post a comment')

        const updated = await Courses.findByIdAndUpdate(
            course._id,
            { $push: { comments: { userId: requester._id, date: new Date(), text } } },
            { new: true }
        )

        const newComment = updated.comments[updated.comments.length - 1]
        res.status(201).json({
            message: 'Comment added',
            data: { _id: newComment._id, userId: newComment.userId, nickname: requester.nickname, date: newComment.date, text: newComment.text }
        })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.deleteComment = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')

        const comment = (course.comments || []).find(c => c._id.toString() === req.params.commentId)
        if (!comment) return errorHandler(res, 404, 'Comment not found')

        const isAuthor = comment.userId.toString() === requester._id.toString()
        if (!isAuthor) {
            const role = await Roles.findById(requester.role)
            const canManage = ['manage', 'admin', 'root'].includes(role?.accessLevel)
            if (!canManage) return errorHandler(res, 403, 'You can only delete your own comments')
        }

        await Courses.findByIdAndUpdate(course._id, { $pull: { comments: { _id: comment._id } } })
        res.status(200).json({ message: 'Comment deleted', data: { _id: comment._id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
// ── Purchase ──────────────────────────────────────────────────────────────────

module.exports.purchase = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')

        const course = await Courses.findById(req.params.id)
        if (!course) return errorHandler(res, 404, 'Course not found')

        if (course.courseType === 'HOSTED')
            return errorHandler(res, 400, 'HOSTED courses do not require purchase')

        const alreadyOwns = (requester.courses || []).some(
            c => c._id?.toString() === course._id.toString()
        )
        if (alreadyOwns)
            return res.status(200).json({ message: 'Already owned', data: { courseId: course._id } })

        // Apply promo if provided (reuse validate logic, but don't mark used here — apply does that)
        const { promoCode } = req.body
        let finalPrice = course.price || 0

        if (promoCode) {
            const Promos = require('../models/mongo.promos')
            const promo = await Promos.findOne({ code: promoCode.trim().toUpperCase() })
            if (promo && promo.active) {
                const appliesToCourse = promo.courseIds.length === 0 ||
                    promo.courseIds.some(id => id.toString() === course._id.toString())
                if (appliesToCourse) {
                    const discount = promo.discountType === 'percent'
                        ? parseFloat((finalPrice * promo.discountValue / 100).toFixed(2))
                        : Math.min(promo.discountValue, finalPrice)
                    finalPrice = Math.max(0, parseFloat((finalPrice - discount).toFixed(2)))
                    // Mark promo used
                    await Promos.findByIdAndUpdate(promo._id, {
                        $inc: { usedCount: 1 },
                        $push: { usages: { userId: requester._id, courseId: course._id, usedAt: new Date() } }
                    })
                }
            }
        }

        // Add course to user's library
        await Users.findByIdAndUpdate(requester._id, {
            $push: { courses: { _id: course._id, process: 0 } }
        })

        // Increment followers count
        await Courses.findByIdAndUpdate(course._id, {
            $inc: { followers: 1 }
        })

        res.status(200).json({
            message: 'Course purchased successfully',
            data: { courseId: course._id, finalPrice }
        })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
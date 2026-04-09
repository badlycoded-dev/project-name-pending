const Users = require('../models/mongo.users')
const Roles = require('../models/mongo.roles')
const utils = require('../utils/utils')
const fileHandler = require('../utils/fileHandler')
const linkFilter = require('../utils/linkFilter')
const errorHandler = require('../utils/errorHandler')
const mdl = require('../utils/module')
const config = require('../config/config')

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

module.exports.getCurrent = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]
        const data = await utils.parseToken(token)
        const user = await Users.findById(data._id).populate('role')
        const level = linkFilter.getUserAccessLevel(user)
        res.json({ user: linkFilter.filterUserData(user, level) })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getAll = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        let level = 'default'
        let requesterId = null
        let isRoot = false

        if (token) {
            try {
                const requester = await utils.parseToken(token)
                if (requester) {
                    requesterId = requester._id?.toString()
                    const role = requester.role ? await Roles.findById(requester.role) : null
                    if (role) {
                        level = role.accessLevel || 'default'
                        isRoot = level === 'root' || role.roleName === 'root'
                    }
                }
            } catch (_) {}
        }

        const query = {}
        const { search, tutorOnly } = req.query
        if (search?.trim()) {
            query.$or = [
                { nickname: { $regex: search.trim(), $options: 'i' } },
                { email:    { $regex: search.trim(), $options: 'i' } }
            ]
        }
        if (tutorOnly === 'true') {
            query.tutorRank = { $ne: null, $exists: true }
        }

        const users = await Users.find(query).populate('role')

        const filtered = linkFilter.filterUsersData(users, level).filter(u => {
            const userId = u._id?.toString()
            if (isRoot && requesterId && userId === requesterId) return true
            const role = u.role
            if (role && typeof role === 'object') {
                if (role.accessLevel === 'root' || role.roleName === 'root') return false
            }
            if (u.nickname === 'root') return false
            return true
        })

        res.status(200).json({ data: filtered })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getById = async (req, res) => {
    try {
        const level = await getAccessLevel(req)
        const user = await Users.findById(req.params.id)
        if (!user) return errorHandler(res, 404, 'User not found')

        const filtered = linkFilter.filterUserData(user, level)

        let plainPassword = null
        if (filtered.passwordEnc) {
            try {
                plainPassword = mdl.parse(filtered.passwordEnc)
            } catch (e) {
                // passwordEnc was encrypted with a different SECRET (e.g. after re-deploy)
                // Don't crash — return a sentinel so the UI knows to prompt a password reset
                plainPassword = null
            }
        }

        filtered.password = plainPassword
            ? utils.createToken(plainPassword, config.JWT_SECRET, { expiresIn: 60 * 5 }, false)
            : '*PASSWORD MUST BE RESET — encrypted with a different secret*'

        res.status(200).json({ data: filtered })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.create = async (req, res) => {
    try {
        const password = await utils.generatePasswordHash(req.body.password)

        const user = await new Users({
            email:        req.body.email,
            passwordHash: password.hash,
            passwordEnc:  mdl.use(req.body.password),
            nickname:     req.body.nickname || req.body.email.split('@')[0],
            login:        req.body.login || req.body.email,
            role:         req.body.role,
            links:        []
        }).save()

        res.status(201).json({
            message: 'User created successfully',
            login: { email: req.body.email, password: password.password },
            data: user
        })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.update = async (req, res) => {
    try {
        const update = {
            nickname:  req.body.nickname,
            firstName: req.body.firstName,
            lastName:  req.body.lastName,
            login:     req.body.login || req.body.email,
            role:      req.body.role,
            email:     req.body.email,
            phone:     req.body.phone,
            github:    req.body.github,
            tutorRank: req.body.tutorRank,
            courses:   req.body.courses,
            updatedAt: Date.now()
        }

        if (req.body.password) {
            const hashed = await utils.generatePasswordHash(req.body.password)
            update.passwordHash = hashed.hash
            update.passwordEnc  = mdl.use(req.body.password)
        }

        const user = await Users.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
        res.status(200).json({ message: 'User updated successfully', data: user })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.remove = async (req, res) => {
    try {
        fileHandler.deleteUserDirectory(req.params.id)
        await Users.deleteOne({ _id: req.params.id })
        res.status(200).json({ message: 'User deleted successfully', data: { _id: req.params.id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.finishCourse = async (req, res) => {
    try {
        const decoded = await utils.parseToken(req.headers.authorization.split(' ')[1])
        const user = await Users.findById(decoded._id)
        if (!user) return errorHandler(res, 404, 'User not found')

        const { courseId } = req.params
        const existing = user.courses?.find(c => c._id?.toString() === courseId)
        if (existing) {
            existing.process = 1
        } else {
            user.courses.push({ _id: courseId, process: 1 })
        }

        user.updatedAt = new Date()
        await user.save()
        res.status(200).json({ message: 'Course marked as finished', data: { process: 1 } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.updateCourseProgress = async (req, res) => {
    try {
        const decoded = await utils.parseToken(req.headers.authorization.split(' ')[1])
        const user = await Users.findById(decoded._id)
        if (!user) return errorHandler(res, 404, 'User not found')

        const { courseId } = req.params
        let { process } = req.body
        process = parseFloat(process)
        if (isNaN(process) || process < 0 || process > 1)
            return errorHandler(res, 400, 'process must be a number between 0 and 1')

        const existing = user.courses?.find(c => c._id?.toString() === courseId)
        if (existing) {
            // Never decrease progress below current value
            if (process > existing.process) existing.process = process
        } else {
            user.courses.push({ _id: courseId, process })
        }

        user.updatedAt = new Date()
        await user.save()
        const saved = user.courses.find(c => c._id?.toString() === courseId)
        res.status(200).json({ message: 'Progress updated', data: { process: saved?.process } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

// ── Profile picture ───────────────────────────────────────────────────────────

module.exports.getProfilePicture = (req, res) => fileHandler.sendUserProfilePicture(req, res)

function filterProfileLinks(links) {
    return (links || []).filter(l => {
        if (l.type !== 'image') return true
        return l.description?.toLowerCase() !== 'profile picture'
    })
}

module.exports.uploadProfilePicture = [
    fileHandler.uploadProfilePicture,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

            const user = await Users.findById(req.params.id)
            if (!user) {
                fileHandler.deleteUserProfilePicture(req.params.id)
                return res.status(404).json({ message: 'User not found' })
            }

            const renamed = fileHandler.renameProfilePicture(req.params.id, req.file.filename)
            if (!renamed) return res.status(500).json({ message: 'Failed to process profile picture' })

            const profileLink = fileHandler.buildProfilePictureLink(req.params.id)
            await Users.findByIdAndUpdate(req.params.id, {
                $set: { links: [profileLink, ...filterProfileLinks(user.links)] }
            })

            res.status(200).json({ message: 'Profile picture uploaded successfully', data: { userId: user._id, filename: renamed.filename, link: profileLink } })
        } catch (e) {
            if (req.file) fileHandler.deleteUserProfilePicture(req.params.id)
            errorHandler(res, 500, e)
        }
    },
    fileHandler.handleUploadError
]

module.exports.updateProfilePicture = [
    fileHandler.uploadProfilePicture,
    async (req, res) => {
        try {
            if (!req.file) return res.status(400).json({ message: 'No file uploaded' })

            const user = await Users.findById(req.params.id)
            if (!user) {
                fileHandler.deleteUserProfilePicture(req.params.id)
                return res.status(404).json({ message: 'User not found' })
            }

            const renamed = fileHandler.renameProfilePicture(req.params.id, req.file.filename)
            if (!renamed) return res.status(500).json({ message: 'Failed to process profile picture' })

            const profileLink = fileHandler.buildProfilePictureLink(req.params.id)
            await Users.findByIdAndUpdate(req.params.id, {
                $set: { links: [profileLink, ...filterProfileLinks(user.links)] }
            })

            res.status(200).json({ message: 'Profile picture updated successfully', data: { userId: user._id, filename: renamed.filename, link: profileLink } })
        } catch (e) {
            errorHandler(res, 500, e)
        }
    },
    fileHandler.handleUploadError
]

module.exports.deleteProfilePicture = async (req, res) => {
    try {
        const user = await Users.findById(req.params.id)
        if (!user) return res.status(404).json({ message: 'User not found' })

        const deleted = fileHandler.deleteUserProfilePicture(req.params.id)
        if (!deleted) return res.status(404).json({ message: 'No profile picture found to delete' })

        await Users.findByIdAndUpdate(req.params.id, { $set: { links: filterProfileLinks(user.links) } })
        res.status(200).json({ message: 'Profile picture deleted successfully', data: { userId: user._id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
const fs = require('fs')
const path = require('path')
const fileHandler = require('../utils/fileHandler')
const errorHandler = require('../utils/errorHandler')

// ── User profile pictures ─────────────────────────────────────────────────────

module.exports.getUserProfilePicture = (req, res) => {
    try {
        const { userId, filename } = req.params
        const filePath = path.join(fileHandler.paths.userProfiles, userId, filename)

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Profile picture not found' })

        res.setHeader('Cache-Control', 'public, max-age=86400')
        res.sendFile(filePath)
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.deleteUserProfilePicture = (req, res) => {
    try {
        const { userId, filename } = req.params
        const filePath = path.join(fileHandler.paths.userProfiles, userId, filename)

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' })

        fs.unlinkSync(filePath)
        res.status(200).json({ message: 'File deleted successfully', data: { userId, filename } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

// ── Course files ──────────────────────────────────────────────────────────────

module.exports.getCourseFile = (req, res) => {
    try {
        const { courseId, filename } = req.params
        const filePath = path.join(fileHandler.paths.courseFiles, courseId, filename)

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' })

        const disposition = req.query.download === 'true' ? 'attachment' : 'inline'
        res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`)
        res.setHeader('Cache-Control', 'public, max-age=3600')
        res.sendFile(filePath)
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.deleteCourseFile = (req, res) => {
    try {
        const { courseId, filename } = req.params
        const filePath = path.join(fileHandler.paths.courseFiles, courseId, filename)

        if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' })

        fs.unlinkSync(filePath)
        res.status(200).json({ message: 'File deleted successfully', data: { courseId, filename } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.listCourseFiles = (req, res) => {
    try {
        const { courseId } = req.params
        const courseDir = path.join(fileHandler.paths.courseFiles, courseId)

        if (!fs.existsSync(courseDir)) {
            return res.status(200).json({ courseId, count: 0, files: [] })
        }

        const files = fs.readdirSync(courseDir).map(filename => {
            const stats = fs.statSync(path.join(courseDir, filename))
            return {
                filename,
                size:     stats.size,
                created:  stats.birthtime,
                modified: stats.mtime,
                url:      `/api/files/courses/${courseId}/${filename}`
            }
        })

        res.status(200).json({ courseId, count: files.length, files })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.listUserFiles = (req, res) => {
    try {
        const { userId } = req.params
        const userDir = path.join(fileHandler.paths.userProfiles, userId)

        if (!fs.existsSync(userDir)) {
            return res.status(200).json({ userId, count: 0, files: [] })
        }

        const files = fs.readdirSync(userDir).map(filename => {
            const stats = fs.statSync(path.join(userDir, filename))
            return {
                filename,
                size:     stats.size,
                created:  stats.birthtime,
                modified: stats.mtime,
                url:      `/api/files/users/${userId}/${filename}`
            }
        })

        res.status(200).json({ userId, count: files.length, files })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
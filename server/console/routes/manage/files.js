const router      = require('express').Router()
const fs          = require('fs')
const path        = require('path')
const fileHandler = require('../../utils/fileHandler')
const errorHandler = require('../../utils/errorHandler')

function listDir(dirPath, idKey, idValue, urlPrefix) {
    if (!fs.existsSync(dirPath)) {
        return { [idKey]: idValue, count: 0, files: [] }
    }
    const files = fs.readdirSync(dirPath).map(filename => {
        const stats = fs.statSync(path.join(dirPath, filename))
        return {
            filename,
            size:          stats.size,
            sizeFormatted: `${(stats.size / 1024).toFixed(2)} KB`,
            created:       stats.birthtime,
            modified:      stats.mtime,
            url:           `${urlPrefix}/${filename}`
        }
    })
    return { [idKey]: idValue, count: files.length, files }
}

function deleteFile(basePath, idValue, filename, res) {
    const filePath = path.join(basePath, idValue, filename)
    const realPath = path.resolve(filePath)
    const base     = path.resolve(basePath, idValue)

    if (!realPath.startsWith(base)) return res.status(403).json({ message: 'Access denied' })
    if (!fs.existsSync(filePath))   return res.status(404).json({ message: 'File not found' })

    fs.unlinkSync(filePath)
    res.status(200).json({ message: 'File deleted successfully', data: { filename } })
}

router.get('/users/:userId/list', (req, res) => {
    try {
        const dir = path.join(fileHandler.paths.userProfiles, req.params.userId)
        res.status(200).json(listDir(dir, 'userId', req.params.userId, `/api/files/users/${req.params.userId}`))
    } catch (e) { errorHandler(res, 500, e) }
})

router.delete('/users/:userId/:filename', (req, res) => {
    try {
        deleteFile(fileHandler.paths.userProfiles, req.params.userId, req.params.filename, res)
    } catch (e) { errorHandler(res, 500, e) }
})

router.get('/courses/:courseId/list', (req, res) => {
    try {
        const dir = path.join(fileHandler.paths.courseFiles, req.params.courseId)
        const result = listDir(dir, 'courseId', req.params.courseId, `/api/files/courses/${req.params.courseId}`)
        result.files = result.files.map(f => ({
            ...f,
            sizeFormatted: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
            isThumbnail:   f.filename.startsWith('thumbnail'),
            type:          f.filename.startsWith('thumbnail') ? 'thumbnail' : 'file'
        }))
        res.status(200).json(result)
    } catch (e) { errorHandler(res, 500, e) }
})

router.delete('/courses/:courseId/:filename', (req, res) => {
    try {
        deleteFile(fileHandler.paths.courseFiles, req.params.courseId, req.params.filename, res)
    } catch (e) { errorHandler(res, 500, e) }
})

module.exports = router
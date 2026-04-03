const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/files')
const { validate } = require('../utils/utils')
const { registry } = require('../utils/fileHandler')

const auth = passport.authenticate('jwt', { session: false })

const attachHandler = (req, _res, next) => {
    try {
        req.formHandler = registry.getOrCreate(`forms/${req.params.formType}`)
        next()
    } catch (err) {
        next(err)
    }
}

// User profile pictures
router.get('/users/:userId/:filename',    controller.getUserProfilePicture)
router.delete('/users/:userId/:filename', auth, validate('manage'), controller.deleteUserProfilePicture)
router.get('/users/:userId/list',         controller.listUserFiles)

// Course files
router.get('/courses/:courseId/:filename',    controller.getCourseFile)
router.delete('/courses/:courseId/:filename', auth, validate('create'), controller.deleteCourseFile)
router.get('/courses/:courseId/list',         controller.listCourseFiles)

// Form submission files
router.get('/forms/:formType/:id/:subdir/:filename', attachHandler, (req, res) => {
    const { id, subdir, filename } = req.params
    const filePath = req.formHandler.getFilePath(id, filename, subdir)
    if (!filePath) return res.status(404).json({ message: 'File not found' })
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline'
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.sendFile(filePath)
})

router.get('/forms/:formType/:id/:filename', attachHandler, (req, res) =>
    req.formHandler.sendFileHandler()(req, res)
)

module.exports = router
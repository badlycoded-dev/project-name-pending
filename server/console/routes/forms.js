const express  = require('express')
const router   = express.Router()
const passport = require('passport')
const ctrl     = require('../controllers/forms')
const { validate, validateDynamic } = require('../utils/utils')
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

const memoryUpload = (req, res, next) => {
    const handler = registry.getOrCreate(`forms/${req.params.formType}`)
    handler.anyMemory()(req, res, (err) => handler.handleError(err, req, res, next))
}

// Public — submit application
router.post('/apply/:formType', attachHandler, memoryUpload, ctrl.submitApplication)

// Admin — cross-type (no formType)
router.get('/detail/:id',       auth, validateDynamic('quality'), ctrl.getOneById)
router.patch('/detail/:id',     auth, validateDynamic('quality'), ctrl.updateStatusById)
router.delete('/detail/:id',    auth, validateDynamic('quality'), ctrl.deleteSubmissionById)
router.get('/detail/:id/files', auth, validateDynamic('quality'), ctrl.listFilesById)
router.delete('/detail/:id/files/:skillIndex/:filename', auth, validateDynamic('quality'), ctrl.deleteFileById)
router.get('/', auth, validateDynamic('quality'), ctrl.getAllAny)

// Admin — per form type
router.get('/:formType',       auth, validateDynamic('quality'), ctrl.getAll)
router.get('/:formType/:id',   auth, validateDynamic('quality'), ctrl.getOne)
router.patch('/:formType/:id', auth, validateDynamic('quality'), ctrl.updateStatus)
router.delete('/:formType/:id',auth, validateDynamic('quality'), ctrl.deleteSubmission)
router.get('/:formType/:id/files', auth, validateDynamic('quality'), ctrl.listFiles)
router.delete('/:formType/:id/files/:skillIndex/:filename', auth, validateDynamic('quality'), ctrl.deleteFile)

// File serving
router.get('/files/:formType/:id/:subdir/:filename', attachHandler, (req, res) => {
    const { id, subdir, filename } = req.params
    const filePath = req.formHandler.getFilePath(id, filename, subdir)
    if (!filePath) return res.status(404).json({ message: 'File not found' })
    const disposition = req.query.download === 'true' ? 'attachment' : 'inline'
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    res.sendFile(filePath)
})

router.get('/files/forms/:formType/:id/:filename', attachHandler, (req, res) =>
    req.formHandler.sendFileHandler()(req, res)
)

module.exports = router
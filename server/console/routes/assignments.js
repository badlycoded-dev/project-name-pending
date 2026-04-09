const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/assignments')
const { validate, validateDynamic } = require('../utils/utils')
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const auth     = passport.authenticate('jwt', { session: false })
const tutorVal = validateDynamic('tutor')

const tmpDir = path.join(__dirname, '../../storage/tmp')
fs.mkdirSync(tmpDir, { recursive: true })

const ALLOWED_TYPES = ['text/plain', 'application/pdf', 'application/zip',
    'application/x-zip-compressed', 'application/x-zip', 'application/octet-stream']

const upload = multer({
    dest: tmpDir,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = ALLOWED_TYPES.includes(file.mimetype) || /\.(txt|pdf|zip)$/i.test(file.originalname)
        cb(ok ? null : new Error('Only .txt, .pdf and .zip files are allowed'), ok)
    }
})

router.get('/',                       auth, tutorVal, controller.getByGroup)
router.post('/',                      auth, tutorVal, upload.array('taskFiles'), controller.create)
router.patch('/:id',                  auth, tutorVal, upload.array('taskFiles'), controller.update)
router.patch('/:id/place',            auth, tutorVal, controller.place)
router.delete('/:id',                 auth, tutorVal, controller.remove)
router.delete('/:id/files/:filename', auth, tutorVal, controller.removeTaskFile)

router.get('/files/:sessionId/:filename', auth, (req, res) => {
    const filePath = path.join(__dirname, '../../storage/data/assignments',
        req.params.sessionId, req.params.filename)
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'File not found' })
    res.download(filePath, req.params.filename)
})

module.exports = router
const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/submissions')
const { validate } = require('../utils/utils')
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')

const auth     = passport.authenticate('jwt', { session: false })
const tutorVal = validate('tutor')

const tmpDir = path.join(__dirname, '../../storage/tmp')
fs.mkdirSync(tmpDir, { recursive: true })

const upload = multer({
    dest: tmpDir,
    limits: { fileSize: 200 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const ok = /\.(zip|txt)$/i.test(file.originalname)
        cb(ok ? null : new Error('Only .zip files are allowed'), ok)
    }
})

router.get('/:groupId/:assignmentId',                        auth, controller.getSubmissions)
router.post('/:groupId/:assignmentId',                       auth, upload.single('submission'), controller.submit)
router.patch('/:groupId/:assignmentId/:studentId/grade',     auth, tutorVal, controller.grade)
router.get('/:groupId/:assignmentId/:studentId/file',        auth, controller.downloadSubmission)

module.exports = router
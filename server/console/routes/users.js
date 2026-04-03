const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/users')
const { validate } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.get('/c',                             auth, controller.getCurrent)
router.patch('/me/courses/:courseId/finish',    auth, controller.finishCourse)
router.patch('/me/courses/:courseId/progress',  auth, controller.updateCourseProgress)

router.get('/',      controller.getAll)
router.get('/:id',   controller.getById)
router.post('/',     auth, validate('admin'), controller.create)
router.patch('/:id', auth, validate('admin'), controller.update)
router.delete('/:id',auth, validate('admin'), controller.remove)

router.get('/:id/profile-picture/:filename', controller.getProfilePicture)
router.post('/:id/profile-picture',   auth, validate('manage'), controller.uploadProfilePicture)
router.put('/:id/profile-picture',    auth, validate('manage'), controller.updateProfilePicture)
router.delete('/:id/profile-picture', auth, validate('manage'), controller.deleteProfilePicture)

module.exports = router
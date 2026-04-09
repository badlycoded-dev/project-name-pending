const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/users')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.get('/c',                             auth, controller.getCurrent)
router.patch('/me/courses/:courseId/finish',    auth, controller.finishCourse)
router.patch('/me/courses/:courseId/progress',  auth, controller.updateCourseProgress)

router.get('/',      controller.getAll)
router.get('/:id',   controller.getById)
router.post('/',     auth, validateDynamic('admin'), controller.create)
router.patch('/:id', auth, validateDynamic('admin'), controller.update)
router.delete('/:id',auth, validateDynamic('admin'), controller.remove)

router.get('/:id/profile-picture/:filename', controller.getProfilePicture)
router.post('/:id/profile-picture',   auth, validateDynamic('manage'), controller.uploadProfilePicture)
router.put('/:id/profile-picture',    auth, validateDynamic('manage'), controller.updateProfilePicture)
router.delete('/:id/profile-picture', auth, validateDynamic('manage'), controller.deleteProfilePicture)

module.exports = router
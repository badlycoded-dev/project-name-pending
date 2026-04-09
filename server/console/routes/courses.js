const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/courses')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.get('/',    controller.getAll)
router.get('/:id', controller.getById)
router.post('/',   auth, validateDynamic('create'), controller.create)
router.put('/:id', auth, validateDynamic('create'), controller.update)
router.patch('/:id', auth, validateDynamic('create'), controller.update)
router.delete('/:id', auth, validateDynamic('create'), controller.remove)

router.get('/:id/rating',  auth, controller.getMyRating)
router.post('/:id/rating', auth, controller.rateById)

router.post('/:id/purchase', auth, controller.purchase)

router.get('/:id/comments',               controller.getComments)
router.post('/:id/comments',              auth, controller.addComment)
router.delete('/:id/comments/:commentId', auth, controller.deleteComment)

router.get('/:id/files',           controller.listCourseFiles)
router.get('/:id/files/:filename', controller.getCourseFile)
router.post('/:id/files',          auth, validateDynamic('create'), controller.uploadCourseFile)
router.post('/:id/files/multiple', auth, validateDynamic('create'), controller.uploadCourseFiles)
router.put('/:id/files/:filename', auth, validateDynamic('create'), controller.updateCourseFile)
router.delete('/:id/files/:filename', auth, validateDynamic('create'), controller.deleteCourseFile)

module.exports = router
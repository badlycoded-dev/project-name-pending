const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/groups')
const { validate, validateDynamic } = require('../utils/utils')

const auth     = passport.authenticate('jwt', { session: false })

router.get('/my', auth, controller.getMyGroups)
router.get('/',    auth, validateDynamic('tutor'), controller.getBySession)
router.get('/:id', auth, controller.getById)
router.post('/',   auth, validateDynamic('tutor'), controller.create)
router.delete('/:id', auth, validateDynamic('tutor'), controller.remove)

router.post('/:id/members',                 auth, validateDynamic('tutor'), controller.addMember)
router.patch('/:id/members/:userId/status', auth, validateDynamic('tutor'), controller.updateMemberStatus)
router.delete('/:id/members/:userId',       auth, validateDynamic('tutor'), controller.removeMember)

module.exports = router
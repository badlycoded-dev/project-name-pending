const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/groups')
const { validate } = require('../utils/utils')

const auth     = passport.authenticate('jwt', { session: false })
const tutorVal = validate('tutor')

router.get('/my', auth, controller.getMyGroups)
router.get('/',    auth, tutorVal, controller.getBySession)
router.get('/:id', auth, controller.getById)
router.post('/',   auth, tutorVal, controller.create)
router.delete('/:id', auth, tutorVal, controller.remove)

router.post('/:id/members',                 auth, tutorVal, controller.addMember)
router.patch('/:id/members/:userId/status', auth, tutorVal, controller.updateMemberStatus)
router.delete('/:id/members/:userId',       auth, tutorVal, controller.removeMember)

module.exports = router
const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/sessions')
const { validate, validateDynamic } = require('../utils/utils')

const auth     = passport.authenticate('jwt', { session: false })
const tutorVal = validateDynamic('tutor') 

router.get('/',    auth, validateDynamic('tutor'), controller.getAll)
router.get('/:id', auth, validateDynamic('tutor'), controller.getById)

router.post('/',     auth, validateDynamic('tutor'), controller.create)
router.patch('/:id', auth, validateDynamic('tutor'), controller.update)
router.delete('/:id',auth, validateDynamic('tutor'), controller.remove)

router.post('/:id/override-rank',        auth, validateDynamic('tutor'), controller.overrideRank)
router.post('/:id/revoke-rank-override', auth, validateDynamic('tutor'), controller.revokeRankOverride)
router.post('/:id/private-copy',         auth, validateDynamic('tutor'), controller.createPrivateCopy)
router.patch('/:id/archive',             auth, validateDynamic('tutor'), controller.archive)
router.get('/:id/schedule/expanded',     auth, validateDynamic('tutor'), controller.getExpandedSchedule)

router.patch('/:id/reassign-host', auth, validateDynamic('manage'), controller.reassignHost)
router.post('/prune', auth, validateDynamic('manage'), controller.prune)

module.exports = router

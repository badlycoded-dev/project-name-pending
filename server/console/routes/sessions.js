const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/sessions')
const { validate } = require('../utils/utils')

const auth     = passport.authenticate('jwt', { session: false })
const tutorVal = validate('tutor')

router.get('/',    auth, tutorVal, controller.getAll)
router.get('/:id', auth, tutorVal, controller.getById)

router.post('/',     auth, tutorVal, controller.create)
router.patch('/:id', auth, tutorVal, controller.update)
router.delete('/:id',auth, tutorVal, controller.remove)

router.post('/:id/override-rank',        auth, tutorVal, controller.overrideRank)
router.post('/:id/revoke-rank-override', auth, tutorVal, controller.revokeRankOverride)
router.post('/:id/private-copy',         auth, tutorVal, controller.createPrivateCopy)
router.patch('/:id/archive',             auth, tutorVal, controller.archive)
router.get('/:id/schedule/expanded',     auth, tutorVal, controller.getExpandedSchedule)

// Pruning: bulk-delete archived/completed sessions older than N days
router.post('/prune', auth, validate('manage'), controller.prune)

module.exports = router

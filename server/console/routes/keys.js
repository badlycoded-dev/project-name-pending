const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/keys')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.post('/redeem', auth, controller.redeem)
router.get('/mine',    auth, controller.getMyKeys)

router.get('/',       auth, validateDynamic('manage'), controller.listAll)
router.post('/',      auth, validateDynamic('manage'), controller.generate)
router.delete('/:id', auth, validateDynamic('manage'), controller.deleteKey)

module.exports = router
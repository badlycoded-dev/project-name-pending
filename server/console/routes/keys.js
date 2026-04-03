const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/keys')
const { validate } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.post('/redeem', auth, controller.redeem)
router.get('/mine',    auth, controller.getMyKeys)

router.get('/',       auth, validate('manage'), controller.listAll)
router.post('/',      auth, validate('manage'), controller.generate)
router.delete('/:id', auth, validate('manage'), controller.deleteKey)

module.exports = router
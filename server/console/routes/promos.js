const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/promos')
const { validate } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.post('/validate', auth, controller.validate)
router.post('/apply',    auth, controller.apply)

router.get('/',          auth, validate('create'), controller.listAll)
router.post('/',         auth, validate('create'), controller.create)
router.patch('/:id/toggle', auth, validate('create'), controller.toggle)
router.delete('/:id',    auth, validate('create'), controller.deletePromo)

module.exports = router
const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/promos')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.post('/validate', auth, controller.validate)
router.post('/apply',    auth, controller.apply)

router.get('/',          auth, validateDynamic('create'), controller.listAll)
router.post('/',         auth, validateDynamic('create'), controller.create)
router.patch('/:id/toggle', auth, validateDynamic('create'), controller.toggle)
router.delete('/:id',    auth, validateDynamic('create'), controller.deletePromo)

module.exports = router
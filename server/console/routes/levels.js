const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/levels')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.get('/',    controller.getAll)
router.get('/:id', controller.getById)
router.post('/',   auth, validateDynamic('manage'), controller.create)
router.put('/:id', auth, validateDynamic('manage'), controller.update)
router.delete('/:id', auth, validateDynamic('manage'), controller.remove)

module.exports = router
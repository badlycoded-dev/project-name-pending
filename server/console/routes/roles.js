const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/roles')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.get('/',    auth, validateDynamic('manage'), controller.getAll)
router.get('/:id', auth, validateDynamic('manage'), controller.getById)
router.post('/',   auth, validateDynamic('manage'), controller.create)
router.put('/:id', auth, validateDynamic('manage'), controller.update)
router.delete('/:id', auth, validateDynamic('manage'), controller.remove)

module.exports = router
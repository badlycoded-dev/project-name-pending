const router     = require('express').Router()
const passport   = require('passport')
const controller = require('../controllers/levels')
const { validate } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.get('/',    controller.getAll)
router.get('/:id', controller.getById)
router.post('/',   auth, validate('manage'), controller.create)
router.put('/:id', auth, validate('manage'), controller.update)
router.delete('/:id', auth, validate('manage'), controller.remove)

module.exports = router
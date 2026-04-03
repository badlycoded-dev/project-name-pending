const router     = require('express').Router()
const controller = require('../controllers/auth')

router.post('/login',       controller.login)
router.post('/register',    controller.register)
router.post('/validate',    controller.validate)
router.post('/ext-session', controller.extendToken)

module.exports = router
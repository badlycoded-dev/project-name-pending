const router   = require('express').Router()
const passport = require('passport')
const { validate, validateDynamic } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.use('/courses', auth, validateDynamic('create'), require('./courses'))
router.use('/users',   auth, validateDynamic('manage'), require('./users'))
router.use('/roles',   auth, validateDynamic('manage'), require('./roles'))
router.use('/files',   auth, validateDynamic('manage'), require('./manage/files'))
router.use('/forms',   auth, validateDynamic('quality'), require('./forms'))

module.exports = router
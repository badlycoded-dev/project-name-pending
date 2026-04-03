const router   = require('express').Router()
const passport = require('passport')
const { validate } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

router.use('/courses', auth, validate('create'), require('./courses'))
router.use('/users',   auth, validate('manage'), require('./users'))
router.use('/roles',   auth, validate('manage'), require('./roles'))
router.use('/files',   auth, validate('manage'), require('./manage/files'))
router.use('/forms',   auth, validate('quality'), require('./forms'))

module.exports = router
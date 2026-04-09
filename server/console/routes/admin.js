const router = require('express').Router()
const passport = require('passport')
const ctrl = require('../controllers/admin')
const { validate } = require('../utils/utils')

const auth = passport.authenticate('jwt', { session: false })

// DB Editor
router.get('/collections',                   auth, validate('root'), ctrl.listCollections)
router.get('/collections/:name',             auth, validate('root'), ctrl.getCollection)
router.patch('/collections/:name/:id',       auth, validate('root'), ctrl.updateDocument)
router.delete('/collections/:name/:id',      auth, validate('root'), ctrl.deleteDocument)

// Backup / Restore
router.get('/backup/:name',                  auth, validate('admin'), ctrl.backupCollection)
router.get('/backup',                        auth, validate('admin'), ctrl.backupAll)
router.post('/restore/:name',                auth, validate('admin'), ctrl.restoreCollection)

// Access Rules
router.get('/access-rules',                  auth, validate('root'), ctrl.getAccessRules)
router.post('/access-rules',                 auth, validate('root'), ctrl.upsertAccessRule)
router.delete('/access-rules/:id',           auth, validate('root'), ctrl.deleteAccessRule)

module.exports = router
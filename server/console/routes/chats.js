const router     = require('express').Router();
const passport   = require('passport');
const controller = require('../controllers/chats');

const auth = passport.authenticate('jwt', { session: false });

// All chat routes require authentication
router.use(auth);

router.get('/',    controller.getAll);
router.post('/',   controller.create);
router.get('/:id', controller.getById);
router.delete('/:id', controller.remove);

router.get('/:id/messages',           controller.getMessages);
router.post('/:id/messages',          controller.sendMessage);
router.delete('/:id/messages/:msgId', controller.deleteMessage);

module.exports = router;
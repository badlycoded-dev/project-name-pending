/**
 * routes/dev/index.js
 *
 * Dev API branch — mounted at /api/dev
 * All routes here share the ID-hiding convention:
 *   - MongoDB _id never appears in URLs
 *   - Resources are referenced via encrypted `ref` tokens in the body
 *   - All responses have _id fields replaced with opaque ref tokens
 *
 * Add more resource routers here as you expand the dev branch.
 */
 
/**
 * routes/dev/index.js
 *
 * Dev API branch — mounted at /api/dev
 *
 * Convention for all routes in this branch:
 *   - MongoDB _id never appears in URLs
 *   - Resources are identified by an encrypted `ref` token in the request body
 *     (or as a query param for GET requests that can't carry a body)
 *   - All responses have every _id field replaced with an opaque encrypted token
 *
 * auth/files/utils are excluded — they're already ID-free or path-based.
 */

const router  = require('express').Router();

router.use((req,res,next)=>{res.status(200).json({message: 'WIP'})})

 
// router.use('/assignments', require('./assignments'));
// router.use('/chats',       require('./chats'));
// router.use('/courses',     require('./courses'));
// router.use('/directions',  require('./directions'));
// router.use('/forms',       require('./forms'));
// router.use('/groups',      require('./groups'));
// router.use('/keys',        require('./keys'));
// router.use('/levels',      require('./levels'));
// router.use('/promos',      require('./promos'));
// router.use('/roles',       require('./roles'));
// router.use('/sessions',    require('./sessions'));
// router.use('/submissions', require('./submissions'));
// router.use('/users',       require('./users'));
 
module.exports = router;
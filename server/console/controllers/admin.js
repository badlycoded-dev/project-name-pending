const mongoose = require('mongoose')
const AccessRule = require('../models/mongo.access')
const Roles = require('../models/mongo.roles')
const Users = require('../models/mongo.users')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')

const ACCESS_LEVELS = ['default','create','tutor','quality','manage','admin','root']

async function getRequester(req) {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return null
    return utils.parseToken(token)
}
async function getAccessLevel(user) {
    const role = await Roles.findById(user.role)
    return role?.accessLevel || 'default'
}

// ── DB Editor ─────────────────────────────────────────────────────────────────
module.exports.listCollections = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (!['admin','root'].includes(level)) return errorHandler(res, 403, 'Admin+ required')
        const collections = await mongoose.connection.db.listCollections().toArray()
        res.status(200).json({ data: collections.map(c => c.name).sort() })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.getCollection = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (!['admin','root'].includes(level)) return errorHandler(res, 403, 'Admin+ required')
        const { name } = req.params
        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(50, parseInt(req.query.limit) || 20)
        const skip = (page - 1) * limit
        const col = mongoose.connection.db.collection(name)
        const [docs, total] = await Promise.all([
            col.find({}).skip(skip).limit(limit).toArray(),
            col.countDocuments()
        ])
        res.status(200).json({ data: docs, total, page, pages: Math.ceil(total / limit) })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.updateDocument = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (!['admin','root'].includes(level)) return errorHandler(res, 403, 'Admin+ required')
        const { name, id } = req.params
        const { update } = req.body
        if (!update || typeof update !== 'object') return errorHandler(res, 400, 'update object required')

        // Root-only sensitive fields protection
        const sensitiveFields = ['passwordHash','passwordEnc','role']
        if (level !== 'root') {
            for (const f of sensitiveFields) {
                if (update[f] !== undefined) return errorHandler(res, 403, `Only root can modify '${f}'`)
            }
        }

        delete update._id
        const col = mongoose.connection.db.collection(name)
        const { ObjectId } = require('mongodb')
        const result = await col.findOneAndUpdate(
            { _id: new ObjectId(id) },
            { $set: { ...update, updatedAt: new Date() } },
            { returnDocument: 'after' }
        )
        if (!result) return errorHandler(res, 404, 'Document not found')
        res.status(200).json({ message: 'Document updated', data: result })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.deleteDocument = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (level !== 'root') return errorHandler(res, 403, 'Root only')
        const { name, id } = req.params
        const { ObjectId } = require('mongodb')
        const col = mongoose.connection.db.collection(name)
        const result = await col.deleteOne({ _id: new ObjectId(id) })
        if (result.deletedCount === 0) return errorHandler(res, 404, 'Document not found')
        res.status(200).json({ message: 'Document deleted' })
    } catch (e) { errorHandler(res, 500, e) }
}

// ── Access Rules ──────────────────────────────────────────────────────────────
module.exports.getAccessRules = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (!['admin','root'].includes(level)) return errorHandler(res, 403, 'Admin+ required')
        const rules = await AccessRule.find({}).sort({ path: 1 })
        res.status(200).json({ data: rules })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.upsertAccessRule = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (!['admin','root'].includes(level)) return errorHandler(res, 403, 'Admin+ required')
        const { path, label, minLevel } = req.body
        if (!path || !minLevel) return errorHandler(res, 400, 'path and minLevel required')
        if (!ACCESS_LEVELS.includes(minLevel)) return errorHandler(res, 400, 'Invalid minLevel')
        // Admin cannot set admin/root-level access rules (only root can)
        if (level !== 'root' && ['admin','root'].includes(minLevel))
            return errorHandler(res, 403, 'Only root can set admin/root level restrictions')
        const rule = await AccessRule.findOneAndUpdate(
            { path },
            { path, label: label || path, minLevel, updatedBy: requester._id, updatedAt: new Date() },
            { upsert: true, new: true }
        )
        res.status(200).json({ message: 'Rule saved', data: rule })
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.deleteAccessRule = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (level !== 'root') return errorHandler(res, 403, 'Root only')
        await AccessRule.findByIdAndDelete(req.params.id)
        res.status(200).json({ message: 'Rule deleted' })
    } catch (e) { errorHandler(res, 500, e) }
}

// ── Dynamic validate middleware ───────────────────────────────────────────────
// Drop-in replacement for validate() that checks DB override first
module.exports.validateDynamic = (defaultLevel) => async (req, res, next) => {
    try {
        const jwt = require('jsonwebtoken')
        const config = require('../config/config')
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return errorHandler(res, 401, 'No token provided')
        const decoded = jwt.verify(token, config.JWT_SECRET)
        const user = await Users.findById(decoded.userId)
        if (!user) return errorHandler(res, 403, 'User not found')
        const role = await Roles.findById(user.role)
        const userLevel = role?.accessLevel || 'default'

        // Build a route key from method + path for lookup
        const routeKey = `${req.method}:${req.baseUrl}${req.path}`.replace(/\/[a-f0-9]{24}/gi, '/:id').replace(/\/+$/, '') || '/'
        const dbRule = await AccessRule.findOne({ type: 'api', path: routeKey })
        const required = dbRule ? dbRule.minLevel : defaultLevel

        const ACCESS_LEVELS = ['default','create','tutor','quality','manage','admin','root']
        if (ACCESS_LEVELS.indexOf(userLevel) >= ACCESS_LEVELS.indexOf(required)) return next()
        errorHandler(res, 403, `ACCESS DENIED: requires '${required}' level`)
    } catch (err) { errorHandler(res, 500, err.message) }
}

// ── Backup / Restore ──────────────────────────────────────────────────────────
module.exports.backupCollection = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (!['admin','root'].includes(level)) return errorHandler(res, 403, 'Admin+ required')
        const { name } = req.params
        const col = mongoose.connection.db.collection(name)
        const docs = await col.find({}).toArray()
        const json = JSON.stringify({ collection: name, exportedAt: new Date(), count: docs.length, data: docs }, null, 2)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename="${name}-backup-${Date.now()}.json"`)
        res.send(json)
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.backupAll = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (level !== 'root') return errorHandler(res, 403, 'Root only')
        const collections = await mongoose.connection.db.listCollections().toArray()
        const backup = {}
        for (const { name } of collections) {
            backup[name] = await mongoose.connection.db.collection(name).find({}).toArray()
        }
        const json = JSON.stringify({ exportedAt: new Date(), collections: backup }, null, 2)
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', `attachment; filename="full-backup-${Date.now()}.json"`)
        res.send(json)
    } catch (e) { errorHandler(res, 500, e) }
}

module.exports.restoreCollection = async (req, res) => {
    try {
        const requester = await getRequester(req)
        if (!requester) return errorHandler(res, 401, 'Authentication required')
        const level = await getAccessLevel(requester)
        if (level !== 'root') return errorHandler(res, 403, 'Root only')
        const { name } = req.params
        const { data, mode } = req.body // mode: 'merge' | 'replace'
        if (!Array.isArray(data)) return errorHandler(res, 400, 'data must be an array of documents')
        const col = mongoose.connection.db.collection(name)
        const { ObjectId } = require('mongodb')
        if (mode === 'replace') await col.deleteMany({})
        let inserted = 0, updated = 0
        for (const doc of data) {
            const { _id, ...rest } = doc
            if (_id) {
                const r = await col.replaceOne({ _id: new ObjectId(String(_id)) }, { _id: new ObjectId(String(_id)), ...rest }, { upsert: true })
                r.upsertedCount ? inserted++ : updated++
            } else {
                await col.insertOne(rest); inserted++
            }
        }
        res.status(200).json({ message: `Restored: ${inserted} inserted, ${updated} updated`, inserted, updated })
    } catch (e) { errorHandler(res, 500, e) }
}
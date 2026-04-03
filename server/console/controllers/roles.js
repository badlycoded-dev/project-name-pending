const Roles = require('../models/mongo.roles')
const utils = require('../utils/utils')
const errorHandler = require('../utils/errorHandler')

module.exports.getAll = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        let isRoot = false

        if (token) {
            try {
                const requester = await utils.parseToken(token)
                const role = requester?.role ? await Roles.findById(requester.role) : null
                isRoot = role?.accessLevel === 'root' || role?.roleName === 'root'
            } catch (_) {}
        }

        const roles = await Roles.find({})
        const filtered = isRoot ? roles : roles.filter(r => r.roleName !== 'root')
        res.status(200).json({ data: filtered })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getById = async (req, res) => {
    try {
        const role = await Roles.findById(req.params.id)
        if (!role) return errorHandler(res, 404, 'Role not found')
        res.status(200).json({ data: role })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.create = async (req, res) => {
    try {
        const role = await new Roles({
            roleName:    req.body.roleName,
            accessLevel: req.body.accessLevel,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).save()

        res.status(201).json({ message: 'Role created successfully', data: role })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.update = async (req, res) => {
    try {
        const role = await Roles.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    roleName:    req.body.roleName,
                    accessLevel: req.body.accessLevel,
                    updatedAt: Date.now()
                }
            },
            { new: true }
        )
        res.status(200).json({ message: 'Role updated successfully', data: role })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.remove = async (req, res) => {
    try {
        await Roles.deleteOne({ _id: req.params.id })
        res.status(200).json({ message: 'Role deleted successfully', data: { _id: req.params.id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
const bcrypt = require('bcrypt')
const User = require('../models/mongo.users')
const errorHandler = require('../utils/errorHandler')
const config = require('../config/config')
const utils = require('../utils/utils')
const mdl = require('../utils/module')

module.exports.login = async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email })
        if (!user) return errorHandler(res, 404, 'User not found')

        const passwordMatch = bcrypt.compareSync(req.body.password, user.passwordHash)
        if (!passwordMatch) return errorHandler(res, 401, 'Incorrect password')

        const token = utils.createToken(user, config.JWT_SECRET)
        res.status(200).json({ token, tokenType: 'Bearer' })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.extendToken = async (req, res) => {
    try {
        const token = await utils.extendToken(req)
        res.status(200).json({ token, tokenType: 'Bearer' })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.register = async (req, res) => {
    try {
        const existing = await User.findOne({ email: req.body.email })
        if (existing) return errorHandler(res, 409, 'Email already in use')

        const password = await utils.generatePasswordHash(req.body.password)

        const user = await new User({
            email:       req.body.email,
            passwordHash: password.hash,
            passwordEnc: mdl.use(req.body.password),
            nickname:    req.body.nickname || req.body.email.split('@')[0],
            login:       req.body.login || req.body.email
        }).save()

        res.status(201).json(user)
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.validate = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return errorHandler(res, 401, 'No token provided')

        const decoded = require('jsonwebtoken').verify(token, config.JWT_SECRET)
        const user = await User.findById(decoded.userId).populate('role')

        if (!user || !user.role) return errorHandler(res, 403, 'Access denied')

        const levels = { default: 1, create: 2, manage: 3, admin: 4, root: 5 }
        const userLevel = levels[user.role.accessLevel] || 0

        if (userLevel >= levels['manage']) {
            res.status(200).json({ valid: true })
        } else {
            errorHandler(res, 403, 'Access denied')
        }
    } catch (e) {
        errorHandler(res, 500, e.message)
    }
}
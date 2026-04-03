const Directions = require('../models/mongo.directions')
const errorHandler = require('../utils/errorHandler')

module.exports.getAll = async (req, res) => {
    try {
        const directions = await Directions.find({})
        res.status(200).json({ data: directions })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getById = async (req, res) => {
    try {
        const direction = await Directions.findById(req.params.id)
        if (!direction) return errorHandler(res, 404, 'Direction not found')
        res.status(200).json({ data: direction })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.create = async (req, res) => {
    try {
        const direction = await new Directions({
            directionName: req.body.directionName,
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).save()

        res.status(201).json({ message: 'Direction created successfully', data: direction })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.update = async (req, res) => {
    try {
        const direction = await Directions.findByIdAndUpdate(
            req.params.id,
            { $set: { directionName: req.body.directionName, updatedAt: Date.now() } },
            { new: true }
        )
        res.status(200).json({ message: 'Direction updated successfully', data: direction })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.remove = async (req, res) => {
    try {
        await Directions.deleteOne({ _id: req.params.id })
        res.status(200).json({ message: 'Direction deleted successfully', data: { _id: req.params.id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
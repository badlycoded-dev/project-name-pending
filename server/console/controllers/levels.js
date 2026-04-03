const Levels = require('../models/mongo.levels')
const errorHandler = require('../utils/errorHandler')

module.exports.getAll = async (req, res) => {
    try {
        const levels = await Levels.find({})
        res.status(200).json({ data: levels })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.getById = async (req, res) => {
    try {
        const level = await Levels.findById(req.params.id)
        if (!level) return errorHandler(res, 404, 'Level not found')
        res.status(200).json({ data: level })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.create = async (req, res) => {
    try {
        const level = await new Levels({
            levelName:    req.body.levelName,
            directionName: req.body.directionName,
            minTutorRank: req.body.minTutorRank || 'assistant',
            createdAt: Date.now(),
            updatedAt: Date.now()
        }).save()

        res.status(201).json({ message: 'Level created successfully', data: level })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.update = async (req, res) => {
    try {
        const level = await Levels.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    levelName:    req.body.levelName,
                    directionName: req.body.directionName,
                    minTutorRank: req.body.minTutorRank || 'assistant',
                    updatedAt: Date.now()
                }
            },
            { new: true }
        )
        res.status(200).json({ message: 'Level updated successfully', data: level })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}

module.exports.remove = async (req, res) => {
    try {
        await Levels.deleteOne({ _id: req.params.id })
        res.status(200).json({ message: 'Level deleted successfully', data: { _id: req.params.id } })
    } catch (e) {
        errorHandler(res, 500, e)
    }
}
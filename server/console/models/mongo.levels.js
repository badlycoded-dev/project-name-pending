const mongoose = require('mongoose')
const Schema = mongoose.Schema
 
const levelSchema = new Schema({
    levelName: {
        type: String,
        default: 'default',
        required: true,
    },
    directionName: {
        type: String,
        default: 'default',
        required: true,
    },
    // Minimum tutor sub-rank required to host a course at this level
    minTutorRank: {
        type: String,
        required: false,
        default: 'assistant',
        enum: ['assistant', 'teacher', 'lecturer', 'instructor', 'tutor', 'professor']
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    updatedAt: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model('levels', levelSchema)
const mongoose = require('mongoose')
const Schema = mongoose.Schema

const accessRuleSchema = new Schema({
    path: {
        type: String,
        required: true,
        unique: true
    },
    label: {
        type: String,
        required: false
    },
    group: {
        type: String,
        required: false,
        default: 'Other'
    },
    type: {
        type: String,
        enum: ['page', 'api'],
        default: 'page'
    },
    method: {
        type: String,
        required: false
    },
    minLevel: {
        type: String,
        enum: ['default', 'create', 'tutor', 'quality', 'manage', 'admin', 'root'],
        default: 'default'
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: false
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('access', accessRuleSchema)
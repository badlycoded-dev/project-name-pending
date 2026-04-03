const mongoose = require('mongoose')
const Schema = mongoose.Schema

const specialSchema = new Schema({
    type: {
        type: String,
        required: false,
        enum: ['promo', 'productKey']
    },
    userId: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    value: {
        type: String,
        default: '',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now()
    },
    dueTo: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model('specials', specialSchema)


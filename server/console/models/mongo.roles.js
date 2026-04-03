const mongoose = require('mongoose')
const Schema = mongoose.Schema
 
const roleSchema = new Schema({
    roleName: {
        type: String,
        default: 'user',
        required: true,
    },
    accessLevel: {
        type: String,
        default: 'default',
        required: true
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

module.exports = mongoose.model('roles', roleSchema)
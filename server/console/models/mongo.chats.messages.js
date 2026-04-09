const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chatMessageSchema = new Schema({
    chatId: {
        type: Schema.Types.ObjectId,
        ref: 'chats',
        required: true,
        index: true
    },
    sender: {
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 4000
    },
    readBy: [{
        type: Schema.Types.ObjectId,
        ref: 'users'
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

chatMessageSchema.index({ chatId: 1, createdAt: 1 });

module.exports = mongoose.model('chats_messages', chatMessageSchema);
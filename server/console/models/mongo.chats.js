const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// P2P chat between two users
const chatSchema = new Schema({
    participants: [{
        type: Schema.Types.ObjectId,
        ref: 'users',
        required: true
    }],
    lastMessage: {
        _id:            { type: Schema.Types.ObjectId, default: null },
        text:           { type: String, default: null },
        senderNickname: { type: String, default: null },
        senderId:       { type: Schema.Types.ObjectId, default: null },
        createdAt:      { type: Date, default: null }
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Ensure unique pair (unordered)
chatSchema.index({ participants: 1 });

module.exports = mongoose.model('chats', chatSchema);
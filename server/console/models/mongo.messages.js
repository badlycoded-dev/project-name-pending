const mongoose = require('mongoose');

// P(m)_01 — meeting chat messages
// Uses the same MongoDB connection defined in console/config (MONGO_URI)
const schema = new mongoose.Schema({
    sessionId:    { type: String, required: true, index: true },
    roomId:       { type: String, required: true },
    from:         String,
    fromNickname: String,
    to:           String,   // null = public, socketId = DM
    text:         { type: String, required: true },
    ts:           { type: Date, default: Date.now },
}, { collection: 'meeting_messages' });

schema.index({ sessionId: 1, ts: 1 });
module.exports = mongoose.model('MeetingMessage', schema);

const mongoose = require('mongoose')
const { Schema } = mongoose

/**
 * RtcRoom — persisted room configuration stored in MongoDB.
 *
 * A room can be:
 *   1. Tied to a session  (sessionId is set, roomId = "session:<sessionId>")
 *   2. Ad-hoc / link-based (sessionId is null, roomId is a random slug)
 *
 * The in-memory rooms.js Map handles live peer state.
 * This model handles configuration, settings, and invite-link metadata.
 */
const rtcRoomSchema = new Schema({
    // Stable room identifier used by the signaling server
    roomId: {
        type:     String,
        required: true,
        unique:   true,
        index:    true,
        trim:     true
    },

    // Optional link to a session document
    sessionId: {
        type:    Schema.Types.ObjectId,
        ref:     'sessions',
        default: null,
        index:   true
    },

    // Display name shown in the UI
    displayName: {
        type:    String,
        default: ''
    },

    // Who created the room
    createdBy: {
        type:    Schema.Types.ObjectId,
        ref:     'users',
        default: null
    },

    // ── Settings ──────────────────────────────────────────────────────────────
    settings: {
        // Whether guests (non-authenticated) may join via link
        // Currently always false — kept for future extension
        allowGuests: { type: Boolean, default: false },

        // Maximum number of simultaneous participants (0 = unlimited)
        maxParticipants: { type: Number, default: 0 },

        // Whether the host must admit each participant (lobby mode)
        // Signaling enforcement is client-side for now
        lobbyEnabled: { type: Boolean, default: false },

        // Whether participants join with audio muted by default
        // The front-end already enforces this; the field documents intent
        joinMuted: { type: Boolean, default: true },

        // Whether participants join with video off by default
        joinVideoOff: { type: Boolean, default: true }
    },

    // Room lifecycle
    status: {
        type:    String,
        enum:    ['active', 'closed'],
        default: 'active'
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

// Auto-update updatedAt on save
rtcRoomSchema.pre('save', function (next) {
    this.updatedAt = new Date()
    next()
})

module.exports = mongoose.model('rtc_rooms', rtcRoomSchema)

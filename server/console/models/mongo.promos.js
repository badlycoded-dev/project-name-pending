const mongoose = require('mongoose')
const Schema = mongoose.Schema

const promoSchema = new Schema({
    // Short human-readable code, e.g. "LAUNCH20" or "SUMMER50"
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    // Creator/tutor who owns this promo
    createdBy: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Which courses this promo applies to (empty = all courses by creator)
    courseIds: [{
        ref: 'courses',
        type: Schema.Types.ObjectId
    }],
    // Discount type: 'percent' (0-100) or 'flat' (fixed amount off)
    discountType: {
        type: String,
        required: true,
        enum: ['percent', 'flat'],
        default: 'percent'
    },
    discountValue: {
        type: Number,
        required: true,
        min: 0
    },
    // Usage limits
    maxUses: {
        type: Number,
        default: null  // null = unlimited
    },
    usedCount: {
        type: Number,
        default: 0
    },
    // Who used it (track per-user)
    usages: [{
        userId: { ref: 'users', type: Schema.Types.ObjectId },
        courseId: { ref: 'courses', type: Schema.Types.ObjectId },
        usedAt: { type: Date, default: Date.now }
    }],
    expiresAt: {
        type: Date,
        default: null
    },
    note: {
        type: String,
        default: ''
    },
    active: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

module.exports = mongoose.model('promos', promoSchema)

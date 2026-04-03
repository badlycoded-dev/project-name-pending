const mongoose = require('mongoose')
const Schema = mongoose.Schema

const keySchema = new Schema({
    // Human-readable code: XXXXX-XXXXX-XXXXX (uppercase alphanumeric)
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true,
        trim: true
    },
    // Which courses this key unlocks (can be multiple)
    courseIds: [{
        ref: 'courses',
        type: Schema.Types.ObjectId,
        required: true
    }],
    // Who created this key (manage+ user or the system)
    createdBy: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Optional batch label for the admin's reference
    note: {
        type: String,
        required: false,
        default: ''
    },
    // Redemption state
    redeemedBy: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        default: null
    },
    redeemedAt: {
        type: Date,
        default: null
    },
    // Optional hard expiry — null means no expiry
    expiresAt: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
})

// Virtual: whether this key can still be redeemed
keySchema.virtual('isRedeemed').get(function () {
    return this.redeemedBy != null;
});
keySchema.virtual('isExpired').get(function () {
    return this.expiresAt != null && new Date() > this.expiresAt;
});
keySchema.virtual('isValid').get(function () {
    return !this.isRedeemed && !this.isExpired;
});

module.exports = mongoose.model('keys', keySchema)

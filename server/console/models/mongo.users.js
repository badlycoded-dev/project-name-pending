const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    nickname: {
        type: String,
        required: true,
        unique: true
    },
    firstName: {
        type: String,
        required: false
    },
    lastName: {
        type: String,
        required: false
    },
    login: {
        type: String,
        required: false,
        unique: true
    },
    passwordEnc: {
        type: String,
        required: false
    },
    passwordHash: {
        type: String,
        required: true
    },
    role: {
        ref: 'roles',
        type: Schema.Types.ObjectId,
        default: '698f4d58ab4593a2bd660336',
        required: false
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false
    },
    github: {
        type: String,
        required: false
    },
    courses: [{
        _id: {
            ref: 'courses',
            type: Schema.Types.ObjectId,
            required: false
        },
        process: {
            type: Schema.Types.Double,
            required: false
        }
    }],
    links: [{
        type: {
            type: String,
            required: false,
            enum: ['image', 'video', 'audio', 'document', 'archive', 'other']
        },
        url: {
            type: String,
            required: false,
            description: 'Full path (e.g., /api/files/users/123/avatar.jpg)'
        },
        filename: {
            type: String,
            required: false,
        },
        accessLevel: {
            type: String,
            required: false,
            enum: ['default', 'create', 'manage', 'admin', 'root'],
            default: 'default',
            description: 'Minimum access level required to view this link'
        },
        description: {
            type: String,
            required: false
        }
    }],
    // Tutor sub-rank (null if not a tutor)
    tutorRank: {
        type: String,
        required: false,
        default: null,
        enum: [null, 'assistant', 'teacher', 'lecturer', 'instructor', 'tutor', 'professor']
    },
    // IDs of groups the user belongs to (as a student) or hosts (as a tutor)
    groups: [{
        type: require('mongoose').Schema.Types.ObjectId,
        ref: 'groups'
    }],
    lib: [{
        type: {
            type: String,
            required: false,
            enum: ['promo', 'productKey']
        },
        id: {
            type: Schema.Types.ObjectId,
            required: false
        },
        title: {
            type: String,
            required: true
        },
        amount: {
            type: Number,
            requred: false
        },
        value: [{
            type: String,
            required: true
        }]
    }],
    createdAt: {
        type: Date,
        default: Date.now()
    },
    updatedAt: {
        type: Date,
        default: Date.now()
    }
})

module.exports = mongoose.model('users', userSchema)
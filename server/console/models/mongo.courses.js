const mongoose = require('mongoose')
const Schema = mongoose.Schema

const courseSchema = new Schema({
    userId: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Course delivery type
    courseType: {
        type: String,
        required: false,
        default: 'SELF_TAUGHT',
        enum: ['SELF_TAUGHT', 'MENTORED', 'HOSTED']
    },
    // Whether this is a private tutor copy of another course
    isPrivateCopy: {
        type: Boolean,
        default: false
    },
    original: {
        courseId: {
            ref: 'courses',
            type: Schema.Types.ObjectId,
            default: null
        },
        ownedBy: {
            ref: 'users',
            type: Schema.Types.ObjectId,
            default: null
        }
    },
    status: {
        type: String,
        required: false,
        default: 'hidden'
    },
    direction: {
        type: String,
        required: true
    },
    level: {
        type: String,
        required: true
    },
    ratings: {
        type: Number,
        required: false,
        default: 0,
        description: 'Computed average rating (0-5), auto-recalculated on each vote'
    },
    ratingsList: [{
        userId: {
            ref: 'users',
            type: require('mongoose').Schema.Types.ObjectId,
            required: true
        },
        value: {
            type: Number,
            required: true,
            min: 1,
            max: 5
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    followers: {
        type: Number,
        required: false
    },
    price: {
        type: Number,
        required: true
    },
    base_lang: {
        type: String,
        required: true,
        enum: ['en', 'ua']
    },
    add_langs:[{
        type: String,
        required: true
    }],
    trans: [{
        _id:{
            type: Schema.Types.ObjectId,
            required: false
        },
        title: {
            type: String,
            required: true
        },
        description: {
            type: String,
            required: false,
            default: ''
        },
        skills: [{
            type: String,
            required: false
        }],
        // Per-language course structure (volumes/chapters/items)
        // If empty, falls back to the top-level volumes array (base language)
        volumes: {
            type: Schema.Types.Mixed,
            required: false,
            default: []
        }
    }],
    volumes: [{
        vid: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: false,
            enum: ['container', 'text', 'image', 'video', 'audio', 'document', 'archive', 'other']
        },
        url: {
            type: String,
            required: false,
            description: 'Full path (e.g., /api/manage/courses/456/thumbnail.jpg)'
        },
        chapters: [{
            cid: {
                type: String,
                required: true,
            },
            title: {
                type: String,
                required: true,
            },
            type: {
                type: String,
                required: false,
                enum: ['container', 'text', 'image', 'video', 'audio', 'document', 'archive', 'other']
            },
            url: {
                type: String,
                required: false,
                description: 'Full path (e.g., /api/manage/courses/456/thumbnail.jpg)'
            },
            items: [{
                iid: {
                    type: String,
                    required: true,
                },
                title: {
                    type: String,
                    required: true,
                },
                type: {
                    type: String,
                    required: false,
                    enum: ['text', 'image', 'video', 'audio', 'document', 'archive', 'other', 'assignment', 'open-answer']
                },
                // For assignment items: reference to Assignment._id
                assignmentId: {
                    type: require('mongoose').Schema.Types.ObjectId,
                    ref: 'assignments',
                    default: null
                },
                url: {
                    type: String,
                    required: false,
                    description: 'Full path (e.g., /api/manage/courses/456/thumbnail.jpg)'
                }
            }]
        }]
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
            description: 'Full path (e.g., /api/manage/courses/456/thumbnail.jpg)'
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
        },
        lang: {
            type: String,
            required: false,
            default: null,
            description: 'Language code this file belongs to (e.g. en, ua). null = all languages'
        }
    }],
    // Supplementary files uploaded by the tutor (session-level, tutor access only)
    tutorFiles: [{
        type: {
            type: String,
            required: false,
            enum: ['image', 'video', 'audio', 'document', 'archive', 'other']
        },
        url: {
            type: String,
            required: false
        },
        filename: {
            type: String,
            required: false
        },
        accessLevel: {
            type: String,
            required: false,
            default: 'tutor'
        },
        description: {
            type: String,
            required: false
        }
    }],
    comments: [{
        userId: {
            ref: 'users',
            type: require('mongoose').Schema.Types.ObjectId,
            required: true
        },
        date: {
            type: Date,
            default: Date.now,
            required: true
        },
        text: {
            type: String,
            required: true,
            maxlength: 4000
        }
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

module.exports = mongoose.model('courses', courseSchema)
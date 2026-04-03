const mongoose = require('mongoose')
const Schema = mongoose.Schema

/**
 * Session — a tutor-led run of a course for a specific group.
 *
 * A session ties together:
 *   - which course is being taught (original or private copy)
 *   - who the host and co-tutors are
 *   - the schedule of live meetings
 *   - per-item deadlines with optional locking
 *   - restriction override flag (allows bypassing level's minTutorRank)
 */
const sessionSchema = new Schema({
    // The course being taught (may be a private copy)
    courseId: {
        ref: 'courses',
        type: Schema.Types.ObjectId,
        required: true
    },
    // If a private copy was created for this session, its ID goes here
    privateCopyId: {
        ref: 'courses',
        type: Schema.Types.ObjectId,
        default: null
    },
    // Course delivery type — mirrors course.courseType
    courseType: {
        type: String,
        required: true,
        enum: ['SELF_TAUGHT', 'MENTORED', 'HOSTED']
    },
    // Host tutor
    hostTutor: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Co-tutors with granular permissions
    coTutors: [{
        userId: {
            ref: 'users',
            type: Schema.Types.ObjectId,
            required: true
        },
        canGrade:      { type: Boolean, default: true },
        canSchedule:   { type: Boolean, default: true },
        // Host controls whether co-tutors may edit the private copy
        canEditCopy:   { type: Boolean, default: false }
    }],
    // Per-tutor rank overrides (replaces the old session-wide restrictionIgnored boolean).
    // Each entry records that a specific tutor's rank check was waived for this session.
    rankOverrides: [{
        tutorId: {
            ref: 'users',
            type: require('mongoose').Schema.Types.ObjectId,
            required: true
        },
        overriddenBy: {
            ref: 'users',
            type: require('mongoose').Schema.Types.ObjectId,
            required: true
        },
        overriddenAt: { type: Date, default: Date.now }
    }],
    // Kept for backwards compat — true when ANY tutor in this session has an override
    restrictionIgnored: {
        type: Boolean,
        default: false
    },
    restrictionOverrideBy: {
        ref: 'users',
        type: require('mongoose').Schema.Types.ObjectId,
        default: null
    },
    // Host-controlled: whether private-copy editing is permitted at all
    copyEditAllowed: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        required: false,
        default: 'draft',
        enum: ['draft', 'active', 'completed', 'archived']
    },
    // Live-session schedule entries
    schedule: [{
        title:       { type: String, required: true },
        datetime:    { type: Date,   required: true },
        durationMin: { type: Number, default: 60 },
        meetingLink: { type: String, default: '' },  // Zoom/Teams/Meet/Classroom link
        notes:       { type: String, default: '' },

        // ── Recurrence ────────────────────────────────────────────────────────
        // If isRecurring is false (default), this is a one-time meeting.
        // If true, the meeting repeats according to recurrence settings.
        isRecurring:     { type: Boolean, default: false },
        recurrence: {
            // How often to repeat
            frequency: {
                type: String,
                enum: ['daily', 'weekly', 'biweekly', 'monthly'],
                default: 'weekly'
            },
            // Which days of the week (0=Sun … 6=Sat). Used for weekly/biweekly.
            daysOfWeek:  { type: [Number], default: [] },
            // Date after which no more occurrences are generated (inclusive)
            endDate:     { type: Date, default: null },
            // Max number of occurrences (null = no limit)
            maxOccurrences: { type: Number, default: null }
        }
    }],
    // Per-item deadlines (volumes, chapters, items, or assignments)
    deadlines: [{
        targetType: {
            type: String,
            required: true,
            enum: ['volume', 'chapter', 'item', 'assignment']
        },
        targetId:    { type: String, required: true },  // vid / cid / iid / assignmentId
        dueAt:       { type: Date,   required: true },
        description: { type: String, default: '' },
        // If true, content is locked for students after deadline
        lockAfterDue: { type: Boolean, default: false }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('sessions', sessionSchema)

const mongoose = require('mongoose')
const Schema = mongoose.Schema

/**
 * Assignment — defines a task that a tutor creates for a group.
 *
 * Any tutor sub-rank can CREATE an assignment (set title, description,
 * task files, due date, mark scale).
 *
 * Only 'tutor' or 'professor' sub-rank can PLACE it inside course content
 * (as an item of type 'assignment' in volumes/chapters).
 *
 * Overdue sanctions (applied starting 00:00 of the day AFTER dueAt):
 *   markScale '5'      → deduct 1 from maxMark
 *   markScale '12'     → deduct 2
 *   markScale '100'    → deduct 2
 *   markScale 'custom' → deduct 1
 */
const assignmentSchema = new Schema({
    // Which session and group this belongs to
    sessionId: {
        ref: 'sessions',
        type: Schema.Types.ObjectId,
        required: true
    },
    groupId: {
        ref: 'groups',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Which course the assignment is placed in
    courseId: {
        ref: 'courses',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Placement inside course content (set only by tutor/professor sub-rank)
    placedIn: {
        type: {
            type: String,
            enum: ['volume', 'chapter', 'item'],
            default: null
        },
        targetId: { type: String, default: null }  // vid / cid / iid
    },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // Task files provided by the tutor (instructions, templates, etc.)
    taskFiles: [{
        url:          { type: String },
        filename:     { type: String },
        originalName: { type: String }
    }],
    dueAt: { type: Date, required: true },
    // Grading configuration
    markScale: {
        type: String,
        required: true,
        enum: ['5', '12', '100', 'custom'],
        default: '5'
    },
    maxMark: { type: Number, required: true },
    // Computed from markScale — stored so it doesn't need recalculating
    // Can be overridden by setting customOverdueDeduction
    overdueDeduction: { type: Number, required: true },  // 1 or 2
    // Optional custom overdue deduction (overrides the scale-based one)
    customOverdueDeduction: { type: Number, default: null },
    createdBy: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('assignments', assignmentSchema)

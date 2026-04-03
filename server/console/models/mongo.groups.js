const mongoose = require('mongoose')
const Schema = mongoose.Schema

/**
 * Submission sub-document (embedded in Assignment entry inside Group).
 *
 * File path convention:
 *   storage/data/u/[studentId]/g/[groupId]/[courseId]/[assignmentNumber]_[nickname]-[studentId].zip
 */
const submissionSchema = new Schema({
    studentId: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Relative path to the submitted zip file
    filePath:     { type: String, required: true },
    submittedAt:  { type: Date,   default: Date.now },
    isOverdue:    { type: Boolean, default: false },
    resubmitCount: { type: Number, default: 0 },
    // Grading
    status: {
        type: String,
        default: 'pending',
        enum: ['pending', 'approved', 'declined']
    },
    mark:     { type: Number, default: null },  // null until graded
    feedback: { type: String, default: '' },
    gradedBy: {
        ref: 'users',
        type: Schema.Types.ObjectId,
        default: null
    },
    gradedAt: { type: Date, default: null }
})

/**
 * Assignment entry inside a Group.
 * References an Assignment document for the definition;
 * embeds all submissions from group members here.
 */
const groupAssignmentSchema = new Schema({
    assignmentId: {
        ref: 'assignments',
        type: Schema.Types.ObjectId,
        required: true
    },
    // Sequential number within this group (used in file path)
    assignmentNumber: { type: Number, required: true },
    submissions: [submissionSchema]
})

/**
 * Group — a cohort of students attached to a Session.
 * Embeds both the assignment list and all submissions so that
 * the tutor can query everything about a group in one document.
 */
const groupSchema = new Schema({
    sessionId: {
        ref: 'sessions',
        type: Schema.Types.ObjectId,
        required: true
    },
    // The course students access (private copy ID if one exists, else original)
    courseId: {
        ref: 'courses',
        type: Schema.Types.ObjectId,
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    // Group members (students)
    members: [{
        userId: {
            ref: 'users',
            type: Schema.Types.ObjectId,
            required: true
        },
        addedBy: {
            ref: 'users',
            type: Schema.Types.ObjectId,
            required: true
        },
        status: {
            type: String,
            default: 'active',
            enum: ['active', 'dropped', 'completed']
        },
        joinedAt: { type: Date, default: Date.now }
    }],
    // Assignments placed in this group, each with embedded submissions
    assignments: [groupAssignmentSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
})

module.exports = mongoose.model('groups', groupSchema)

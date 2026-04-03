'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas (reused across all form types) ───────────────────────────────

const fileLinkSchema = new mongoose.Schema({
    filename:     { type: String },
    originalName: { type: String },
    url:          { type: String },
    mimeType:     { type: String },
    size:         { type: Number },  // bytes
}, { _id: false });

const exampleSchema = new mongoose.Schema({
    kind:         { type: String, enum: ['file', 'link'], required: true },
    name:         { type: String, required: true },  // display label / link text
    url:          { type: String },                  // for kind='link' or built file URL
    filename:     { type: String },                  // stored filename on disk (kind='file')
    originalName: { type: String },
    mimeType:     { type: String },
    size:         { type: Number },
}, { _id: false });

/**
 * Skill sub-document — shared across all form types that collect skills.
 * The "type", "subject", "source" fields are free-text strings so that
 * different form configs can populate them with their own option lists.
 */
const skillSchema = new mongoose.Schema({
    type:         { type: String, required: true },  // e.g. "Academic", "Professional" …
    subject:      { type: String, required: true },
    experience:   { type: Number, default: 0 },      // full years
    source:       { type: String, required: true },  // e.g. "Self-taught", "University Degree" …
    certificates: { type: [fileLinkSchema], default: [] },
    examples:     { type: [exampleSchema],  default: [] },
}, { _id: false });

// ─── Main schema ──────────────────────────────────────────────────────────────

/**
 * Generic form-submission document.
 *
 * Instead of hard-coding field names (firstName, lastName, about, …), all
 * form-specific payload is stored in the `data` Mixed field.  The shape of
 * `data` is defined by the form-type config on the client/server and can
 * differ between form types without requiring schema changes.
 *
 * Example:
 *   formType: "creator-application"
 *   data:     { firstName: "Alice", lastName: "Smith", about: "…" }
 *
 *   formType: "support-ticket"
 *   data:     { subject: "Bug report", description: "…", severity: "high" }
 */
const formSubmissionSchema = new mongoose.Schema(
    {
        /** Discriminator — which form type produced this submission */
        formType: {
            type:     String,
            required: true,
            trim:     true,
            index:    true,
        },

        /** Optional: ID of the authenticated user who submitted */
        userId: {
            type:    mongoose.Schema.Types.ObjectId,
            ref:     'User',
            default: null,
        },

        /**
         * All form-type-specific scalar fields.
         * Stored as a plain object; no sub-schema so any structure is accepted.
         * Run application-level validation in the controller before saving.
         */
        data: {
            type:    mongoose.Schema.Types.Mixed,
            default: {},
        },

        /**
         * Skills section — optional.  Present when the form config includes
         * a skills block; empty array otherwise.
         */
        skills: {
            type:    [skillSchema],
            default: [],
        },

        // ── Review workflow ──────────────────────────────────────────────────

        status: {
            type:    String,
            enum:    ['pending', 'under-review', 'approved', 'rejected'],
            default: 'pending',
        },

        /** Internal admin note added during review */
        reviewNote: { type: String, default: '' },

        /** Admin who last changed the status */
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref:  'User',
        },

        reviewedAt: { type: Date },
    },
    { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────

formSubmissionSchema.index({ formType: 1, status: 1 });
formSubmissionSchema.index({ userId: 1 });
formSubmissionSchema.index({ createdAt: -1 });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a display-friendly title for the submission.
 * Falls back to the document ID if `data` has no recognisable name fields.
 */
formSubmissionSchema.virtual('displayTitle').get(function () {
    const d = this.data ?? {};
    if (d.firstName || d.lastName) return `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim();
    if (d.name)    return d.name;
    if (d.title)   return d.title;
    if (d.subject) return d.subject;
    return this._id.toString();
});

module.exports = mongoose.model('FormSubmission', formSubmissionSchema);
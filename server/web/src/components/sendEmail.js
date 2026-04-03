/**
 * useStatusEmail
 *
 * Reusable hook that sends a status-change email via EmailJS
 * whenever a form submission's status is updated.
 *
 * ── Setup ────────────────────────────────────────────────────────────────────
 * 1. Install:  npm install @emailjs/browser
 * 2. Add to your index.html (or init once in index.js):
 *      import emailjs from "@emailjs/browser";
 *      emailjs.init("YOUR_PUBLIC_KEY");
 * 3. Fill in the three constants below.
 * 4. In EmailJS dashboard, create one template per status (or one shared
 *    template) that uses the variables listed in EMAIL_TEMPLATES.
 *
 * ── Usage ────────────────────────────────────────────────────────────────────
 *
 *   // Inside any component that has access to the submission object:
 *   const { sendStatusEmail, sending, lastResult } = useStatusEmail();
 *
 *   // Call after a successful status PATCH:
 *   await sendStatusEmail(submission, newStatus);
 *
 * ── EmailJS template variables available ─────────────────────────────────────
 *   {{to_email}}      — recipient email (from submission data)
 *   {{to_name}}       — recipient name
 *   {{form_type}}     — human-readable form type label
 *   {{status}}        — new status string
 *   {{status_label}}  — capitalised, friendly label ("Approved", "Rejected"…)
 *   {{subject}}       — email subject line (built from template config below)
 *   {{message}}       — body message (built from template config below)
 *   {{review_note}}   — admin's review note (empty string if none)
 *   {{app_name}}      — your app name (set in EMAILJS_CONFIG)
 */

import { useState } from "react";
import emailjs from "@emailjs/browser";
import { FORM_CONFIGS } from "../config/config.forms";

// ─── ✏️  Fill these in ────────────────────────────────────────────────────────

const EMAILJS_CONFIG = {
    serviceId:  "service_qkrj62k",   // EmailJS → Email Services → Service ID
    publicKey:  process.env.REACT_APP_EMAILJS_PUBLIC_KEY || '',   // Set via REACT_APP_EMAILJS_PUBLIC_KEY in .env
    appName:    "project-name-pending Automtic Response System",     // Shown inside email body as {{app_name}}
};

/**
 * One entry per status value.
 * templateId  — EmailJS template ID for this status.
 * subject     — Email subject line ({{to_name}} is interpolated client-side).
 * message     — Opening paragraph of the email body.
 *
 * Set templateId to null to skip sending for that status.
 */
const EMAIL_TEMPLATES = {
    approved: {
        templateId: "template_other",
        subject:    (name) => `Your application has been approved, ${name}!`,
        message:    (name, formLabel) =>
            `Great news ${name}, your ${formLabel} has been reviewed and approved. ` +
            `We will be in touch shortly with next steps.`,
    },
    rejected: {
        templateId: "template_no",
        subject:    (name) => `Update on your application, ${name}`,
        message:    (name, formLabel) =>
            `Dear ${name}, thank you for submitting your ${formLabel}. ` +
            `After intence review, our HR team came with difficult decision to reject your application. ` +
            `If it helps you they left a note with explanation, why YOUR application got rejected:`,
    },
    "under-review": {
        templateId: "template_other",   // or null to skip
        subject:    (name) => `Your application is under review, ${name}`,
        message:    (name, formLabel) =>
            `Hi ${name}, we have received your ${formLabel}, and it is currently under review. ` +
            `We will notify you once a decision has been made. We'll do our best to process it within month. `,
    },
    pending: {
        templateId: null,   // typically no email needed when reverting to pending
        subject:    () => "",
        message:    () => "",
    },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve the recipient email from the submission.
 * Checks data.email first, then scans config fields for type:"email".
 */
function resolveEmail(submission, config) {
    if (submission?.data?.email) return submission.data.email;
    if (config?.fields) {
        const f = config.fields.find(f => f.type === "email");
        if (f) return submission?.data?.[f.name] ?? null;
    }
    return null;
}

/**
 * Resolve the recipient's display name from the submission.
 */
function resolveName(submission, config) {
    if (config?.getTitle) return config.getTitle(submission);
    const d = submission?.data ?? {};
    if (d.firstName || d.lastName) return `${d.firstName ?? ""} ${d.lastName ?? ""}`.trim();
    return d.name ?? d.subject ?? "Applicant";
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @returns {{
 *   sendStatusEmail: (submission: object, newStatus: string) => Promise<void>,
 *   sending: boolean,
 *   lastResult: "idle" | "sent" | "skipped" | "error"
 * }}
 */
export function useStatusEmail() {
    const [sending, setSending]       = useState(false);
    const [lastResult, setLastResult] = useState("idle"); // "idle"|"sent"|"skipped"|"error"

    /**
     * @param {object} submission  — full submission document from the API
     * @param {string} newStatus   — the status just applied
     */
    const sendStatusEmail = async (submission, newStatus) => {
        const template = EMAIL_TEMPLATES[newStatus];

        // No template configured for this status → silently skip
        if (!template?.templateId) {
            setLastResult("skipped");
            return;
        }

        const config     = FORM_CONFIGS[submission?.formType] ?? null;
        const toEmail    = resolveEmail(submission, config);

        // No email address found → skip (don't crash)
        if (!toEmail) {
            console.warn("[useStatusEmail] No email found on submission", submission?._id);
            setLastResult("skipped");
            return;
        }

        const toName     = resolveName(submission, config);
        const formLabel  = config?.title ?? submission?.formType ?? "application";
        const statusLabel = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

        const templateParams = {
            to_email:     toEmail,
            to_name:      toName,
            form_type:    formLabel,
            status:       newStatus,
            status_label: statusLabel,
            subject:      template.subject(toName, formLabel),
            message:      template.message(toName, formLabel),
            review_note:  submission?.reviewNote ?? "",
            app_name:     EMAILJS_CONFIG.appName,
        };

        setSending(true);
        setLastResult("idle");

        try {
            await emailjs.send(
                EMAILJS_CONFIG.serviceId,
                template.templateId,
                templateParams,
                EMAILJS_CONFIG.publicKey,
            );
            setLastResult("sent");
            console.info(`[useStatusEmail] Email sent → ${toEmail} (${newStatus})`);
        } catch (err) {
            console.error("[useStatusEmail] Failed to send email:", err);
            setLastResult("error");
        } finally {
            setSending(false);
        }
    };

    return { sendStatusEmail, sending, lastResult };
}
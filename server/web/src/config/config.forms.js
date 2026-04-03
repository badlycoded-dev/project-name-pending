import { toHttps } from '../utils/utils';
/**
 * formConfigs.js
 *
 * Single source of truth for every form type in the system.
 * The three UI components (CreatorForm / Forms / ViewForm) are config-driven —
 * no code changes are needed to add a new form type, only a new entry here.
 *
 * ─── Config shape ─────────────────────────────────────────────────────────────
 *
 * {
 *   formType:    string   — must match the :formType slug in the API routes
 *   title:       string   — page / card heading
 *   description: string   — subtitle shown on the public form
 *
 *   apiBase:   string     — base URL, e.g. (toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + ""
 *   listPath:  string     — client-side route for the admin list
 *   viewPath:  fn(id)     — client-side route for the admin detail view
 *
 *   fields: Array<FieldDef>  — rendered top-to-bottom in the public form
 *     FieldDef {
 *       name:        string              — key inside `data` payload
 *       label:       string
 *       type:        'text'|'textarea'|'email'|'tel'|'number'|'select'|'checkbox'
 *       required?:   boolean
 *       placeholder?: string
 *       rows?:       number              — textarea only
 *       options?:    string[]            — select only
 *       col?:        number              — Bootstrap col width (1-12), default 12
 *     }
 *
 *   skills?:    SkillsConfig | null   — null = no skills section
 *     SkillsConfig {
 *       label:        string
 *       required:     boolean
 *       minCount:     number
 *       knowledgeTypes:   string[]
 *       subjectsByType:   Record<string, string[]>
 *       knowledgeSources: string[]
 *     }
 *
 *   agreement?: AgreementConfig | null  — null = no checkbox
 *     AgreementConfig {
 *       label:    string
 *       required: boolean
 *     }
 *
 *   // Admin-list display helpers
 *   getTitle:    fn(submission) => string   — main column text
 *   getSubtitle: fn(submission) => string   — secondary column text
 *   getInitials: fn(submission) => string   — avatar letters
 *
 *   // Admin-detail info card
 *   infoCardTitle:  string
 *   infoFields: Array<{ key: string, label: string }>  — rendered inside the info card
 *                  key is a path inside submission.data, e.g. 'about'
 * }
 */

// ─── Shared skill option lists (can be overridden per config) ─────────────────

export const SHARED_KNOWLEDGE_TYPES = ['Academic', 'Professional', 'Practical', 'Research'];

export const SHARED_SUBJECTS_BY_TYPE = {
    Academic:     ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'History', 'Literature'],
    Professional: ['Design', 'Coding', 'Marketing', 'Management', 'Finance', 'Law'],
    Practical:    ['Cooking', 'Crafts', 'Music', 'Sports', 'Photography', 'Woodworking'],
    Research:     ['Data Science', 'Machine Learning', 'Psychology', 'Sociology', 'Economics'],
};

export const SHARED_KNOWLEDGE_SOURCES = [
    'Self-taught', 'University Degree', 'Online Course',
    'Bootcamp', 'Apprenticeship', 'Certification',
];

// ─── Helper ───────────────────────────────────────────────────────────────────

const get = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj);

// ============================================================================
// FORM CONFIGS
// ============================================================================

/**
 * Teacher / Creator application form.
 * Collecting: name, about, skills with certificates and work examples.
 */
export const creatorApplicationConfig = {
    formType:    'tutor',
    title:       'Tutor Application',
    description: 'Fill the form to apply for a tutor role. HRs will contact you after review.',

    apiBase:  toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api'),
    listPath: '/manage/forms',
    viewPath: (id) => `/manage/forms/detail/${id}`,

    // ── Public form fields ────────────────────────────────────────────────────
    fields: [
        { name: 'firstName', label: 'First Name', type: 'text',     required: true,  placeholder: 'John',  col: 6 },
        { name: 'lastName',  label: 'Last Name',  type: 'text',     required: true,  placeholder: 'Smith', col: 6 },
        { name: 'email', label: 'Write your Email address', type: 'email',     required: true,  placeholder: 'example@email.com',  col: 12 },
        { name: 'about',     label: 'Tell us about yourself', type: 'textarea', required: true,
          rows: 4, placeholder: 'Your background, teaching experience, what you are passionate about…' },
    ],

    // ── Skills section ────────────────────────────────────────────────────────
    skills: {
        label:    'Skills',
        required: true,
        minCount: 1,
        knowledgeTypes:   SHARED_KNOWLEDGE_TYPES,
        subjectsByType:   SHARED_SUBJECTS_BY_TYPE,
        knowledgeSources: SHARED_KNOWLEDGE_SOURCES,
    },

    // ── Agreement checkbox ────────────────────────────────────────────────────
    agreement: {
        label:    'I agree to the terms and conditions of the teacher application program',
        required: true,
    },

    // ── Admin list display ────────────────────────────────────────────────────
    getTitle:    (s) => `${s.data?.firstName ?? ''} ${s.data?.lastName ?? ''}`.trim() || '(no name)',
    getSubtitle: (s) => s.data?.about ? `${s.data.about.substring(0, 70)}${s.data.about.length > 70 ? '…' : ''}` : '',
    getInitials: (s) => `${s.data?.firstName?.[0] ?? '?'}${s.data?.lastName?.[0] ?? ''}`,

    // ── Admin detail info card ────────────────────────────────────────────────
    infoCardTitle: 'Applicant Information',
    infoFields: [
        { key: 'about', label: 'About' },
    ],
};

export const tutorApplicationConfig = {
    formType:    'creator',
    title:       'Creator Application',
    description: 'Fill the form to apply for a creator role. HRs will contact you after review.',

    apiBase:  toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api'),
    listPath: '/manage/forms',
    viewPath: (id) => `/manage/forms/detail/${id}`,

    // ── Public form fields ────────────────────────────────────────────────────
    fields: [
        { name: 'firstName', label: 'First Name', type: 'text',     required: true,  placeholder: 'John',  col: 6 },
        { name: 'lastName',  label: 'Last Name',  type: 'text',     required: true,  placeholder: 'Smith', col: 6 },
        { name: 'email', label: 'Write your Email address', type: 'email',     required: true,  placeholder: 'example@email.com',  col: 12 },
        { name: 'about',     label: 'Tell us about yourself', type: 'textarea', required: true,
          rows: 4, placeholder: 'Your background, teaching experience, what you are passionate about…' },
    ],

    // ── Skills section ────────────────────────────────────────────────────────
    skills: {
        label:    'Skills',
        required: true,
        minCount: 1,
        knowledgeTypes:   SHARED_KNOWLEDGE_TYPES,
        subjectsByType:   SHARED_SUBJECTS_BY_TYPE,
        knowledgeSources: SHARED_KNOWLEDGE_SOURCES,
    },

    // ── Agreement checkbox ────────────────────────────────────────────────────
    agreement: {
        label:    'I agree to the terms and conditions of the teacher application program',
        required: true,
    },

    // ── Admin list display ────────────────────────────────────────────────────
    getTitle:    (s) => `${s.data?.firstName ?? ''} ${s.data?.lastName ?? ''}`.trim() || '(no name)',
    getSubtitle: (s) => s.data?.about ? `${s.data.about.substring(0, 70)}${s.data.about.length > 70 ? '…' : ''}` : '',
    getInitials: (s) => `${s.data?.firstName?.[0] ?? '?'}${s.data?.lastName?.[0] ?? ''}`,

    // ── Admin detail info card ────────────────────────────────────────────────
    infoCardTitle: 'Applicant Information',
    infoFields: [
        { key: 'about', label: 'About' },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Add more form types below. Example:
//
export const supportTicketConfig = {
    formType:    'support-ticket',
    title:       'Support Ticket',
    description: 'Report a problem or ask a question.',
    apiBase:     toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api'),
    listPath:    '/manage/forms/support-ticket',
    viewPath:    (id) => `/manage/forms/support-ticket/${id}`,
    fields: [
        { name: 'name',        label: 'Your Name',    type: 'text',   required: true, placeholder: 'John Smith', col: 6 },
        { name: 'email',       label: 'Email',        type: 'email',  required: true, placeholder: 'example@email.com', col: 6 },
        { name: 'subject',     label: 'Subject',      type: 'text',   required: true, placeholder: 'Something doesnt work...'},
        { name: 'description', label: 'Description (Describe your problem in details as much as you can)',  type: 'textarea', required: true, placeholder: 'This or that doesnt work...', rows: 5 },
        { name: 'severity',    label: 'Severity',     type: 'select', required: true,
          options: ['Low', 'Medium', 'High', 'Critical', 'Emergency'] },
    ],
    skills:    null,
    agreement: null,
    getTitle:    (s) => s.data?.subject ?? '(no subject)',
    getSubtitle: (s) => s.data?.name ?? '',
    getInitials: (s) => s.data?.name?.[0] ?? '?',
    infoCardTitle: 'Ticket Information',
    infoFields: [
        { key: 'email',       label: 'Email' },
        { key: 'severity',    label: 'Severity' },
        { key: 'description', label: 'Description' },
    ],
};
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Central map — import this in your router/pages to look up configs by slug.
 * Usage: FORM_CONFIGS['creator-application']
 */
export const FORM_CONFIGS = {
    [creatorApplicationConfig.formType]: creatorApplicationConfig,
    [tutorApplicationConfig.formType]: tutorApplicationConfig,
    [supportTicketConfig.formType]: supportTicketConfig,
};
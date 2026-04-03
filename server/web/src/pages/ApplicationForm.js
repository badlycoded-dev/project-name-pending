import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { FORM_CONFIGS } from "../config/config.forms";
import { UtilityModal } from '../components/UtilityModal';

// ─── Icons ────────────────────────────────────────────────────────────────────

const ICON = {
    close: <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" /></svg>,
    edit:  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.203.134l-4 1.5a.5.5 0 0 1-.635-.635l1.5-4a.5.5 0 0 1 .134-.203l10-10z" /></svg>,
    trash: <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" /><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3h11V2h-11v1z" /></svg>,
    upload:<svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" /><path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" /></svg>,
    file:  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.5L9.5 0H4zm5.5 0v4a.5.5 0 0 0 .5.5H14L9.5 0z" /></svg>,
    link:  <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M6.354 5.5H4a3 3 0 0 0 0 6h3a3 3 0 0 0 2.83-4H9c-.086 0-.17.01-.25.031A2 2 0 0 1 7 10H4a2 2 0 1 1 0-4h1.535c.218-.376.495-.714.82-1z" /><path d="M9 5a3 3 0 0 0-2.83 4h1.098A2 2 0 0 1 9 6h3a2 2 0 1 1 0 4h-1.535a4.02 4.02 0 0 1-.82 1H12a3 3 0 1 0 0-6H9z" /></svg>,
    pencil:<svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.203.134l-4 1.5a.5.5 0 0 1-.635-.635l1.5-4a.5.5 0 0 1 .134-.203l10-10z" /></svg>,
};

// ─── FileRow ──────────────────────────────────────────────────────────────────

function FileRow({ icon, name, onRemove }) {
    return (
        <div className="d-flex align-items-center justify-content-between rounded px-2 py-1 mb-1"
            style={{ background: "#f8f9fa", border: "1px solid #dee2e6", fontSize: "0.82rem" }}>
            <span className="d-flex align-items-center gap-2 text-truncate">
                <span className="text-muted">{icon}</span>
                <span className="text-truncate" style={{ maxWidth: 200 }}>{name}</span>
            </span>
            <button type="button" className="btn btn-link btn-sm p-0 text-danger ms-2" onClick={onRemove}>
                {ICON.close}
            </button>
        </div>
    );
}

// ─── SkillModal ───────────────────────────────────────────────────────────────

function SkillModal({ show, skill, skillConfig, onClose, onSave }) {
    const emptySkill = () => ({ type: "", subject: "", experience: 0, source: "", certificates: [], examples: [] });
    const [form, setForm]         = useState(skill || emptySkill());
    const [errors, setErrors]     = useState({});
    const [exampleUrl, setExampleUrl] = useState("");
    const certRef        = useRef();
    const exampleFileRef = useRef();

    useEffect(() => {
        if (show) { setForm(skill || emptySkill()); setErrors({}); setExampleUrl(""); }
    }, [show, skill]);

    if (!show) return null;

    const set = (field, value) => {
        setForm(prev => ({ ...prev, [field]: value }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: "" }));
    };

    const validate = () => {
        const e = {};
        if (!form.type)    e.type    = "Required";
        if (!form.subject) e.subject = "Required";
        if (form.experience < 0) e.experience = "Must be ≥ 0";
        if (!form.source)  e.source  = "Required";
        if (form.certificates.length === 0) e.certificates = "At least one certificate / diploma is required";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const addCerts = (e) => {
        Array.from(e.target.files).forEach(file => {
            if (!file.type.startsWith("image/") && file.type !== "application/pdf") return;
            set("certificates", [...form.certificates, { file, name: file.name }]);
        });
        e.target.value = "";
        if (errors.certificates) setErrors(prev => ({ ...prev, certificates: "" }));
    };

    const addExampleFiles = (e) => {
        Array.from(e.target.files).forEach(file => {
            set("examples", [...form.examples, { kind: "file", file, name: file.name }]);
        });
        e.target.value = "";
    };

    const addExampleUrl = () => {
        const url = exampleUrl.trim();
        if (!url) return;
        set("examples", [...form.examples, { kind: "link", name: url, url }]);
        setExampleUrl("");
    };

    const subjects = skillConfig?.subjectsByType?.[form.type] ?? [];

    return (
        <>
            <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onClose} />
            <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable">
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header border-bottom">
                            <h5 className="modal-title fw-bold">{skill?._editing ? "Edit Skill" : "Add Skill"}</h5>
                            <button type="button" className="btn-close" onClick={onClose} />
                        </div>
                        <div className="modal-body p-4">
                            <div className="row g-3">

                                {/* Type */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Type of knowledge <span className="text-danger">*</span></label>
                                    <select className={`form-select ${errors.type ? "is-invalid" : ""}`}
                                        value={form.type} onChange={e => { set("type", e.target.value); set("subject", ""); }}>
                                        <option value="">Select type…</option>
                                        {(skillConfig?.knowledgeTypes ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {errors.type && <div className="invalid-feedback">{errors.type}</div>}
                                </div>

                                {/* Subject */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Subject <span className="text-danger">*</span></label>
                                    <select className={`form-select ${errors.subject ? "is-invalid" : ""}`}
                                        value={form.subject} onChange={e => set("subject", e.target.value)} disabled={!form.type}>
                                        <option value="">Select subject…</option>
                                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {!form.type && <small className="text-muted">Select type first</small>}
                                    {errors.subject && <div className="invalid-feedback">{errors.subject}</div>}
                                </div>

                                {/* Experience */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Experience (in full years) <span className="text-danger">*</span></label>
                                    <input type="number" className={`form-control ${errors.experience ? "is-invalid" : ""}`}
                                        value={form.experience} min={0}
                                        onChange={e => set("experience", parseInt(e.target.value, 10) || 0)} />
                                    {errors.experience && <div className="invalid-feedback">{errors.experience}</div>}
                                </div>

                                {/* Source */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Source of knowledge <span className="text-danger">*</span></label>
                                    <select className={`form-select ${errors.source ? "is-invalid" : ""}`}
                                        value={form.source} onChange={e => set("source", e.target.value)}>
                                        <option value="">Select source…</option>
                                        {(skillConfig?.knowledgeSources ?? []).map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                    {errors.source && <div className="invalid-feedback">{errors.source}</div>}
                                </div>

                                {/* Certificates */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Certificate / Diploma <span className="text-danger">*</span></label>
                                    <input ref={certRef} type="file" className="d-none" accept="image/*,application/pdf" multiple onChange={addCerts} />
                                    <div className="border rounded p-3 text-center mb-2"
                                        style={{ cursor: "pointer", borderStyle: "dashed", background: "#f8f9fa", minHeight: 64 }}
                                        onClick={() => certRef.current.click()}>
                                        <div className="text-muted small">{ICON.upload}<span className="ms-2">Add files (PDF or image)</span></div>
                                    </div>
                                    {errors.certificates && <div className="text-danger small mb-1">{errors.certificates}</div>}
                                    {form.certificates.map((c, i) => (
                                        <FileRow key={i} icon={ICON.file} name={c.name}
                                            onRemove={() => set("certificates", form.certificates.filter((_, j) => j !== i))} />
                                    ))}
                                </div>

                                {/* Examples */}
                                <div className="col-12">
                                    <label className="form-label fw-semibold">Examples of work</label>
                                    <input ref={exampleFileRef} type="file" className="d-none" accept=".zip,application/zip" multiple onChange={addExampleFiles} />
                                    <div className="border rounded p-3 text-center mb-2"
                                        style={{ cursor: "pointer", borderStyle: "dashed", background: "#f8f9fa", minHeight: 64 }}
                                        onClick={() => exampleFileRef.current.click()}>
                                        <div className="text-muted small">{ICON.upload}<span className="ms-2">Add archive or paste link</span></div>
                                    </div>
                                    <div className="input-group mb-2">
                                        <input type="text" className="form-control"
                                            placeholder="Or paste cloud storage link (Drive, Dropbox…)"
                                            value={exampleUrl} onChange={e => setExampleUrl(e.target.value)}
                                            onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addExampleUrl())} />
                                        <button type="button" className="btn btn-outline-secondary" onClick={addExampleUrl}>Add</button>
                                    </div>
                                    {form.examples.map((ex, i) => (
                                        <FileRow key={i} icon={ex.kind === "link" ? ICON.link : ICON.file} name={ex.name}
                                            onRemove={() => set("examples", form.examples.filter((_, j) => j !== i))} />
                                    ))}
                                </div>

                            </div>
                        </div>
                        <div className="modal-footer border-top">
                            <button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancel</button>
                            <button type="button" className="btn btn-primary px-4" onClick={() => validate() && onSave(form)}>
                                {skill?._editing ? "UPDATE" : "ADD"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── SkillRow ─────────────────────────────────────────────────────────────────

function SkillRow({ skill, onEdit, onDelete }) {
    return (
        <div className="d-flex align-items-center justify-content-between rounded px-3 py-2 mb-2"
            style={{ border: "1px solid #dee2e6", background: "#fff", fontSize: "0.875rem" }}>
            <span className="d-flex flex-wrap gap-2 align-items-center text-truncate">
                <span className="fw-semibold">{skill.type}</span>
                <span className="text-muted">|</span>
                <span>{skill.subject}</span>
                <span className="text-muted">|</span>
                <span>{skill.experience} yr{skill.experience !== 1 ? "s" : ""}</span>
                <span className="text-muted">|</span>
                <span className="text-muted">{skill.source}</span>
                {skill.certificates.length > 0 && (
                    <span className="badge bg-success-subtle text-success-emphasis">
                        {skill.certificates.length} cert{skill.certificates.length !== 1 ? "s" : ""}
                    </span>
                )}
            </span>
            <span className="d-flex gap-1 ms-3 flex-shrink-0">
                <button type="button" className="btn btn-warning btn-sm" style={{ width: 28, height: 28, padding: 0 }} onClick={onEdit}>{ICON.edit}</button>
                <button type="button" className="btn btn-danger btn-sm"  style={{ width: 28, height: 28, padding: 0 }} onClick={onDelete}>{ICON.trash}</button>
            </span>
        </div>
    );
}

// ─── Generic field renderer ───────────────────────────────────────────────────

function FormField({ field, value, onChange, error }) {
    const { name, label, type, required, placeholder, rows, options, col = 12 } = field;
    const id = `field_${name}`;
    const cls = `form-control${error ? " is-invalid" : ""}`;

    const inputEl = () => {
        if (type === "textarea") {
            return <textarea id={id} name={name} className={cls} rows={rows ?? 3}
                placeholder={placeholder} value={value} onChange={onChange} />;
        }
        if (type === "select") {
            return (
                <select id={id} name={name} className={`form-select${error ? " is-invalid" : ""}`}
                    value={value} onChange={onChange}>
                    <option value="">Select…</option>
                    {(options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        }
        // text, email, tel, number
        return <input type={type} id={id} name={name} className={cls}
            placeholder={placeholder} value={value} onChange={onChange} />;
    };

    return (
        <div className={`col-12${col !== 12 ? ` col-sm-${col}` : ""}`}>
            <label htmlFor={id} className="form-label fw-semibold">
                {label}{required && <span className="text-danger ms-1">*</span>}
            </label>
            {inputEl()}
            {error && <div className="invalid-feedback">{error}</div>}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

/**
 * Config-driven public form.
 *
 * Props:
 *   formType  {string}  — key in FORM_CONFIGS (e.g. 'creator-application')
 *   data      {object}  — shared app-level data (Navbar)
 *   onLogout  {fn}
 *
 * To add a new form type, add its config to formConfigs.js and render:
 *   <CreatorForm formType="support-ticket" data={data} onLogout={onLogout} />
 */
function CreatorForm({ formType, data, onLogout }) {
    const config   = FORM_CONFIGS[formType];
    const navigate = useNavigate();

    // ── State — ALL hooks must come before any conditional return ─────────────

    const initialFields = () =>
        Object.fromEntries(((config?.fields) ?? []).map(f => [f.name, f.type === "checkbox" ? false : ""]));

    const [fieldValues, setFieldValues] = useState(initialFields);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete  = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
    const [skills, setSkills]           = useState([]);
    const [agreed, setAgreed]           = useState(false);
    const [errors, setErrors]           = useState({});
    const [submitting, setSubmitting]   = useState(false);
    const [submitted, setSubmitted]     = useState(false);

    // Modal state
    const [modalOpen, setModalOpen]       = useState(false);
    const [editingSkill, setEditingSkill] = useState(null);
    const [editingIndex, setEditingIndex] = useState(null);

    // Guard — must come AFTER all hooks
    if (!config) {
        return <div className="alert alert-danger m-4">Unknown form type: {formType}</div>;
    }

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleFieldChange = (e) => {
        const { name, value, type: t, checked } = e.target;
        setFieldValues(prev => ({ ...prev, [name]: t === "checkbox" ? checked : value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    };

    const openAddSkill   = () => { setEditingSkill({ type:"",subject:"",experience:0,source:"",certificates:[],examples:[] }); setEditingIndex(null);  setModalOpen(true); };
    const openEditSkill  = (i) => { setEditingSkill({ ...skills[i], _editing: true }); setEditingIndex(i); setModalOpen(true); };
    const handleModalSave = (skill) => {
        if (editingIndex !== null) {
            setSkills(prev => { const a = [...prev]; a[editingIndex] = skill; return a; });
        } else {
            setSkills(prev => [...prev, skill]);
        }
        if (errors.skills) setErrors(prev => ({ ...prev, skills: "" }));
        setModalOpen(false);
    };
    const deleteSkill = (i) => {
        showConfirm('Remove Skill', 'Are you sure you want to remove this skill?', () => {
            setSkills(prev => prev.filter((_, j) => j !== i));
        });
    };

    // ── Validation ────────────────────────────────────────────────────────────

    const validate = () => {
        const e = {};
        (config.fields ?? []).forEach(f => {
            if (f.required && !fieldValues[f.name]) e[f.name] = `${f.label} is required`;
        });
        if (config.skills?.required && skills.length === 0) {
            e.skills = `Add at least ${config.skills.minCount ?? 1} skill`;
        }
        if (config.agreement?.required && !agreed) {
            e.agreed = "You must agree to continue";
        }
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    // ── Submit ────────────────────────────────────────────────────────────────

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validate()) return;

        setSubmitting(true);
        try {
            const fd = new FormData();

            // All scalar fields as JSON blob
            fd.append("data", JSON.stringify(fieldValues));

            // Skills — extract files out, keep link examples and metadata in JSON
            const skillsForJson = skills.map(s => ({
                ...s,
                certificates: [],  // files sent separately
                examples: s.examples.filter(ex => ex.kind === "link"),
            }));
            fd.append("skills", JSON.stringify(skillsForJson));

            // Append per-skill files
            skills.forEach((skill, i) => {
                skill.certificates.forEach(c => fd.append(`cert_${i}`, c.file));
                skill.examples.filter(ex => ex.kind === "file").forEach(ex => fd.append(`example_${i}`, ex.file));
            });


            const res = await fetch(`${config.apiBase}/forms/apply/${config.formType}`, {
                method: "POST",
                body: fd,
            });

            if (res.ok) {
                setSubmitted(true);
            } else {
                const json = await res.json().catch(() => ({}));
                showInfo('Error', json.message ?? "Submission failed. Please try again.");
            }
        } catch (err) {
            console.error("[CreatorForm] submit:", err);
            showInfo('Error', 'Network error. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    // ── Success screen ────────────────────────────────────────────────────────

    if (submitted) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center p-4" style={{ background: "#f0f4f8" }}>
                <div className="card border-0 shadow-sm text-center p-5" style={{ maxWidth: 420 }}>
                    <div className="mb-3">
                        <span className="badge bg-success rounded-circle p-3" style={{ fontSize: "1.5rem" }}>✓</span>
                    </div>
                    <h4 className="fw-bold mb-2">Submitted!</h4>
                    <p className="text-muted mb-4">{config.description}</p>
                    <button className="btn btn-outline-primary" onClick={() => { setSubmitted(false); setFieldValues(initialFields()); setSkills([]); setAgreed(false); }}>
                        Submit another
                    </button>
                    <br/>
                    <button className="btn btn-outline-secondary"
                        onClick={() => navigate("/manage/forms")}>
                        Return
                    </button>
                </div>
            </div>
        );
    }

    // ── Form ──────────────────────────────────────────────────────────────────

    return (
    <AppLayout data={data} onLogout={onLogout} title="">
<div className="min-vh-100 p-3 p-md-5" style={{ background: "#f0f4f8" }}>
                <div className="row justify-content-center">
                    <div className="col-12 col-lg-7 col-xl-6">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4 p-md-5">

                                {/* Header */}
                                <div className="mb-4">
                                    <h2 className="h4 fw-bold text-dark mb-1">{config.title}</h2>
                                    <p className="text-muted small mb-0">{config.description}</p>
                                </div>

                                <form onSubmit={handleSubmit} noValidate>
                                    <div className="row g-3">

                                        {/* Dynamic fields */}
                                        {config.fields.map(field => (
                                            <FormField
                                                key={field.name}
                                                field={field}
                                                value={fieldValues[field.name]}
                                                onChange={handleFieldChange}
                                                error={errors[field.name]}
                                            />
                                        ))}

                                        {/* Skills section */}
                                        {config.skills && (
                                            <div className="col-12">
                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                    <label className="form-label fw-semibold mb-0">
                                                        {config.skills.label}
                                                        {config.skills.required && <span className="text-danger ms-1">*</span>}
                                                    </label>
                                                    <button type="button" className="btn btn-primary btn-sm" onClick={openAddSkill}>+ Add</button>
                                                </div>
                                                {errors.skills && <div className="text-danger small mb-2">{errors.skills}</div>}
                                                {skills.length === 0 ? (
                                                    <div className="text-center text-muted small rounded py-3"
                                                        style={{ border: "1px dashed #ced4da", background: "#fafafa" }}>
                                                        No skills added yet — click <strong>+ Add</strong>
                                                    </div>
                                                ) : (
                                                    skills.map((skill, i) => (
                                                        <SkillRow key={i} skill={skill}
                                                            onEdit={() => openEditSkill(i)}
                                                            onDelete={() => deleteSkill(i)} />
                                                    ))
                                                )}
                                            </div>
                                        )}

                                        {/* Agreement */}
                                        {config.agreement && (
                                            <div className="col-12">
                                                <div className="form-check">
                                                    <input type="checkbox" id="agreed" className={`form-check-input ${errors.agreed ? "is-invalid" : ""}`}
                                                        checked={agreed} onChange={e => { setAgreed(e.target.checked); if (errors.agreed) setErrors(p => ({ ...p, agreed: "" })); }} />
                                                    <label htmlFor="agreed" className="form-check-label small">
                                                        {config.agreement.label}
                                                        {config.agreement.required && <span className="text-danger ms-1">*</span>}
                                                    </label>
                                                    {errors.agreed && <div className="invalid-feedback">{errors.agreed}</div>}
                                                </div>
                                            </div>
                                        )}

                                        {/* Submit */}
                                        <div className="col-12 mt-2">
                                            <button type="submit" className="btn btn-primary w-100" disabled={submitting}>
                                                {submitting ? <><span className="spinner-border spinner-border-sm me-2" />Submitting…</> : "Submit"}
                                            </button>
                                        </div>

                                    </div>
                                </form>

                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Skill modal */}
            {config.skills && (
                <SkillModal
                    show={modalOpen}
                    skill={editingSkill}
                    skillConfig={config.skills}
                    onClose={() => setModalOpen(false)}
                    onSave={handleModalSave}
                />
            )}
            <UtilityModal
                show={modal.show}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                danger={modal.danger}
                confirmToken={modal.confirmToken}
                tokenLabel={modal.tokenLabel}
                deleteLabel={modal.deleteLabel || 'Delete'}
                onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
                onDelete={() => { modal.onDelete?.(); closeModal(); }}
                onCancel={modal.onCancel || closeModal}
                onClose={modal.onClose || closeModal}
            />

        </AppLayout>

    );
}

export default CreatorForm;
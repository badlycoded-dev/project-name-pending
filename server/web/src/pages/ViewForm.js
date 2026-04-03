import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from '../components/Layout';
import { FORM_CONFIGS } from "../config/config.forms";
import { useStatusEmail } from "../components/sendEmail";
import { UtilityModal } from '../components/UtilityModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────


const STATUS_BADGE = {
    pending: "bg-warning text-dark",
    "under-review": "bg-info text-dark",
    approved: "bg-success",
    rejected: "bg-danger",
};
const statusBadge = (s) => STATUS_BADGE[s?.toLowerCase()] ?? "bg-light text-dark";

const ALL_STATUSES = ["pending", "under-review", "approved", "rejected"];

const formatDate = (d) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
};

const FILE_ICON = { image: "🖼️", video: "🎬", audio: "🎵", document: "📄", archive: "📦", other: "📎" };

function fileType(filename = "") {
    const s = filename.toLowerCase();
    if ([".jpg", ".jpeg", ".png", ".gif", ".webp"].some(e => s.endsWith(e))) return "image";
    if ([".mp4", ".webm", ".mov", ".avi"].some(e => s.endsWith(e))) return "video";
    if ([".mp3", ".wav", ".aac", ".flac"].some(e => s.endsWith(e))) return "audio";
    if ([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt"].some(e => s.endsWith(e))) return "document";
    if ([".zip", ".rar", ".7z"].some(e => s.endsWith(e))) return "archive";
    return "other";
}

const fallbackTitle = (sub) => (sub?.data?.firstName || sub?.data?.lastName)
    ? `${sub.data.firstName ?? ""} ${sub.data.lastName ?? ""}`.trim()
    : sub?.data?.name ?? sub?.data?.subject ?? `(${sub?.formType ?? "unknown"})`;

const fallbackInitials = (sub) => { const t = fallbackTitle(sub); return t.length ? t[0].toUpperCase() : "?"; };

/**
 * Resolve the email for a submission.
 * Checks data.email first, then scans config fields for any type:"email" field
 * so it works for any form type regardless of what the field is named.
 */
const getEmail = (sub, config) => {
    if (sub?.data?.email) return sub.data.email;
    if (config?.fields) {
        const emailField = config.fields.find(f => f.type === "email");
        if (emailField) return sub?.data?.[emailField.name] ?? null;
    }
    return null;
};

const API_BASE = process.env.REACT_APP_API_URL + "";

// ─── FileRow ──────────────────────────────────────────────────────────────────

function FileRow({ name, url, onDelete, isLink = false }) {
    const icon = isLink ? "🔗" : FILE_ICON[fileType(name)];
    const href = url?.startsWith("http") ? url : `${API_BASE.replace("/api", "")}${url}`;
    return (
        <div className="d-flex align-items-center justify-content-between rounded px-2 py-1 mb-1"
            style={{ background: "#f8f9fa", border: "1px solid #dee2e6", fontSize: "0.82rem" }}>
            <a href={href} target="_blank" rel="noopener noreferrer"
                className="d-flex align-items-center gap-2 text-decoration-none text-dark text-truncate flex-grow-1">
                <span style={{ fontSize: "1rem" }}>{icon}</span>
                <span className="text-truncate" style={{ maxWidth: 280 }}>{name}</span>
            </a>
            {onDelete && (
                <button type="button" className="btn btn-link btn-sm p-0 ms-2 text-danger flex-shrink-0" onClick={onDelete}>
                    <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                    </svg>
                </button>
            )}
        </div>
    );
}

// ─── SkillCard ────────────────────────────────────────────────────────────────

function SkillCard({ skill, skillIndex, submissionId, submissionFormType, token, onFileDeleted }) {
    const [open, setOpen] = useState(false);
    const [scModal, setScModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null });
    const scClose = () => setScModal(p => ({ ...p, show: false }));
    const scConfirm = (title, message, onConfirm, danger = false) => setScModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: scClose });

    const deleteFile = (filename) => {
        scConfirm('Delete File', `Delete "${filename}"?`, async () => {
            try {
                const res = await fetch(
                    `${API_BASE}/manage/forms/detail/${submissionId}/files/${skillIndex}/${filename}`,
                    { method: "DELETE", headers: { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}` } }
                );
                if (res.ok) onFileDeleted();
            } catch (err) {
                console.error("[ViewForm] deleteFile:", err);
            }
        }, true);
    };

    return (
        <>
            <UtilityModal show={scModal.show} type={scModal.type} title={scModal.title} message={scModal.message}
                danger={scModal.danger}
                onConfirm={() => { scModal.onConfirm?.(); scClose(); }}
                onCancel={scModal.onCancel || scClose} onClose={scClose} />
            <div className="card border mb-2 shadow-none">
                <div className="card-header bg-white d-flex align-items-center justify-content-between py-2 px-3"
                    style={{ cursor: "pointer" }} onClick={() => setOpen(v => !v)}>
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                        <span className="badge bg-primary bg-opacity-10 text-primary fw-semibold">{skill.type}</span>
                        <span className="fw-semibold">{skill.subject}</span>
                        <span className="text-muted small">{skill.experience} yr{skill.experience !== 1 ? "s" : ""}</span>
                        <span className="badge bg-light text-dark border">{skill.source}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                        {skill.certificates?.length > 0 && (
                            <span className="badge bg-success-subtle text-success-emphasis">
                                {skill.certificates.length} cert{skill.certificates.length !== 1 ? "s" : ""}
                            </span>
                        )}
                        {skill.examples?.length > 0 && (
                            <span className="badge bg-info-subtle text-info-emphasis">
                                {skill.examples.length} example{skill.examples.length !== 1 ? "s" : ""}
                            </span>
                        )}
                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"
                            style={{ transition: "transform .2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
                            <path fillRule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z" />
                        </svg>
                    </div>
                </div>
                {open && (
                    <div className="card-body p-3">
                        <div className="row g-3">
                            <div className="col-12 col-md-6">
                                <p className="small fw-semibold text-muted text-uppercase mb-2">
                                    Certificates / Diplomas ({skill.certificates?.length ?? 0})
                                </p>
                                {skill.certificates?.length > 0
                                    ? skill.certificates.map((c, i) => (
                                        <FileRow key={i} name={c.originalName || c.filename} url={c.url}
                                            onDelete={() => deleteFile(c.filename)} />
                                    ))
                                    : <p className="text-muted small fst-italic mb-0">No certificates</p>}
                            </div>
                            <div className="col-12 col-md-6">
                                <p className="small fw-semibold text-muted text-uppercase mb-2">
                                    Work Examples ({skill.examples?.length ?? 0})
                                </p>
                                {skill.examples?.length > 0
                                    ? skill.examples.map((ex, i) => (
                                        <FileRow key={i} name={ex.name || ex.originalName} url={ex.url}
                                            isLink={ex.kind === "link"}
                                            onDelete={ex.kind === "file" ? () => deleteFile(ex.filename) : undefined} />
                                    ))
                                    : <p className="text-muted small fst-italic mb-0">No examples</p>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

// ─── GenericDataFields ────────────────────────────────────────────────────────

function GenericDataFields({ submission, config }) {
    const d = submission.data ?? {};

    if (config?.infoFields?.length) {
        return (
            <>
                {config.infoFields.map(({ key, label }) => {
                    const value = key.split(".").reduce((o, k) => o?.[k], d);
                    if (!value) return null;
                    return (
                        <div key={key} className="mb-3">
                            <p className="small fw-semibold text-muted text-uppercase mb-1">{label}</p>
                            <p className="mb-0" style={{ lineHeight: 1.7 }}>{value}</p>
                        </div>
                    );
                })}
            </>
        );
    }

    const entries = Object.entries(d).filter(([, v]) => typeof v !== "object" || v === null);
    if (!entries.length) return null;
    return (
        <div className="row g-2">
            {entries.map(([key, value]) => (
                <div key={key} className="col-12 col-md-6 mb-2">
                    <p className="small fw-semibold text-muted text-uppercase mb-1">{key}</p>
                    <p className="mb-0 small" style={{ lineHeight: 1.7, wordBreak: "break-word" }}>{String(value)}</p>
                </div>
            ))}
        </div>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

function ViewForm({ data, onLogout }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const { sendStatusEmail, sending: emailSending, lastResult: emailResult } = useStatusEmail();

    const [submission, setSubmission] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal = () => setModal(p => ({ ...p, show: false }));
    const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
    const [newStatus, setNewStatus] = useState("");
    const [reviewNote, setReviewNote] = useState("");
    const [statusSaved, setStatusSaved] = useState(false);

    const config = submission ? (FORM_CONFIGS[submission.formType] ?? null) : null;

    const authHeaders = {
        Authorization: `${token?.split(" ")[0]} ${token?.split(" ")[1]}`,
        "Content-Type": "application/json",
    };

    const fetchSubmission = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/manage/forms/detail/${id}`, {
                method: "GET", headers: authHeaders,
            });
            if (res.ok) {
                const json = await res.json();
                const s = json.data;
                setSubmission(s);
                setNewStatus(s.status);
                setReviewNote(s.reviewNote || "");
            } else {
                showInfo('Error', 'Failed to load submission');
                navigate("/manage/forms");
            }
        } catch (err) {
            console.error("[ViewForm] fetch:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (token) fetchSubmission(); }, [id]);

    const handleSaveStatus = async () => {
        setSaving(true);
        setStatusSaved(false);
        try {
            const res = await fetch(`${API_BASE}/manage/forms/detail/${id}`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ status: newStatus, reviewNote }),
            });
            if (res.ok) {
                const json = await res.json();
                const saved = json.data;
                setSubmission(saved);
                setStatusSaved(true);
                setTimeout(() => setStatusSaved(false), 2500);

                // ── Send notification email if status actually changed ──────────
                if (saved.status !== submission.status) {
                    await sendStatusEmail(saved, saved.status);
                }
            }
        } catch (err) {
            console.error("[ViewForm] saveStatus:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const title = config ? config.getTitle(submission) : fallbackTitle(submission);
        showConfirm('Delete Submission', `Permanently delete "${title}"? All uploaded files will be removed. This cannot be undone.`,
            async () => {
                try {
                    const res = await fetch(`${API_BASE}/manage/forms/detail/${id}`, {
                        method: "DELETE", headers: authHeaders,
                    });
                    if (res.ok) navigate("/manage/forms");
                } catch (err) {
                    console.error("[ViewForm] delete:", err);
                }
            }, true);
    };

    if (loading) {
        return (
    <AppLayout data={data} onLogout={onLogout} title="View Submission">
<div className="min-vh-100 d-flex align-items-center justify-content-center">
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading…</span>
                        </div>
                        <p className="text-muted">Loading submission…</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    if (!submission) return null;

    const hasChanged = newStatus !== submission.status || reviewNote !== (submission.reviewNote || "");
    const displayTitle = config ? config.getTitle(submission) : fallbackTitle(submission);
    const initials = config ? config.getInitials(submission) : fallbackInitials(submission);
    const email = getEmail(submission, config);

    return (
    <AppLayout data={data} onLogout={onLogout} title="View Submission">
<div className="min-vh-100 bg-light p-3 p-md-4">

                {/* Header */}
                <div className="row mb-4">
                    <div className="col-12">
                        <button className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 mb-2"
                            onClick={() => navigate("/manage/forms")}>
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
                            </svg>
                            Back to All Forms
                        </button>
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                            <h1 className="h3 fw-bold text-dark mb-0">{displayTitle}</h1>
                            <span className={`badge rounded-pill ${statusBadge(submission.status)}`} style={{ fontSize: "0.65rem" }}>
                                {submission.status}
                            </span>
                            <span className="badge bg-light text-dark border" style={{ fontSize: "0.65rem" }}>
                                {config?.title ?? submission.formType}
                            </span>
                        </div>
                        <p className="text-muted small mb-0">
                            Submitted {formatDate(submission.createdAt)}
                            {submission.reviewedAt && ` · Reviewed ${formatDate(submission.reviewedAt)}`}
                        </p>
                    </div>
                </div>

                <div className="row g-4">

                    {/* ── Left column ──────────────────────────────────────── */}
                    <div className="col-12 col-lg-8">

                        {/* Info card */}
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-white border-bottom py-2 px-3">
                                <h6 className="mb-0 fw-semibold">
                                    {config?.infoCardTitle ?? "Submission Details"}
                                </h6>
                            </div>
                            <div className="card-body p-4">
                                <div className="d-flex align-items-center gap-3 mb-3">
                                    <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0"
                                        style={{ width: 56, height: 56, fontSize: "1.2rem" }}>
                                        {initials}
                                    </div>
                                    <div>
                                        <div className="fw-bold fs-5">{displayTitle}</div>
                                        {email && (
                                            <div className="small mt-1">
                                                <svg width="13" height="13" fill="#6c757d" className="me-1 mb-1" viewBox="0 0 16 16">
                                                    <path d="M0 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V4zm2-1a1 1 0 0 0-1 1v.217l7 4.2 7-4.2V4a1 1 0 0 0-1-1H2zm13 2.383-4.708 2.825L15 11.105V5.383zm-.034 6.876-5.64-3.471L8 9.583l-1.326-.795-5.64 3.47A1 1 0 0 0 2 13h12a1 1 0 0 0 .966-.741zM1 11.105l4.708-2.897L1 5.383v5.722z" />
                                                </svg>
                                                <a href={`mailto:${(email === 'root@local.com') ? 'badlycoded.edu@local.com' : email}`} className="text-decoration-none text-muted">{(email === 'root@local.com') ? 'badlycoded.edu@local.com' : email}</a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <GenericDataFields submission={submission} config={config} />
                            </div>
                        </div>

                        {/* Skills card */}
                        {submission.skills?.length > 0 && (
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-2 px-3">
                                    <h6 className="mb-0 fw-semibold">
                                        Skills
                                        <span className="badge bg-secondary ms-2">{submission.skills.length}</span>
                                    </h6>
                                    <small className="text-muted">Click a skill to expand files. Click on uploaded items opens/downloads it.</small>
                                </div>
                                <div className="card-body p-3">
                                    {submission.skills.map((skill, i) => (
                                        <SkillCard
                                            key={i}
                                            skill={skill}
                                            skillIndex={i}
                                            submissionId={submission._id}
                                            submissionFormType={submission.formType}
                                            token={token}
                                            onFileDeleted={fetchSubmission}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Right column: review panel ─────────────────────── */}
                    <div className="col-12 col-lg-4">
                        <div className="card border-0 shadow-sm mb-3 sticky-top" style={{ top: "1rem" }}>
                            <div className="card-header bg-white border-bottom py-2 px-3">
                                <h6 className="mb-0 fw-semibold">Review</h6>
                            </div>
                            <div className="card-body p-3">

                                {/* Current status */}
                                <div className="mb-3">
                                    <p className="small fw-semibold text-muted text-uppercase mb-1">Current Status</p>
                                    <span className={`badge rounded-pill fs-6 px-3 py-2 ${statusBadge(submission.status)}`}>
                                        {submission.status}
                                    </span>
                                </div>

                                {/* Change status */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Change Status</label>
                                    <div className="d-grid gap-1">
                                        {ALL_STATUSES.map(s => (
                                            <button key={s} type="button"
                                                className={`btn btn-sm text-start d-flex align-items-center gap-2 ${newStatus === s ? "btn-primary" : "btn-outline-secondary"}`}
                                                onClick={() => setNewStatus(s)}>
                                                <span className={`badge rounded-circle p-1 ${statusBadge(s)}`} style={{ width: 10, height: 10 }} />
                                                {s.charAt(0).toUpperCase() + s.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Review note */}
                                <div className="mb-3">
                                    <label className="form-label fw-semibold small">Review Note</label>
                                    <textarea className="form-control form-control-sm" rows={4}
                                        placeholder="Internal note for this review decision…"
                                        value={reviewNote} onChange={e => setReviewNote(e.target.value)} />
                                </div>

                                {/* Save */}
                                <button type="button"
                                    className={`btn btn-primary w-100 btn-sm mb-2 ${!hasChanged ? "opacity-50" : ""}`}
                                    onClick={handleSaveStatus} disabled={saving || !hasChanged}>
                                    {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving…</> :
                                        statusSaved ? <>✓ Saved</> : <>Save Changes</>}
                                </button>

                                {statusSaved && (
                                    <div className="alert alert-success py-1 px-2 small mb-2">Status updated.</div>
                                )}
                            </div>

                            {/* Meta */}
                            <div className="card-footer bg-white border-top p-3">
                                <table className="table table-sm table-borderless mb-0 small">
                                    <tbody>
                                        <tr><td className="text-muted fw-semibold pe-3">Form Type</td><td>{config?.title ?? submission.formType}</td></tr>
                                        {email && (
                                            <tr>
                                                <td className="text-muted fw-semibold pe-3">Email</td>
                                                <td><a href={`mailto:${(email === 'root@local.com') ? 'badlycoded.edu@local.com' : email}`} className="text-decoration-none text-dark">{(email === 'root@local.com') ? 'badlycoded.edu@local.com' : email}</a></td>
                                            </tr>
                                        )}
                                        <tr><td className="text-muted fw-semibold pe-3">Submitted</td><td>{formatDate(submission.createdAt)}</td></tr>
                                        {submission.reviewedAt && (
                                            <tr><td className="text-muted fw-semibold pe-3">Reviewed</td><td>{formatDate(submission.reviewedAt)}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Danger zone */}
                            <div className="card-footer bg-white border-top p-3">
                                <button type="button" className="btn btn-outline-danger btn-sm w-100" onClick={handleDelete}>
                                    <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
                                        <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3h11V2h-11v1z" />
                                    </svg>
                                    Delete Submission
                                </button>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
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

export default ViewForm;
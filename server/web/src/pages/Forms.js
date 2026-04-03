import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { extendSession } from "../utils/utils";
import { FORM_CONFIGS } from "../config/config.forms";

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

const getConfig = (sub) => FORM_CONFIGS[sub?.formType] ?? null;

const fallbackTitle = (sub) => (sub?.data?.firstName || sub?.data?.lastName)
    ? `${sub.data.firstName ?? ""} ${sub.data.lastName ?? ""}`.trim()
    : sub?.data?.name ?? sub?.data?.subject ?? `(${sub?.formType ?? "unknown"})`;
const fallbackSubtitle = (sub) => sub?.data?.about ?? sub?.data?.description ?? "";
const fallbackInitials = (sub) => { const t = fallbackTitle(sub); return t.length ? t[0].toUpperCase() : "?"; };

const getTitle = (sub) => getConfig(sub)?.getTitle(sub) ?? fallbackTitle(sub);
const getSubtitle = (sub) => getConfig(sub)?.getSubtitle(sub) ?? fallbackSubtitle(sub);
const getInitials = (sub) => getConfig(sub)?.getInitials(sub) ?? fallbackInitials(sub);

/**
 * Resolve the email for a row.
 * Checks sub.data.email first (explicit field), then scans all config fields
 * for any field of type "email" and reads its value — so it works for any
 * form type that has an email field regardless of what the field is named.
 */
const getEmail = (sub) => {
    if (sub?.data?.email) return sub.data.email;
    const config = getConfig(sub);
    if (config?.fields) {
        const emailField = config.fields.find(f => f.type === "email");
        if (emailField) return sub.data?.[emailField.name] ?? null;
    }
    return null;
};

const viewPath = (id) => `/manage/forms/detail/${id}`;

const API_BASE = process.env.REACT_APP_API_URL + "";

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({ show, title, message, onConfirm, onCancel, danger = false }) {
    if (!show) return null;
    return (
        <>
            <div className="modal-backdrop fade show" style={{ zIndex: 1040 }} onClick={onCancel} />
            <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header border-bottom">
                            <h5 className="modal-title fw-bold">{title}</h5>
                            <button type="button" className="btn-close" onClick={onCancel} />
                        </div>
                        <div className="modal-body">{message}</div>
                        <div className="modal-footer border-top">
                            <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
                            <button className={`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick={onConfirm}>
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

function Forms({ data, onLogout }) {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");

    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("");
    const [selectedFormType, setSelectedFormType] = useState("");
    const [confirm, setConfirm] = useState(null);
    const [sortBy, setSortBy] = useState('date');
    const [sortDir, setSortDir] = useState('desc');

    const authHeaders = {
        Authorization: `${token?.split(" ")[0]} ${token?.split(" ")[1]}`,
        "Content-Type": "application/json",
    };

    const fetchSubmissions = async (opts = {}) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (opts.formType) params.set('formType', opts.formType);
            if (opts.status)   params.set('status',   opts.status);
            if (opts.search)   params.set('search',   opts.search);
            const qs = params.toString() ? `?${params.toString()}` : '';
            const res = await fetch(`${API_BASE}/manage/forms${qs}`, {
                method: "GET", headers: authHeaders,
            });
            if (res.status === 401) await extendSession(data);
            if (res.ok) {
                const json = await res.json();
                setSubmissions(json.data ?? []);
            }
        } catch (err) {
            console.error("[Forms] fetch:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { if (token) fetchSubmissions(); }, []);

    const quickStatus = async (id, newStatus) => {
        try {
            const res = await fetch(`${API_BASE}/manage/forms/detail/${id}`, {
                method: "PATCH",
                headers: authHeaders,
                body: JSON.stringify({ status: newStatus }),
            });
            if (res.ok) fetchSubmissions();
        } catch (err) {
            console.error("[Forms] quickStatus:", err);
        }
    };

    const deleteSubmission = async (id) => {
        try {
            const res = await fetch(`${API_BASE}/manage/forms/detail/${id}`, {
                method: "DELETE", headers: authHeaders,
            });
            if (res.ok) fetchSubmissions();
        } catch (err) {
            console.error("[Forms] delete:", err);
        }
    };

    const handleConfirm = () => {
        if (!confirm) return;
        if (confirm.action === "delete") deleteSubmission(confirm.id);
        else quickStatus(confirm.id, confirm.action);
        setConfirm(null);
    };

    const dataTypes = [...new Set(submissions.map(s => s.formType).filter(Boolean))];
    const knownTypes = Object.keys(FORM_CONFIGS);
    const allFormTypes = [...new Set([...knownTypes, ...dataTypes])].sort();

    const filtered = (() => {
        let result = submissions.filter(s => {
            const text = searchText.toLowerCase();
            const email = getEmail(s)?.toLowerCase() ?? "";
            const matchText = !text || getTitle(s).toLowerCase().includes(text) || getSubtitle(s).toLowerCase().includes(text) || email.includes(text);
            const matchStatus = !selectedStatus || s.status === selectedStatus;
            const matchFormType = !selectedFormType || s.formType === selectedFormType;
            return matchText && matchStatus && matchFormType;
        });
        result = [...result].sort((a, b) => {
            if (sortBy === 'date')   { return sortDir==='asc' ? new Date(a.createdAt)-new Date(b.createdAt) : new Date(b.createdAt)-new Date(a.createdAt); }
            if (sortBy === 'name')   { const cmp=getTitle(a).localeCompare(getTitle(b)); return sortDir==='asc'?cmp:-cmp; }
            if (sortBy === 'status') { const cmp=(a.status||'').localeCompare(b.status||''); return sortDir==='asc'?cmp:-cmp; }
            if (sortBy === 'type')   { const cmp=(a.formType||'').localeCompare(b.formType||''); return sortDir==='asc'?cmp:-cmp; }
            return 0;
        });
        return result;
    })();

    const statusCounts = submissions
        .filter(s => !selectedFormType || s.formType === selectedFormType)
        .reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

    const formTypeCounts = submissions.reduce((acc, s) => {
        acc[s.formType] = (acc[s.formType] || 0) + 1; return acc;
    }, {});


    if (loading) {
        return (
    <AppLayout data={data} onLogout={onLogout} title="Applications">
<div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 56px)' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" style={{ width: '2.5rem', height: '2.5rem' }}></div>
                        <p className="text-muted small mb-0">Loading forms…</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

        return (
    <AppLayout data={data} onLogout={onLogout} title="Applications">
<div className="min-vh-100 bg-light p-3 p-md-4">

                {/* Header */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
                            <div>
                                <h1 className="h3 fw-bold text-dark mb-1">All Form Submissions</h1>
                                <p className="text-muted mb-0 small">Review and manage submissions across all form types</p>
                            </div>
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                                <select className="form-select form-select-sm w-50" 
                                    onChange={e => navigate(`${e.target.value}`)}>
                                    <option value="#">Select Form</option>
                                    <option value="/creator/apply">Creator Form</option>
                                    <option value="/tutor/apply">Tutor Form</option>
                                    <option value="/support/open-ticket">Support Ticket</option>
                                </select>
                                {/* <button className="btn btn-primary btn-sm" onClick={() => navigate('/creator/apply')}>
                                    <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                    </svg>
                                    Apply Form
                                </button> */}
                                <button className="btn btn-sm btn-outline-primary" onClick={fetchSubmissions} disabled={loading}>
                                    {loading ? <><span className="spinner-border spinner-border-sm me-1" />Loading…</> : "↺ Refresh"}
                                </button>
                                <span className="badge bg-primary rounded-pill p-2 px-3">
                                    {filtered.length}{filtered.length !== submissions.length ? ` / ${submissions.length}` : ""} submission{submissions.length !== 1 ? "s" : ""}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Form-type filter pills */}
                {allFormTypes.length > 1 && (
                    <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
                        <span className="text-muted small">Form type:</span>
                        {allFormTypes.map(ft => (
                            <button key={ft}
                                className={`btn btn-sm rounded-pill ${selectedFormType === ft ? "btn-primary" : "btn-outline-secondary"}`}
                                onClick={() => setSelectedFormType(prev => prev === ft ? "" : ft)}>
                                <span className="badge bg-secondary rounded-pill me-1">{formTypeCounts[ft] ?? 0}</span>
                                {FORM_CONFIGS[ft]?.title ?? ft}
                            </button>
                        ))}
                        {selectedFormType && (
                            <button className="btn btn-sm btn-link text-danger p-0" onClick={() => setSelectedFormType("")}>
                                Clear
                            </button>
                        )}
                    </div>
                )}

                {/* Status filter pills */}
                <div className="d-flex flex-wrap gap-2 mb-3">
                    {ALL_STATUSES.map(s => (
                        <button key={s}
                            className={`btn btn-sm rounded-pill ${selectedStatus === s ? "btn-primary" : "btn-outline-secondary"}`}
                            onClick={() => setSelectedStatus(prev => prev === s ? "" : s)}>
                            <span className={`badge rounded-pill me-1 ${statusBadge(s)}`}>{statusCounts[s] ?? 0}</span>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                    {selectedStatus && (
                        <button className="btn btn-sm btn-link text-danger p-0 align-self-center"
                            onClick={() => setSelectedStatus("")}>
                            Clear filter
                        </button>
                    )}
                </div>

                {/* Search bar */}
                <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body p-3">
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-md-7">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0">
                                        <svg width="16" height="16" fill="#6c757d" viewBox="0 0 16 16">
                                            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242 6a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                                        </svg>
                                    </span>
                                    <input type="text" className="form-control border-start-0 ps-0"
                                        placeholder="Search by name, email, subject…"
                                        value={searchText} onChange={e => setSearchText(e.target.value)} />
                                    {searchText && (
                                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSearchText("")}>✕</button>
                                    )}
                                </div>
                            </div>
                            <div className="col-12 col-md-3">
                                <select className="form-select form-select-sm" value={selectedStatus}
                                    onChange={e => setSelectedStatus(e.target.value)}>
                                    <option value="">All statuses</option>
                                    {ALL_STATUSES.map(s => (
                                        <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                    ))}
                                </select>
                            </div>
                                    <div className="input-group input-group-sm" style={{maxWidth:200}}>
                                        <select className="form-select form-select-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                            <option value="date">Sort: Date</option>
                                            <option value="name">Sort: Name</option>
                                            <option value="status">Sort: Status</option>
                                            <option value="type">Sort: Type</option>
                                        </select>
                                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSortDir(d => d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑':'↓'}</button>
                                    </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th className="fw-semibold text-muted small text-uppercase py-3" style={{ width: 42 }}>#</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Applicant</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Email</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Form Type</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Skills</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Status</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Submitted</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3 text-end" style={{ width: 180 }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length > 0 ? filtered.map((sub, idx) => (
                                    <tr key={sub._id} className="align-middle">
                                        <td className="text-muted">{idx + 1}</td>

                                        {/* Applicant */}
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary fw-bold flex-shrink-0"
                                                    style={{ width: 34, height: 34, fontSize: "0.8rem" }}>
                                                    {getInitials(sub)}
                                                </div>
                                                <div>
                                                    <div className="fw-semibold">{getTitle(sub)}</div>
                                                    <div className="text-muted small text-truncate" style={{ maxWidth: 200 }}>
                                                        {getSubtitle(sub)}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>

                                        {/* Email — read from data.email or any email-type field in config */}
                                        <td className="small">
                                            {(() => {
                                                const email = getEmail(sub);
                                                
                                                return email
                                                    ? <a href={`mailto:${(email === 'root@local.com') ? 'badlycoded.edu@local.com' : email}`} className="text-decoration-none text-muted">
                                                        {(email === 'root@local.com') ? 'badlycoded.edu@local.com' : email}
                                                    </a>
                                                    : <span className="text-muted">—</span>;
                                            })()}
                                        </td>

                                        {/* Form type */}
                                        <td>
                                            <span className="badge bg-light text-dark border" style={{ fontSize: "0.72rem" }}>
                                                {FORM_CONFIGS[sub.formType]?.title ?? sub.formType}
                                            </span>
                                        </td>

                                        {/* Skills preview */}
                                        <td>
                                            <div className="d-flex flex-wrap gap-1">
                                                {(sub.skills ?? []).slice(0, 2).map((s, i) => (
                                                    <span key={i} className="badge bg-light text-dark border" style={{ fontSize: "0.72rem" }}>
                                                        {s.subject}
                                                    </span>
                                                ))}
                                                {sub.skills?.length > 2 && (
                                                    <span className="badge bg-secondary" style={{ fontSize: "0.72rem" }}>+{sub.skills.length - 2}</span>
                                                )}
                                                {(!sub.skills || sub.skills.length === 0) && <span className="text-muted small">—</span>}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td>
                                            <span className={`badge rounded-pill ${statusBadge(sub.status)}`}>{sub.status}</span>
                                        </td>

                                        {/* Date */}
                                        <td className="text-muted small">{formatDate(sub.createdAt)}</td>

                                        {/* Actions */}
                                        <td className="text-end">
                                            <div className="btn-group btn-group-sm">
                                                <button type="button" className="btn btn-outline-primary" title="View"
                                                    onClick={() => navigate(viewPath(sub._id))}>
                                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" /><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" /></svg>
                                                </button>
                                                {sub.status !== "approved" && (
                                                    <button type="button" className="btn btn-outline-success" title="Approve"
                                                        onClick={() => setConfirm({ id: sub._id, action: "approved", label: `Approve "${getTitle(sub)}"?` })}>
                                                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M10.97 4.97a.75.75 0 0 1 1.07 1.05l-3.99 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425z" /></svg>
                                                    </button>
                                                )}
                                                {sub.status !== "rejected" && (
                                                    <button type="button" className="btn btn-outline-warning" title="Reject"
                                                        onClick={() => setConfirm({ id: sub._id, action: "rejected", label: `Reject "${getTitle(sub)}"?` })}>
                                                        <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" /></svg>
                                                    </button>
                                                )}
                                                <button type="button" className="btn btn-outline-danger" title="Delete"
                                                    onClick={() => setConfirm({ id: sub._id, action: "delete", label: `Permanently delete "${getTitle(sub)}"? This cannot be undone.` })}>
                                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" /><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3h11V2h-11v1z" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="8" className="text-center py-5">
                                            <div className="text-muted">
                                                <svg width="40" height="40" fill="currentColor" viewBox="0 0 16 16" className="mb-3 opacity-50"><path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /></svg>
                                                {submissions.length === 0
                                                    ? <><p className="mb-0 fw-semibold">No submissions yet</p><small>They will appear here once submitted</small></>
                                                    : <><p className="mb-0 fw-semibold">No matches</p><small>Try adjusting your search or filters</small></>
                                                }
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ConfirmModal
                show={!!confirm}
                title={confirm?.action === "delete" ? "Delete Submission" : confirm?.action === "approved" ? "Approve" : "Reject"}
                message={confirm?.label}
                danger={confirm?.action === "delete" || confirm?.action === "rejected"}
                onConfirm={handleConfirm}
                onCancel={() => setConfirm(null)}
            />
        </AppLayout>
    );
}

export default Forms;
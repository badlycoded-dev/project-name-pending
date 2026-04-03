import { useEffect, useState } from "react";
import AppLayout from '../components/Layout';
import { UtilityModal } from "../components/UtilityModal";

function Keys({ data, onLogout }) {
    const token = localStorage.getItem("token");
    const ah = token
        ? { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}`, "Content-Type": "application/json" }
        : {};

    const [keys, setKeys] = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copied, setCopied] = useState(null);

    // Generate form
    const [genCourseIds, setGenCourseIds] = useState([]);
    const [genAmount, setGenAmount] = useState(1);
    const [genNote, setGenNote] = useState("");
    const [genExpiry, setGenExpiry] = useState("");
    const [genErrors, setGenErrors] = useState({});
    const [showGenForm, setShowGenForm] = useState(false);

    // Filter
    const [filterStatus, setFilterStatus] = useState("all");
    const [search, setSearch] = useState("");

    // Modal
    const [modal, setModal] = useState({ show: false, type: "info", title: "", message: "", confirmToken: "", tokenLabel: "", onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal = () => setModal(p => ({ ...p, show: false }));
    const showInfo = (title, message) => setModal({ show: true, type: "info", title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: "confirm", danger, title, message, onConfirm, onCancel: closeModal });

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [keysRes, coursesRes] = await Promise.all([
                fetch(process.env.REACT_APP_API_URL + "/keys", { headers: ah }),
                fetch(process.env.REACT_APP_API_URL + "/manage/courses", { headers: ah })
            ]);
            if (keysRes.ok) { const d = await keysRes.json(); setKeys(d.data || []); }
            if (coursesRes.ok) { const d = await coursesRes.json(); setCourses(d.data || []); }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleGenerate = async (e) => {
        e.preventDefault();
        const errs = {};
        if (genCourseIds.length === 0) errs.courses = "Select at least one course";
        if (!genAmount || genAmount < 1 || genAmount > 100) errs.amount = "Amount must be 1–100";
        setGenErrors(errs);
        if (Object.keys(errs).length > 0) return;

        setGenerating(true);
        try {
            const res = await fetch(process.env.REACT_APP_API_URL + "/keys", {
                method: "POST", headers: ah,
                body: JSON.stringify({
                    courseIds: genCourseIds,
                    amount: parseInt(genAmount),
                    note: genNote.trim(),
                    expiresAt: genExpiry || undefined
                })
            });
            if (res.ok) {
                showInfo("Generated", `${genAmount} key(s) generated successfully.`);
                setGenCourseIds([]); setGenAmount(1); setGenNote(""); setGenExpiry("");
                setShowGenForm(false);
                fetchAll();
            } else {
                const err = await res.json();
                showInfo("Error", err.message || "Failed to generate keys");
            }
        } catch (e) { showInfo("Error", "Network error"); }
        setGenerating(false);
    };

    const handleDelete = (key) => {
        showConfirm("Delete Key", `Delete key ${key.code}? This cannot be undone.`, async () => {
            try {
                const res = await fetch(`${process.env.REACT_APP_API_URL}/keys/${key._id}`, { method: "DELETE", headers: ah });
                if (res.ok) { setKeys(p => p.filter(k => k._id !== key._id)); }
                else { const err = await res.json(); showInfo("Error", err.message); }
            } catch (e) { showInfo("Error", "Network error"); }
        }, true);
    };

    const copyCode = (code) => {
        navigator.clipboard.writeText(code).catch(() => {});
        setCopied(code);
        setTimeout(() => setCopied(null), 2000);
    };

    const toggleCourse = (id) =>
        setGenCourseIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

    const getCourseTitle = (c) => c?.trans?.[0]?.title || c?.title || "(untitled)";

    const filtered = keys.filter(k => {
        if (filterStatus === "redeemed" && !k.isRedeemed) return false;
        if (filterStatus === "available" && (k.isRedeemed || k.isExpired)) return false;
        if (filterStatus === "expired" && !k.isExpired) return false;
        if (search) {
            const q = search.toLowerCase();
            return k.code.toLowerCase().includes(q) ||
                k.note?.toLowerCase().includes(q) ||
                k.courses?.some(c => c.title.toLowerCase().includes(q));
        }
        return true;
    });

    const statusBadge = (key) => {
        if (key.isRedeemed) return <span className="badge bg-success">Redeemed</span>;
        if (key.isExpired) return <span className="badge bg-danger">Expired</span>;
        return <span className="badge bg-primary">Available</span>;
    };

    if (loading) return (
    <AppLayout data={data} onLogout={onLogout} title="Product Keys">
<div className="flex-grow-1 d-flex align-items-center justify-content-center">
                <div className="spinner-border text-primary" /><span className="ms-2 text-muted">Loading…</span>
            </div>
        </AppLayout>
    );

    return (
    <AppLayout data={data} onLogout={onLogout} title="Product Keys">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>

                {/* Header */}
                <div className="row mb-4">
                    <div className="col-12 d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                            <h1 className="h3 fw-bold text-dark mb-1">Product Keys</h1>
                            <p className="text-muted mb-0 small">Generate and manage course redemption keys</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowGenForm(p => !p)}>
                            {showGenForm ? "Cancel" : "+ Generate Keys"}
                        </button>
                    </div>
                </div>

                {/* Generate Form */}
                {showGenForm && (
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white fw-semibold">Generate New Keys</div>
                        <div className="card-body">
                            <form onSubmit={handleGenerate}>
                                <div className="row g-3">
                                    {/* Course picker */}
                                    <div className="col-12">
                                        <label className="form-label fw-semibold">Courses <span className="text-danger">*</span></label>
                                        <div className="border rounded p-2" style={{ maxHeight: 240, overflowY: "auto" }}>
                                            {courses.length === 0 ? (
                                                <p className="text-muted small mb-0">No courses available</p>
                                            ) : courses.filter(c=>c.isPrivateCopy === false).map(c => (
                                                <div key={c._id} className="form-check">
                                                    <input className="form-check-input" type="checkbox"
                                                        id={`c-${c._id}`} checked={genCourseIds.includes(c._id)}
                                                        onChange={() => toggleCourse(c._id)} />
                                                    <label className="form-check-label small" htmlFor={`c-${c._id}`}>
                                                        {getCourseTitle(c)}
                                                        <span className="text-muted ms-1">(${c.price ?? 0})</span>
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        {genErrors.courses && <div className="text-danger small mt-1">{genErrors.courses}</div>}
                                    </div>

                                    {/* Amount */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Amount <span className="text-danger">*</span></label>
                                        <input type="number" className={`form-control ${genErrors.amount ? "is-invalid" : ""}`}
                                            value={genAmount} onChange={e => setGenAmount(e.target.value)}
                                            min={1} max={100} />
                                        {genErrors.amount && <div className="invalid-feedback">{genErrors.amount}</div>}
                                        <small className="text-muted">Max 100 per batch</small>
                                    </div>

                                    {/* Note */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Note <span className="text-muted">(optional)</span></label>
                                        <input type="text" className="form-control" placeholder="e.g. Batch for course launch"
                                            value={genNote} onChange={e => setGenNote(e.target.value)} maxLength={120} />
                                    </div>

                                    {/* Expiry */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Expiry <span className="text-muted">(optional)</span></label>
                                        <input type="datetime-local" className="form-control"
                                            value={genExpiry} onChange={e => setGenExpiry(e.target.value)} />
                                        <small className="text-muted">Leave blank for no expiry</small>
                                    </div>

                                    <div className="col-12 d-flex justify-content-end">
                                        <button type="submit" className="btn btn-primary" disabled={generating}>
                                            {generating
                                                ? <><span className="spinner-border spinner-border-sm me-2" />Generating…</>
                                                : `Generate ${genAmount} Key${genAmount > 1 ? "s" : ""}`}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="row mb-3 g-2 align-items-center">
                    <div className="col-12 col-md-5">
                        <input type="text" className="form-control form-control-sm" placeholder="Search by code, note, or course…"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="col-auto">
                        {["all", "available", "redeemed", "expired"].map(s => (
                            <button key={s} className={`btn btn-sm me-1 ${filterStatus === s ? "btn-dark" : "btn-outline-secondary"}`}
                                onClick={() => setFilterStatus(s)}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="col-auto ms-auto">
                        <small className="text-muted">{filtered.length} / {keys.length} keys</small>
                    </div>
                </div>

                {/* Keys table */}
                <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Code</th>
                                    <th>Courses</th>
                                    <th>Note</th>
                                    <th>Status</th>
                                    <th>Redeemed by</th>
                                    <th>Expires</th>
                                    <th>Created</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={8} className="text-center text-muted py-4">No keys found</td></tr>
                                ) : filtered.map(key => (
                                    <tr key={key._id}>
                                        <td>
                                            <code className="user-select-all" style={{ fontSize: "0.9rem" }}>{key.code}</code>
                                            <button className="btn btn-sm btn-link p-0 ms-2" onClick={() => copyCode(key.code)}
                                                title="Copy code">
                                                {copied === key.code
                                                    ? <i className="bi bi-check text-success"></i>
                                                    : <i className="bi bi-clipboard"></i>}
                                            </button>
                                        </td>
                                        <td>
                                            <div style={{ maxWidth: 220 }}>
                                                {(key.courses || []).map(c => (
                                                    <div key={c._id} className="small text-truncate">{c.title}</div>
                                                ))}
                                            </div>
                                        </td>
                                        <td><small className="text-muted">{key.note || "—"}</small></td>
                                        <td>{statusBadge(key)}</td>
                                        <td>
                                            {key.redeemedBy
                                                ? <><small>{key.redeemedBy}</small><br />
                                                    <small className="text-muted">{key.redeemedAt ? new Date(key.redeemedAt).toLocaleDateString() : ""}</small></>
                                                : <span className="text-muted">—</span>}
                                        </td>
                                        <td>
                                            {key.expiresAt
                                                ? <small className={key.isExpired ? "text-danger" : "text-muted"}>{new Date(key.expiresAt).toLocaleDateString()}</small>
                                                : <small className="text-muted">Never</small>}
                                        </td>
                                        <td><small className="text-muted">{new Date(key.createdAt).toLocaleDateString()}</small></td>
                                        <td>
                                            {!key.isRedeemed && (
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(key)} title="Delete key">
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <UtilityModal
                show={modal.show} type={modal.type} title={modal.title} message={modal.message}
                danger={modal.danger}
                onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
                onCancel={modal.onCancel || closeModal} onClose={modal.onClose || closeModal}
            />
        </AppLayout>
    );
}

export default Keys;

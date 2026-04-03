import { useEffect, useState } from "react";
import AppLayout from '../components/Layout';
import { UtilityModal } from "../components/UtilityModal";

function Promos({ data, onLogout }) {
    const token = localStorage.getItem("token");
    const ah = token
        ? { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}`, "Content-Type": "application/json" }
        : {};

    const [promos, setPromos]   = useState([]);
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving]   = useState(false);
    const [showForm, setShowForm] = useState(false);

    const [form, setForm] = useState({
        code: "", courseIds: [], discountType: "percent",
        discountValue: "", maxUses: "", expiresAt: "", note: ""
    });
    const [formErrors, setFormErrors] = useState({});
    const [filterStatus, setFilterStatus] = useState("all");
    const [search, setSearch] = useState("");

    const [modal, setModal] = useState({ show: false, type: "info", title: "", message: "", onConfirm: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (t, m) => setModal({ show: true, type: "info", title: t, message: m, onClose: closeModal });
    const showConfirm = (t, m, fn, d = false) => setModal({ show: true, type: "confirm", danger: d, title: t, message: m, onConfirm: fn, onCancel: closeModal });

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [pr, cr] = await Promise.all([
                fetch(process.env.REACT_APP_API_URL + "/promos", { headers: ah }),
                fetch(process.env.REACT_APP_API_URL + "/manage/courses", { headers: ah })
            ]);
            if (pr.ok) { const d = await pr.json(); setPromos(d.data || []); }
            if (cr.ok) { const d = await cr.json(); setCourses(d.data || []); }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const getCourseTitle = (c) => c?.trans?.[0]?.title || "(untitled)";

    const validate = () => {
        const e = {};
        if (!form.code.trim()) e.code = "Code is required";
        if (!form.discountValue || isNaN(+form.discountValue) || +form.discountValue <= 0)
            e.discountValue = "Enter a positive number";
        if (form.discountType === "percent" && +form.discountValue > 100)
            e.discountValue = "Percent cannot exceed 100";
        setFormErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!validate()) return;
        setSaving(true);
        try {
            const res = await fetch(process.env.REACT_APP_API_URL + "/promos", {
                method: "POST", headers: ah,
                body: JSON.stringify({
                    code: form.code, courseIds: form.courseIds,
                    discountType: form.discountType, discountValue: +form.discountValue,
                    maxUses: form.maxUses ? +form.maxUses : undefined,
                    expiresAt: form.expiresAt || undefined,
                    note: form.note
                })
            });
            if (res.ok) {
                showInfo("Created", "Promo code created successfully.");
                setForm({ code: "", courseIds: [], discountType: "percent", discountValue: "", maxUses: "", expiresAt: "", note: "" });
                setShowForm(false); fetchAll();
            } else { const err = await res.json(); showInfo("Error", err.message); }
        } catch (e) { showInfo("Error", "Network error"); }
        setSaving(false);
    };

    const handleToggle = async (promo) => {
        try {
            const res = await fetch(`${process.env.REACT_APP_API_URL}/promos/${promo._id}/toggle`, { method: "PATCH", headers: ah });
            if (res.ok) { const d = await res.json(); setPromos(p => p.map(x => x._id === promo._id ? { ...x, active: d.data.active } : x)); }
        } catch (e) { showInfo("Error", "Network error"); }
    };

    const handleDelete = (promo) => {
        showConfirm("Delete Promo", `Delete code "${promo.code}"? This cannot be undone.`, async () => {
            try {
                const res = await fetch(`${process.env.REACT_APP_API_URL}/promos/${promo._id}`, { method: "DELETE", headers: ah });
                if (res.ok) setPromos(p => p.filter(x => x._id !== promo._id));
                else { const err = await res.json(); showInfo("Error", err.message); }
            } catch (e) { showInfo("Error", "Network error"); }
        }, true);
    };

    const toggleCourse = (id) =>
        setForm(p => ({ ...p, courseIds: p.courseIds.includes(id) ? p.courseIds.filter(x => x !== id) : [...p.courseIds, id] }));

    const filtered = promos.filter(p => {
        if (filterStatus === "active"   && (!p.active || p.isExpired || p.isExhausted)) return false;
        if (filterStatus === "inactive" && (p.active && !p.isExpired && !p.isExhausted)) return false;
        if (search) {
            const q = search.toLowerCase();
            return p.code.toLowerCase().includes(q) || p.note?.toLowerCase().includes(q) ||
                p.courses?.some(c => c.title.toLowerCase().includes(q));
        }
        return true;
    });

    const statusBadge = (p) => {
        if (!p.active)      return <span className="badge bg-secondary">Inactive</span>;
        if (p.isExpired)    return <span className="badge bg-danger">Expired</span>;
        if (p.isExhausted)  return <span className="badge bg-warning text-dark">Exhausted</span>;
        return <span className="badge bg-success">Active</span>;
    };

    if (loading) return (
    <AppLayout data={data} onLogout={onLogout} title="Promo Codes">
<div className="flex-grow-1 d-flex align-items-center justify-content-center">
            <div className="spinner-border text-primary" />
        </div>
        </AppLayout>
    );

    return (
    <AppLayout data={data} onLogout={onLogout} title="Promo Codes">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>

                {/* Header */}
                <div className="row mb-4">
                    <div className="col-12 d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <div>
                            <h1 className="h3 fw-bold mb-1">Promo Codes</h1>
                            <p className="text-muted small mb-0">Discount codes for your courses</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => setShowForm(p => !p)}>
                            {showForm ? "Cancel" : "+ New Promo"}
                        </button>
                    </div>
                </div>

                {/* Create Form */}
                {showForm && (
                    <div className="card border-0 shadow-sm mb-4">
                        <div className="card-header bg-white fw-semibold">Create Promo Code</div>
                        <div className="card-body">
                            <form onSubmit={handleCreate}>
                                <div className="row g-3">
                                    {/* Code */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Code <span className="text-danger">*</span></label>
                                        <input type="text" className={`form-control text-uppercase ${formErrors.code ? "is-invalid" : ""}`}
                                            value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                                            placeholder="e.g. LAUNCH20" maxLength={32} />
                                        {formErrors.code && <div className="invalid-feedback">{formErrors.code}</div>}
                                    </div>

                                    {/* Discount type + value */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Discount <span className="text-danger">*</span></label>
                                        <div className="input-group">
                                            <select className="form-select" style={{ maxWidth: 110 }}
                                                value={form.discountType} onChange={e => setForm(p => ({ ...p, discountType: e.target.value }))}>
                                                <option value="percent">%</option>
                                                <option value="flat">$ flat</option>
                                            </select>
                                            <input type="number" className={`form-control ${formErrors.discountValue ? "is-invalid" : ""}`}
                                                value={form.discountValue} onChange={e => setForm(p => ({ ...p, discountValue: e.target.value }))}
                                                placeholder={form.discountType === "percent" ? "0–100" : "0.00"} min={0} step={0.01} />
                                            {formErrors.discountValue && <div className="invalid-feedback">{formErrors.discountValue}</div>}
                                        </div>
                                    </div>

                                    {/* Max uses */}
                                    <div className="col-12 col-md-2">
                                        <label className="form-label fw-semibold">Max Uses</label>
                                        <input type="number" className="form-control" placeholder="∞"
                                            value={form.maxUses} onChange={e => setForm(p => ({ ...p, maxUses: e.target.value }))} min={1} />
                                        <small className="text-muted">Blank = unlimited</small>
                                    </div>

                                    {/* Expiry */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Expires At</label>
                                        <input type="datetime-local" className="form-control"
                                            value={form.expiresAt} onChange={e => setForm(p => ({ ...p, expiresAt: e.target.value }))} />
                                    </div>

                                    {/* Note */}
                                    <div className="col-12 col-md-4">
                                        <label className="form-label fw-semibold">Note</label>
                                        <input type="text" className="form-control" placeholder="Internal note (optional)"
                                            value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} maxLength={120} />
                                    </div>

                                    {/* Course picker */}
                                    <div className="col-12">
                                        <label className="form-label fw-semibold">
                                            Applies to <span className="text-muted fw-normal">(blank = all your courses)</span>
                                        </label>
                                        <div className="border rounded p-2" style={{ maxHeight: 200, overflowY: "auto" }}>
                                            {courses.length === 0
                                                ? <p className="text-muted small mb-0">No courses found</p>
                                                : courses.map(c => (
                                                    <div key={c._id} className="form-check">
                                                        <input className="form-check-input" type="checkbox" id={`pc-${c._id}`}
                                                            checked={form.courseIds.includes(c._id)}
                                                            onChange={() => toggleCourse(c._id)} />
                                                        <label className="form-check-label small" htmlFor={`pc-${c._id}`}>
                                                            {getCourseTitle(c)} <span className="text-muted">(${c.price ?? 0})</span>
                                                        </label>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>

                                    <div className="col-12 d-flex justify-content-end">
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
                                            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : "Create Promo"}
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
                        <input type="text" className="form-control form-control-sm" placeholder="Search code, note, course…"
                            value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div className="col-auto">
                        {["all", "active", "inactive"].map(s => (
                            <button key={s} className={`btn btn-sm me-1 ${filterStatus === s ? "btn-dark" : "btn-outline-secondary"}`}
                                onClick={() => setFilterStatus(s)}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </button>
                        ))}
                    </div>
                    <div className="col-auto ms-auto">
                        <small className="text-muted">{filtered.length} / {promos.length}</small>
                    </div>
                </div>

                {/* Table */}
                <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0 align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Code</th>
                                    <th>Discount</th>
                                    <th>Courses</th>
                                    <th>Uses</th>
                                    <th>Expires</th>
                                    <th>Status</th>
                                    <th>Note</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0
                                    ? <tr><td colSpan={8} className="text-center text-muted py-4">No promos found</td></tr>
                                    : filtered.map(p => (
                                        <tr key={p._id}>
                                            <td><code className="user-select-all">{p.code}</code></td>
                                            <td>
                                                <span className="badge bg-info text-dark">
                                                    {p.discountType === "percent" ? `${p.discountValue}%` : `$${p.discountValue}`} off
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ maxWidth: 200 }}>
                                                    {p.courses?.length === 0
                                                        ? <small className="text-muted">All courses</small>
                                                        : p.courses?.map(c => <div key={c._id} className="small text-truncate">{c.title}</div>)}
                                                </div>
                                            </td>
                                            <td>
                                                <small>{p.usedCount}{p.maxUses !== null ? ` / ${p.maxUses}` : ""}</small>
                                            </td>
                                            <td>
                                                {p.expiresAt
                                                    ? <small className={p.isExpired ? "text-danger" : "text-muted"}>{new Date(p.expiresAt).toLocaleDateString()}</small>
                                                    : <small className="text-muted">Never</small>}
                                            </td>
                                            <td>{statusBadge(p)}</td>
                                            <td><small className="text-muted">{p.note || "—"}</small></td>
                                            <td>
                                                <div className="d-flex gap-1">
                                                    <button className={`btn btn-sm ${p.active ? "btn-outline-warning" : "btn-outline-success"}`}
                                                        onClick={() => handleToggle(p)} title={p.active ? "Disable" : "Enable"}>
                                                        {p.active ? <i className="bi bi-pause-fill"></i> : <i className="bi bi-play-fill"></i>}
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(p)} title="Delete">
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <UtilityModal show={modal.show} type={modal.type} title={modal.title} message={modal.message}
                danger={modal.danger}
                onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
                onCancel={modal.onCancel || closeModal} onClose={modal.onClose || closeModal} />
        </AppLayout>
    );
}

export default Promos;

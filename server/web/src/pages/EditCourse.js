import { toHttps } from '../utils/utils';
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from '../components/Layout';
import AuthImage from "../components/AuthImage";
import { UtilityModal } from '../components/UtilityModal';

// ── Language registry — add new languages here ──────────────────────────────
const LANG_LABELS = {
    en: "English", ua: "Ukrainian", de: "German", fr: "French",
    es: "Spanish", pl: "Polish", it: "Italian", pt: "Portuguese",
    zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
    tr: "Turkish", nl: "Dutch", sv: "Swedish", cs: "Czech",
};
const ALL_LANGS = Object.keys(LANG_LABELS);
const emptyTrans  = () => ({ title: "", description: "", skills: [], volumes: [] });

function EditCourse({ data, onLogout }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const ah = token ? { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}`, "Content-Type": "application/json" } : {};
    const mh = token ? { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}` } : {};

    const [loading, setLoading]         = useState(true);
    const [saving, setSaving]           = useState(false);
    const [users, setUsers]             = useState([]);
    const [directions, setDirections]   = useState([]);
    const [levels, setLevels]           = useState([]);

    // Lang state
    const [baseLang, setBaseLang]       = useState("en");
    const [addLangs, setAddLangs]       = useState([]);
    const [trans, setTrans]             = useState([emptyTrans()]);
    const [activeLang, setActiveLang]   = useState(0);
    const [skillInputs, setSkillInputs] = useState([""]);

    const [formData, setFormData] = useState({ userId: "", status: "", direction: "", level: "", price: "", courseType: "SELF_TAUGHT", links: [] });
    const [errors, setErrors]     = useState({});

    // File states
    const [thumbnail, setThumbnail]               = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    // per-language pending files: { [langCode]: File[] }
    const [courseFiles, setCourseFiles]           = useState({});
    const [existingFiles, setExistingFiles]       = useState([]);
    // File filter/sort for existingFiles
    const [fileSearch, setFileSearch]   = useState('');
    const [fileTypeFilter, setFileTypeFilter] = useState('all');
    const [fileSortBy, setFileSortBy]   = useState('name'); // 'name' | 'date' | 'type' | 'size'
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete  = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });

    // Move an item in a list up (-1) or down (+1)
    const moveItem = (setter, idx, dir) => {
        setter(prev => {
            const arr = [...prev];
            const target = idx + dir;
            if (target < 0 || target >= arr.length) return arr;
            [arr[idx], arr[target]] = [arr[target], arr[idx]];
            return arr;
        });
    };

    const isSystemTextFile = (fn) => /^vol-\d+-ch-\d+-item-\d+-\d+\.txt$/i.test(fn);

    useEffect(() => {
        if (!token) return;
        const fetchAll = async () => {
            try {
                const [courseRes, usersRes, dirsRes, lvlsRes, filesRes] = await Promise.all([
                    fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}`, { headers: ah }),
                    fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/manage/users", { headers: ah }),
                    fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/directions", { headers: ah }),
                    fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/levels", { headers: ah }),
                    fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}/files`, { headers: ah })
                ]);

                if (!courseRes.ok) { showInfo('Error', 'Failed to fetch course details'); navigate("/manage/courses"); return; }
                const { data: course } = await courseRes.json();

                setBaseLang(course.base_lang || "en");
                const al = Array.isArray(course.add_langs) ? course.add_langs : [];
                setAddLangs(al);

                const langs = [course.base_lang || "en", ...al];
                const loadedTrans = Array.isArray(course.trans) && course.trans.length > 0
                    ? langs.map((_, i) => ({
                        title:       course.trans[i]?.title       || "",
                        description: course.trans[i]?.description || "",
                        skills:      Array.isArray(course.trans[i]?.skills) ? course.trans[i].skills : [],
                        // For base lang (idx 0) use top-level volumes; for others use trans[i].volumes
                        volumes:     i === 0
                            ? (course.volumes || [])
                            : (Array.isArray(course.trans[i]?.volumes) ? course.trans[i].volumes : [])
                      }))
                    : langs.map((_, i) => ({ ...emptyTrans(), volumes: i === 0 ? (course.volumes || []) : [] }));
                setTrans(loadedTrans);
                setSkillInputs(langs.map(() => ""));

                setFormData({
                    userId:     course.userId     || "",
                    status:     course.status     || "editing",
                    direction:  course.direction  || "",
                    level:      course.level      || "",
                    courseType: course.courseType || "SELF_TAUGHT",
                    price:      course.price?.toString() || "",
                    links:      course.links      || []
                });

                if (usersRes.ok) { const d = await usersRes.json(); setUsers(d.data || d); }
                if (dirsRes.ok)  { const d = await dirsRes.json();  setDirections(d.data || []); }
                if (lvlsRes.ok)  { const d = await lvlsRes.json();  setLevels(d.data || []); }

                // Use course.links (from MongoDB) — the disk /files endpoint doesn't carry lang metadata
                const fromLinks = (course.links || []).filter(f => {
                    const fn = (f.description || f.filename || "").toLowerCase();
                    return !fn.includes("thumbnail") && !isSystemTextFile(f.description || f.filename || "");
                }).map(f => ({ ...f, originalName: f.description || f.filename, lang: f.lang || null }));
                if (fromLinks.length > 0) {
                    setExistingFiles(fromLinks);
                } else if (filesRes.ok) {
                    // Fallback to disk listing for courses that predate the links schema
                    const d = await filesRes.json();
                    const all = d.data || d.files || [];
                    setExistingFiles(all.filter(f => {
                        const fn = (f.originalName || f.filename || "").toLowerCase();
                        return !fn.includes("thumbnail") && !isSystemTextFile(f.originalName || f.filename || "");
                    }));
                }
            } catch (err) {
                console.error(err); showInfo('Error', 'Error loading course details'); navigate("/manage/courses");
            } finally { setLoading(false); }
        };
        fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const allLangs = [baseLang, ...addLangs];

    const toggleAddLang = (lang) => {
        if (addLangs.includes(lang)) {
            const idx = addLangs.indexOf(lang);
            setAddLangs(p => p.filter(l => l !== lang));
            setTrans(p => p.filter((_, i) => i !== idx + 1));
            setSkillInputs(p => p.filter((_, i) => i !== idx + 1));
            if (activeLang > trans.length - 2) setActiveLang(0);
        } else {
            setAddLangs(p => [...p, lang]);
            setTrans(p => [...p, emptyTrans()]);
            setSkillInputs(p => [...p, ""]);
        }
    };

    const handleTransChange = (idx, field, value) =>
        setTrans(p => p.map((t, i) => i === idx ? { ...t, [field]: value } : t));

    const handleAddSkill = (idx) => {
        const trimmed = skillInputs[idx]?.trim();
        if (!trimmed || trans[idx]?.skills.includes(trimmed)) return;
        setTrans(p => p.map((t, i) => i === idx ? { ...t, skills: [...t.skills, trimmed] } : t));
        setSkillInputs(p => p.map((s, i) => i === idx ? "" : s));
    };
    const handleRemoveSkill = (ti, skill) =>
        setTrans(p => p.map((t, i) => i === ti ? { ...t, skills: t.skills.filter(s => s !== skill) } : t));

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(p => ({ ...p, [name]: value }));
        if (errors[name]) setErrors(p => ({ ...p, [name]: "" }));
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.startsWith("image/")) { setErrors(p => ({ ...p, thumbnail: "Please select an image file" })); return; }
        if (file.size > 5 * 1024 * 1024) { setErrors(p => ({ ...p, thumbnail: "Thumbnail must be less than 5MB" })); return; }
        setThumbnail(file);
        setThumbnailPreview(URL.createObjectURL(file));
        setErrors(p => ({ ...p, thumbnail: "" }));
    };

    const deleteExistingFile = async (idx) => {
        const file = existingFiles[idx];
        showConfirm('Delete File', `Delete "${file.originalName || file.filename}"?`, async () => {
            try {
                const res = await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}/files/${file.filename || file.originalName}`, { method: "DELETE", headers: ah });
                if (res.ok) { setExistingFiles(p => p.filter((_, i) => i !== idx)); showInfo('Deleted', 'File deleted successfully.'); }
                else showInfo('Error', 'Failed to delete file.');
            } catch (err) { console.error(err); showInfo('Error', 'Error deleting file.'); }
        }, true);
    };

    const validateForm = () => {
        const e = {};
        if (!formData.userId)           e.userId    = "Owner is required";
        if (!formData.status)           e.status    = "Status is required";
        if (!formData.direction.trim()) e.direction = "Direction is required";
        if (!formData.level.trim())     e.level     = "Level is required";
        if (!trans[0]?.title?.trim())   e.baseTitle = `Title is required for ${LANG_LABELS[baseLang]}`;
        if (formData.price && isNaN(parseFloat(formData.price))) e.price = "Price must be a valid number";
        setErrors(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        if (!validateForm()) return;
        setSaving(true);
        try {
            // Rebuild links: thumbnail first, then existingFiles in sorted order (preserving lang)
            const thumbnailLinks = (formData.links || []).filter(l =>
                l.description && l.description.toLowerCase() === "course thumbnail"
            );
            const reorderedFileLinks = existingFiles
                .filter(f => f.url || f.path)
                .map(f => ({
                    type:        f.type || "other",
                    url:         f.url  || f.path,
                    filename:    f.filename    || f.originalName || "",
                    accessLevel: f.accessLevel || "default",
                    description: f.originalName || f.filename || "",
                    lang:        f.lang || null
                }));
            const mergedLinks = [...thumbnailLinks, ...reorderedFileLinks];

            // Build trans for saving: strip volumes from base lang (stored at top level),
            // keep volumes for non-base langs inside their trans entry
            const transToSave = trans.map((t, i) => {
                const { volumes: _, ...rest } = t;
                if (i === 0) return rest; // base lang: volumes saved separately at top level
                return { ...rest, volumes: t.volumes || [] };
            });

            const res = await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}`, {
                method: "PATCH", headers: ah,
                body: JSON.stringify({
                    userId: formData.userId, status: formData.status,
                    base_lang: baseLang, add_langs: addLangs, trans: transToSave,
                    direction: formData.direction, level: formData.level,
                    courseType: formData.courseType || "SELF_TAUGHT",
                    price: formData.price ? parseFloat(formData.price) : 0,
                    links: mergedLinks
                })
            });
            if (!res.ok) { const err = await res.json(); showInfo('Error', `Failed to update: ${err.message || "Unknown error"}`); setSaving(false); return; }

            if (thumbnail) {
                const fd = new FormData(); fd.append("file", thumbnail);
                await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}/files?thumbnail=true`, { method: "POST", headers: mh, body: fd });
            }

            if (courseFiles && Object.keys(courseFiles).some(k => courseFiles[k]?.length)) {
                for (const [lang, files] of Object.entries(courseFiles)) {
                    if (!files.length) continue;
                    const fd = new FormData(); files.forEach(f => fd.append("files", f));
                    const fr = await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}/files/multiple?lang=${lang}`, { method: "POST", headers: mh, body: fd });
                    if (!fr.ok) { const err = await fr.json(); showInfo('Error', `File upload failed: ${err.message || "Unknown error"}`); }
                }
                const refreshRes = await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${id}/files`, { headers: ah });
                if (refreshRes.ok) {
                    const d = await refreshRes.json();
                    const all = d.data || d.files || [];
                    setExistingFiles(all.filter(f => {
                        const fn = (f.originalName || f.filename || "").toLowerCase();
                        return !fn.includes("thumbnail") && !isSystemTextFile(f.originalName || f.filename || "");
                    }));
                }
            }

            showInfo('Success', 'Course updated successfully!');
            setThumbnail(null); setThumbnailPreview(null); setCourseFiles({});
            navigate("/manage/courses");
        } catch (err) { console.error(err); showInfo('Error', 'Error updating course. Please try again.'); }
        finally { setSaving(false); }
    };

    const getStatusBadge = (s) => ({ deployed: "bg-success", "on-check": "bg-warning text-dark", editing: "bg-secondary" }[s] || "bg-light text-dark");

    if (loading) return (
    <AppLayout data={data} onLogout={onLogout} title="Edit Course">
<div className="flex-grow-1 d-flex align-items-center justify-content-center">
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" /><p className="text-muted">Loading course details...</p>
                </div>
            </div>
        </AppLayout>
    );

    return (
    <AppLayout data={data} onLogout={onLogout} title="Edit Course">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                <div className="row mb-4">
                    <div className="col-12">
                        <button className="btn btn-outline-secondary btn-sm mb-2" onClick={() => navigate("/manage/courses")}>← Back to Courses</button>
                        <h1 className="h3 fw-bold text-dark mb-1">Edit Course</h1>
                        <p className="text-muted mb-0 small">Update course information and settings</p>
                    </div>
                </div>
                <div className="row">
                    <div className="col-12 col-lg-10 col-xl-8">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <form onSubmit={handleSubmit}>

                                    {/* Thumbnail */}
                                    <div className="text-center mb-4">
                                        <label className="form-label fw-semibold d-block mb-2">Course Thumbnail</label>
                                        {thumbnailPreview ? (
                                            <img src={thumbnailPreview} alt="Thumbnail" className="rounded mb-2" style={{ maxWidth: "100%", height: 150, objectFit: "cover" }} />
                                        ) : formData.links?.[0]?.url ? (
                                            <AuthImage src={formData.links[0].url} alt="Current thumbnail" className="rounded mb-2"
                                                style={{ maxWidth: "100%", height: 150, objectFit: "cover" }}
                                                fallback={<div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary mx-auto mb-2" style={{ width: 150, height: 150 }}><span className="text-muted small">No thumbnail</span></div>} />
                                        ) : (
                                            <div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary mx-auto mb-2" style={{ width: 150, height: 150 }}>
                                                <span className="text-muted small">No thumbnail</span>
                                            </div>
                                        )}
                                        <div className="d-flex justify-content-center gap-2 mb-1">
                                            <input type="file" id="thumbnail" className="d-none" accept="image/*" onChange={handleThumbnailChange} />
                                            {!thumbnailPreview && !formData.links?.[0]?.url ? (
                                                <label htmlFor="thumbnail" className="btn btn-sm btn-primary">Upload Thumbnail</label>
                                            ) : (
                                                <>
                                                    <label htmlFor="thumbnail" className="btn btn-sm btn-warning">Change</label>
                                                    <button type="button" className="btn btn-sm btn-danger"
                                                        onClick={() => { setThumbnail(null); setThumbnailPreview(null); setFormData(p => ({ ...p, links: [] })); }}>Delete</button>
                                                </>
                                            )}
                                        </div>
                                        {errors.thumbnail && <small className="text-danger d-block">{errors.thumbnail}</small>}
                                        {formData.status && <div className="mt-2"><span className={`badge rounded-pill ${getStatusBadge(formData.status)}`}>{formData.status}</span></div>}
                                    </div>

                                    <div className="row g-3">
                                        {/* Owner */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Course Owner <span className="text-danger">*</span></label>
                                            <select className={`form-select ${errors.userId ? "is-invalid" : ""}`} name="userId" value={formData.userId} onChange={handleChange}>
                                                <option value="">Select an owner</option>
                                                {users.map(u => <option key={u._id} value={u._id}>{u.nickname} ({u.email})</option>)}
                                            </select>
                                            {errors.userId && <div className="invalid-feedback">{errors.userId}</div>}
                                        </div>

                                        {/* Status */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Status <span className="text-danger">*</span></label>
                                            <select className={`form-select ${errors.status ? "is-invalid" : ""}`} name="status" value={formData.status} onChange={handleChange}>
                                                <option value="">Select status</option>
                                                <option value="editing">Editing</option>
                                                <option value="on-check">On Check</option>
                                                <option value="deployed">Deployed</option>
                                            </select>
                                            {errors.status && <div className="invalid-feedback">{errors.status}</div>}
                                        </div>

                                        {/* Course Type */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Course Type</label>
                                            <select className="form-select"
                                                value={formData.courseType || "SELF_TAUGHT"}
                                                onChange={e => setFormData(p => ({ ...p, courseType: e.target.value }))}>
                                                <option value="SELF_TAUGHT">Self-Taught — student buys &amp; learns independently</option>
                                                <option value="MENTORED">Mentored — student owns course, tutor guides</option>
                                                <option value="HOSTED">Hosted — tutor hosts, no purchase needed</option>
                                            </select>
                                            <small className="text-muted">Determines how students access this course</small>
                                        </div>

                                        {/* Base language */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Base Language <span className="text-danger">*</span></label>
                                            <select className="form-select" value={baseLang}
                                                onChange={e => { setBaseLang(e.target.value); setActiveLang(0); }}>
                                                {ALL_LANGS.map(l => <option key={l} value={l} disabled={addLangs.includes(l)}>{LANG_LABELS[l]}</option>)}
                                            </select>
                                        </div>

                                        {/* Additional languages */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Additional Languages</label>
                                            <div className="d-flex flex-wrap gap-3 pt-2">
                                                {ALL_LANGS.filter(l => l !== baseLang).map(lang => (
                                                    <div key={lang} className="form-check m-0">
                                                        <input className="form-check-input" type="checkbox" id={`addlang-${lang}`}
                                                            checked={addLangs.includes(lang)} onChange={() => toggleAddLang(lang)} />
                                                        <label className="form-check-label" htmlFor={`addlang-${lang}`}>{LANG_LABELS[lang]}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Per-language content */}
                                        <div className="col-12">
                                            <label className="form-label fw-semibold mb-2">Course Content</label>
                                            {allLangs.length > 1 && (
                                                <ul className="nav nav-tabs mb-0">
                                                    {allLangs.map((lang, idx) => (
                                                        <li key={lang} className="nav-item">
                                                            <button type="button" className={`nav-link ${activeLang === idx ? "active" : ""}`} onClick={() => setActiveLang(idx)}>
                                                                {LANG_LABELS[lang]}
                                                                {idx === 0 && <span className="badge bg-primary ms-1" style={{ fontSize: "0.6rem" }}>base</span>}
                                                                {errors.baseTitle && idx === 0 && <span className="text-danger ms-1 fw-bold">!</span>}
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            )}
                                            {allLangs.map((lang, idx) => (
                                                <div key={lang} className="border rounded p-3 bg-light" style={{ display: activeLang === idx ? "block" : "none", borderTopLeftRadius: allLangs.length > 1 && idx === 0 ? 0 : undefined }}>
                                                    <div className="d-flex gap-2 mb-3 align-items-center flex-wrap">
                                                        <span className="badge bg-secondary">{LANG_LABELS[lang]}</span>
                                                        {idx === 0 && <span className="badge bg-primary">Base Language</span>}
                                                        {idx > 0 && (
                                                            <div className="ms-auto d-flex align-items-center gap-2">
                                                                <small className="text-muted">
                                                                    Course structure: {(trans[idx]?.volumes?.length || 0) > 0
                                                                        ? <span className="text-success fw-semibold">{trans[idx].volumes.length} volume(s) — custom</span>
                                                                        : <span className="text-muted fst-italic">using base language structure</span>}
                                                                </small>
                                                                <button type="button" className="btn btn-sm btn-outline-secondary"
                                                                    title="Copy structure from base language for translation"
                                                                    onClick={() => setTrans(p => p.map((t, i) => i === idx
                                                                        ? { ...t, volumes: JSON.parse(JSON.stringify(p[0].volumes || [])) }
                                                                        : t
                                                                    ))}>
                                                                    <i className="bi bi-copy me-1"></i>Copy from base
                                                                </button>
                                                                {(trans[idx]?.volumes?.length || 0) > 0 && (
                                                                    <button type="button" className="btn btn-sm btn-outline-danger"
                                                                        title="Remove custom structure — will fall back to base"
                                                                        onClick={() => setTrans(p => p.map((t, i) => i === idx ? { ...t, volumes: [] } : t))}>
                                                                        <i className="bi bi-x-lg me-1"></i>Reset
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                        {idx === 0 && (
                                                            <small className="text-muted ms-auto fst-italic">Course structure is edited in the Course Preview editor</small>
                                                        )}
                                                    </div>
                                                    <div className="mb-3">
                                                        <label className="form-label fw-semibold">Title {idx === 0 && <span className="text-danger">*</span>}</label>
                                                        <input type="text"
                                                            className={`form-control ${errors.baseTitle && idx === 0 ? "is-invalid" : ""}`}
                                                            value={trans[idx]?.title || ""}
                                                            onChange={e => handleTransChange(idx, "title", e.target.value)}
                                                            placeholder={`Course title in ${LANG_LABELS[lang]}`} />
                                                        {errors.baseTitle && idx === 0 && <div className="invalid-feedback">{errors.baseTitle}</div>}
                                                    </div>
                                                    <div className="mb-3">
                                                        <label className="form-label fw-semibold">Description</label>
                                                        <textarea className="form-control" rows="3"
                                                            value={trans[idx]?.description || ""}
                                                            onChange={e => handleTransChange(idx, "description", e.target.value)}
                                                            placeholder={`Course description in ${LANG_LABELS[lang]}`} />
                                                    </div>
                                                    <div className="mb-3">
                                                        <label className="form-label fw-semibold">Skills</label>
                                                        <div className="input-group mb-2">
                                                            <input type="text" className="form-control"
                                                                value={skillInputs[idx] || ""}
                                                                onChange={e => setSkillInputs(p => p.map((s, i) => i === idx ? e.target.value : s))}
                                                                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddSkill(idx); } }}
                                                                placeholder="Type a skill and press Enter" />
                                                            <button type="button" className="btn btn-outline-primary" onClick={() => handleAddSkill(idx)}>Add</button>
                                                        </div>
                                                        {trans[idx]?.skills?.length > 0 && (
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {trans[idx].skills.map((skill, si) => (
                                                                    <span key={si} className="badge bg-primary d-flex align-items-center gap-1" style={{ fontSize: "0.875rem", padding: "0.5rem 0.75rem" }}>
                                                                        {skill}
                                                                        <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16" style={{ cursor: "pointer" }} onClick={() => handleRemoveSkill(idx, skill)}>
                                                                            <path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z"/>
                                                                        </svg>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* ── Per-lang structure translation (non-base langs only) ── */}
                                                    {idx > 0 && (trans[idx]?.volumes?.length || 0) > 0 && (
                                                        <div className="card border-0 shadow-sm mb-3">
                                                            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                                                                <i className="bi bi-translate text-primary"></i>
                                                                Course Structure — Translated Titles
                                                                <small className="text-muted fw-normal ms-1">Edit volume/chapter/item titles for {LANG_LABELS[lang]}</small>
                                                            </div>
                                                            <div className="card-body p-3" style={{ maxHeight: 400, overflowY: 'auto' }}>
                                                                {(trans[idx].volumes || []).map((vol, vi) => (
                                                                    <div key={vol.vid || vi} className="mb-3">
                                                                        <div className="d-flex align-items-center gap-2 mb-1">
                                                                            <i className="bi bi-folder text-warning" style={{ fontSize: '.85rem' }}></i>
                                                                            <input type="text" className="form-control form-control-sm fw-semibold"
                                                                                value={vol.title || ""}
                                                                                placeholder={`Volume ${vi + 1} title`}
                                                                                onChange={e => setTrans(p => {
                                                                                    const next = JSON.parse(JSON.stringify(p));
                                                                                    next[idx].volumes[vi].title = e.target.value;
                                                                                    return next;
                                                                                })} />
                                                                        </div>
                                                                        {(vol.chapters || []).map((ch, ci) => (
                                                                            <div key={ch.cid || ci} className="ms-3 mb-1">
                                                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                                                    <i className="bi bi-journal text-info" style={{ fontSize: '.85rem' }}></i>
                                                                                    <input type="text" className="form-control form-control-sm"
                                                                                        value={ch.title || ""}
                                                                                        placeholder={`Chapter ${ci + 1} title`}
                                                                                        onChange={e => setTrans(p => {
                                                                                            const next = JSON.parse(JSON.stringify(p));
                                                                                            next[idx].volumes[vi].chapters[ci].title = e.target.value;
                                                                                            return next;
                                                                                        })} />
                                                                                </div>
                                                                                {(ch.items || []).map((item, ii) => (
                                                                                    <div key={item.iid || ii} className="ms-3 d-flex align-items-center gap-2 mb-1">
                                                                                        <i className="bi bi-file-text text-secondary" style={{ fontSize: '.8rem' }}></i>
                                                                                        <input type="text" className="form-control form-control-sm"
                                                                                            value={item.title || ""}
                                                                                            placeholder={`Item ${ii + 1} title`}
                                                                                            onChange={e => setTrans(p => {
                                                                                                const next = JSON.parse(JSON.stringify(p));
                                                                                                next[idx].volumes[vi].chapters[ci].items[ii].title = e.target.value;
                                                                                                return next;
                                                                                            })} />
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* ── Per-language Course Files ── */}
                                                    <div className="card border-0 shadow-sm">
                                                        <div className="card-header bg-white d-flex align-items-center justify-content-between">
                                                            <span className="fw-semibold">
                                                                <i className="bi bi-folder2-open me-2 text-primary"></i>
                                                                Course Files <small className="text-muted fw-normal ms-1">({LANG_LABELS[lang]})</small>
                                                            </span>
                                                            <span className="badge bg-light text-dark border">
                                                                {existingFiles.filter(f => !f.lang || f.lang === lang).length} uploaded · {(courseFiles[lang] || []).length} pending
                                                            </span>
                                                        </div>
                                                        <div className="card-body p-3">

                                                            {/* Filter bar */}
                                                            {existingFiles.filter(f => !f.lang || f.lang === lang).length > 0 && (
                                                                <div className="d-flex gap-2 flex-wrap align-items-center mb-3 p-2 bg-light rounded border">
                                                                    <input type="text" className="form-control form-control-sm"
                                                                        style={{ maxWidth: 180 }} placeholder="Search files…"
                                                                        value={fileSearch} onChange={e => setFileSearch(e.target.value)} />
                                                                    <select className="form-select form-select-sm" style={{ maxWidth: 130 }}
                                                                        value={fileTypeFilter} onChange={e => setFileTypeFilter(e.target.value)}>
                                                                        <option value="all">All types</option>
                                                                        <option value="image">Images</option>
                                                                        <option value="video">Videos</option>
                                                                        <option value="audio">Audio</option>
                                                                        <option value="document">Documents</option>
                                                                        <option value="archive">Archives</option>
                                                                        <option value="other">Other</option>
                                                                    </select>
                                                                    <select className="form-select form-select-sm" style={{ maxWidth: 140 }}
                                                                        value={fileSortBy} onChange={e => setFileSortBy(e.target.value)}>
                                                                        <option value="date">Order: saved</option>
                                                                        <option value="name">Sort: Name ↑</option>
                                                                        <option value="type">Sort: Type</option>
                                                                        <option value="size">Sort: Size ↓</option>
                                                                    </select>
                                                                    {(fileSearch || fileTypeFilter !== 'all' || fileSortBy !== 'date') && (
                                                                        <button type="button" className="btn btn-sm btn-outline-secondary"
                                                                            onClick={() => { setFileSearch(''); setFileTypeFilter('all'); setFileSortBy('date'); }}>
                                                                            <i className="bi bi-x-lg"></i> Clear
                                                                        </button>
                                                                    )}
                                                                    {fileSortBy === 'date' && !fileSearch && fileTypeFilter === 'all' && (
                                                                        <small className="text-muted ms-auto">Drag ▲▼ to reorder</small>
                                                                    )}
                                                                </div>
                                                            )}

                                                            {/* Existing files for this lang */}
                                                            {existingFiles.filter(f => !f.lang || f.lang === lang).length > 0 && (
                                                                <div className="mb-3" style={{ maxHeight: 320, overflowY: 'auto' }}>
                                                                    {(() => {
                                                                        const langExisting = existingFiles.filter(f => !f.lang || f.lang === lang);
                                                                        const isFiltered = fileSearch || fileTypeFilter !== 'all';
                                                                        const isSorted = fileSortBy !== 'date';
                                                                        const reorderDisabled = isFiltered || isSorted;
                                                                        return [...langExisting]
                                                                            .filter(file => {
                                                                                if (fileSearch && !file.filename?.toLowerCase().includes(fileSearch.toLowerCase()) &&
                                                                                    !file.url?.toLowerCase().includes(fileSearch.toLowerCase())) return false;
                                                                                if (fileTypeFilter !== 'all' && (file.type || 'other') !== fileTypeFilter) return false;
                                                                                return true;
                                                                            })
                                                                            .sort((a, b) => {
                                                                                if (fileSortBy === 'name') return (a.filename || '').localeCompare(b.filename || '');
                                                                                if (fileSortBy === 'type') return (a.type || '').localeCompare(b.type || '');
                                                                                if (fileSortBy === 'size') return (b.size || 0) - (a.size || 0);
                                                                                return 0;
                                                                            })
                                                                            .map((file) => {
                                                                                const realIdx = existingFiles.indexOf(file);
                                                                                const fn = file.originalName || file.filename || `File ${realIdx + 1}`;
                                                                                const mime = file.mimetype || file.mimeType || '';
                                                                                const ext = fn.split('.').pop().toLowerCase();
                                                                                const isImg = mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext);
                                                                                const isVid = mime.startsWith('video/') || ['mp4','webm','mov'].includes(ext);
                                                                                const isAud = mime.startsWith('audio/') || ['mp3','wav','aac','flac'].includes(ext);
                                                                                const isDoc = ['pdf','doc','docx','ppt','pptx'].includes(ext);
                                                                                const isZip = ['zip','rar','7z'].includes(ext);
                                                                                const typeLabel = isImg ? 'image' : isVid ? 'video' : isAud ? 'audio' : isDoc ? 'doc' : isZip ? 'archive' : 'file';
                                                                                const typeColors = { image:'#198754', video:'#0d6efd', audio:'#fd7e14', doc:'#dc3545', archive:'#6f42c1', file:'#6c757d' };
                                                                                const typeIcon = { image:'bi-image', video:'bi-camera-video', audio:'bi-music-note', doc:'bi-file-pdf', archive:'bi-file-zip', file:'bi-file-earmark' };
                                                                                return (
                                                                                    <div key={realIdx} className="d-flex align-items-center gap-2 bg-white p-2 rounded mb-1 border">
                                                                                        <div className="d-flex flex-column" style={{ gap: 1 }}>
                                                                                            <button type="button" className="btn btn-sm btn-outline-secondary p-0 lh-1"
                                                                                                style={{ width: 20, height: 18, fontSize: '.6rem' }}
                                                                                                disabled={reorderDisabled || realIdx === 0}
                                                                                                onClick={() => moveItem(setExistingFiles, realIdx, -1)}
                                                                                                title={reorderDisabled ? 'Clear filters to reorder' : 'Move up'}>▲</button>
                                                                                            <button type="button" className="btn btn-sm btn-outline-secondary p-0 lh-1"
                                                                                                style={{ width: 20, height: 18, fontSize: '.6rem' }}
                                                                                                disabled={reorderDisabled || realIdx === existingFiles.length - 1}
                                                                                                onClick={() => moveItem(setExistingFiles, realIdx, 1)}
                                                                                                title={reorderDisabled ? 'Clear filters to reorder' : 'Move down'}>▼</button>
                                                                                        </div>
                                                                                        <i className={`bi ${typeIcon[typeLabel]}`} style={{ color: typeColors[typeLabel], fontSize: '1.1rem', width: 20, textAlign:'center' }}></i>
                                                                                        <div className="flex-grow-1 overflow-hidden">
                                                                                            <div className="small fw-semibold text-truncate" title={fn}>{fn}</div>
                                                                                            <div className="d-flex align-items-center gap-2" style={{ fontSize: '.72rem', color: '#6c757d' }}>
                                                                                                <span className="badge" style={{ background: typeColors[typeLabel] + '22', color: typeColors[typeLabel], fontSize: '.65rem' }}>{typeLabel}</span>
                                                                                                {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ''}
                                                                                                {reorderDisabled && <span className="text-warning"><i className="bi bi-lock"></i> reorder off</span>}
                                                                                            </div>
                                                                                        </div>
                                                                                        <a href={`${toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')}${file.url || file.path}`} target="_blank" rel="noopener noreferrer"
                                                                                            className="btn btn-sm btn-outline-secondary" title="Open"><i className="bi bi-box-arrow-up-right"></i></a>
                                                                                        <button type="button" className="btn btn-sm btn-outline-danger"
                                                                                            onClick={() => deleteExistingFile(realIdx)} title="Delete">
                                                                                            <i className="bi bi-trash"></i>
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            });
                                                                    })()}
                                                                </div>
                                                            )}
                                                            {existingFiles.filter(f => !f.lang || f.lang === lang).length === 0 && (
                                                                <p className="text-muted small text-center py-2">No uploaded files for this language yet.</p>
                                                            )}

                                                            {/* Pending uploads for this lang */}
                                                            <div className="border-top pt-3">
                                                                <div className="d-flex align-items-center justify-content-between mb-2">
                                                                    <span className="fw-semibold small">
                                                                        <i className="bi bi-cloud-upload me-1 text-success"></i>
                                                                        Upload new files
                                                                    </span>
                                                                    <small className="text-muted">Max 512 MB per file</small>
                                                                </div>
                                                                <input type="file" id={`courseFiles-${lang}`} className="d-none" multiple
                                                                    onChange={e => {
                                                                        const files = Array.from(e.target.files).filter(f => {
                                                                            if (f.size > 512 * 1024 * 1024) { showInfo('File Too Large', `${f.name} exceeds 512 MB limit.`); return false; }
                                                                            return true;
                                                                        });
                                                                        setCourseFiles(p => ({ ...p, [lang]: [...(p[lang] || []), ...files] }));
                                                                        e.target.value = '';
                                                                    }}
                                                                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xlsx,.xls,.zip" />
                                                                {!(courseFiles[lang]?.length) ? (
                                                                    <label htmlFor={`courseFiles-${lang}`}
                                                                        className="d-flex flex-column align-items-center justify-content-center gap-2 border border-2 border-dashed rounded p-4 text-muted"
                                                                        style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
                                                                        <i className="bi bi-cloud-upload" style={{ fontSize: '2rem', color: '#3b5bdb' }}></i>
                                                                        <span className="fw-semibold small">Click to choose files for {LANG_LABELS[lang]}</span>
                                                                        <span style={{ fontSize: '.75rem' }}>Images, videos, PDFs, docs, archives · Max 512 MB each</span>
                                                                    </label>
                                                                ) : (
                                                                    <>
                                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                                            <label htmlFor={`courseFiles-${lang}`} className="btn btn-sm btn-outline-success" style={{ cursor: 'pointer' }}>
                                                                                <i className="bi bi-plus-lg me-1"></i>Add more
                                                                            </label>
                                                                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setCourseFiles(p => ({ ...p, [lang]: [] }))}>
                                                                                <i className="bi bi-x-lg me-1"></i>Clear all
                                                                            </button>
                                                                        </div>
                                                                        <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                                                            {(courseFiles[lang] || []).map((f, i) => (
                                                                                <div key={i} className="d-flex align-items-center gap-2 bg-white p-2 rounded mb-1 border border-success border-opacity-50">
                                                                                    <div className="d-flex flex-column" style={{ gap: 1 }}>
                                                                                        <button type="button" className="btn btn-sm btn-outline-secondary p-0 lh-1"
                                                                                            style={{ width: 20, height: 18, fontSize: '.6rem' }}
                                                                                            disabled={i === 0}
                                                                                            onClick={() => setCourseFiles(p => { const arr = [...p[lang]]; [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; return {...p,[lang]:arr}; })}>▲</button>
                                                                                        <button type="button" className="btn btn-sm btn-outline-secondary p-0 lh-1"
                                                                                            style={{ width: 20, height: 18, fontSize: '.6rem' }}
                                                                                            disabled={i === courseFiles[lang].length - 1}
                                                                                            onClick={() => setCourseFiles(p => { const arr = [...p[lang]]; [arr[i],arr[i+1]]=[arr[i+1],arr[i]]; return {...p,[lang]:arr}; })}>▼</button>
                                                                                    </div>
                                                                                    <i className="bi bi-file-earmark text-success" style={{ fontSize: '1.1rem', width: 20, textAlign: 'center' }}></i>
                                                                                    <div className="flex-grow-1 overflow-hidden">
                                                                                        <div className="small fw-semibold text-truncate">{f.name}</div>
                                                                                        <div style={{ fontSize: '.72rem', color: '#6c757d' }}>{(f.size / 1024 / 1024).toFixed(2)} MB</div>
                                                                                    </div>
                                                                                    <button type="button" className="btn btn-sm btn-outline-danger"
                                                                                        onClick={() => setCourseFiles(p => ({ ...p, [lang]: p[lang].filter((_, j) => j !== i) }))}>
                                                                                        <i className="bi bi-x-lg"></i>
                                                                                    </button>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Direction */}
                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold">Direction <span className="text-danger">*</span></label>
                                            <select className={`form-select ${errors.direction ? "is-invalid" : ""}`} name="direction" value={formData.direction}
                                                onChange={e => { handleChange(e); setFormData(p => ({ ...p, level: "" })); }}>
                                                <option value="">Select direction</option>
                                                {directions.map(d => <option key={d._id} value={d.directionName}>{d.directionName}</option>)}
                                            </select>
                                            {errors.direction && <div className="invalid-feedback">{errors.direction}</div>}
                                        </div>

                                        {/* Level */}
                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold">Level <span className="text-danger">*</span></label>
                                            <select className={`form-select ${errors.level ? "is-invalid" : ""}`} name="level" value={formData.level}
                                                onChange={handleChange} disabled={!formData.direction}>
                                                <option value="">Select level</option>
                                                {levels.filter(l => l.directionName === formData.direction).map(l => (
                                                    <option key={l._id} value={l.levelName}>{l.levelName}</option>
                                                ))}
                                            </select>
                                            {errors.level && <div className="invalid-feedback">{errors.level}</div>}
                                            {!formData.direction && <small className="text-muted">Select direction first</small>}
                                        </div>

                                        {/* Price */}
                                        <div className="col-12 col-md-4">
                                            <label className="form-label fw-semibold">Price (USD)</label>
                                            <div className="input-group">
                                                <span className="input-group-text">$</span>
                                                <input type="number" className={`form-control ${errors.price ? "is-invalid" : ""}`}
                                                    name="price" value={formData.price} onChange={handleChange}
                                                    placeholder="0.00" step="0.01" min="0" />
                                            </div>
                                            {errors.price && <div className="text-danger small mt-1">{errors.price}</div>}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="d-flex gap-2 justify-content-end pt-4 mt-3 border-top">
                                        <button type="button" className="btn btn-outline-secondary"
                                            onClick={() => showConfirm('Cancel', 'Discard unsaved changes?', () => navigate("/manage/courses"))} disabled={saving}>Cancel</button>
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
                                            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : "Save Changes"}
                                        </button>
                                    </div>
                                </form>
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

export default EditCourse;
import { toHttps } from '../utils/utils';
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

// ── Language registry — add new languages here ──────────────────────────────
const LANG_LABELS = {
    en: "English", ua: "Ukrainian", de: "German", fr: "French",
    es: "Spanish", pl: "Polish", it: "Italian", pt: "Portuguese",
    zh: "Chinese", ja: "Japanese", ko: "Korean", ar: "Arabic",
    tr: "Turkish", nl: "Dutch", sv: "Swedish", cs: "Czech",
};
const ALL_LANGS = Object.keys(LANG_LABELS);
const emptyTrans  = () => ({ title: "", description: "", skills: [] });

function CreateCourse({ data, onLogout }) {
    const navigate = useNavigate();
    const [saving, setSaving]             = useState(false);
    const [users, setUsers]               = useState([]);
    const [directions, setDirections]     = useState([]);
    const [levels, setLevels]             = useState([]);
    const [baseLang, setBaseLang]         = useState("en");
    const [addLangs, setAddLangs]         = useState([]);
    const [trans, setTrans]               = useState([emptyTrans()]);
    const [activeLang, setActiveLang]     = useState(0);
    const [skillInputs, setSkillInputs]   = useState([""]);
    const [formData, setFormData]         = useState({ userId: "", direction: "", level: "", price: "", courseType: "SELF_TAUGHT" });
    const [errors, setErrors]             = useState({});
    const [thumbnailFile, setThumbnailFile]       = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    // per-language files: { [langCode]: File[] }
    const [langFiles, setLangFiles] = useState({});
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

    useEffect(() => {
        const token = localStorage.getItem("token");
        const ah = token
            ? { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}`, "Content-Type": "application/json" }
            : { "Content-Type": "application/json" };
        if (token) {
            fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/manage/users", { headers: ah })
                .then(r => r.ok ? r.json() : null).then(d => d && setUsers(d.data || d)).catch(console.error);
        }
        fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/directions", { headers: ah })
            .then(r => r.ok ? r.json() : null).then(d => d && setDirections(d.data || [])).catch(console.error);
        fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/levels", { headers: ah })
            .then(r => r.ok ? r.json() : null).then(d => d && setLevels(d.data || [])).catch(console.error);
    }, []);

    const allLangs = [baseLang, ...addLangs];

    const toggleAddLang = (lang) => {
        if (addLangs.includes(lang)) {
            const idx = addLangs.indexOf(lang);
            setAddLangs(p => p.filter(l => l !== lang));
            setTrans(p => p.filter((_, i) => i !== idx + 1));
            setSkillInputs(p => p.filter((_, i) => i !== idx + 1));
            if (activeLang > allLangs.length - 2) setActiveLang(0);
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
        if (file.size > 5 * 1024 * 1024) { setErrors(p => ({ ...p, thumbnail: "Image must be less than 5MB" })); return; }
        setThumbnailFile(file);
        setThumbnailPreview(URL.createObjectURL(file));
        setErrors(p => ({ ...p, thumbnail: "" }));
    };

    const validateForm = () => {
        const e = {};
        if (!formData.userId)           e.userId    = "Owner is required";
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
            const token = localStorage.getItem("token");
            const ah = { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}`, "Content-Type": "application/json" };
            const mh = { Authorization: `${token.split(" ")[0]} ${token.split(" ")[1]}` };

            const res = await fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + "/manage/courses", {
                method: "POST", headers: ah,
                body: JSON.stringify({
                    userId: formData.userId, status: "editing",
                    base_lang: baseLang, add_langs: addLangs, trans,
                    direction: formData.direction, level: formData.level,
                    price: formData.price ? parseFloat(formData.price) : 0,
                    courseType: formData.courseType || "SELF_TAUGHT"
                })
            });
            if (!res.ok) { const err = await res.json(); showInfo('Error', `Failed: ${err.message || "Unknown error"}`); setSaving(false); return; }
            const { data: cd } = await res.json();

            if (thumbnailFile) {
                const ext = thumbnailFile.name.split(".").pop();
                const blob = thumbnailFile.slice(0, thumbnailFile.size, thumbnailFile.type);
                const renamed = new File([blob], `thumbnail.${ext}`, { type: thumbnailFile.type });
                const fd = new FormData(); fd.append("file", renamed);
                await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${cd._id}/files`, { method: "POST", headers: mh, body: fd });
            }
            // Upload per-language files
            for (const [lang, files] of Object.entries(langFiles)) {
                if (!files.length) continue;
                const fd = new FormData(); files.forEach(f => fd.append("files", f));
                await fetch(`${toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')}/manage/courses/${cd._id}/files/multiple?lang=${lang}`, { method: "POST", headers: mh, body: fd });
            }
            showInfo('Success', 'Course created successfully!');
            navigate("/manage/courses");
        } catch (err) { console.error(err); showInfo('Error', 'Error creating course. Please try again.'); }
        finally { setSaving(false); }
    };

    return (
    <AppLayout data={data} onLogout={onLogout} title="Create Course">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                <div className="row mb-4">
                    <div className="col-12">
                        <button className="btn btn-outline-secondary btn-sm mb-2" onClick={() => navigate("/manage/courses")}>← Back to Courses</button>
                        <h1 className="h3 fw-bold text-dark mb-1">Create Course</h1>
                        <p className="text-muted mb-0 small">Add a new course with multi-language support</p>
                    </div>
                </div>
                <div className="row">
                    <div className="col-12 col-lg-10 col-xl-8">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <form onSubmit={handleSubmit}>

                                    {/* Thumbnail */}
                                    <div className="text-center mb-4">
                                        {thumbnailPreview
                                            ? <img src={thumbnailPreview} alt="Thumbnail" className="rounded mb-2" style={{ width: 120, height: 120, objectFit: "cover" }} />
                                            : <div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary mx-auto mb-2" style={{ width: 120, height: 120 }}>
                                                <svg width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                                                    <path d="M8.211 2.047a.5.5 0 0 0-.422 0l-7.5 3.5a.5.5 0 0 0 .025.917l7.5 3a.5.5 0 0 0 .372 0L14 6.464V13.5a.5.5 0 0 0 1 0V6.236a.5.5 0 0 0-.053-.224l-7.5-3.5z"/>
                                                    <path d="M4.176 9.032a.5.5 0 0 0-.656.327l-.5 1.7a.5.5 0 0 0 .294.605l4.5 1.8a.5.5 0 0 0 .372 0l4.5-1.8a.5.5 0 0 0 .294-.605l-.5-1.7a.5.5 0 0 0-.656-.327L8 10.466 4.176 9.032z"/>
                                                </svg>
                                              </div>
                                        }
                                        <div className="d-flex justify-content-center gap-2 mb-1">
                                            <input type="file" id="thumbnail" className="d-none" accept="image/*" onChange={handleThumbnailChange} />
                                            {!thumbnailPreview
                                                ? <label htmlFor="thumbnail" className="btn btn-sm btn-primary">Upload Thumbnail</label>
                                                : <>
                                                    <label htmlFor="thumbnail" className="btn btn-sm btn-warning">Change</label>
                                                    <button type="button" className="btn btn-sm btn-danger" onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}>Delete</button>
                                                  </>
                                            }
                                        </div>
                                        {errors.thumbnail && <small className="text-danger d-block">{errors.thumbnail}</small>}
                                        <small className="text-muted">Recommended 800×600 px · max 5 MB</small>
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

                                        {/* Base language */}
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">Base Language <span className="text-danger">*</span></label>
                                            <select className="form-select" value={baseLang} onChange={e => { setBaseLang(e.target.value); setActiveLang(0); }}>
                                                {ALL_LANGS.map(l => <option key={l} value={l} disabled={addLangs.includes(l)}>{LANG_LABELS[l]}</option>)}
                                            </select>
                                            <small className="text-muted">Primary course language</small>
                                        </div>

                                        {/* Additional languages */}
                                        <div className="col-12">
                                            <label className="form-label fw-semibold">Additional Languages</label>
                                            <div className="d-flex flex-wrap gap-3">
                                                {ALL_LANGS.filter(l => l !== baseLang).map(lang => (
                                                    <div key={lang} className="form-check m-0">
                                                        <input className="form-check-input" type="checkbox" id={`addlang-${lang}`}
                                                            checked={addLangs.includes(lang)} onChange={() => toggleAddLang(lang)} />
                                                        <label className="form-check-label" htmlFor={`addlang-${lang}`}>{LANG_LABELS[lang]}</label>
                                                    </div>
                                                ))}
                                                {ALL_LANGS.length <= 1 && <small className="text-muted">No additional languages available</small>}
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
                                                    <div className="d-flex gap-2 mb-3">
                                                        <span className="badge bg-secondary">{LANG_LABELS[lang]}</span>
                                                        {idx === 0 && <span className="badge bg-primary">Base Language</span>}
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

                                                    {/* ── Per-language Course Files ── */}
                                                    <div className="card border-0 shadow-sm">
                                                        <div className="card-header bg-white d-flex align-items-center justify-content-between">
                                                            <span className="fw-semibold">
                                                                <i className="bi bi-folder2-open me-2 text-primary"></i>
                                                                Course Files <small className="text-muted fw-normal ms-1">({LANG_LABELS[lang]})</small>
                                                            </span>
                                                            {(langFiles[lang]?.length || 0) > 0 && (
                                                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                                                    {langFiles[lang].length} pending
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="card-body p-3">
                                                            <input type="file" id={`contentFiles-${lang}`} className="d-none" multiple
                                                                onChange={e => {
                                                                    const files = Array.from(e.target.files).filter(f => {
                                                                        if (f.size > 512 * 1024 * 1024) { showInfo('File Too Large', `${f.name} exceeds 512 MB limit.`); return false; }
                                                                        return true;
                                                                    });
                                                                    setLangFiles(p => ({ ...p, [lang]: [...(p[lang] || []), ...files] }));
                                                                    e.target.value = '';
                                                                }}
                                                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip" />

                                                            {!(langFiles[lang]?.length) ? (
                                                                <label htmlFor={`contentFiles-${lang}`}
                                                                    className="d-flex flex-column align-items-center justify-content-center gap-2 border border-2 border-dashed rounded p-4 text-muted"
                                                                    style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
                                                                    <i className="bi bi-cloud-upload" style={{ fontSize: '2rem', color: '#3b5bdb' }}></i>
                                                                    <span className="fw-semibold small">Click to choose files for {LANG_LABELS[lang]}</span>
                                                                    <span style={{ fontSize: '.75rem' }}>Images, videos, PDFs, docs, archives · Max 512 MB each</span>
                                                                </label>
                                                            ) : (
                                                                <>
                                                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                                                        <label htmlFor={`contentFiles-${lang}`} className="btn btn-sm btn-outline-success" style={{ cursor: 'pointer' }}>
                                                                            <i className="bi bi-plus-lg me-1"></i>Add more
                                                                        </label>
                                                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setLangFiles(p => ({ ...p, [lang]: [] }))}>
                                                                            <i className="bi bi-x-lg me-1"></i>Clear all
                                                                        </button>
                                                                    </div>
                                                                    <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                                                        {(langFiles[lang] || []).map((f, i) => {
                                                                            const ext = f.name.split('.').pop().toLowerCase();
                                                                            const isImg = f.type.startsWith('image/'), isVid = f.type.startsWith('video/'), isAud = f.type.startsWith('audio/');
                                                                            const isDoc = ['pdf','doc','docx','ppt','pptx'].includes(ext), isZip = ['zip','rar','7z'].includes(ext);
                                                                            const key = isImg?'img':isVid?'vid':isAud?'aud':isDoc?'doc':isZip?'zip':'img';
                                                                            const iconMap = { img:'bi-image', vid:'bi-camera-video', aud:'bi-music-note', doc:'bi-file-pdf', zip:'bi-file-zip' };
                                                                            const colorMap = { img:'#198754', vid:'#0d6efd', aud:'#fd7e14', doc:'#dc3545', zip:'#6f42c1' };
                                                                            return (
                                                                                <div key={i} className="d-flex align-items-center gap-2 bg-white p-2 rounded mb-1 border">
                                                                                    <div className="d-flex flex-column" style={{ gap: 1 }}>
                                                                                        <button type="button" className="btn btn-sm btn-outline-secondary p-0 lh-1" style={{ width: 20, height: 18, fontSize: '.6rem' }}
                                                                                            disabled={i === 0} onClick={() => setLangFiles(p => { const arr = [...p[lang]]; [arr[i-1],arr[i]]=[arr[i],arr[i-1]]; return {...p,[lang]:arr}; })}>▲</button>
                                                                                        <button type="button" className="btn btn-sm btn-outline-secondary p-0 lh-1" style={{ width: 20, height: 18, fontSize: '.6rem' }}
                                                                                            disabled={i === langFiles[lang].length - 1} onClick={() => setLangFiles(p => { const arr = [...p[lang]]; [arr[i],arr[i+1]]=[arr[i+1],arr[i]]; return {...p,[lang]:arr}; })}>▼</button>
                                                                                    </div>
                                                                                    <i className={`bi ${iconMap[key] || 'bi-file-earmark'}`} style={{ color: colorMap[key] || '#6c757d', fontSize: '1.1rem', width: 20, textAlign: 'center' }}></i>
                                                                                    <div className="flex-grow-1 overflow-hidden">
                                                                                        <div className="small fw-semibold text-truncate">{f.name}</div>
                                                                                        <div style={{ fontSize: '.72rem', color: '#6c757d' }}>{(f.size/1024/1024).toFixed(2)} MB</div>
                                                                                    </div>
                                                                                    <button type="button" className="btn btn-sm btn-outline-danger"
                                                                                        onClick={() => setLangFiles(p => ({ ...p, [lang]: p[lang].filter((_,j) => j !== i) }))}>
                                                                                        <i className="bi bi-x-lg"></i>
                                                                                    </button>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </>
                                                            )}
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

                                        {/* Course type */}
                                        <div className="mb-3">
                                            <label className="form-label fw-semibold">Course Type <span className="text-danger">*</span></label>
                                            <select className="form-select" name="courseType"
                                                value={formData.courseType} onChange={handleChange}>
                                                <option value="SELF_TAUGHT">Self-Taught — student buys &amp; learns independently</option>
                                                <option value="MENTORED">Mentored — student owns course, tutor guides</option>
                                                <option value="HOSTED">Hosted — tutor hosts, no purchase needed</option>
                                            </select>
                                            <small className="text-muted">Determines how students access this course</small>
                                        </div>

                                    </div>

                                    {/* Actions */}
                                    <div className="d-flex gap-2 justify-content-end pt-4 mt-3 border-top">
                                        <button type="button" className="btn btn-outline-secondary" onClick={() => showConfirm('Cancel', 'Cancel and discard all data?', () => navigate("/manage/courses"))} disabled={saving}>Cancel</button>
                                        <button type="submit" className="btn btn-primary" disabled={saving}>
                                            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Creating...</> : "Create Course"}
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

export default CreateCourse;
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { UtilityModal } from "../components/UtilityModal";

const API = process.env.REACT_APP_API_URL + "";

function Sessions({ data, onLogout }) {
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const ah = { Authorization: `${token?.split(" ")[0]} ${token?.split(" ")[1]}`, "Content-Type": "application/json" };

    const [sessions,       setSessions]       = useState([]);
    const [courses,        setCourses]        = useState([]);
    const [loading,        setLoading]        = useState(true);
    const [searchText,     setSearchText]     = useState('');
    const [filterStatus,   setFilterStatus]   = useState('');
    const [filterType,     setFilterType]     = useState('');
    const [sortBy,         setSortBy]         = useState('date');
    const [sortDir,        setSortDir]        = useState('desc');
    const [showForm,       setShowForm]       = useState(false);
    const [form,           setForm]           = useState({ courseId: "", courseType: "HOSTED", coTutors: [], restrictionIgnored: false });
    const [saving,         setSaving]         = useState(false);
    const [showPrune,      setShowPrune]      = useState(false);
    const [pruneOpts,      setPruneOpts]      = useState({ days: 90, statuses: ['archived'] });
    const [pruning,        setPruning]        = useState(false);
    const [modal,          setModal]          = useState({ show: false });

    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (t, m) => setModal({ show: true, type: "info",    title: t, message: m, onClose: closeModal });
    const showConfirm = (t, m, fn, d = false) => setModal({ show: true, type: "confirm", danger: d, title: t, message: m, onConfirm: fn, onCancel: closeModal });

    const canManage = ['tutor','manage','admin','root'].includes(data.accessLevel);
    const canPrune  = ['manage','admin','root'].includes(data.accessLevel);

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [sr, cr] = await Promise.all([
                fetch(`${API}/sessions`, { headers: ah }),
                fetch(`${API}/courses`,  { headers: ah }),
            ]);
            if (sr.ok) { const d = await sr.json(); setSessions(d.data || []); }
            if (cr.ok) { const d = await cr.json(); setCourses(d.data || []); }
        } catch {}
        setLoading(false);
    };

    const courseTitle = (c) => c?.trans?.[0]?.title || "(untitled)";

    const filtered = sessions.filter(s => {
        const t = courseTitle(s.courseId).toLowerCase();
        if (searchText && !t.includes(searchText.toLowerCase()) && !(s.hostTutor?.nickname||'').toLowerCase().includes(searchText.toLowerCase())) return false;
        if (filterStatus && s.status !== filterStatus) return false;
        if (filterType   && s.courseType !== filterType) return false;
        return true;
    }).sort((a, b) => {
        if (sortBy === 'title')  { const c = courseTitle(a.courseId).localeCompare(courseTitle(b.courseId)); return sortDir==='asc'?c:-c; }
        if (sortBy === 'status') { const c = (a.status||'').localeCompare(b.status||''); return sortDir==='asc'?c:-c; }
        return sortDir==='asc' ? new Date(a.createdAt)-new Date(b.createdAt) : new Date(b.createdAt)-new Date(a.createdAt);
    });

    // Stats
    const stats = { total: sessions.length, active: sessions.filter(s=>s.status==='active').length, draft: sessions.filter(s=>s.status==='draft').length, completed: sessions.filter(s=>s.status==='completed').length };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.courseId) { showInfo("Validation", "Select a course."); return; }
        setSaving(true);
        try {
            const res = await fetch(`${API}/sessions`, { method: "POST", headers: ah, body: JSON.stringify(form) });
            const json = await res.json();
            if (res.ok) { showInfo("Created", "Session created."); setShowForm(false); setForm({ courseId:"", courseType:"HOSTED", coTutors:[], restrictionIgnored:false }); fetchAll(); }
            else showInfo("Error", json.message || "Failed");
        } catch { showInfo("Error", "Network error"); }
        setSaving(false);
    };

    const handlePrune = async () => {
        setPruning(true);
        try {
            const res = await fetch(`${API}/sessions/prune`, { method:'POST', headers: ah, body: JSON.stringify({ olderThanDays: pruneOpts.days, statuses: pruneOpts.statuses }) });
            const d = await res.json();
            if (res.ok) { showInfo('Pruned', d.message); setShowPrune(false); fetchAll(); }
            else showInfo('Error', d.message || 'Prune failed');
        } catch { showInfo('Error','Network error'); }
        setPruning(false);
    };

    const handleArchive = (sess) => showConfirm("Archive Session", `Archive "${courseTitle(sess.courseId)}"?`, async () => {
        const res = await fetch(`${API}/sessions/${sess._id}`, { method:"DELETE", headers: ah });
        if (res.ok) fetchAll(); else { const d = await res.json(); showInfo("Error", d.message); }
    }, true);

    if (loading) return (
        <AppLayout data={data} onLogout={onLogout} title="Sessions">
            <div className="page-content d-flex align-items-center justify-content-center" style={{ minHeight: 320 }}>
                <div className="spinner-border" style={{ color: 'var(--accent)' }} />
            </div>
        </AppLayout>
    );

    return (
        <AppLayout data={data} onLogout={onLogout} title="Sessions">
            <div className="page-content">

                {/* ── Header ── */}
                <div className="page-header d-flex align-items-start justify-content-between flex-wrap gap-2">
                    <div>
                        <h1 className="page-title">Sessions</h1>
                        <p className="page-subtitle">Manage tutor-led course sessions</p>
                    </div>
                    {canManage && (
                        <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                            {canPrune && (
                                <button className="ep-btn ep-btn-md ep-btn-danger-ghost" onClick={() => setShowPrune(p=>!p)}>
                                    <i className="bi bi-trash3" />{showPrune ? 'Cancel' : 'Prune'}
                                </button>
                            )}
                            <button className="ep-btn ep-btn-md ep-btn-primary" onClick={() => setShowForm(p=>!p)}>
                                <i className={`bi ${showForm?'bi-x':'bi-plus-lg'}`} />{showForm ? 'Cancel' : 'New Session'}
                            </button>
                        </div>
                    )}
                </div>

                {/* ── Stats row ── */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:'.75rem', marginBottom:'1.25rem' }}>
                    {[
                        { label:'Total', value:stats.total, icon:'bi-layers', color:'var(--accent)' },
                        { label:'Active', value:stats.active, icon:'bi-broadcast', color:'var(--success)' },
                        { label:'Draft', value:stats.draft, icon:'bi-pencil-square', color:'var(--text-muted)' },
                        { label:'Completed', value:stats.completed, icon:'bi-check-circle', color:'var(--info)' },
                    ].map(s => (
                        <div key={s.label} className="stat-tile">
                            <div className="stat-tile-label">{s.label}</div>
                            <div className="stat-tile-value" style={{ color:s.color }}>{s.value}</div>
                            <div className="stat-tile-sub"><i className={`bi ${s.icon}`} style={{ color:s.color }} /></div>
                        </div>
                    ))}
                </div>

                {/* ── Prune panel ── */}
                {showPrune && canPrune && (
                    <div className="ep-card mb-3" style={{ borderColor:'var(--danger-border)' }}>
                        <div className="ep-card-header" style={{ background:'var(--danger-bg)' }}>
                            <span className="ep-card-title" style={{ color:'var(--danger)' }}><i className="bi bi-exclamation-triangle me-2" />Prune Old Sessions</span>
                        </div>
                        <div className="ep-card-body">
                            <p style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:'.85rem' }}>Permanently deletes sessions (and their groups/assignments) older than specified days.</p>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:'1rem', alignItems:'flex-end' }}>
                                <div>
                                    <label className="ep-label">Older than (days)</label>
                                    <input type="number" className="ep-input" style={{ width:100 }} value={pruneOpts.days} min={1} onChange={e=>setPruneOpts(p=>({...p,days:parseInt(e.target.value)||30}))} />
                                </div>
                                <div>
                                    <label className="ep-label">Statuses</label>
                                    <div style={{ display:'flex', gap:'1rem' }}>
                                        {['archived','completed'].map(s=>(
                                            <label key={s} style={{ display:'flex', alignItems:'center', gap:'.4rem', fontSize:'.78rem', color:'var(--text-2)', cursor:'pointer' }}>
                                                <input type="checkbox" checked={pruneOpts.statuses.includes(s)} onChange={e=>setPruneOpts(p=>({...p,statuses:e.target.checked?[...p.statuses,s]:p.statuses.filter(x=>x!==s)}))} />
                                                {s}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <button className="ep-btn ep-btn-md ep-btn-danger" onClick={handlePrune} disabled={pruning||pruneOpts.statuses.length===0}>
                                    {pruning ? <><span className="spinner-border spinner-border-sm" /> Pruning…</> : <><i className="bi bi-trash3-fill" /> Confirm Prune</>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Create form ── */}
                {showForm && canManage && (
                    <div className="ep-card mb-3">
                        <div className="ep-card-header">
                            <span className="ep-card-title"><i className="bi bi-plus-circle me-2" />Create Session</span>
                        </div>
                        <div className="ep-card-body">
                            <form onSubmit={handleCreate}>
                                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))', gap:'.75rem' }}>
                                    <div className="ep-form-group" style={{ gridColumn:'1/-1' }}>
                                        <label className="ep-label">Course <span style={{ color:'var(--danger)' }}>*</span></label>
                                        <select className="ep-select" value={form.courseId} onChange={e=>setForm(p=>({...p,courseId:e.target.value}))}>
                                            <option value="">Select a course…</option>
                                            {courses.map(c=><option key={c._id} value={c._id}>{c.isPrivateCopy?'[PRIVATE] ':''}{courseTitle(c)} — {c.level} ({c.courseType||'SELF_TAUGHT'})</option>)}
                                        </select>
                                    </div>
                                    <div className="ep-form-group">
                                        <label className="ep-label">Session Type</label>
                                        <select className="ep-select" value={form.courseType} onChange={e=>setForm(p=>({...p,courseType:e.target.value}))}>
                                            <option value="HOSTED">HOSTED — no purchase required</option>
                                            <option value="MENTORED">MENTORED — must own course</option>
                                            <option value="SELF_TAUGHT">SELF_TAUGHT — no session features</option>
                                        </select>
                                    </div>
                                    <div className="ep-form-group d-flex align-items-center gap-2" style={{ paddingTop:'1.4rem' }}>
                                        <input type="checkbox" id="ri" checked={form.restrictionIgnored} onChange={e=>setForm(p=>({...p,restrictionIgnored:e.target.checked}))} />
                                        <label htmlFor="ri" style={{ fontSize:'.78rem', color:'var(--text-2)', cursor:'pointer' }}>Override rank restriction</label>
                                    </div>
                                    <div style={{ gridColumn:'1/-1', display:'flex', justifyContent:'flex-end' }}>
                                        <button type="submit" className="ep-btn ep-btn-md ep-btn-primary" disabled={saving}>
                                            {saving?<><span className="spinner-border spinner-border-sm" /> Creating…</>:<><i className="bi bi-check2" /> Create Session</>}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ── Filters ── */}
                {sessions.length > 0 && (
                    <div className="ep-toolbar">
                        <div className="ep-search-wrap">
                            <i className="bi bi-search" />
                            <input className="ep-input" style={{ width:200 }} placeholder="Search title or tutor…" value={searchText} onChange={e=>setSearchText(e.target.value)} />
                        </div>
                        <select className="ep-select" style={{ width:140 }} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                            <option value="">All statuses</option>
                            <option value="draft">Draft</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="archived">Archived</option>
                        </select>
                        <select className="ep-select" style={{ width:150 }} value={filterType} onChange={e=>setFilterType(e.target.value)}>
                            <option value="">All types</option>
                            <option value="HOSTED">Hosted</option>
                            <option value="MENTORED">Mentored</option>
                            <option value="SELF_TAUGHT">Self-Taught</option>
                        </select>
                        <select className="ep-select" style={{ width:110 }} value={sortBy} onChange={e=>setSortBy(e.target.value)}>
                            <option value="date">Date</option>
                            <option value="title">Title</option>
                            <option value="status">Status</option>
                        </select>
                        <button className="ep-btn ep-btn-md ep-btn-ghost" onClick={()=>setSortDir(d=>d==='asc'?'desc':'asc')} style={{ padding:'.45rem .75rem' }}>
                            <i className={`bi bi-sort-${sortDir==='asc'?'up':'down'}`} />
                        </button>
                        <span style={{ fontSize:'.72rem', color:'var(--text-muted)', marginLeft:'auto' }}>{filtered.length} / {sessions.length} sessions</span>
                    </div>
                )}

                {/* ── Session grid ── */}
                {sessions.length === 0 ? (
                    <div className="ep-empty">
                        <i className="bi bi-people" />
                        <p>No sessions yet.{canManage && ' Create your first session above.'}</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="ep-empty">
                        <i className="bi bi-funnel" />
                        <p>No sessions match your filters.</p>
                    </div>
                ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'.85rem' }}>
                        {filtered.map(sess => {
                            const isHost = String(sess.hostTutor?._id||sess.hostTutor) === String(data._id);
                            const statusCls = `session-card status-${sess.status}`;
                            return (
                                <div key={sess._id} className={statusCls}>
                                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.5rem' }}>
                                        <div style={{ fontWeight:700, fontSize:'.88rem', color:'var(--text)', lineHeight:1.3, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                            {courseTitle(sess.courseId)}
                                        </div>
                                        <span className={`badge-status ${sess.status}`}>{sess.status}</span>
                                    </div>
                                    <div style={{ fontSize:'.75rem', color:'var(--text-muted)', display:'flex', flexDirection:'column', gap:'.2rem' }}>
                                        <span><i className="bi bi-layers me-1" />{sess.courseId?.level} · {sess.courseType}</span>
                                        <span><i className="bi bi-person-fill me-1" />{sess.hostTutor?.nickname||'—'}{isHost && <span className="badge-status active ms-1" style={{ fontSize:'.6rem' }}>you</span>}</span>
                                        {sess.coTutors?.length > 0 && <span><i className="bi bi-people me-1" />{sess.coTutors.length} co-tutor{sess.coTutors.length>1?'s':''}</span>}
                                        {sess.schedule?.length > 0 && <span><i className="bi bi-calendar-event me-1" />{sess.schedule.length} scheduled</span>}
                                    </div>
                                    <div style={{ display:'flex', gap:'.4rem', marginTop:'.1rem' }}>
                                        <button className="ep-btn ep-btn-sm ep-btn-primary" style={{ flex:1 }} onClick={()=>navigate(`/manage/session/${sess._id}`)}>
                                            <i className="bi bi-arrow-right-circle" /> View
                                        </button>
                                        {isHost && sess.status!=='archived' && (
                                            <button className="ep-btn ep-btn-sm ep-btn-danger-ghost" onClick={()=>handleArchive(sess)} title="Archive">
                                                <i className="bi bi-archive" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <UtilityModal show={modal.show} type={modal.type} title={modal.title} message={modal.message}
                danger={modal.danger}
                onConfirm={()=>{ modal.onConfirm?.(); closeModal(); }}
                onCancel={modal.onCancel||closeModal} onClose={modal.onClose||closeModal} />
        </AppLayout>
    );
}

export default Sessions;

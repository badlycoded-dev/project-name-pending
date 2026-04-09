import { toHttps } from '../utils/utils';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';

const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');

function ProgressBar({ value }) {
    const pct = Math.round((value || 0) * 100);
    const color = pct >= 100 ? '#2f9e44' : pct > 50 ? '#3b5bdb' : '#f08c00';
    return (
        <div style={{ height: 6, borderRadius: 3, background: '#e9ecef', overflow: 'hidden', marginTop: 6 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width .4s' }} />
        </div>
    );
}

function StudentDashboard({ data, onLogout }) {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const ah = { Authorization: `${token?.split(' ')[0]} ${token?.split(' ')[1]}` };

    const [courses, setCourses]   = useState([]);
    const [loading, setLoading]   = useState(true);
    const [groups, setGroups]     = useState([]);
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter]     = useState('all');
    const [search, setSearch]     = useState('');
    const [activeTab, setActiveTab] = useState('courses');
    const [sessFilter, setSessFilter] = useState('');

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Fetch current user to get their courses list with process values
            const meRes = await fetch(`${API}/users/c`, { headers: { ...ah, 'Content-Type': 'application/json' } });
            if (!meRes.ok) { setLoading(false); return; }
            const { user } = await meRes.json();
            const enrolled = user.courses || [];

            // Fetch full course data for each enrolled course
            const courseData = await Promise.all(
                enrolled.map(async (entry) => {
                    try {
                        const res = await fetch(`${API}/courses/${entry._id}`);
                        if (!res.ok) return null;
                        const { data: c } = await res.json();
                        return { ...c, process: entry.process ?? 0 };
                    } catch { return null; }
                })
            );
            setCourses(courseData.filter(Boolean));

            // Fetch groups the user belongs to
            const grpRes = await fetch(`${API}/groups/my`, { headers: ah });
            if (grpRes.ok) {
                const { data: grpData } = await grpRes.json();
                setGroups(grpData || []);
                // Fetch sessions for those groups
                const sessIds = [...new Set((grpData || []).map(g => g.sessionId).filter(Boolean))];
                const sessData = await Promise.all(
                    sessIds.map(async (sid) => {
                        try {
                            const r = await fetch(`${API}/sessions/${sid}`, { headers: ah });
                            return r.ok ? (await r.json()).data : null;
                        } catch { return null; }
                    })
                );
                setSessions(sessData.filter(Boolean));
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const filtered = courses.filter(c => {
        const pct = Math.round((c.process || 0) * 100);
        if (filter === 'in-progress' && (pct === 0 || pct >= 100)) return false;
        if (filter === 'completed' && pct < 100) return false;
        if (filter === 'not-started' && pct !== 0) return false;
        if (search) {
            const title = c.trans?.[0]?.title || '';
            if (!title.toLowerCase().includes(search.toLowerCase())) return false;
        }
        return true;
    });

    const totalDone = courses.filter(c => (c.process || 0) >= 1).length;
    const inProgress = courses.filter(c => (c.process || 0) > 0 && (c.process || 0) < 1).length;

    if (loading) return (
    <AppLayout data={data} onLogout={onLogout} title="My Courses">
<div className="ap-loading"><div className="spinner-border text-primary" /><span>Loading your courses…</span></div>
        </AppLayout>
    );

    return (
    <AppLayout data={data} onLogout={onLogout} title="My Courses">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>

                {/* Header */}
                <div className="mb-3">
                    <h1 className="h3 fw-bold mb-1">My Learning</h1>
                    <p className="text-muted mb-2">Track your enrolled courses and sessions</p>
                    <div className="btn-group">
                        <button className={`btn btn-sm ${activeTab==='courses'?'btn-primary':'btn-outline-secondary'}`}
                            onClick={()=>setActiveTab('courses')}>
                            <i className="bi bi-book me-1"/>Courses
                            {courses.length>0 && <span className={`badge ms-1 ${activeTab==='courses'?'bg-white text-primary':'bg-secondary'}`}>{courses.length}</span>}
                        </button>
                        <button className={`btn btn-sm ${activeTab==='sessions'?'btn-primary':'btn-outline-secondary'}`}
                            onClick={()=>setActiveTab('sessions')}>
                            <i className="bi bi-people me-1"/>Sessions
                            {sessions.length>0 && <span className={`badge ms-1 ${activeTab==='sessions'?'bg-white text-primary':'bg-secondary'}`}>{sessions.length}</span>}
                        </button>
                    </div>
                </div>

                {/* Stat row */}
                <div className="row g-3 mb-4">
                    {(activeTab==='courses' ? [
                        { label: 'Enrolled',    value: courses.length,  icon: 'bi-book',              color: '#3b5bdb' },
                        { label: 'In progress', value: inProgress,      icon: 'bi-hourglass-split',   color: '#f08c00' },
                        { label: 'Completed',   value: totalDone,       icon: 'bi-check-circle-fill', color: '#2f9e44' },
                        { label: 'My groups',   value: groups.length,   icon: 'bi-people-fill',       color: '#7048e8' },
                    ] : [
                        { label: 'Total',    value: sessions.length,                                         icon: 'bi-people',           color: '#3b5bdb' },
                        { label: 'Active',   value: sessions.filter(s=>s.status==='active').length,          icon: 'bi-play-circle-fill', color: '#2f9e44' },
                        { label: 'Upcoming', value: sessions.filter(s=>{ const n=new Date(); return (s.schedule||[]).some(e=>new Date(e.datetime)>n); }).length, icon: 'bi-calendar-event', color: '#f08c00' },
                        { label: 'My groups',value: groups.length,                                           icon: 'bi-people-fill',      color: '#7048e8' },
                    ]).map(s => (
                        <div key={s.label} className="col-6 col-md-3">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-body p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-1">
                                        <small className="text-muted text-uppercase fw-semibold" style={{ fontSize: '.68rem', letterSpacing: '.05em' }}>{s.label}</small>
                                        <i className={`bi ${s.icon}`} style={{ color: s.color, fontSize: '1.1rem', opacity: .8 }}></i>
                                    </div>
                                    <div className="fw-bold" style={{ fontSize: '1.6rem', color: s.color, lineHeight: 1.1 }}>{s.value}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── COURSES TAB ── */}
                {activeTab === 'courses' && (<>
                {/* Courses section */}
                <div className="card border-0 shadow-sm mb-4">
                    <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span className="fw-semibold"><i className="bi bi-book me-2 text-primary"></i>My Courses</span>
                        <div className="d-flex gap-2 flex-wrap">
                            <input type="text" className="form-control form-control-sm" placeholder="Search…"
                                style={{ maxWidth: 180 }} value={search} onChange={e => setSearch(e.target.value)} />
                            <div className="btn-group btn-group-sm">
                                {[['all','All'],['not-started','Not started'],['in-progress','In progress'],['completed','Done']].map(([k,l]) => (
                                    <button key={k} className={`btn ${filter === k ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setFilter(k)}>{l}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="card-body p-3">
                        {courses.length === 0 ? (
                            <div className="text-center py-5">
                                <i className="bi bi-book-half" style={{ fontSize: '2.5rem', color: '#dee2e6' }}></i>
                                <p className="text-muted mt-3">You haven't enrolled in any courses yet.</p>
                                <button className="btn btn-primary btn-sm" onClick={() => navigate('/manage/courses')}>
                                    Browse Courses
                                </button>
                            </div>
                        ) : filtered.length === 0 ? (
                            <p className="text-muted text-center py-3">No courses match your filter.</p>
                        ) : (
                            <div className="row g-3">
                                {filtered.map(c => {
                                    const pct = Math.round((c.process || 0) * 100);
                                    const title = c.trans?.[0]?.title || '(untitled)';
                                    const desc  = c.trans?.[0]?.description || '';
                                    const thumb = c.links?.find(l => l.description?.toLowerCase() === 'course thumbnail');
                                    const myGroup = groups.find(g => String(g.courseId) === String(c._id) || String(g.courseId?._id) === String(c._id));
                                    const mySession = myGroup ? sessions.find(s => String(s._id) === String(myGroup.sessionId)) : null;

                                    return (
                                        <div key={c._id} className="col-md-6 col-lg-4">
                                            <div className="card border-0 shadow-sm h-100" style={{ cursor: 'pointer' }}
                                                onClick={() => navigate(`/course/view/${c._id}${mySession ? `?session=${mySession._id}` : ''}`)}>
                                                {thumb && (
                                                    <img src={`${toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')}${thumb.url}`} alt={title}
                                                        className="card-img-top" style={{ height: 140, objectFit: 'cover' }} />
                                                )}
                                                <div className="card-body p-3">
                                                    <div className="d-flex align-items-start justify-content-between mb-1">
                                                        <h6 className="fw-semibold mb-0" style={{ lineHeight: 1.3 }}>{title}</h6>
                                                        {pct >= 100 && <span className="badge bg-success ms-2 flex-shrink-0">Done</span>}
                                                        {pct > 0 && pct < 100 && <span className="badge bg-warning text-dark ms-2 flex-shrink-0">{pct}%</span>}
                                                    </div>
                                                    {desc && <p className="text-muted small mb-2 text-truncate" style={{ WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{desc}</p>}
                                                    <div className="d-flex gap-2 flex-wrap mb-2">
                                                        <span className="badge bg-light text-dark border" style={{ fontSize: '.68rem' }}>{c.direction}</span>
                                                        <span className="badge bg-light text-dark border" style={{ fontSize: '.68rem' }}>{c.level}</span>
                                                        {mySession && <span className="badge bg-info text-dark" style={{ fontSize: '.68rem' }}><i className="bi bi-people me-1"></i>Session</span>}
                                                        {c.isPrivateCopy && <span className="badge bg-warning text-dark" style={{ fontSize: '.68rem' }}><i className="bi bi-lock-fill me-1"></i>Private</span>}
                                                    </div>
                                                    <ProgressBar value={c.process} />
                                                    <div className="d-flex justify-content-between mt-1">
                                                        <small className="text-muted">{pct === 0 ? 'Not started' : pct >= 100 ? 'Completed' : `${pct}% complete`}</small>
                                                        <small className="text-primary">Continue →</small>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
                </>)}

                {/* ── SESSIONS TAB ── */}
                {activeTab === 'sessions' && (
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
                            <span className="fw-semibold"><i className="bi bi-people me-2" style={{color:'#7048e8'}}></i>My Sessions</span>
                            <select className="form-select form-select-sm" style={{maxWidth:140}} value={sessFilter} onChange={e=>setSessFilter(e.target.value)}>
                                <option value="">All statuses</option>
                                <option value="active">Active</option>
                                <option value="draft">Draft</option>
                                <option value="completed">Completed</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                        <div className="card-body p-0">
                            {sessions.length === 0 ? (
                                <div className="text-center py-5">
                                    <i className="bi bi-people" style={{ fontSize: '2.5rem', color: '#dee2e6' }}></i>
                                    <p className="text-muted mt-3">You're not enrolled in any sessions yet.</p>
                                </div>
                            ) : sessions.filter(s=>!sessFilter||s.status===sessFilter).length === 0 ? (
                                <p className="text-muted text-center py-3">No sessions match this filter.</p>
                            ) : sessions.filter(s=>!sessFilter||s.status===sessFilter).map(s => {
                                const courseTitle = s.courseId?.trans?.[0]?.title || '(untitled)';
                                const now = new Date();
                                const upcoming = (s.schedule||[])
                                    .filter(e=>new Date(e.datetime)>now)
                                    .sort((a,b)=>new Date(a.datetime)-new Date(b.datetime))[0];
                                const past = (s.schedule||[])
                                    .filter(e=>new Date(e.datetime)<=now)
                                    .sort((a,b)=>new Date(b.datetime)-new Date(a.datetime))[0];
                                const statusColor = {active:'#2f9e44',draft:'#868e96',completed:'#3b5bdb',archived:'#adb5bd'}[s.status]||'#868e96';
                                return (
                                    <div key={s._id} className="px-3 py-3 border-bottom"
                                        style={{cursor:'pointer'}}
                                        onClick={()=>navigate(`/course/view/${s.courseId?._id||s.courseId}?session=${s._id}`)}>
                                        <div className="d-flex align-items-start gap-3">
                                            <div className="flex-shrink-0 mt-1">
                                                <i className="bi bi-people-fill" style={{color:'#7048e8',fontSize:'1.3rem'}}></i>
                                            </div>
                                            <div className="flex-grow-1 min-w-0">
                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                    <span className="fw-semibold" style={{fontSize:'.92rem'}}>{courseTitle}</span>
                                                    <span className="badge" style={{background:statusColor,fontSize:'.6rem'}}>{s.status}</span>
                                                    {s.courseType && <span className="badge bg-light text-dark border" style={{fontSize:'.6rem'}}>{s.courseType}</span>}
                                                </div>
                                                <div className="d-flex flex-wrap gap-3" style={{fontSize:'.75rem',color:'#868e96'}}>
                                                    <span><i className="bi bi-person-fill me-1"/>Host: {s.hostTutor?.nickname||'—'}</span>
                                                    {s.coTutors?.length>0 && <span><i className="bi bi-people me-1"/>{s.coTutors.length} co-tutor{s.coTutors.length>1?'s':''}</span>}
                                                    {s.schedule?.length>0 && <span><i className="bi bi-calendar3 me-1"/>{s.schedule.length} classes total</span>}
                                                    {past && <span><i className="bi bi-calendar-check me-1"/>Last: {new Date(past.datetime).toLocaleDateString()}</span>}
                                                </div>
                                            </div>
                                            <div className="text-end flex-shrink-0">
                                                {upcoming ? (<>
                                                    <div className="small fw-semibold text-primary">{new Date(upcoming.datetime).toLocaleDateString()}</div>
                                                    <div style={{fontSize:'.72rem',color:'#868e96'}}>{new Date(upcoming.datetime).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                                                    <div style={{fontSize:'.65rem',color:'#2f9e44'}}>Next class</div>
                                                </>) : (
                                                    <div style={{fontSize:'.72rem',color:'#adb5bd'}}>No upcoming</div>
                                                )}
                                            </div>
                                            <i className="bi bi-chevron-right text-muted align-self-center"></i>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}

export default StudentDashboard;
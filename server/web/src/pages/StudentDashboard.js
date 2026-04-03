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

    const [courses, setCourses]   = useState([]);   // full course docs for enrolled courses
    const [loading, setLoading]   = useState(true);
    const [groups, setGroups]     = useState([]);   // user's session groups
    const [sessions, setSessions] = useState([]);
    const [filter, setFilter]     = useState('all'); // 'all' | 'in-progress' | 'completed'
    const [search, setSearch]     = useState('');

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
                <div className="mb-4">
                    <h1 className="h3 fw-bold mb-1">My Learning</h1>
                    <p className="text-muted mb-0">Track your enrolled courses and sessions</p>
                </div>

                {/* Stat row */}
                <div className="row g-3 mb-4">
                    {[
                        { label: 'Enrolled',    value: courses.length,  icon: 'bi-book',              color: '#3b5bdb' },
                        { label: 'In progress', value: inProgress,      icon: 'bi-hourglass-split',   color: '#f08c00' },
                        { label: 'Completed',   value: totalDone,       icon: 'bi-check-circle-fill', color: '#2f9e44' },
                        { label: 'My groups',   value: groups.length,   icon: 'bi-people-fill',       color: '#7048e8' },
                    ].map(s => (
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
                                    // Find active session for this course
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

                {/* Active sessions */}
                {sessions.length > 0 && (
                    <div className="card border-0 shadow-sm">
                        <div className="card-header bg-white fw-semibold">
                            <i className="bi bi-people me-2 text-purple" style={{ color: '#7048e8' }}></i>Active Sessions
                        </div>
                        <div className="card-body p-0">
                            {sessions.map(s => {
                                const courseTitle = s.courseId?.trans?.[0]?.title || '(untitled)';
                                const now = new Date();
                                const upcoming = (s.schedule || [])
                                    .filter(e => new Date(e.datetime) > now)
                                    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))[0];
                                return (
                                    <div key={s._id} className="d-flex align-items-center gap-3 px-3 py-3 border-bottom"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/course/view/${s.courseId?._id || s.courseId}?session=${s._id}`)}>
                                        <i className="bi bi-people-fill" style={{ color: '#7048e8', fontSize: '1.3rem' }}></i>
                                        <div className="flex-grow-1">
                                            <div className="fw-semibold small">{courseTitle}</div>
                                            <div style={{ fontSize: '.75rem', color: '#868e96' }}>
                                                Host: {s.hostTutor?.nickname || '—'}
                                                <span className={`badge ms-2 ${s.status === 'active' ? 'bg-success' : 'bg-secondary'}`} style={{ fontSize: '.6rem' }}>{s.status}</span>
                                            </div>
                                        </div>
                                        {upcoming && (
                                            <div className="text-end">
                                                <div className="small fw-semibold text-primary">{new Date(upcoming.datetime).toLocaleDateString()}</div>
                                                <div style={{ fontSize: '.72rem', color: '#868e96' }}>{new Date(upcoming.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                            </div>
                                        )}
                                        <i className="bi bi-chevron-right text-muted"></i>
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
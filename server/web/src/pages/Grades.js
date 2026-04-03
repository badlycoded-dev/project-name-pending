import { toHttps } from '../utils/utils';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';

const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');

const STATUS_META = {
    approved: { color: 'bg-success',           label: 'Approved' },
    declined: { color: 'bg-danger',            label: 'Declined' },
    pending:  { color: 'bg-warning text-dark', label: 'Pending'  },
};

function Grades({ data, onLogout }) {
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    const ah = { Authorization: `${token?.split(' ')[0]} ${token?.split(' ')[1]}` };

    const [rows, setRows]         = useState([]);  // flattened submission rows
    const [loading, setLoading]   = useState(true);
    const [filter, setFilter]     = useState('all');  // 'all' | 'pending' | 'approved' | 'declined'
    const [sortBy, setSortBy]     = useState('date'); // 'date' | 'mark' | 'course'

    useEffect(() => { fetchAll(); }, []);

    const fetchAll = async () => {
        setLoading(true);
        try {
            // Get user's groups
            const meRes = await fetch(`${API}/users/c`, { headers: { ...ah, 'Content-Type': 'application/json' } });
            if (!meRes.ok) { setLoading(false); return; }
            const { user } = await meRes.json();

            const grpRes = await fetch(`${API}/groups/my`, { headers: ah });
            if (!grpRes.ok) { setLoading(false); return; }
            const { data: groups } = await grpRes.json();
            if (!groups?.length) { setRows([]); setLoading(false); return; }

            // For each group fetch assignments, then submissions for this user
            const allRows = [];
            await Promise.all((groups || []).map(async (group) => {
                try {
                    const aRes = await fetch(`${API}/assignments?groupId=${group._id}`, { headers: ah });
                    if (!aRes.ok) return;
                    const { data: assignments } = await aRes.json();
                    await Promise.all((assignments || []).map(async (a) => {
                        try {
                            const sRes = await fetch(
                                `${API}/submissions/${group._id}/${a._id}`,
                                { headers: ah }
                            );
                            if (!sRes.ok) return;
                            const { data: subs } = await sRes.json();
                            // Only my submissions
                            const mine = (subs || []).filter(
                                s => String(s.studentId?._id || s.studentId) === String(user._id)
                            );
                            mine.forEach(s => allRows.push({
                                submission: s,
                                assignment: a,
                                group,
                                courseId: group.courseId,
                            }));
                        } catch {}
                    }));
                } catch {}
            }));

            setRows(allRows);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const filtered = rows
        .filter(r => filter === 'all' || r.submission.status === filter)
        .sort((a, b) => {
            if (sortBy === 'date')  return new Date(b.submission.submittedAt) - new Date(a.submission.submittedAt);
            if (sortBy === 'mark')  return (b.submission.mark ?? -1) - (a.submission.mark ?? -1);
            if (sortBy === 'course') return String(a.courseId).localeCompare(String(b.courseId));
            return 0;
        });

    const totalMark  = rows.filter(r => r.submission.mark != null).reduce((s, r) => s + (r.submission.mark / r.assignment.maxMark), 0);
    const gradedCount= rows.filter(r => r.submission.mark != null).length;
    const avgPct     = gradedCount ? Math.round((totalMark / gradedCount) * 100) : null;

    if (loading) return (
    <AppLayout data={data} onLogout={onLogout} title="My Grades">
<div className="ap-loading"><div className="spinner-border text-primary" /><span>Loading grades…</span></div>
        </AppLayout>
    );

    return (
    <AppLayout data={data} onLogout={onLogout} title="My Grades">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>

                {/* Header */}
                <div className="mb-4">
                    <button className="btn btn-outline-secondary btn-sm mb-2" onClick={() => navigate('/my-courses')}>
                        ← My Learning
                    </button>
                    <h1 className="h3 fw-bold mb-1">My Grades</h1>
                    <p className="text-muted mb-0">Submission history across all sessions</p>
                </div>

                {/* Summary cards */}
                <div className="row g-3 mb-4">
                    {[
                        { label: 'Submissions',  value: rows.length,                                                icon: 'bi-upload',           color: '#3b5bdb' },
                        { label: 'Pending',      value: rows.filter(r => r.submission.status === 'pending').length, icon: 'bi-hourglass-split',  color: '#f08c00' },
                        { label: 'Approved',     value: rows.filter(r => r.submission.status === 'approved').length,icon: 'bi-check-circle-fill',color: '#2f9e44' },
                        { label: 'Avg score',    value: avgPct != null ? `${avgPct}%` : '—',                        icon: 'bi-bar-chart-fill',   color: '#7048e8' },
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

                {/* Table */}
                <div className="card border-0 shadow-sm">
                    <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
                        <span className="fw-semibold"><i className="bi bi-clipboard-check me-2 text-primary"></i>Submissions</span>
                        <div className="d-flex gap-2 flex-wrap">
                            {/* Status filter */}
                            <div className="btn-group btn-group-sm">
                                {[['all','All'],['pending','Pending'],['approved','Approved'],['declined','Declined']].map(([k,l]) => (
                                    <button key={k} className={`btn ${filter === k ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setFilter(k)}>{l}</button>
                                ))}
                            </div>
                            {/* Sort */}
                            <select className="form-select form-select-sm" style={{ maxWidth: 140 }}
                                value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                <option value="date">Newest first</option>
                                <option value="mark">Highest mark</option>
                                <option value="course">By course</option>
                            </select>
                        </div>
                    </div>

                    {rows.length === 0 ? (
                        <div className="text-center py-5">
                            <i className="bi bi-clipboard-x" style={{ fontSize: '2.5rem', color: '#dee2e6' }}></i>
                            <p className="text-muted mt-3">No submissions yet. Join a session to get assignments.</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-hover align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Assignment</th>
                                        <th>Group</th>
                                        <th>Submitted</th>
                                        <th>Status</th>
                                        <th>Mark</th>
                                        <th>Feedback</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map((r, i) => {
                                        const s  = r.submission;
                                        const a  = r.assignment;
                                        const pct = s.mark != null ? Math.round((s.mark / a.maxMark) * 100) : null;
                                        const meta = STATUS_META[s.status] || STATUS_META.pending;
                                        return (
                                            <tr key={i}>
                                                <td>
                                                    <div className="fw-semibold small">{a.title}</div>
                                                    <div style={{ fontSize: '.72rem', color: '#868e96' }}>
                                                        Due: {new Date(a.dueAt).toLocaleDateString()}
                                                        {s.isOverdue && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '.6rem' }}>overdue</span>}
                                                    </div>
                                                </td>
                                                <td><small className="text-muted">{r.group?.name || '—'}</small></td>
                                                <td><small className="text-muted">{new Date(s.submittedAt).toLocaleString()}</small></td>
                                                <td><span className={`badge ${meta.color}`} style={{ fontSize: '.72rem' }}>{meta.label}</span></td>
                                                <td>
                                                    {s.mark != null ? (
                                                        <div>
                                                            <span className="fw-semibold">{s.mark}</span>
                                                            <span className="text-muted">/{a.maxMark}</span>
                                                            <div style={{ height: 4, borderRadius: 2, background: '#e9ecef', marginTop: 3, width: 60 }}>
                                                                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#2f9e44' : pct >= 50 ? '#f08c00' : '#e03131', borderRadius: 2 }} />
                                                            </div>
                                                        </div>
                                                    ) : <span className="text-muted">—</span>}
                                                </td>
                                                <td>
                                                    <small className="text-muted" style={{ maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {s.feedback || '—'}
                                                    </small>
                                                </td>
                                                <td>
                                                    <button className="btn btn-sm btn-outline-primary"
                                                        onClick={() => navigate(`/course/view/${r.courseId}`)}>
                                                        View
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

export default Grades;
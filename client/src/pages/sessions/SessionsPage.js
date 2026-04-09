import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getUser } from '../../utils/auth';
import config from '../../config/config';

const API_URL = config.API_URL;

/* ── helpers ─────────────────────────────────────────────────── */
const STATUS_META = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: 'rgba(107,114,128,.12)', icon: 'bi-pencil'        },
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,.12)',  icon: 'bi-play-circle'   },
  completed: { label: 'Completed', color: '#3b82f6', bg: 'rgba(59,130,246,.12)',  icon: 'bi-check-circle'  },
  archived:  { label: 'Archived',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  icon: 'bi-archive'       },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || STATUS_META.draft;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: m.color, background: m.bg, border: `1px solid ${m.color}33`,
    }}>
      <i className={`bi ${m.icon}`} /> {m.label}
    </span>
  );
}

/* ── Create Session Modal ────────────────────────────────────── */
function CreateSessionModal({ onClose, onCreated }) {
  const [courseId, setCourseId]   = useState('');
  const [courseType, setCourseType] = useState('HOSTED');
  const [courses, setCourses]     = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/manage/courses`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setCourses(d.data || []))
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!courseId) { setError('Please select a course'); return; }
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/sessions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, courseType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      onCreated(data.data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1040 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 480,
        background: 'var(--card-bg)', color: 'var(--text)',
        borderRadius: 18, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,.35)',
        padding: 28,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h5 style={{ margin: 0, fontWeight: 700 }}>Create New Session</h5>
          <button className="btn-close" onClick={onClose} />
        </div>

        {error && <div className="alert alert-danger py-2 small">{error}</div>}

        <div className="mb-3">
          <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>Course</label>
          <select className="form-select" value={courseId} onChange={e => setCourseId(e.target.value)}
            style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)' }}>
            <option value="">— Select a course —</option>
            {courses.map(c => (
              <option key={c._id} value={c._id}>{c.trans?.[0]?.title || c.title || c._id}</option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="form-label fw-semibold small text-uppercase" style={{ color: 'var(--muted)' }}>Session Type</label>
          <div className="d-flex gap-2">
            {['HOSTED', 'SELF_TAUGHT'].map(type => (
              <button key={type} type="button"
                onClick={() => setCourseType(type)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: `2px solid ${courseType === type ? 'var(--primary-color)' : 'var(--border-color)'}`,
                  background: courseType === type ? 'rgba(37,99,235,.1)' : 'transparent',
                  color: courseType === type ? 'var(--primary-color)' : 'var(--muted)',
                  fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all .15s',
                }}>
                <i className={`bi ${type === 'HOSTED' ? 'bi-people' : 'bi-person'} me-2`} />
                {type === 'HOSTED' ? 'Hosted' : 'Self-Taught'}
              </button>
            ))}
          </div>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary rounded-pill px-4 flex-1" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-primary rounded-pill px-4 flex-1 fw-bold" onClick={handleCreate} disabled={loading}>
            {loading ? <span className="spinner-border spinner-border-sm me-2" /> : <i className="bi bi-plus-circle me-2" />}
            Create Session
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Session Detail Modal ────────────────────────────────────── */
function SessionDetailModal({ session, onClose, onUpdate, onDelete }) {
  const [status, setStatus]   = useState(session.status || 'draft');
  const [updating, setUpdating] = useState(false);
  const [error, setError]     = useState('');

  const courseTitle = session.courseId?.trans?.[0]?.title || session.courseId?.title || session.courseId || '—';
  const tutors = session.tutors || [];

  const handleStatusChange = async (newStatus) => {
    setUpdating(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/sessions/${session._id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      setStatus(newStatus);
      onUpdate({ ...session, status: newStatus });
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleArchive = async () => {
    if (!window.confirm('Archive this session?')) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/sessions/${session._id}/archive`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      onUpdate({ ...session, status: 'archived' });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this session? This cannot be undone. Session must be "completed" first.')) return;
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/sessions/${session._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      onDelete(session._id);
      onClose();
    } catch (err) {
      setError(err.message);
      setUpdating(false);
    }
  };

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1040 }} onClick={onClose} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto',
        background: 'var(--card-bg)', color: 'var(--text)',
        borderRadius: 18, zIndex: 1050, boxShadow: '0 20px 60px rgba(0,0,0,.35)',
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '22px 24px 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ marginBottom: 6 }}><StatusBadge status={status} /></div>
            <h5 style={{ margin: 0, fontWeight: 700 }}>{courseTitle}</h5>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)' }}>ID: {session._id}</p>
          </div>
          <button className="btn-close" onClick={onClose} />
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

          {/* Info grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Type',    value: session.courseType || '—', icon: 'bi-tag' },
              { label: 'Groups',  value: session.groupCount ?? (session.groups?.length ?? '—'), icon: 'bi-people' },
              { label: 'Created', value: session.createdAt ? new Date(session.createdAt).toLocaleDateString() : '—', icon: 'bi-calendar' },
              { label: 'Updated', value: session.updatedAt ? new Date(session.updatedAt).toLocaleDateString() : '—', icon: 'bi-clock' },
            ].map(({ label, value, icon }) => (
              <div key={label} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 14px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className={`bi ${icon}`} /> {label}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{String(value)}</div>
              </div>
            ))}
          </div>

          {/* Tutors */}
          {tutors.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Tutors ({tutors.length})
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {tutors.map((t, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border-color)' }}>
                    <i className="bi bi-person-circle text-primary" style={{ fontSize: 18 }} />
                    <span style={{ flex: 1, fontSize: 14 }}>{t.userId?.nickname || t.userId || '—'}</span>
                    {t.isHost && <span className="badge bg-primary" style={{ fontSize: 10 }}>Host</span>}
                    {t.canGrade && <span className="badge bg-secondary" style={{ fontSize: 10 }}>Grade</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Change Status */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
              Change Status
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {['draft', 'active', 'completed'].map(s => {
                const m = STATUS_META[s];
                const isCurrent = status === s;
                return (
                  <button key={s} disabled={isCurrent || updating} onClick={() => handleStatusChange(s)}
                    style={{
                      border: `2px solid ${isCurrent ? m.color : 'var(--border-color)'}`,
                      background: isCurrent ? m.bg : 'transparent',
                      color: isCurrent ? m.color : 'var(--muted)',
                      borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 600,
                      cursor: isCurrent ? 'default' : 'pointer', transition: 'all .15s',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                    <i className={`bi ${m.icon}`} /> {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Manage session link */}
          <a
            href={`/manage/session/${session._id}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '10px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(37,99,235,.1)', color: 'var(--primary-color)',
              border: '1px solid rgba(37,99,235,.2)', textDecoration: 'none',
              fontWeight: 600, fontSize: 14, transition: 'background .15s',
            }}>
            <i className="bi bi-kanban" /> Open Full Session Manager
          </a>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-sm btn-outline-warning rounded-pill px-3" onClick={handleArchive} disabled={updating}>
              <i className="bi bi-archive me-1" /> Archive
            </button>
            <button className="btn btn-sm btn-outline-danger rounded-pill px-3" onClick={handleDelete} disabled={updating}>
              <i className="bi bi-trash me-1" /> Delete
            </button>
          </div>
          <button className="btn btn-sm btn-secondary rounded-pill px-4" onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*                        MAIN PAGE                               */
/* ═══════════════════════════════════════════════════════════════ */
export default function SessionsPage() {
  const navigate  = useNavigate();
  const { t }     = useContext(SettingsContext);
  const user      = getUser();

  const [sessions, setSessions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch]       = useState('');

  const fetchSessions = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/sessions`, {
        headers: { 'Authorization': token?.startsWith('Bearer ') ? token : `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      setSessions(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleUpdate = (updated) => setSessions(prev => prev.map(s => s._id === updated._id ? updated : s));
  const handleDelete = (id) => setSessions(prev => prev.filter(s => s._id !== id));
  const handleCreated = (newSession) => setSessions(prev => [newSession, ...prev]);

  /* Filter */
  const filtered = sessions.filter(s => {
    const title = s.courseId?.trans?.[0]?.title || s.courseId?.title || '';
    const matchSearch = !search || title.toLowerCase().includes(search.toLowerCase()) || s._id.includes(search);
    const matchStatus = !filterStatus || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  /* Counts */
  const counts = Object.keys(STATUS_META).reduce((acc, k) => {
    acc[k] = sessions.filter(s => s.status === k).length;
    return acc;
  }, {});

  if (!user) { navigate('/login'); return null; }

  return (
    <div className="container py-5" style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="bi bi-kanban me-2 text-primary" />
            Sessions
          </h2>
          <p className="text-muted mb-0">Manage your teaching sessions</p>
        </div>
        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary rounded-pill px-3" onClick={fetchSessions} disabled={loading}>
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
          </button>
          <button className="btn btn-primary rounded-pill px-4 fw-bold" onClick={() => setShowCreate(true)}>
            <i className="bi bi-plus-circle me-2" /> New Session
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .spin { animation: spin .7s linear infinite; display:inline-block; }
        .sess-card { transition: transform .15s, box-shadow .15s; cursor: pointer; }
        .sess-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.15) !important; }
      `}</style>

      {/* Status counters */}
      <div className="row g-3 mb-4">
        {Object.entries(STATUS_META).map(([key, m]) => (
          <div key={key} className="col-6 col-md-3">
            <div onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
              style={{
                background: filterStatus === key ? m.bg : 'var(--card-bg)',
                border: `2px solid ${filterStatus === key ? m.color : 'var(--border-color)'}`,
                borderRadius: 14, padding: '14px 18px', cursor: 'pointer', transition: 'all .2s',
              }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: m.color }}>{counts[key]}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className={`bi ${m.icon}`} style={{ color: m.color }} /> {m.label}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            <div className="col-12 col-md-7">
              <div className="input-group">
                <span className="input-group-text" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}>
                  <i className="bi bi-search text-muted" />
                </span>
                <input type="text" className="form-control" placeholder="Search by course name or session ID..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)' }} />
                {search && <button className="btn btn-outline-secondary" onClick={() => setSearch('')}><i className="bi bi-x" /></button>}
              </div>
            </div>
            <div className="col-6 col-md-3">
              <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)' }}>
                <option value="">All Statuses</option>
                {Object.entries(STATUS_META).map(([k, m]) => (
                  <option key={k} value={k}>{m.label}</option>
                ))}
              </select>
            </div>
            {(filterStatus || search) && (
              <div className="col-6 col-md-2">
                <button className="btn btn-outline-secondary btn-sm rounded-pill w-100"
                  onClick={() => { setFilterStatus(''); setSearch(''); }}>
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Loading / Error / Empty */}
      {loading && (
        <div className="text-center py-5">
          <span className="spinner-border text-primary" />
          <p className="text-muted mt-3">Loading sessions...</p>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger d-flex align-items-center gap-2" style={{ borderRadius: 12 }}>
          <i className="bi bi-exclamation-triangle-fill" />
          <span>{error}</span>
          <button className="btn btn-sm btn-outline-danger ms-auto rounded-pill" onClick={fetchSessions}>Retry</button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-kanban fs-1 text-muted mb-3 d-block" />
          <h5 className="fw-bold">{sessions.length === 0 ? 'No sessions yet' : 'No sessions match your filter'}</h5>
          {sessions.length === 0 && (
            <button className="btn btn-primary rounded-pill px-4 mt-3" onClick={() => setShowCreate(true)}>
              <i className="bi bi-plus-circle me-2" /> Create your first session
            </button>
          )}
        </div>
      )}

      {/* Sessions list */}
      {!loading && !error && filtered.length > 0 && (
        <>
          <p className="text-muted small mb-3">Showing <strong>{filtered.length}</strong> session{filtered.length !== 1 ? 's' : ''}</p>
          <div className="d-grid gap-3">
            {filtered.map(session => {
              const title = session.courseId?.trans?.[0]?.title || session.courseId?.title || 'Untitled Course';
              const sm = STATUS_META[session.status] || STATUS_META.draft;
              const tutors = session.tutors || [];
              const hostTutor = tutors.find(t => t.isHost);

              return (
                <div key={session._id} className="sess-card card border-0 shadow-sm"
                  style={{ borderRadius: 14, background: 'var(--card-bg)' }}
                  onClick={() => setSelected(session)}>
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center gap-3 flex-wrap">
                      {/* Icon */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        background: sm.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={`bi ${sm.icon} fs-4`} style={{ color: sm.color }} />
                      </div>

                      {/* Title + meta */}
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>{title}</div>
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          {hostTutor && (
                            <span><i className="bi bi-person me-1" />{hostTutor.userId?.nickname || 'Host'}</span>
                          )}
                          <span><i className="bi bi-tag me-1" />{session.courseType || '—'}</span>
                          {session.createdAt && (
                            <span><i className="bi bi-calendar me-1" />{new Date(session.createdAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Badges */}
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <StatusBadge status={session.status} />
                        {(session.groupCount || session.groups?.length) > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="bi bi-people" /> {session.groupCount || session.groups?.length} group{(session.groupCount || session.groups?.length) !== 1 ? 's' : ''}
                          </span>
                        )}
                        {tutors.length > 0 && (
                          <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <i className="bi bi-person-badge" /> {tutors.length} tutor{tutors.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>

                      <i className="bi bi-chevron-right text-muted" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {showCreate && (
        <CreateSessionModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}
      {selected && (
        <SessionDetailModal
          session={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
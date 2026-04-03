import { toHttps } from '../utils/utils';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { formatLaunchTime, formatUptime, getTimeAgo } from '../utils/utils';

const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');

function Sparkbar({ value, max, color }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="stat-bar">
      <div className="stat-bar-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function StatCard({ label, value, sub, icon, color = 'var(--accent)', sparkValue, sparkMax, onClick }) {
  return (
    <div className={`stat-tile${onClick ? ' cursor-pointer' : ''}`} onClick={onClick}>
      <div className="d-flex align-items-start justify-content-between mb-1">
        <div className="sc-label">{label}</div>
        <span style={{ fontSize: 20, color, opacity: .8 }}>{icon}</span>
      </div>
      <div className="sc-value" style={{ color }}>
        {value === undefined || value === null ? <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>—</span> : value}
      </div>
      {sub && <div className="sc-sub">{sub}</div>}
      {sparkMax !== undefined && <Sparkbar value={sparkValue || 0} max={sparkMax} color={color} />}
    </div>
  );
}

function StatusDot({ ok }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px',
      borderRadius: 20, fontSize: '.75rem', fontWeight: 700,
      background: ok ? 'var(--success-bg)' : 'var(--danger-bg)',
      color: ok ? 'var(--success)' : 'var(--danger)'
    }}>
      <span style={{ fontSize: '.5rem' }}>●</span>
      {ok ? 'Online' : 'Offline'}
    </span>
  );
}

function Main({ data, onLogout, startMeeting, activeMeeting }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState({ status: 'ok', db_status: 'ok', uptime: 0, launchTime: null });
  const [stats, setStats] = useState({
    userCount: null, courseCount: null, sessionCount: null,
    activeSessionCount: null, groupCount: null, assignmentCount: null,
    pendingSubmissionCount: null, upcomingMeetings: []
  });
  const [live, setLive] = useState('connecting');
  const esRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const url = `${API}/utils/status/stream?token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onopen = () => setLive('open');
    es.onerror = () => { setLive('error'); setStatus(p => ({ ...p, status: 'fixing' })); };
    es.onmessage = (e) => {
      try {
        const d = JSON.parse(e.data);
        setStatus(p => ({ ...p, ...d }));
        setStats(p => ({
          userCount: d.userCount ?? p.userCount,
          courseCount: d.courseCount ?? p.courseCount,
          sessionCount: d.sessionCount ?? p.sessionCount,
          activeSessionCount: d.activeSessionCount ?? p.activeSessionCount,
          groupCount: d.groupCount ?? p.groupCount,
          assignmentCount: d.assignmentCount ?? p.assignmentCount,
          pendingSubmissionCount: d.pendingSubmissionCount ?? p.pendingSubmissionCount,
          upcomingMeetings: d.upcomingMeetings ?? p.upcomingMeetings,
        }));
        if (live !== 'open') setLive('open');
      } catch { }
    };
    return () => es.close();
  }, []);

  const serverOk = status.status === 'ok';
  const dbOk = serverOk && status.db_status === 'connected';

  const isManage = ['manage', 'admin', 'root'].includes(data?.accessLevel);
  const isTutor = ['tutor', 'manage', 'admin', 'root'].includes(data?.accessLevel);

  return (
    <AppLayout
      data={data} onLogout={onLogout}
      title="Dashboard"
      topbarActions={
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          <StatusDot ok={serverOk} />
          {live === 'open'
            ? <span className="status-badge active" style={{ fontSize: '.7rem' }}>Live</span>
            : <span className="status-badge warning" style={{ fontSize: '.7rem' }}>Connecting…</span>
          }
        </div>
      }
    >
      <div className='container'>

        {/* ── Welcome banner ── */}
        <div style={{ background: 'var(--accent)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem', marginBottom: '1.5rem', color: '#fff' }}>
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
            <div>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem' }}>
                Welcome back, {data?.nickname || 'User'} 👋
              </h2>
              <p style={{ margin: '.25rem 0 0', opacity: .82, fontSize: '.88rem' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            {isTutor && (
              <button className="btn btn-light btn-sm fw-semibold" onClick={() => navigate('/manage/sessions')}>
                <i className="bi bi-people me-1" /> My Sessions
              </button>
            )}
          </div>
        </div>

        {/* ── Stats row — only for manage+ ── */}
        {isManage && (
          <div className='container'>
            <div className="row g-3 mb-3">
              <div className="col-6 col-lg-3">
                <StatCard label="Users" value={stats.userCount} sub="Registered accounts"
                  icon="👤" color="var(--accent)"
                  sparkValue={stats.userCount} sparkMax={Math.max(stats.userCount || 0, 100)}
                  onClick={() => navigate('/manage/users')} />
              </div>
              <div className="col-6 col-lg-3">
                <StatCard label="Courses" value={stats.courseCount} sub="All types"
                  icon="📚" color="#6610f2"
                  sparkValue={stats.courseCount} sparkMax={Math.max(stats.courseCount || 0, 50)}
                  onClick={() => navigate('/manage/courses')} />
              </div>
              <div className="col-6 col-lg-3">
                <StatCard label="Sessions" value={stats.sessionCount}
                  sub={`${stats.activeSessionCount ?? '—'} active`}
                  icon="🎓" color="var(--info)"
                  sparkValue={stats.activeSessionCount} sparkMax={Math.max(stats.sessionCount || 0, 1)}
                  onClick={() => navigate('/manage/sessions')} />
              </div>
              <div className="col-6 col-lg-3">
                <StatCard label="Pending Reviews" value={stats.pendingSubmissionCount}
                  sub="Awaiting grade" icon="⏳"
                  color={stats.pendingSubmissionCount > 0 ? 'var(--danger)' : 'var(--success)'}
                  sparkValue={stats.pendingSubmissionCount} sparkMax={Math.max(stats.pendingSubmissionCount || 0, 10)} />
              </div>
            </div>
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3">
                <StatCard label="Groups" value={stats.groupCount} sub="Across sessions"
                  icon="👥" color="var(--warning)"
                  sparkValue={stats.groupCount} sparkMax={Math.max(stats.groupCount || 0, 20)} />
              </div>
              <div className="col-6 col-md-3">
                <StatCard label="Assignments" value={stats.assignmentCount}
                  sub="Defined tasks" icon="📋" color="var(--success)" />
              </div>
              <div className="col-6 col-md-3">
                <StatCard label="Uptime"
                  value={serverOk ? formatUptime(status.uptime) : '—'}
                  sub={status.launchTime ? `Since ${formatLaunchTime(status.launchTime)}` : ''}
                  icon="🕐" color={serverOk ? 'var(--success)' : 'var(--danger)'} />
              </div>
              <div className="col-6 col-md-3">
                <StatCard label="Database" value={dbOk ? 'Connected' : 'Offline'}
                  icon="🗄️" color={dbOk ? 'var(--success)' : 'var(--danger)'} />
              </div>
            </div>
          </div>
        )}

        {/* ── Upcoming meetings + quick links ── */}
        <div className="row g-3">
          {/* Upcoming meetings */}
          <div className="col-12 col-lg-7">
            <div className="card h-100">
              <div className="card-header d-flex align-items-center justify-content-between">
                <span><i className="bi bi-calendar-event me-2" />Upcoming Meetings</span>
                <button className="btn btn-sm btn-outline-secondary" onClick={() => navigate('/manage/sessions')}>
                  All Sessions
                </button>
              </div>
              <div className="card-body p-0">
                {!stats.upcomingMeetings?.length ? (
                  <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <div className="empty-state-title">No meetings in the next 7 days</div>
                  </div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {stats.upcomingMeetings.map((m, i) => {
                      const d = new Date(m.datetime);
                      const isToday = d.toDateString() === new Date().toDateString();
                      return (
                        <li key={i} className="list-group-item px-3 py-2">
                          <div className="d-flex align-items-center gap-3">
                            <div style={{
                              minWidth: 44, textAlign: 'center',
                              background: isToday ? 'var(--accent)' : 'var(--surface-3)',
                              color: isToday ? '#fff' : 'var(--text-2)',
                              borderRadius: 8, padding: '4px 6px', lineHeight: 1.2
                            }}>
                              <div style={{ fontSize: 10, fontWeight: 700 }}>
                                {d.toLocaleDateString('en', { month: 'short' }).toUpperCase()}
                              </div>
                              <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{d.getDate()}</div>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className="fw-semibold truncate" style={{ fontSize: '.9rem' }}>{m.title}</div>
                              <small className="text-muted-c">{m.courseTitle}</small>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <div className="fw-semibold small">
                                {d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <small className="text-muted-c">{m.durationMin} min</small>
                            </div>
                          </div>
                          {m.meetingLink && (
                            <a href={m.meetingLink} target="_blank" rel="noopener noreferrer"
                              className="btn btn-sm btn-outline-success mt-2 w-100" style={{ fontSize: '.78rem' }}>
                              <i className="bi bi-camera-video me-1" />Join Meeting
                            </a>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Quick links + system info */}
          <div className="col-12 col-lg-5">
            <div className="card mb-3">
              <div className="card-header"><i className="bi bi-grid me-2" />Quick Access</div>
              <div className="card-body">
                <div className="d-flex flex-wrap gap-2">
                  {[
                    { label: 'My Courses', path: '/my-courses', icon: 'bi-collection-play', show: true },
                    { label: 'My Grades', path: '/my-grades', icon: 'bi-award', show: true },
                    { label: 'Redeem Key', path: '/redeem', icon: 'bi-key', show: true },
                    { label: 'Sessions', path: '/manage/sessions', icon: 'bi-people', show: isTutor },
                    { label: 'Users', path: '/manage/users', icon: 'bi-people-fill', show: isManage },
                    { label: 'Courses', path: '/manage/courses', icon: 'bi-book', show: isTutor },
                    { label: 'Keys', path: '/manage/keys', icon: 'bi-key-fill', show: isManage },
                    { label: 'Settings', path: '/manage/settings', icon: 'bi-gear', show: isManage },
                  ].filter(l => l.show).map(l => (
                    <button key={l.path} className="btn btn-sm btn-outline-secondary"
                      onClick={() => navigate(l.path)}>
                      <i className={`bi ${l.icon} me-1`} />{l.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isManage && (
              <div className="card">
                <div className="card-header"><i className="bi bi-server me-2" />System</div>
                <div className="card-body p-0">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      {[
                        ['API Server', <StatusDot ok={serverOk} />],
                        ['Database', <StatusDot ok={dbOk} />],
                        ['Uptime', serverOk ? formatUptime(status.uptime) : '—'],
                        ['Restarted', status.launchTime ? getTimeAgo(status.launchTime) : '—'],
                        ['Live feed', live === 'open' ? <span className="status-badge active">Live</span> : <span className="status-badge warning">Reconnecting</span>],
                      ].map(([k, v]) => (
                        <tr key={k}>
                          <td style={{ color: 'var(--text-muted)', width: '45%', paddingLeft: '1rem' }}><strong>{k}</strong></td>
                          <td>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

export default Main;

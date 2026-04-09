import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getUser } from '../../utils/auth';
import config from '../../config/config';
import { UtilityModal } from '../../components/UtilityModal';
import io from 'socket.io-client';

const API_URL = config.API_URL;
const RTC_URL = config.RTC_URL;
const BASE_URL = API_URL.replace('/api', '');

function authHeader() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path, opts = {}) {
  return fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { ...authHeader(), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

const STATUS_META = {
  draft:     { label: 'Draft',     color: '#6b7280', bg: 'rgba(107,114,128,.12)' },
  active:    { label: 'Active',    color: '#10b981', bg: 'rgba(16,185,129,.12)'  },
  completed: { label: 'Completed', color: '#3b82f6', bg: 'rgba(59,130,246,.12)'  },
  archived:  { label: 'Archived',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)'  },
};

export default function StudentSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useContext(SettingsContext);
  const currentUser = getUser();

  const [session,   setSession]   = useState(null);
  const [myGroup,   setMyGroup]   = useState(null);
  const [allGroups, setAllGroups] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // ── Chat state ──────────────────────────────────────────────
  const [chatTab,         setChatTab]         = useState('general');
  const [chatMessages,    setChatMessages]    = useState([]);
  const [chatInput,       setChatInput]       = useState('');
  const [chatPeers,       setChatPeers]       = useState([]);
  const [chatPrivateWith, setChatPrivateWith] = useState(null);
  const [chatModal, setChatModal]   = useState('');
  const chatBottomRef = useRef(null);
  const socketRef     = useRef(null);

  // ── Load data ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const groupsRes = await apiFetch('/groups/my');
      if (groupsRes.ok) {
        const gd = await groupsRes.json();
        const groups = gd.data || [];
        const mine = groups.find(g =>
          String(g.sessionId?._id || g.sessionId) === String(id)
        );
        setMyGroup(mine || null);
        setAllGroups(mine ? [mine] : []);
      }

      // Try to load session (may succeed if student has access via group)
      const sessRes = await apiFetch(`/groups/my`);
      if (sessRes.ok) {
        const sd = await sessRes.json();
        const grps = sd.data || [];
        const g = grps.find(g => String(g.sessionId?._id || g.sessionId) === String(id));
        if (g?.sessionId && typeof g.sessionId === 'object') {
          setSession(g.sessionId);
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Socket chat ─────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'chat') {
      if (socketRef.current) {
        socketRef.current.emit('leave', { roomId: id });
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }
    const token = localStorage.getItem('token');
    const nickname = currentUser?.name || currentUser?.email || 'Student';
    const socket = io(RTC_URL, { auth: { token } });
    socketRef.current = socket;
    socket.emit('join', { roomId: id, nickname });
    socket.on('joined', ({ peers = [], chatHistory = [] }) => {
      setChatMessages(chatHistory); setChatPeers(peers);
    });
    socket.on('peer-joined', ({ peer }) =>
      setChatPeers(prev => [...prev.filter(p => p.socketId !== peer.socketId), peer])
    );
    socket.on('peer-left', ({ socketId }) =>
      setChatPeers(prev => prev.filter(p => p.socketId !== socketId))
    );
    socket.on('chat-message', msg =>
      setChatMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
    );
    return () => {
      socket.emit('leave', { roomId: id });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeTab, id]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const sendMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    const payload = { roomId: id, text: chatInput.trim() };
    if (chatTab === 'private' && chatPrivateWith?.userId) {
      const peer = chatPeers.find(p => p.userId === chatPrivateWith.userId);
      if (!peer) { setChatModal(`${chatPrivateWith.nickname} is not online.`); return; }
      payload.to = peer.socketId;
    }
    socketRef.current.emit('chat-message', payload);
    setChatInput('');
  };

  // ── Render helpers ──────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <div className="spinner-border text-primary" />
    </div>
  );

  if (error || !myGroup) return (
    <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
      <i className="bi bi-exclamation-circle" style={{ fontSize: 48, color: 'var(--muted)' }} />
      <p className="mt-3 text-muted">{error || "You don't have access to this session."}</p>
      <button className="btn btn-outline-secondary mt-2" onClick={() => navigate('/account')}>
        ← Back to Account
      </button>
    </div>
  );

  const myUserId   = String(currentUser?._id || currentUser?.id);
  const mySocketId = socketRef.current?.id;
  const status     = session?.status || 'active';
  const statusMeta = STATUS_META[status] || STATUS_META.active;

  // All members across my group for private chat
  const allMembers = [];
  const seen = new Set();
  (myGroup.members || []).forEach(m => {
    const userObj = m.userId;
    const uid = String(userObj?._id || userObj);
    const nick = userObj?.nickname || userObj?.email || uid;
    if (uid !== myUserId && !seen.has(uid)) { seen.add(uid); allMembers.push({ userId: uid, nickname: nick }); }
  });

  // Filtered chat messages
  const recipientPeer = chatPrivateWith?.userId ? chatPeers.find(p => p.userId === chatPrivateWith.userId) : null;
  const visibleMessages = chatTab === 'general'
    ? chatMessages.filter(m => !m.to)
    : chatMessages.filter(m => {
        if (!m.to || !recipientPeer) return false;
        return (m.from === mySocketId && m.to === recipientPeer.socketId) ||
               (m.from === recipientPeer.socketId && m.to === mySocketId);
      });

  const tabs = ['overview', 'schedule', 'members', 'chat'];

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px' }}>

      {/* ── Header ── */}
      <div className="d-flex align-items-start gap-3 mb-4">
        <button className="btn btn-outline-secondary btn-sm rounded-pill" onClick={() => navigate('/account')}>
          <i className="bi bi-arrow-left" />
        </button>
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <h4 className="fw-bold mb-0">
              {myGroup.courseId?.trans?.[0]?.title || myGroup.courseId?.title || 'Session'}
            </h4>
            <span style={{
              fontSize: '0.75rem', fontWeight: 600, padding: '3px 10px',
              borderRadius: 20, color: statusMeta.color, background: statusMeta.bg,
              border: `1px solid ${statusMeta.color}33`,
            }}>
              {statusMeta.label}
            </span>
          </div>
          <div className="d-flex align-items-center gap-3 flex-wrap mt-1">
            <span className="text-muted small"><i className="bi bi-people me-1" /> Group: <strong>{myGroup.name}</strong></span>
            {session?.hostTutor && (
              <span className="text-muted small"><i className="bi bi-person-video3 me-1" />{session.hostTutor.nickname || session.hostTutor.email || 'Tutor'}</span>
            )}
            {(myGroup.courseId?._id || myGroup.courseId) && (
              <button
                className="btn btn-sm btn-outline-primary rounded-pill px-3 py-0"
                style={{ fontSize: '0.78rem' }}
                onClick={() => navigate(`/course/${myGroup.courseId?._id || myGroup.courseId}`)}
              >
                <i className="bi bi-book me-1" /> View Course
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="d-flex gap-2 mb-4 border-bottom pb-0" style={{ overflowX: 'auto' }}>
        {tabs.map(tab => (
          <button
            key={tab}
            className={`btn btn-link text-capitalize px-3 py-2 text-decoration-none border-0 ${activeTab === tab ? 'fw-bold text-primary border-bottom border-primary border-2' : 'text-muted'}`}
            style={{ borderBottom: activeTab === tab ? '2px solid var(--primary-color, #3b82f6)' : '2px solid transparent', borderRadius: 0, whiteSpace: 'nowrap' }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'chat' && <i className="bi bi-chat-dots me-1" />}
            {tab === 'schedule' && <i className="bi bi-calendar3 me-1" />}
            {tab === 'members' && <i className="bi bi-people me-1" />}
            {tab === 'overview' && <i className="bi bi-grid me-1" />}
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div className="row g-3">
          {/* Course thumbnail */}
          {myGroup.courseId?.links?.find(l => l.type === 'image') && (
            <div className="col-12">
              <img
                src={`${BASE_URL}${myGroup.courseId.links.find(l => l.type === 'image').url}`}
                alt="course"
                style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 14 }}
                onError={e => { e.target.style.display = 'none'; }}
              />
            </div>
          )}

          {/* Stats */}
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm text-center p-3">
              <div className="fw-bold fs-4">{myGroup.members?.length || 0}</div>
              <div className="text-muted small">Members</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm text-center p-3">
              <div className="fw-bold fs-4">{session?.schedule?.length || 0}</div>
              <div className="text-muted small">Classes</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm text-center p-3">
              <div className="fw-bold fs-4 text-capitalize" style={{ color: statusMeta.color }}>{status}</div>
              <div className="text-muted small">Status</div>
            </div>
          </div>
          <div className="col-6 col-md-3">
            <div className="card border-0 shadow-sm text-center p-3">
              <div className="fw-bold fs-4">
                {chatPeers.length > 0
                  ? <span style={{ color: '#10b981' }}>🟢 {chatPeers.length}</span>
                  : <span className="text-muted">—</span>}
              </div>
              <div className="text-muted small">Online</div>
            </div>
          </div>

          {/* Upcoming classes */}
          {session?.schedule?.length > 0 && (() => {
            const upcoming = session.schedule
              .filter(c => new Date(c.datetime) > new Date())
              .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
              .slice(0, 3);
            if (!upcoming.length) return null;
            return (
              <div className="col-12">
                <div className="card border-0 shadow-sm p-3">
                  <h6 className="fw-bold mb-3"><i className="bi bi-calendar-event me-2 text-primary" />Upcoming Classes</h6>
                  {upcoming.map((cls, i) => (
                    <div key={i} className="d-flex align-items-center gap-3 py-2 border-bottom last-no-border">
                      <div style={{ background: 'rgba(59,130,246,.1)', borderRadius: 10, padding: '6px 12px', textAlign: 'center', minWidth: 54 }}>
                        <div className="fw-bold text-primary" style={{ fontSize: '1rem' }}>{new Date(cls.datetime).getDate()}</div>
                        <div className="text-muted" style={{ fontSize: '0.65rem' }}>{new Date(cls.datetime).toLocaleString('en', { month: 'short' })}</div>
                      </div>
                      <div>
                        <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>{cls.title}</div>
                        <div className="text-muted small">
                          {new Date(cls.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {cls.durationMin && ` · ${cls.durationMin} min`}
                          {cls.meetingLink && (
                            <a href={cls.meetingLink} target="_blank" rel="noopener noreferrer" className="ms-2">
                              <i className="bi bi-camera-video text-primary" /> Join
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Schedule ── */}
      {activeTab === 'schedule' && (
        <div className="card border-0 shadow-sm">
          <div className="card-body p-0">
            {!session?.schedule?.length ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-calendar-x fs-1 d-block mb-2" />
                No classes scheduled yet.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover mb-0 align-middle">
                  <thead style={{ background: 'rgba(0,0,0,0.05)' }}>
                    <tr className="small text-uppercase text-muted">
                      <th className="px-4 py-3">Topic</th>
                      <th className="py-3">Date & Time</th>
                      <th className="py-3">Duration</th>
                      <th className="py-3">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...session.schedule]
                      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
                      .map((cls, i) => {
                        const isPast = new Date(cls.datetime) < new Date();
                        return (
                          <tr key={i} style={{ opacity: isPast ? 0.55 : 1 }}>
                            <td className="px-4 py-3">
                              <div className="fw-semibold">{cls.title}</div>
                              {cls.notes && <div className="text-muted small">{cls.notes}</div>}
                            </td>
                            <td className="py-3">
                              <div>{new Date(cls.datetime).toLocaleDateString()}</div>
                              <div className="text-muted small">{new Date(cls.datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                            </td>
                            <td className="py-3 text-muted">{cls.durationMin ? `${cls.durationMin} min` : '—'}</td>
                            <td className="py-3">
                              {cls.meetingLink ? (
                                <a href={cls.meetingLink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-3">
                                  <i className="bi bi-camera-video me-1" /> Join
                                </a>
                              ) : <span className="text-muted">—</span>}
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
      )}

      {/* ── Members ── */}
      {activeTab === 'members' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-0 px-4 pt-4">
            <h6 className="fw-bold mb-0">Group: {myGroup.name} · {myGroup.members?.length || 0} member{myGroup.members?.length !== 1 ? 's' : ''}</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table mb-0 align-middle">
                <thead style={{ background: 'rgba(0,0,0,0.05)' }}>
                  <tr className="small text-uppercase text-muted">
                    <th className="px-4 py-3">Member</th>
                    <th className="py-3">Online</th>
                  </tr>
                </thead>
                <tbody>
                  {(myGroup.members || []).map((m, i) => {
                    const userObj = m.userId;
                    const uid = String(userObj?._id || userObj);
                    const nick = userObj?.nickname || userObj?.email || uid;
                    const isMe = uid === myUserId;
                    const isOnline = chatPeers.some(p => p.userId === uid);
                    return (
                      <tr key={i}>
                        <td className="px-4 py-3">
                          <div className="d-flex align-items-center gap-2">
                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary-color, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.8rem', fontWeight: 700, flexShrink: 0 }}>
                              {nick.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="fw-semibold" style={{ fontSize: '0.9rem' }}>
                                {nick} {isMe && <span className="badge bg-secondary ms-1" style={{ fontSize: '0.65rem' }}>You</span>}
                              </div>
                              {userObj?.email && <div className="text-muted small">{userObj.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          {isOnline
                            ? <span style={{ color: '#10b981', fontSize: '0.8rem' }}>🟢 Online</span>
                            : <span className="text-muted" style={{ fontSize: '0.8rem' }}>⚫ Offline</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Chat ── */}
      {activeTab === 'chat' && (
        <div className="card border-0 shadow-sm" style={{ height: 520, display: 'flex', flexDirection: 'column' }}>
          {/* Sub-tabs */}
          <div className="card-header border-0 pt-3 pb-0 px-4" style={{ background: 'transparent' }}>
            <div className="d-flex gap-2 align-items-center flex-wrap">
              <div className="nav nav-pills gap-1">
                {['general', 'private'].map(sub => (
                  <button
                    key={sub}
                    className={`nav-link px-3 py-1 ${chatTab === sub ? 'active' : ''}`}
                    style={{ fontSize: '0.85rem', borderRadius: 20 }}
                    onClick={() => { setChatTab(sub); if (sub === 'general') setChatPrivateWith(null); }}
                  >
                    <i className={`bi ${sub === 'general' ? 'bi-chat-dots' : 'bi-lock'} me-1`} />
                    {sub === 'general' ? 'General' : 'Private'}
                  </button>
                ))}
              </div>
              {chatTab === 'private' && (
                <select
                  className="form-select form-select-sm"
                  style={{ maxWidth: 240, borderRadius: 12 }}
                  value={chatPrivateWith?.userId || ''}
                  onChange={e => {
                    if (!e.target.value) { setChatPrivateWith(null); return; }
                    const opt = e.target.options[e.target.selectedIndex];
                    setChatPrivateWith({ userId: e.target.value, nickname: opt.dataset.nickname || opt.text.replace(/ [🟢⚫].*/,'') });
                  }}
                >
                  <option value="">— Select recipient —</option>
                  {allMembers.map(m => {
                    const online = chatPeers.some(p => p.userId === m.userId);
                    return <option key={m.userId} value={m.userId} data-nickname={m.nickname}>{m.nickname} {online ? '🟢' : '⚫'}</option>;
                  })}
                </select>
              )}
              {chatPeers.length > 0 && (
                <span className="ms-auto text-muted small"><i className="bi bi-circle-fill me-1" style={{ color: '#10b981', fontSize: '0.5rem' }} />{chatPeers.length} online</span>
              )}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleMessages.length === 0 ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--muted)' }}>
                <i className="bi bi-chat-square-dots" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
                <span style={{ fontSize: '0.85rem' }}>
                  {chatTab === 'private' && !chatPrivateWith ? 'Select a recipient above' : 'No messages yet.'}
                </span>
              </div>
            ) : visibleMessages.map((msg, i) => {
              const isMe = msg.from === mySocketId;
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                  {!isMe && <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 2, paddingLeft: 4 }}>{msg.fromNickname || 'User'}</span>}
                  <div style={{ maxWidth: '70%', padding: '8px 14px', borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: isMe ? 'var(--primary-color, #3b82f6)' : 'var(--input-bg, rgba(255,255,255,0.07))', color: isMe ? '#fff' : 'var(--text)', fontSize: '0.88rem', lineHeight: 1.45, wordBreak: 'break-word' }}>
                    {msg.text}
                  </div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--muted)', marginTop: 2 }}>{new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              );
            })}
            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div className="card-footer border-0 px-4 pb-4 pt-2" style={{ background: 'transparent' }}>
            {chatTab === 'private' && !chatPrivateWith ? (
              <div className="text-center text-muted small py-2"><i className="bi bi-person-check me-1" />Select a recipient above</div>
            ) : (
              <div className="d-flex gap-2">
                <input
                  className="form-control"
                  style={{ borderRadius: 22, padding: '8px 16px' }}
                  placeholder={chatTab === 'private' ? `Message ${chatPrivateWith?.nickname || ''}…` : 'Message everyone…'}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                />
                <button className="btn btn-primary" style={{ borderRadius: 22, padding: '8px 18px' }} onClick={sendMessage} disabled={!chatInput.trim()}>
                  <i className="bi bi-send-fill" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <UtilityModal
        show={!!chatModal}
        type="info"
        title="User offline"
        message={chatModal}
        onClose={() => setChatModal('')}
      />
    </div>
  );
}
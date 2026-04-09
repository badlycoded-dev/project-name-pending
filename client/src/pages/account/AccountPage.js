import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, setUser, clearUser } from '../../utils/auth';
import { SettingsContext } from '../../contexts/SettingsContext';
import config from '../../config/config';
import { UtilityModal } from '../../components/UtilityModal';

const API_URL = config.API_URL;
const BASE_URL = API_URL.replace('/api', '');

function AccountPage() {
  const navigate = useNavigate();
  const { t } = useContext(SettingsContext);

  // --- реактивный стейт пользователя (не замороженное чтение) ---
  const [user, setUserState]      = useState(() => { try { return getUser(); } catch { return null; } });
  const [createdCourses, setCreatedCourses] = useState([]);
  const [stats, setStats]         = useState({ courseCount: 0, linkCount: 0 });
  const [syncStatus, setSyncStatus] = useState('idle'); // 'idle' | 'syncing' | 'updated' | 'error'
  const [mySessions, setMySessions] = useState([]); // sessions student belongs to
  const [modal, setModal] = useState({ show: false, title: '', message: '' });

  // --- использование useRef для предотвращения повторных запросов ---
  const syncInitDone = useRef(false);
  const coursesInitDone = useRef(false);

  const hasTeacherRights = user && ['tutor', 'create', 'manage', 'quality', 'admin', 'root'].includes(user.role);

  // ─── Синхронизация роли и данных с сервером ───────────────────────────────
  const syncUserFromServer = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setSyncStatus('syncing');
    try {
      const res = await fetch(`${API_URL}/users/c`, {
        headers: { 'Authorization': token.startsWith('Bearer ') ? token : `Bearer ${token}` },
      });
      if (!res.ok) { setSyncStatus('error'); return; }

      const data = await res.json();
      const serverUser = data.user || data;

      // Определяем роль с сервера
      const serverRole = serverUser.role?.accessLevel || serverUser.role || 'default';

      const currentStored = getUser();
      const storedRole    = currentStored?.role || 'default';

      const roleChanged = serverRole !== storedRole;

      // Загружаем детали курсов из user.courses (список {_id, process} с сервера)
      const serverCourseIds = (serverUser.courses || []).map(c => c._id).filter(Boolean);
      let enrolledCourses = currentStored?.enrolled || [];

      if (serverCourseIds.length > 0) {
        try {
          const authHdr = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
          const courseResponses = await Promise.allSettled(
            serverCourseIds.map(cid =>
              fetch(`${API_URL}/courses/${cid}`, { headers: { 'Authorization': authHdr } })
                .then(r => r.ok ? r.json() : null)
                .catch(() => null)
            )
          );
          enrolledCourses = courseResponses
            .map(r => r.status === 'fulfilled' ? r.value : null)
            .filter(Boolean)
            .map(d => {
              const c = d.data || d;
              const BASE = API_URL.replace('/api', '');
              const thumb = c.links?.find(l => l.type === 'image');
              return {
                id:    c._id,
                _id:   c._id,
                title: c.trans?.[0]?.title || c.title || '',
                img:   thumb ? `${BASE}${thumb.url}` : null,
                direction: c.direction,
                level: c.level,
              };
            });
        } catch (_) {
          enrolledCourses = currentStored?.enrolled || [];
        }
      }

      const updatedUser = {
        ...currentStored,
        id:    serverUser._id || serverUser.id || currentStored?.id,
        _id:   serverUser._id || serverUser.id || currentStored?._id,
        email: serverUser.email || currentStored?.email,
        name:  serverUser.nickname || currentStored?.name,
        role:  serverRole,
        enrolled: enrolledCourses,
      };

      setUser(updatedUser, token);
      setUserState(updatedUser);

      if (roleChanged) {
        setSyncStatus('updated');
        // Сбрасываем уведомление через 4 секунды
        setTimeout(() => setSyncStatus('idle'), 4000);
      } else {
        setSyncStatus('idle');
      }
    } catch (err) {
      console.warn('Role sync failed:', err);
      setSyncStatus('error');
    }
  }, []);

  // Синхронизируем только один раз при открытии страницы
  useEffect(() => {
    if (syncInitDone.current) return;
    syncInitDone.current = true;
    syncUserFromServer();
  }, []);

  // ─── Загрузка курсов преподавателя ────────────────────────────────────────
  useEffect(() => {
    if (coursesInitDone.current) return;
    if (!user) return;
    if (!['tutor', 'create', 'manage', 'quality', 'admin', 'root'].includes(user.role)) return;

    coursesInitDone.current = true;

    const token = localStorage.getItem('token');
    fetch(`${API_URL}/manage/courses`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (!data) return;
        const allCourses = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
        const myCourses = allCourses.filter(c => {
          const courseOwnerId  = String(c.userId?._id || c.userId || '');
          const currentUserId  = String(user.id || user._id || '');
          const courseOwnerNick = String(c.userId?.nickname || '').toLowerCase();
          const userName        = String(user.name || '').toLowerCase();
          return (courseOwnerId && courseOwnerId === currentUserId) ||
                 (courseOwnerNick && courseOwnerNick === userName);
        });
        setCreatedCourses(myCourses);
        setStats({
          courseCount: myCourses.length,
          linkCount:   myCourses.reduce((s, c) => s + (c.links?.length || 0), 0),
        });
      })
      .catch(err => console.error('Error fetching courses:', err));
  }, [user?.id]); // Зависимость только от user.id, не от объекта

  // ─── Загрузка сессий студента ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    fetch(`${API_URL}/groups/my`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(async data => {
        if (!data) return;
        const groups = data.data || [];
        // Dedupe by sessionId → one entry per session
        const sessionMap = new Map();
        groups.forEach(g => {
          const sid = String(g.sessionId?._id || g.sessionId);
          if (!sessionMap.has(sid)) {
            sessionMap.set(sid, { sessionId: sid, groupName: g.name, courseId: g.courseId });
          }
        });
        const sessions = [...sessionMap.values()];

        // Try to resolve course titles
        const withTitles = await Promise.all(sessions.map(async s => {
          if (!s.courseId) return s;
          try {
            const cRes = await fetch(`${API_URL}/courses/${s.courseId}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (cRes.ok) {
              const cData = await cRes.json();
              const c = cData.data || cData;
              const BASE = API_URL.replace('/api', '');
              const thumb = (c.links || []).find(l => l.type === 'image');
              return {
                ...s,
                courseTitle: c.trans?.[0]?.title || c.title || 'Session',
                courseImg: thumb ? `${BASE}${thumb.url}` : null,
              };
            }
          } catch (_) {}
          return s;
        }));

        setMySessions(withTitles);
      })
      .catch(() => {});
  }, [user?.id]);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const handleDeleteCourse = async () => {
    if (!deleteTarget) return;
    const cId = deleteTarget._id || deleteTarget.id;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/manage/courses/${cId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setCreatedCourses(prev => prev.filter(item => (item._id || item.id) !== cId));
      } else {
        const err = await res.json();
        setModal({ show: true, title: 'Error', message: `${t('accountPage.deleteFailed')} ${err.message || ''}` });
      }
    } catch {
      setModal({ show: true, title: 'Error', message: t('accountPage.serverErrorDelete') });
    }
    setDeleteTarget(null);
  };

  if (!user) {
    setTimeout(() => navigate('/login'), 0);
    return null;
  }

  const enrollments = user.enrolled || [];

  const handleLogout = () => {
    clearUser();
    navigate('/');
  };

  return (
    <div className="container py-5" style={{ maxWidth: '1100px' }}>

      {/* ── Уведомление об обновлении роли ── */}
      {syncStatus === 'updated' && (
        <div
          className="alert alert-success d-flex align-items-center gap-3 mb-4 shadow-sm"
          style={{ borderRadius: 12, border: 'none' }}
        >
          <i className="bi bi-arrow-repeat fs-4 text-success"></i>
          <div>
            <strong>Your role has been updated!</strong>
            <span className="ms-2 text-muted small">
              New role: <span className="badge bg-success">{user.role}</span>
            </span>
          </div>
        </div>
      )}

      {syncStatus === 'syncing' && (
        <div className="d-flex align-items-center gap-2 text-muted small mb-3">
          <span className="spinner-border spinner-border-sm" role="status"/>
          Syncing account data...
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-5">
        <div>
          <h2 className="fw-bold mb-1">{t('accountPage.title')}</h2>
          <p className="text-muted mb-0">{t('accountPage.welcome')}, {user.name}!</p>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary rounded-pill px-3 shadow-sm"
            onClick={syncUserFromServer}
            disabled={syncStatus === 'syncing'}
            title="Sync role & data from server"
          >
            <i className={`bi bi-arrow-clockwise ${syncStatus === 'syncing' ? 'spin' : ''}`}></i>
          </button>
          <button className="btn btn-outline-secondary rounded-pill px-4 shadow-sm" onClick={() => navigate('/settings')}>
            <i className="bi bi-gear me-2"></i> {t('settings')}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin { animation: spin .8s linear infinite; display: inline-block; }
      `}</style>

      <div className="row g-4">
        {/* ── Левая колонка: профиль ── */}
        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm mb-4 overflow-hidden">
            <div className="card-body p-4 text-center bg-primary bg-opacity-10">
              <div className="bg-white rounded-circle shadow-sm mx-auto d-flex align-items-center justify-content-center mb-3"
                style={{ width: '80px', height: '80px' }}>
                <i className="bi bi-person-circle fs-1 text-primary"></i>
              </div>
              <h5 className="fw-bold mb-1">{user.name}</h5>
              <p className="text-muted small mb-0">{user.email}</p>
              <div className="mt-2">
                <span className={`badge rounded-pill px-3 py-2 ${hasTeacherRights ? 'bg-success' : 'bg-primary'}`}>
                  {user.role === 'default'
                    ? t('accountPage.student')
                    : (t(`accountPage.${user.role}`) || user.role.toUpperCase())}
                </span>
              </div>
            </div>

            <div className="card-footer bg-transparent border-0 p-3 d-flex justify-content-around">
              <div className="text-center">
                <div className="fw-bold fs-5">{enrollments.length}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{t('accountPage.enrolled')}</div>
              </div>
              {hasTeacherRights && (
                <div className="text-center">
                  <div className="fw-bold fs-5">{stats.courseCount}</div>
                  <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{t('accountPage.created')}</div>
                </div>
              )}
            </div>
          </div>

          <div className="card border-0 shadow-sm">
            <div className="card-body p-3">
              <div className="d-grid gap-2">
                {!hasTeacherRights && (
                  <button
                    className="btn btn-light text-start p-3 rounded-3 d-flex align-items-center"
                    onClick={() => navigate('/apply-teacher')}
                  >
                    <i className="bi bi-person-video3 me-3 fs-5 text-primary"></i>
                    <div><div className="fw-bold">{t('teacher.applyButton')}</div></div>
                  </button>
                )}
                {!hasTeacherRights && <hr className="my-2 opacity-50"/>}
                <button
                  className="btn btn-danger border-0 text-start p-3 rounded-3 d-flex align-items-center shadow-sm"
                  onClick={handleLogout}
                >
                  <i className="bi bi-box-arrow-right me-3 fs-5 text-white"></i>
                  <span className="fw-bold text-white">{t('logout')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Правая колонка: курсы ── */}
        <div className="col-12 col-lg-8">

          {/* Созданные курсы (только для преподавателей) */}
          {hasTeacherRights && (
            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-transparent border-0 pt-4 px-4">
                <h5 className="fw-bold mb-0 text-success">
                  <i className="bi bi-easel2 me-2"></i> {t('accountPage.createdCourses')}
                </h5>
              </div>
              <div className="card-body p-4">
                {createdCourses.length === 0 ? (
                  <div className="text-center py-4 text-muted border rounded bg-light">
                    <p className="mb-2">{t('accountPage.noCreatedCourses')}</p>
                    <button className="btn btn-sm btn-success" onClick={() => navigate('/add-course')}>
                      {t('accountPage.createFirstCourse')}
                    </button>
                  </div>
                ) : (
                  <div className="d-grid gap-3">
                    {createdCourses.map(c => {
                      let imgSrc = 'https://placehold.co/60x45?text=No+Img';
                      if (c.links?.length > 0 && c.links[0].url) {
                        let cleanUrl = c.links[0].url.replace(/\\/g, '/').replace('/api/manage/courses', '/api/courses');
                        imgSrc = cleanUrl.startsWith('http') ? cleanUrl : `${BASE_URL}${cleanUrl}`;
                      } else if (c.img) {
                        imgSrc = c.img;
                      }

                      return (
                        <div
                          className="card border-0 bg-light p-3"
                          key={c._id || c.id}
                          onClick={() => navigate(`/course/${c._id || c.id}`)}
                          style={{ cursor: 'pointer', transition: 'transform 0.2s' }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                        >
                          <div className="d-flex align-items-center">
                            <img
                              src={imgSrc}
                              alt={c.title || c.trans?.[0]?.title || 'Course'}
                              className="rounded-3 shadow-sm me-3"
                              style={{ width: '60px', height: '45px', objectFit: 'cover' }}
                              onError={e => { e.target.src = 'https://placehold.com/60x45?text=No+Img'; }}
                            />
                            <div className="flex-grow-1">
                              <h6 className="fw-bold mb-0 text-truncate">{c.title || c.trans?.[0]?.title || 'Untitled Course'}</h6>
                              <div className="small text-muted">
                                <span className="badge bg-secondary me-2">
                                  {c.status === 'editing' ? t('accountPage.draft') : c.status}
                                </span>
                                <span>${c.price}</span>
                              </div>
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-primary shadow-sm fw-bold"
                                onClick={e => { e.stopPropagation(); navigate(`/manage/session/${c._id || c.id}`); }}
                              >
                                <i className="bi bi-kanban me-1"></i> {t('accountPage.manage')}
                              </button>
                              <button
                                className="btn btn-sm btn-outline-secondary"
                                onClick={e => { e.stopPropagation(); navigate(`/instructor/edit-course/${c._id || c.id}`); }}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={e => { e.stopPropagation(); setDeleteTarget(c); }}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* My Learning */}
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0 pt-4 px-4 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-3">
                <h5 className="fw-bold mb-0">{t('accountPage.myLearning')}</h5>
                <button
                  className="btn btn-sm btn-outline-primary fw-bold px-3 rounded-pill"
                  onClick={() => navigate('/redeem')}
                >
                  <i className="bi bi-key-fill me-1"></i> {t('accountPage.redeem')}
                </button>
              </div>
              <button
                className="btn btn-link text-decoration-none small"
                onClick={() => navigate('/search')}
              >
                {t('accountPage.browseMore')}
              </button>
            </div>

            <div className="card-body p-4">
              {enrollments.length === 0 ? (
                <div className="text-center py-5">
                  <i className="bi bi-journal-x fs-1 text-muted mb-3 d-block"></i>
                  <h6 className="fw-bold">{t('accountPage.noEnrolledCourses')}</h6>
                  <p className="text-muted small mb-4">{t('accountPage.startLearning')}</p>
                  <button className="btn btn-primary rounded-pill px-4" onClick={() => navigate('/search')}>
                    {t('accountPage.exploreCourses')}
                  </button>
                </div>
              ) : (
                <div className="d-grid gap-3">
                  {enrollments.map(c => (
                    <div
                      className="card border-0 bg-light p-2"
                      key={c.id || c._id}
                      style={{ transition: '0.2s', cursor: 'pointer' }}
                      onClick={() => navigate(`/course/${c.id || c._id}`)}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.01)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div className="d-flex align-items-center">
                        <img
                          src={c.img || 'https://placehold.co/80x60?text=Course'}
                          alt={c.title}
                          className="rounded-3 shadow-sm me-3"
                          style={{ width: '80px', height: '60px', objectFit: 'cover' }}
                          onError={e => { e.target.src = 'https://placehold.co/80x60?text=Course'; }}
                        />
                        <div className="flex-grow-1">
                          <h6 className="fw-bold mb-1 text-truncate">{c.title || c.trans?.[0]?.title || 'Untitled Course'}</h6>
                          <div className="text-muted small">
                            <i className="bi bi-person me-1"></i> {c.author || c.userId?.nickname || 'Unknown'}
                          </div>
                        </div>
                        <div className="ms-3 pe-2">
                          <i className="bi bi-play-circle-fill text-primary fs-3"></i>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* My Sessions */}
          {mySessions.length > 0 && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent border-0 pt-4 px-4 d-flex align-items-center gap-2">
                <i className="bi bi-people-fill text-primary" />
                <h5 className="fw-bold mb-0">{t('accountPage.mySessions')}</h5>
              </div>
              <div className="card-body p-4 d-grid gap-3">
                {mySessions.map(s => (
                  <div
                    key={s.sessionId}
                    className="card border-0 p-0 overflow-hidden"
                    style={{ background: 'var(--card-bg, rgba(255,255,255,0.04))', borderRadius: 14, cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                    onClick={() => navigate(`/session/${s.sessionId}`)}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.01)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div className="d-flex align-items-center p-3 gap-3">
                      {/* Thumbnail */}
                      <img
                        src={s.courseImg || 'https://placehold.co/72x54?text=📚'}
                        alt={s.courseTitle}
                        style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
                        onError={e => { e.target.src = 'https://placehold.co/72x54?text=📚'; }}
                      />
                      {/* Info */}
                      <div className="flex-grow-1 min-width-0">
                        <div className="fw-semibold text-truncate" style={{ fontSize: '0.95rem' }}>
                          {s.courseTitle || 'Course Session'}
                        </div>
                        <div className="text-muted small mt-1">
                          <i className="bi bi-people me-1" /> {s.groupName}
                        </div>
                      </div>
                      {/* Arrow */}
                      <i className="bi bi-chat-dots-fill text-primary fs-5 flex-shrink-0" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      <UtilityModal
        show={!!deleteTarget}
        type="confirm"
        danger
        title={t('accountPage.deleteConfirm') || 'Delete course?'}
        message={deleteTarget ? `"${deleteTarget.title || deleteTarget.trans?.[0]?.title}" will be permanently deleted.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteCourse}
        onCancel={() => setDeleteTarget(null)}
      />
      <UtilityModal
        show={modal.show}
        type="info"
        title={modal.title}
        message={modal.message}
        onClose={() => setModal({ show: false, title: '', message: '' })}
      />
    </div>
  );
}

export default AccountPage;
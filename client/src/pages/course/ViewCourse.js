import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getUser } from '../../utils/auth';
import config from '../../config/config';
import './ViewCourse.css';

const API_URL = config.API_URL;
const BASE_URL = API_URL.replace('/api', '');

function ViewCourse() {
  const { t } = useContext(SettingsContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getUser();
  const token = localStorage.getItem('token');
  const authHeader = token ? `Bearer ${token}` : '';

  // ── State ──
  const [course, setCourse] = useState(null);
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  // Sidebar state
  const [openVolumes, setOpenVolumes] = useState({});
  const [openChapters, setOpenChapters] = useState({});
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const isAdmin = currentUser && ['admin', 'root', 'manage', 'quality', 'create', 'tutor', 'teacher'].includes(currentUser.role);

  // ── Bootstrap ──
  useEffect(() => {
    fetchCourse();
    checkAccess();
  }, [id]);

  const checkAccess = async () => {
    if (!currentUser) {
      setHasAccess(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/c`, {
        headers: { 'Authorization': authHeader },
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data;
        const courseIds = userData.enrolled || [];
        const courseId = id;
        const hasAccess = courseIds.some(cid => {
          const cIdStr = String(cid._id || cid.id || cid);
          return cIdStr === courseId;
        });
        setHasAccess(hasAccess);
      } else {
        setHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setHasAccess(false);
    }
  };

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/courses/${id}`, {
        headers: { 'Authorization': authHeader },
      });

      if (response.ok) {
        const data = await response.json();
        const courseData = data.data || data;
        if (courseData) {
          setCourse(courseData);
          setVolumes(courseData.volumes || []);
          // Auto-select first item
          if (courseData.volumes && courseData.volumes.length > 0) {
            const firstVol = courseData.volumes[0];
            if (firstVol.chapters && firstVol.chapters.length > 0) {
              const firstChap = firstVol.chapters[0];
              if (firstChap.items && firstChap.items.length > 0) {
                setSelected({ vi: 0, ci: 0, ii: 0 });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching course:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleVolume = (vid) => setOpenVolumes(p => ({ ...p, [vid]: !p[vid] }));
  const toggleChapter = (cid) => setOpenChapters(p => ({ ...p, [cid]: !p[cid] }));

  const selectItem = useCallback((vi, ci, ii) => {
    setSelected({ vi, ci, ii });
    setOpenVolumes(p => ({ ...p, [volumes[vi]?.vid]: true }));
    if (ci !== null && volumes[vi]?.chapters[ci]) {
      setOpenChapters(p => ({ ...p, [volumes[vi].chapters[ci].cid]: true }));
    }
  }, [volumes]);

  // Helper: check if element is a container
  const isContainer = (e) => !e?.type || e.type === 'container' || e.type === 'none';

  // Navigation
  const flatItems = [];
  volumes.forEach((vol, vi) => {
    if (isContainer(vol)) {
      if (vol.chapters) {
        vol.chapters.forEach((ch, ci) => {
          if (isContainer(ch)) {
            if (ch.items) {
              ch.items.forEach((item, ii) => {
                flatItems.push({ vi, ci, ii });
              });
            }
          } else {
            flatItems.push({ vi, ci, ii: null });
          }
        });
      }
    } else {
      flatItems.push({ vi, ci: null, ii: null });
    }
  });

  const currentFlatIdx = selected != null
    ? flatItems.findIndex(f => f.vi === selected.vi && f.ci === selected.ci && f.ii === selected.ii)
    : -1;

  const goTo = (idx) => {
    if (idx < 0 || idx >= flatItems.length) return;
    const { vi, ci, ii } = flatItems[idx];
    selectItem(vi, ci, ii);
  };

  // ── Render ──
  if (loading) {
    return (
      <div className="vc-wrapper">
        <div className="vc-loading">
          <div className="spinner-border text-primary"></div>
          <p>{t('coursePage.loadingContent')}</p>
        </div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="vc-wrapper">
        <div className="vc-error">
          <i className="bi bi-exclamation-circle"></i>
          <p>{t('coursePage.notFound')}</p>
          <button className="btn btn-outline-secondary" onClick={() => navigate('/account')}>
            ← {t('coursePage.backToAccount')}
          </button>
        </div>
      </div>
    );
  }

  if (!hasAccess && !isAdmin) {
    return (
      <div className="vc-wrapper">
        <div className="vc-error">
          <i className="bi bi-lock-fill"></i>
          <p>You don't have access to this course yet.</p>
          <button className="btn btn-outline-secondary" onClick={() => navigate(`/course/${id}`)}>
            {t('coursePage.back')}
          </button>
        </div>
      </div>
    );
  }

  const selectedItem = selected != null
    ? volumes[selected.vi]?.chapters?.[selected.ci]?.items?.[selected.ii] || 
      volumes[selected.vi]?.chapters?.[selected.ci] ||
      volumes[selected.vi]
    : null;

  return (
    <div className={`vc-wrapper${sidebarOpen ? '' : ' vc-wrapper--collapsed'}`}>
      {/* Sidebar */}
      <aside className="vc-sidebar">
        <div className="vc-sidebar-header">
          <span className="vc-sidebar-title" title={course.trans?.[0]?.title || course.title}>
            {course.trans?.[0]?.title || course.title}
          </span>
          <button 
            className="vc-sidebar-toggle" 
            onClick={() => setSidebarOpen(o => !o)}
            title="Toggle sidebar"
          >
            <i className={`bi bi-layout-sidebar${sidebarOpen ? '' : '-reverse'}`}></i>
          </button>
        </div>

        <nav className="vc-nav">
          {volumes.length === 0 && (
            <p className="vc-nav-empty">No content available.</p>
          )}

          {volumes.map((vol, vi) => (
            <div key={vol.vid} className="vc-nav-volume">
              <button
                className="vc-nav-volume-btn"
                onClick={() => toggleVolume(vol.vid)}
                aria-expanded={!!openVolumes[vol.vid]}
              >
                <i className={`bi bi-chevron-${openVolumes[vol.vid] ? 'down' : 'right'}`}></i>
                <i className="bi bi-folder"></i>
                <span className="vc-nav-label">{vol.title}</span>
                {!openVolumes[vol.vid] && <span className="vc-nav-count">{vol.chapters?.length || 0}</span>}
              </button>

              {openVolumes[vol.vid] && (
                <div className="vc-nav-chapters">
                  {vol.chapters?.map((ch, ci) => (
                    <div key={ch.cid} className="vc-nav-chapter">
                      <button
                        className="vc-nav-chapter-btn"
                        onClick={() => toggleChapter(ch.cid)}
                        aria-expanded={!!openChapters[ch.cid]}
                      >
                        <i className={`bi bi-chevron-${openChapters[ch.cid] ? 'down' : 'right'}`}></i>
                        <span className="vc-nav-label">{ch.title}</span>
                        {!openChapters[ch.cid] && <span className="vc-nav-count">{ch.items?.length || 0}</span>}
                      </button>

                      {openChapters[ch.cid] && (
                        <div className="vc-nav-items">
                          {ch.items?.map((item, ii) => {
                            const isSel = selected?.vi === vi && selected?.ci === ci && selected?.ii === ii;
                            return (
                              <button
                                key={item.iid}
                                className={`vc-nav-item-btn${isSel ? ' vc-nav-item-btn--active' : ''}`}
                                onClick={() => selectItem(vi, ci, ii)}
                                title={item.title}
                              >
                                <i className={`bi bi-file-text`}></i>
                                <span className="vc-nav-label">{item.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="vc-main">
        {!sidebarOpen && (
          <button className="vc-sidebar-reopen" onClick={() => setSidebarOpen(true)} title="Open sidebar">
            <i className="bi bi-layout-sidebar"></i>
          </button>
        )}

        {selected == null ? (
          <div className="vc-welcome">
            <div className="vc-welcome-inner">
              {course.links?.[0] && (
                <div className="vc-thumb">
                  <img
                    src={`${BASE_URL}${course.links[0].url}`}
                    alt={course.trans?.[0]?.title || course.title}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <h1 className="vc-title">{course.trans?.[0]?.title || course.title}</h1>
              {course.trans?.[0]?.description && (
                <p className="vc-description">{course.trans?.[0]?.description}</p>
              )}
              <div className="vc-badges">
                <span className="badge bg-primary">{course.direction}</span>
                <span className="badge bg-secondary">{course.level}</span>
              </div>
              {flatItems.length > 0 && (
                <button 
                  className="btn btn-primary btn-lg mt-4"
                  onClick={() => goTo(0)}
                >
                  {t('coursePage.start')} <i className="bi bi-arrow-right ms-2"></i>
                </button>
              )}
            </div>
          </div>
        ) : (
          <ContentPanel
            key={`${selected.vi}-${selected.ci}-${selected.ii}`}
            selected={selected}
            volumes={volumes}
            courseId={id}
            hasPrev={currentFlatIdx > 0}
            hasNext={currentFlatIdx < flatItems.length - 1}
            onPrev={() => goTo(currentFlatIdx - 1)}
            onNext={() => goTo(currentFlatIdx + 1)}
            token={token}
          />
        )}
      </main>
    </div>
  );
}

// ── Content Panel ──
function ContentPanel({ selected, volumes, courseId, hasPrev, hasNext, onPrev, onNext, token }) {
  const navigate = useNavigate();
  const { vi, ci, ii } = selected;
  const vol = volumes[vi];
  const ch = ci != null ? vol?.chapters[ci] : null;
  const item = ii != null ? ch?.items[ii] : (ci != null ? ch : vol);

  if (!item) {
    return (
      <div className="vc-content-error">
        <p>Item not found.</p>
      </div>
    );
  }

  const breadcrumb = [
    vol?.title,
    ch?.title,
    ii != null ? item.title : null,
  ].filter(Boolean);

  return (
    <div className="vc-content-pane">
      {/* Breadcrumb */}
      <nav className="vc-breadcrumb">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="vc-breadcrumb-item">
            {i > 0 && <i className="bi bi-chevron-right"></i>}
            <span>{crumb}</span>
          </span>
        ))}
      </nav>

      {/* Title */}
      <h1 className="vc-content-title">{item.title}</h1>

      {/* Content Body */}
      <div className="vc-content-body">
        <ItemRenderer item={item} token={token} />
      </div>

      {/* Navigation */}
      <div className="vc-pane-nav">
        <button className="btn btn-outline-secondary" onClick={onPrev} disabled={!hasPrev}>
          <i className="bi bi-arrow-left"></i> {hasPrev ? 'Previous' : ''}
        </button>
        {hasNext ? (
          <button className="btn btn-outline-secondary" onClick={onNext}>
            Next <i className="bi bi-arrow-right"></i>
          </button>
        ) : (
          <button
            className="btn btn-success"
            style={{ padding: '8px 28px', fontWeight: 600, fontSize: '0.97rem' }}
            onClick={() => navigate(`/course/${courseId}`)}
          >
            <i className="bi bi-check-circle-fill me-2"></i> Finish Course
          </button>
        )}
      </div>
    </div>
  );
}

// ── Item Renderer ──
function ItemRenderer({ item, token }) {
  const { type, url, title } = item;

  if (type === 'video') {
    return (
      <div className="vc-video-wrap">
        <video src={url} controls className="vc-video-player" />
      </div>
    );
  }

  if (type === 'image') {
    return (
      <div className="vc-image-wrap">
        <img src={url} alt={title} className="vc-content-image" />
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className="vc-audio-wrap">
        <div className="vc-audio-card">
          <i className="bi bi-music-note-beamed"></i>
          <p>{title}</p>
          <audio src={url} controls className="vc-audio-player" />
        </div>
      </div>
    );
  }

  if (type === 'document') {
    return (
      <div className="vc-document-wrap">
        <div className="vc-doc-card">
          <i className="bi bi-file-pdf"></i>
          <p>{title || url.split('/').pop()}</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            <i className="bi bi-box-arrow-up-right"></i> Open Document
          </a>
        </div>
      </div>
    );
  }

  if (type === 'archive') {
    return (
      <div className="vc-document-wrap">
        <div className="vc-doc-card">
          <i className="bi bi-file-zip"></i>
          <p>{title || url.split('/').pop()}</p>
          <a href={url} download className="btn btn-primary">
            <i className="bi bi-download"></i> Download Archive
          </a>
        </div>
      </div>
    );
  }

  if (type === 'text') {
    return <TextViewer url={url} token={token} />;
  }

  return (
    <div className="vc-unknown">
      <i className="bi bi-file-earmark"></i>
      <p>Unsupported content type: <code>{type}</code></p>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-outline-secondary">Open file</a>}
    </div>
  );
}

// ── Text Viewer ──
function TextViewer({ url, token }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      try {
        const response = await fetch(`${BASE_URL}${url}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (response.ok) {
          setContent(await response.text());
        }
      } catch (err) {
        console.error('Error fetching text content:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [url, token]);

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>;
  if (!content) return <p style={{ color: 'var(--muted)' }}>No content available.</p>;

  return <div className="vc-text-body">{content}</div>;
}

export default ViewCourse;
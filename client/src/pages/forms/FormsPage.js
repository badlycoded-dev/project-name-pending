import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getUser } from '../../utils/auth';
import config from '../../config/config';
import { UtilityModal } from '../../components/UtilityModal';

const API_URL = config.API_URL;

/* ── вспомогательные константы ────────────────────────────── */
const STATUSES = ['pending', 'under-review', 'approved', 'rejected'];
const FORM_TYPES = ['tutor', 'creator', 'support-ticket'];

const STATUS_META = {
  'pending':      { label: 'Pending',      color: '#f59e0b', bg: 'rgba(245,158,11,.12)',  icon: 'bi-clock'           },
  'under-review': { label: 'Under Review', color: '#3b82f6', bg: 'rgba(59,130,246,.12)',  icon: 'bi-eye'             },
  'approved':     { label: 'Approved',     color: '#10b981', bg: 'rgba(16,185,129,.12)',  icon: 'bi-check-circle'    },
  'rejected':     { label: 'Rejected',     color: '#ef4444', bg: 'rgba(239,68,68,.12)',   icon: 'bi-x-circle'        },
};

const TYPE_META = {
  'tutor':          { label: 'Tutor',          icon: 'bi-person-video3', color: '#8b5cf6' },
  'creator':        { label: 'Creator',         icon: 'bi-easel2',        color: '#f59e0b' },
  'support-ticket': { label: 'Support Ticket',  icon: 'bi-headset',       color: '#3b82f6' },
};

function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, color: '#6b7280', bg: 'rgba(107,114,128,.1)', icon: 'bi-question' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: m.color, background: m.bg, border: `1px solid ${m.color}33`,
    }}>
      <i className={`bi ${m.icon}`}/> {m.label}
    </span>
  );
}

function TypeBadge({ type }) {
  const m = TYPE_META[type] || { label: type, icon: 'bi-file-text', color: '#6b7280' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600,
      color: m.color, background: `${m.color}18`, border: `1px solid ${m.color}33`,
    }}>
      <i className={`bi ${m.icon}`}/> {m.label}
    </span>
  );
}

/* ── Хелпер: иконка файла по имени ──────────────────────────── */
function fileIcon(name = '') {
  const s = name.toLowerCase();
  if (['.jpg','.jpeg','.png','.gif','.webp'].some(e => s.endsWith(e))) return 'bi-file-earmark-image text-primary';
  if (['.mp4','.webm','.mov','.avi'].some(e => s.endsWith(e))) return 'bi-file-earmark-play text-info';
  if (['.pdf'].some(e => s.endsWith(e))) return 'bi-file-earmark-pdf text-danger';
  if (['.doc','.docx'].some(e => s.endsWith(e))) return 'bi-file-earmark-word text-primary';
  if (['.zip','.rar','.7z'].some(e => s.endsWith(e))) return 'bi-file-zip text-warning';
  return 'bi-file-earmark text-secondary';
}

/* ── Компонент одного файла ──────────────────────────────────── */
function FileItem({ name, url, isLink = false }) {
  const href = isLink ? url : (url?.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`);
  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      download={!isLink ? (name || true) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg)', borderRadius: 8, padding: '7px 10px',
        border: '1px solid var(--border-color)', textDecoration: 'none',
        color: 'var(--text)', fontSize: 12, marginBottom: 4,
      }}
    >
      <i className={`bi ${isLink ? 'bi-link-45deg text-info' : fileIcon(name)} fs-6`} style={{ flexShrink: 0 }}/>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name || (isLink ? url : 'File')}
      </span>
      <i className={`bi ${isLink ? 'bi-box-arrow-up-right' : 'bi-download'} text-muted`} style={{ fontSize: 11, flexShrink: 0 }}/>
    </a>
  );
}

/* ── Модалка детального просмотра заявки ──────────────────── */
function DetailModal({ form, onClose, onStatusChange, onDelete, updating, isAdmin }) {
  const [note, setNote] = useState(form.reviewNote || '');
  const [skillOpen, setSkillOpen] = useState({});
  const data = form.data || {};
  const skills = form.skills || [];

  const toggleSkill = (i) => setSkillOpen(prev => ({ ...prev, [i]: !prev[i] }));

  const handleStatusChange = (status) => {
    onStatusChange(form._id, status, note);
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1040 }}
        onClick={onClose}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: '100%', maxWidth: 680,
        maxHeight: '90vh', overflowY: 'auto',
        background: 'var(--card-bg)', color: 'var(--text)',
        borderRadius: 20, zIndex: 1050,
        boxShadow: '0 25px 60px rgba(0,0,0,.4)',
      }}
        onClick={e => e.stopPropagation()}
      >
        {/* Хедер */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <TypeBadge type={form.formType} />
              <StatusBadge status={form.status} />
            </div>
            <h5 style={{ margin: 0, fontWeight: 700 }}>
              {data.firstName} {data.lastName}
            </h5>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>{data.email}</p>
          </div>
          <button className="btn-close" onClick={onClose} style={{ filter: 'var(--bs-btn-close-filter, none)' }}/>
        </div>

        {/* Тело */}
        <div style={{ padding: '20px 24px' }}>

          {/* Bio */}
          {data.bio && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                About
              </label>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, background: 'var(--bg)', padding: '12px 16px', borderRadius: 10 }}>
                {data.bio}
              </p>
            </div>
          )}

          {/* Skills — with expandable files */}
          {skills.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Skills ({skills.length})
              </label>
              <div style={{ display: 'grid', gap: 8 }}>
                {skills.map((sk, i) => {
                  const hasCerts    = sk.certificates?.length > 0;
                  const hasExamples = sk.examples?.length > 0;
                  const hasLinks    = sk.links?.length > 0;
                  const hasFiles    = hasCerts || hasExamples || hasLinks;
                  const isOpen      = !!skillOpen[i];
                  return (
                    <div key={i} style={{
                      background: 'var(--bg)', borderRadius: 10,
                      border: '1px solid var(--border-color)', overflow: 'hidden',
                    }}>
                      {/* Skill header — clickable if there are files */}
                      <div
                        style={{
                          display: 'flex', gap: 8, flexWrap: 'wrap',
                          alignItems: 'center', padding: '12px 16px',
                          cursor: hasFiles ? 'pointer' : 'default',
                        }}
                        onClick={() => hasFiles && toggleSkill(i)}
                      >
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{sk.type}</span>
                        <span style={{ color: 'var(--muted)', fontSize: 13 }}>·</span>
                        <span style={{ fontSize: 13 }}>{sk.subject}</span>
                        <span className="badge bg-secondary" style={{ fontSize: 11 }}>{sk.experience} yrs</span>
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sk.source}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {hasCerts && (
                            <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>
                              <i className="bi bi-file-earmark-check me-1"/>{sk.certificates.length} cert{sk.certificates.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {hasExamples && (
                            <span style={{ fontSize: 11, color: '#3b82f6', fontWeight: 600 }}>
                              <i className="bi bi-folder2 me-1"/>{sk.examples.length} example{sk.examples.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {hasLinks && (
                            <span style={{ fontSize: 11, color: '#8b5cf6', fontWeight: 600 }}>
                              <i className="bi bi-link-45deg me-1"/>{sk.links.length} link{sk.links.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {hasFiles && (
                            <i className="bi bi-chevron-down text-muted" style={{ fontSize: 11, transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}/>
                          )}
                        </div>
                      </div>

                      {/* Expandable files section */}
                      {hasFiles && isOpen && (
                        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--border-color)' }}>
                          {hasCerts && (
                            <div style={{ marginTop: 12 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' }}>
                                Certificates / Diplomas
                              </p>
                              {sk.certificates.map((c, ci) => (
                                <FileItem key={ci} name={c.originalName || c.filename} url={c.url} />
                              ))}
                            </div>
                          )}
                          {hasExamples && (
                            <div style={{ marginTop: 12 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' }}>
                                Work Examples
                              </p>
                              {sk.examples.map((ex, ei) => (
                                <FileItem key={ei} name={ex.name || ex.originalName} url={ex.url} isLink={ex.kind === 'link'} />
                              ))}
                            </div>
                          )}
                          {hasLinks && (
                            <div style={{ marginTop: 12 }}>
                              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', margin: '0 0 6px' }}>
                                Links
                              </p>
                              {sk.links.map((l, li) => (
                                <FileItem key={li} name={l} url={l} isLink />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Uploaded files (legacy flat list) */}
          {form.files && form.files.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Attached Files ({form.files.length})
              </label>
              <div>
                {form.files.map((f, i) => (
                  <FileItem key={i} name={f.originalName || f.filename || `File ${i + 1}`} url={f.url} />
                ))}
              </div>
            </div>
          )}

          {/* Дата подачи */}
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 20 }}>
            <i className="bi bi-calendar me-1"/>
            Submitted: {form.createdAt ? new Date(form.createdAt).toLocaleString() : '—'}
            {form.reviewedAt && (
              <span className="ms-3">
                <i className="bi bi-pencil me-1"/>
                Reviewed: {new Date(form.reviewedAt).toLocaleString()}
              </span>
            )}
          </div>

          {/* Заметка ревьюера — для студента только чтение если есть */}
          {isAdmin ? (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Review Note
              </label>
              <textarea
                className="form-control"
                rows={3}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="Optional internal note about this application..."
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)', borderRadius: 10, resize: 'vertical' }}
              />
            </div>
          ) : form.reviewNote ? (
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                Review Note
              </label>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, background: 'var(--bg)', padding: '12px 16px', borderRadius: 10, fontStyle: 'italic', color: 'var(--muted)' }}>
                {form.reviewNote}
              </p>
            </div>
          ) : null}

          {/* Кнопки смены статуса — только для администраторов */}
          {isAdmin && (
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                Change Status
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STATUSES.map(s => {
                  const m = STATUS_META[s];
                  const isCurrent = form.status === s;
                  return (
                    <button
                      key={s}
                      disabled={isCurrent || updating}
                      onClick={() => handleStatusChange(s)}
                      style={{
                        border: `2px solid ${isCurrent ? m.color : 'var(--border-color)'}`,
                        background: isCurrent ? m.bg : 'transparent',
                        color: isCurrent ? m.color : 'var(--muted)',
                        borderRadius: 20, padding: '5px 14px',
                        fontSize: 12, fontWeight: 600, cursor: isCurrent ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 5,
                        transition: 'all .2s',
                        opacity: updating ? .6 : 1,
                      }}
                    >
                      {updating && !isCurrent ? (
                        <span className="spinner-border spinner-border-sm"/>
                      ) : (
                        <i className={`bi ${m.icon}`}/>
                      )}
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Футер */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex', justifyContent: isAdmin ? 'space-between' : 'flex-end', alignItems: 'center',
        }}>
          {isAdmin && (
            <button
              className="btn btn-outline-danger btn-sm rounded-pill px-3"
              onClick={() => onDelete(form._id)}
              disabled={updating}
            >
              <i className="bi bi-trash me-1"/> Delete
            </button>
          )}
          <button className="btn btn-secondary btn-sm rounded-pill px-4" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*                     MAIN PAGE                              */
/* ═══════════════════════════════════════════════════════════ */
export default function FormsPage() {
  const navigate    = useNavigate();
  const { t }       = useContext(SettingsContext);
  const user        = getUser();

  // Доступ только quality+
  const allowedRoles = ['quality', 'admin', 'root'];
  const hasAccess    = user && allowedRoles.includes(user.role);

  const [forms, setForms]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null); // открытая заявка
  const [updating, setUpdating]   = useState(false);
  const [modal, setModal]         = useState({ show: false, title: '', message: '' });
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Фильтры
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search,       setSearch]       = useState('');
  const [searchInput,  setSearchInput]  = useState('');

  /* ── Загрузка заявок ──────────────────────────────────────── */
  const fetchForms = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token  = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (filterType)   params.set('formType', filterType);
      if (filterStatus) params.set('status',   filterStatus);
      if (search)       params.set('search',   search);

      const res  = await fetch(`${API_URL}/forms?${params}`, {
        headers: { 'Authorization': token?.startsWith('Bearer ') ? token : `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);
      setForms(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, search]);

  useEffect(() => { fetchForms(); }, [fetchForms]);

  /* ── Смена статуса ───────────────────────────────────────── */
  const handleStatusChange = async (id, status, reviewNote) => {
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_URL}/forms/detail/${id}`, {
        method:  'PATCH',
        headers: {
          'Authorization':  token?.startsWith('Bearer ') ? token : `Bearer ${token}`,
          'Content-Type':   'application/json',
        },
        body: JSON.stringify({ status, reviewNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Error ${res.status}`);

      // Обновляем локально
      setForms(prev => prev.map(f => f._id === id ? { ...f, ...data.data, status } : f));
      setSelected(prev => prev?._id === id ? { ...prev, ...data.data, status } : prev);
    } catch (err) {
      setModal({ show: true, title: 'Error', message: 'Failed to update: ' + err.message });
    } finally {
      setUpdating(false);
    }
  };

  /* ── Удаление ─────────────────────────────────────────────── */
  const handleDelete = (id) => {
    setDeleteConfirm(id);
  };

  const confirmDelete = async () => {
    const id = deleteConfirm;
    setDeleteConfirm(null);
    setUpdating(true);
    try {
      const token = localStorage.getItem('token');
      const res   = await fetch(`${API_URL}/forms/detail/${id}`, {
        method:  'DELETE',
        headers: { 'Authorization': token?.startsWith('Bearer ') ? token : `Bearer ${token}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || `Error ${res.status}`);
      }
      setForms(prev => prev.filter(f => f._id !== id));
      setSelected(null);
    } catch (err) {
      setModal({ show: true, title: 'Error', message: 'Failed to delete: ' + err.message });
    } finally {
      setUpdating(false);
    }
  };

  /* ── Счётчики по статусам ─────────────────────────────────── */
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = forms.filter(f => f.status === s).length;
    return acc;
  }, {});

  /* ── Access guard ─────────────────────────────────────────── */
  if (!user)        return null; // navigate обработан выше через ProtectedRoute
  if (!hasAccess) {
    return (
      <div className="container py-5 text-center">
        <i className="bi bi-shield-lock fs-1 text-muted mb-3 d-block"/>
        <h4 className="fw-bold">Access Denied</h4>
        <p className="text-muted">This page requires <strong>Quality</strong> or higher access level.</p>
        <button className="btn btn-primary rounded-pill px-4" onClick={() => navigate('/account')}>
          Go to Account
        </button>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <div className="container py-5" style={{ maxWidth: 1100 }}>

      {/* ── Заголовок ── */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="fw-bold mb-1">
            <i className="bi bi-inbox me-2 text-primary"/>
            Applications
          </h2>
          <p className="text-muted mb-0">
            Review and manage incoming submissions
          </p>
        </div>
        <button
          className="btn btn-outline-secondary rounded-pill px-3"
          onClick={fetchForms}
          disabled={loading}
          title="Refresh"
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}/>
        </button>
      </div>

      <style>{`
        @keyframes spin { from{transform:rotate(0)} to{transform:rotate(360deg)} }
        .spin { animation: spin .7s linear infinite; display:inline-block; }
        .form-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,.15) !important; }
        .form-card { transition: transform .2s, box-shadow .2s; cursor: pointer; }
      `}</style>

      {/* ── Статус-плашки ── */}
      <div className="row g-3 mb-4">
        {STATUSES.map(s => {
          const m = STATUS_META[s];
          return (
            <div className="col-6 col-md-3" key={s}>
              <div
                onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
                style={{
                  background: filterStatus === s ? m.bg : 'var(--card-bg)',
                  border: `2px solid ${filterStatus === s ? m.color : 'var(--border-color)'}`,
                  borderRadius: 14, padding: '14px 18px', cursor: 'pointer',
                  transition: 'all .2s',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 800, color: m.color }}>{counts[s]}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                  <i className={`bi ${m.icon}`} style={{ color: m.color }}/> {m.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Фильтры / Поиск ── */}
      <div className="card border-0 shadow-sm mb-4" style={{ borderRadius: 14 }}>
        <div className="card-body p-3">
          <div className="row g-2 align-items-center">
            {/* Поиск */}
            <div className="col-12 col-md-5">
              <div className="input-group">
                <span className="input-group-text" style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}>
                  <i className="bi bi-search text-muted"/>
                </span>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
                  style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)' }}
                />
                {searchInput && (
                  <button className="btn btn-outline-secondary" onClick={() => { setSearchInput(''); setSearch(''); }}>
                    <i className="bi bi-x"/>
                  </button>
                )}
                <button className="btn btn-primary" onClick={() => setSearch(searchInput)}>Go</button>
              </div>
            </div>

            {/* Тип */}
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)' }}
              >
                <option value="">All Types</option>
                {FORM_TYPES.map(t => (
                  <option key={t} value={t}>{TYPE_META[t]?.label || t}</option>
                ))}
              </select>
            </div>

            {/* Статус */}
            <div className="col-6 col-md-3">
              <select
                className="form-select"
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text)' }}
              >
                <option value="">All Statuses</option>
                {STATUSES.map(s => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>

            {/* Сброс */}
            <div className="col-12 col-md-1 text-end">
              {(filterType || filterStatus || search) && (
                <button
                  className="btn btn-outline-secondary btn-sm rounded-pill"
                  onClick={() => { setFilterType(''); setFilterStatus(''); setSearch(''); setSearchInput(''); }}
                  title="Clear filters"
                >
                  <i className="bi bi-funnel-fill"/> Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Состояния загрузки / ошибки / пусто ── */}
      {loading && (
        <div className="text-center py-5">
          <span className="spinner-border text-primary" role="status"/>
          <p className="text-muted mt-3 mb-0">Loading submissions...</p>
        </div>
      )}

      {!loading && error && (
        <div className="alert alert-danger d-flex align-items-center gap-2" style={{ borderRadius: 12 }}>
          <i className="bi bi-exclamation-triangle-fill"/>
          <span>{error}</span>
          <button className="btn btn-sm btn-outline-danger ms-auto rounded-pill" onClick={fetchForms}>Retry</button>
        </div>
      )}

      {!loading && !error && forms.length === 0 && (
        <div className="text-center py-5">
          <i className="bi bi-inbox fs-1 text-muted mb-3 d-block"/>
          <h5 className="fw-bold">No submissions found</h5>
          <p className="text-muted">Try adjusting the filters or search query.</p>
        </div>
      )}

      {/* ── Список заявок ── */}
      {!loading && !error && forms.length > 0 && (
        <>
          <p className="text-muted small mb-3">
            Showing <strong>{forms.length}</strong> submission{forms.length !== 1 ? 's' : ''}
          </p>

          <div className="d-grid gap-3">
            {forms.map(form => {
              const d  = form.data || {};
              const sm = STATUS_META[form.status] || STATUS_META['pending'];
              const tm = TYPE_META[form.formType] || { icon: 'bi-file-text', color: '#6b7280' };

              return (
                <div
                  key={form._id}
                  className="form-card card border-0 shadow-sm"
                  style={{ borderRadius: 14, background: 'var(--card-bg)' }}
                  onClick={() => setSelected(form)}
                >
                  <div className="card-body p-4">
                    <div className="d-flex align-items-center gap-3 flex-wrap">

                      {/* Иконка типа */}
                      <div style={{
                        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                        background: `${tm.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className={`bi ${tm.icon} fs-4`} style={{ color: tm.color }}/>
                      </div>

                      {/* Имя + email */}
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>
                          {d.firstName || '—'} {d.lastName || ''}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                          <i className="bi bi-envelope me-1"/>{d.email || '—'}
                        </div>
                      </div>

                      {/* Бейджи */}
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <TypeBadge type={form.formType} />
                        <StatusBadge status={form.status} />
                      </div>

                      {/* Skills count */}
                      {form.skills?.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-lightning-charge text-warning"/>
                          {form.skills.length} skill{form.skills.length !== 1 ? 's' : ''}
                        </div>
                      )}

                      {/* Files count */}
                      {form.files?.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <i className="bi bi-paperclip"/>
                          {form.files.length} file{form.files.length !== 1 ? 's' : ''}
                        </div>
                      )}

                      {/* Дата */}
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
                        {form.createdAt
                          ? new Date(form.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '—'}
                      </div>

                      {/* Шеврон */}
                      <i className="bi bi-chevron-right text-muted"/>
                    </div>

                    {/* Review note preview */}
                    {form.reviewNote && (
                      <div style={{
                        marginTop: 12, padding: '8px 12px',
                        background: 'var(--bg)', borderRadius: 8,
                        fontSize: 12, color: 'var(--muted)',
                        borderLeft: `3px solid ${sm.color}`,
                      }}>
                        <i className="bi bi-chat-left-text me-1"/>
                        {form.reviewNote}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Детальная модалка ── */}
      {selected && (
        <DetailModal
          form={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          updating={updating}
          isAdmin={hasAccess}
        />
      )}
    </div>
  );
}
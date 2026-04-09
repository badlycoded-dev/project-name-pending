import React, { useState, useContext, useRef } from 'react';
import './TeacherForm.css';
import { submitTeacherApplication } from '../utils/teacher';
import { SettingsContext } from '../contexts/SettingsContext';
import { UtilityModal } from './UtilityModal';

export default function TeacherForm({ initialEmail = '' }) {
  const { t } = useContext(SettingsContext);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    agreement: false,
  });

  const [skills, setSkills]                   = useState([]);
  const [isModalOpen, setIsModalOpen]         = useState(false);
  const [editingSkillIndex, setEditingSkillIndex] = useState(null);
  const [currentSkill, setCurrentSkill]       = useState({
    type: '', subject: '', experience: '', source: '', certs: [], examples: [],
  });

  const [tempLink, setTempLink] = useState('');
  const [sending, setSending]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [modal, setModal]       = useState({ show: false, title: '', message: '' });

  // ─── Refs для hidden file inputs ─────────────────────────────────────────
  // ВАЖНО: оба input живут вне модалки — всегда в DOM, refs всегда валидны
  const certInputRef    = useRef(null);
  const exampleInputRef = useRef(null);

  // ─── Основная форма ───────────────────────────────────────────────────────
  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  // ─── Модалка навыков ─────────────────────────────────────────────────────
  const openSkillModal = (index = null) => {
    if (index !== null) {
      setEditingSkillIndex(index);
      setCurrentSkill({ ...skills[index] });
    } else {
      setEditingSkillIndex(null);
      setCurrentSkill({ type: '', subject: '', experience: '', source: '', certs: [], examples: [] });
    }
    setTempLink('');
    setIsModalOpen(true);
  };

  const closeSkillModal = () => {
    setIsModalOpen(false);
    setEditingSkillIndex(null);
  };

  const onSkillChange = (e) => {
    setCurrentSkill(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // ─── Сертификаты (PDF / изображения) ────────────────────────────────────
  const handleCertUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setCurrentSkill(prev => ({ ...prev, certs: [...prev.certs, ...files] }));
    }
    // Сбрасываем input чтобы можно было выбрать те же файлы повторно
    e.target.value = '';
  };

  const openCertFileDialog = (e) => {
    e.stopPropagation();
    certInputRef.current?.click();
  };

  const removeCert = (idx) => {
    setCurrentSkill(prev => ({ ...prev, certs: prev.certs.filter((_, i) => i !== idx) }));
  };

  // ─── Примеры работ (архивы / изображения / видео) ────────────────────────
  const handleExampleUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newExamples = files.map(f => ({ type: 'file', data: f }));
      setCurrentSkill(prev => ({ ...prev, examples: [...prev.examples, ...newExamples] }));
    }
    e.target.value = '';
  };

  const openExampleFileDialog = (e) => {
    e.stopPropagation();
    exampleInputRef.current?.click();
  };

  const addExampleLink = () => {
    if (tempLink.trim()) {
      setCurrentSkill(prev => ({
        ...prev,
        examples: [...prev.examples, { type: 'link', data: tempLink.trim() }],
      }));
      setTempLink('');
    }
  };

  const removeExample = (idx) => {
    setCurrentSkill(prev => ({ ...prev, examples: prev.examples.filter((_, i) => i !== idx) }));
  };

  // ─── Сохранение навыка ───────────────────────────────────────────────────
  const saveSkill = () => {
    if (!currentSkill.type || !currentSkill.subject || !currentSkill.experience) {
      setModal({ show: true, title: 'Required fields', message: t('teacher.alertFillRequired') });
      return;
    }
    if (editingSkillIndex !== null) {
      const updated = [...skills];
      updated[editingSkillIndex] = currentSkill;
      setSkills(updated);
    } else {
      setSkills(prev => [...prev, currentSkill]);
    }
    closeSkillModal();
  };

  const deleteSkill = (idx) => setSkills(skills.filter((_, i) => i !== idx));

  // ─── Валидация ────────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.firstName || !form.lastName || !form.bio) return t('teacher.alertFillPersonal');
    if (skills.length === 0)  return t('teacher.alertAddSkill');
    if (!form.agreement)      return t('teacher.alertAgree');
    return null;
  };

  // ─── Submit ───────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const v = validate();
    if (v) return setError(v);

    setSending(true);
    try {
      const fd = new FormData();

      fd.append('data', JSON.stringify({
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     initialEmail,
        bio:       form.bio,
      }));

      const skillsMeta = skills.map(s => ({
        type:       s.type,
        subject:    s.subject,
        experience: s.experience,
        source:     s.source,
        links:      s.examples.filter(ex => ex.type === 'link').map(ex => ex.data),
      }));
      fd.append('skills', JSON.stringify(skillsMeta));

      let certIdx = 0;
      let exampleIdx = 0;
      skills.forEach(skill => {
        skill.certs.forEach(cert => {
          fd.append(`cert_${certIdx}`, cert);
          certIdx++;
        });
        skill.examples.filter(ex => ex.type === 'file').forEach(ex => {
          fd.append(`example_${exampleIdx}`, ex.data);
          exampleIdx++;
        });
      });

      const res = await submitTeacherApplication(fd, 'tutor');
      setSuccess(res.message || t('teacher.alertSuccess'));
      setForm({ firstName: '', lastName: '', bio: '', agreement: false });
      setSkills([]);
    } catch (err) {
      setError(err.message || t('teacher.alertError'));
    } finally {
      setSending(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="teacher-form-container">

      {/*
        Hidden file inputs — всегда в DOM (не внутри {isModalOpen && ...}),
        чтобы refs были валидны с момента первого рендера компонента.
      */}
      <input
        type="file"
        multiple
        accept="application/pdf,image/*"
        ref={certInputRef}
        onChange={handleCertUpload}
        style={{ display: 'none' }}
        tabIndex={-1}
      />
      <input
        type="file"
        multiple
        accept=".zip,.rar,image/*,video/*"
        ref={exampleInputRef}
        onChange={handleExampleUpload}
        style={{ display: 'none' }}
        tabIndex={-1}
      />

      {/* ── Основная форма ── */}
      <form onSubmit={handleSubmit} className="card p-4 border-0 shadow-sm bg-transparent">
        {error   && <div className="alert alert-danger">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="mb-3">
          <label className="form-label">{t('teacher.firstName')} <span className="req-star">*</span></label>
          <input name="firstName" value={form.firstName} onChange={onChange} className="form-control" placeholder={t('teacher.firstNamePlaceholder')} />
        </div>

        <div className="mb-3">
          <label className="form-label">{t('teacher.lastName')} <span className="req-star">*</span></label>
          <input name="lastName" value={form.lastName} onChange={onChange} className="form-control" placeholder={t('teacher.lastNamePlaceholder')} />
        </div>

        <div className="mb-3">
          <label className="form-label">{t('teacher.bio')} <span className="req-star">*</span></label>
          <textarea name="bio" value={form.bio} onChange={onChange} className="form-control" rows="4" placeholder={t('teacher.bioPlaceholder')} />
        </div>

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <label className="form-label mb-0">{t('teacher.skills')} <span className="req-star">*</span></label>
            <button type="button" className="btn btn-sm btn-primary rounded-pill px-4" onClick={() => openSkillModal()}>
              {t('teacher.addBtn')}
            </button>
          </div>

          <div className="skills-list-container">
            {skills.length === 0 ? (
              <div className="text-muted small text-center py-3">{t('teacher.noSkills')}</div>
            ) : (
              skills.map((s, idx) => (
                <div className="skill-pill" key={idx}>
                  <div className="skill-pill-data">
                    <span className="fw-bold text-truncate" style={{ maxWidth: '100px' }}>{s.type}</span>
                    <span className="text-muted text-truncate" style={{ maxWidth: '100px' }}>{s.subject}</span>
                    <span className="badge bg-secondary">{s.experience} {t('teacher.yrs')}</span>
                    <span className="text-muted">{s.source}</span>
                    <span className="text-primary small">[{s.certs.length} {t('teacher.certsCount')}]</span>
                    <span className="text-info small">[{s.examples.length} {t('teacher.examplesCount')}]</span>
                  </div>
                  <div className="skill-pill-actions">
                    <button type="button" onClick={() => openSkillModal(idx)}><i className="bi bi-pencil"></i></button>
                    <button type="button" onClick={() => deleteSkill(idx)} className="text-danger"><i className="bi bi-x-lg"></i></button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="form-check mb-4 d-flex align-items-center gap-2">
          <input
            className="form-check-input mt-0"
            type="checkbox"
            id="agreement"
            name="agreement"
            checked={form.agreement}
            onChange={onChange}
            style={{ width: '20px', height: '20px' }}
          />
          <label className="form-check-label" htmlFor="agreement">
            {t('teacher.agreement')} <span className="req-star">*</span>
          </label>
        </div>

        <button className="btn btn-primary btn-lg w-100 rounded-3" type="submit" disabled={sending}>
          {sending && <span className="spinner-border spinner-border-sm me-2"></span>}
          {sending ? t('teacher.submitting') : t('teacher.submitBtn')}
        </button>
      </form>

      {/* ── МОДАЛЬНОЕ ОКНО: добавление навыка ── */}
      {isModalOpen && (
        <div className="skill-modal-overlay" onClick={closeSkillModal}>
          <div className="skill-modal-content" onClick={e => e.stopPropagation()}>

            <div className="skill-modal-header">
              <h5>{editingSkillIndex !== null ? t('teacher.editSkill') : t('teacher.addSkillModal')}</h5>
              <button type="button" className="btn-close btn-close-white" onClick={closeSkillModal}></button>
            </div>

            <div className="skill-modal-body">

              {/* Тип */}
              <div className="mb-3">
                <label className="form-label small text-muted text-uppercase fw-bold">
                  {t('teacher.typeOfKnowledge')} <span className="req-star">*</span>
                </label>
                <select name="type" value={currentSkill.type} onChange={onSkillChange} className="form-select rounded-pill">
                  <option value="">{t('teacher.selectType')}</option>
                  <option value="Specified">{t('teacher.typeSpecified')}</option>
                  <option value="General">{t('teacher.typeGeneral')}</option>
                  <option value="Language">{t('teacher.typeLanguage')}</option>
                </select>
              </div>

              {/* Предмет */}
              <div className="mb-3">
                <label className="form-label small text-muted text-uppercase fw-bold">
                  {t('teacher.subject')} <span className="req-star">*</span>
                </label>
                <select name="subject" value={currentSkill.subject} onChange={onSkillChange} className="form-select rounded-pill">
                  <option value="">{t('teacher.selectSubject')}</option>
                  <option value="Design">{t('teacher.subjectDesign')}</option>
                  <option value="Coding">{t('teacher.subjectCoding')}</option>
                  <option value="Marketing">{t('teacher.subjectMarketing')}</option>
                </select>
              </div>

              {/* Опыт */}
              <div className="mb-3">
                <label className="form-label small text-muted text-uppercase fw-bold">
                  {t('teacher.experience')} <span className="req-star">*</span>
                </label>
                <input
                  type="number"
                  name="experience"
                  value={currentSkill.experience}
                  onChange={onSkillChange}
                  className="form-control rounded-pill"
                  min="0"
                  placeholder="0"
                />
              </div>

              {/* Источник */}
              <div className="mb-4">
                <label className="form-label small text-muted text-uppercase fw-bold">
                  {t('teacher.source')} <span className="req-star">*</span>
                </label>
                <select name="source" value={currentSkill.source} onChange={onSkillChange} className="form-select rounded-pill">
                  <option value="">{t('teacher.selectSource')}</option>
                  <option value="Self-taught">{t('teacher.sourceSelf')}</option>
                  <option value="University">{t('teacher.sourceUni')}</option>
                  <option value="Courses">{t('teacher.sourceCourses')}</option>
                </select>
              </div>

              {/* ── Сертификаты (PDF / изображения) ── */}
              <div className="mb-4">
                <label className="form-label small text-muted text-uppercase fw-bold">
                  {t('teacher.certs')} <span className="req-star">*</span>
                </label>

                <div className="file-upload-zone" onClick={openCertFileDialog} style={{ cursor: 'pointer' }}>
                  <i className="bi bi-file-earmark-arrow-up me-2"></i>
                  {t('teacher.addFiles')}
                  <span className="ms-2 text-muted small">(PDF, PNG, JPG...)</span>
                </div>

                {currentSkill.certs.length === 0 && (
                  <p className="text-muted small mt-1 mb-0">{t('teacher.noFiles') || 'No files selected'}</p>
                )}

                {currentSkill.certs.map((file, idx) => (
                  <div className="file-item" key={`cert-${idx}`}>
                    <div className="file-item-info">
                      <i className={`bi ${file.type === 'application/pdf' ? 'bi-file-earmark-pdf text-danger' : 'bi-file-earmark-image text-primary'}`}></i>
                      <span>{file.name}</span>
                      <span className="text-muted small">({(file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                    <div className="file-item-actions">
                      <button type="button" onClick={() => removeCert(idx)}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Примеры работ (архивы / видео / ссылки) ── */}
              <div className="mb-2">
                <label className="form-label small text-muted text-uppercase fw-bold">
                  {t('teacher.examples')} <span className="req-star">*</span>
                </label>

                <div className="file-upload-zone" onClick={openExampleFileDialog} style={{ cursor: 'pointer' }}>
                  <i className="bi bi-archive me-2"></i>
                  {t('teacher.addArchive')}
                  <span className="ms-2 text-muted small">(ZIP, RAR, MP4, PNG...)</span>
                </div>

                <div className="link-input-group mt-2">
                  <input
                    type="url"
                    value={tempLink}
                    onChange={e => setTempLink(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addExampleLink())}
                    className="form-control rounded-pill"
                    placeholder="https://..."
                  />
                  <button type="button" className="btn btn-outline-primary rounded-pill" onClick={addExampleLink}>
                    {t('teacher.addLink')}
                  </button>
                </div>

                {currentSkill.examples.length === 0 && (
                  <p className="text-muted small mt-1 mb-0">{t('teacher.noFiles') || 'No files or links'}</p>
                )}

                {currentSkill.examples.map((ex, idx) => (
                  <div className="file-item" key={`ex-${idx}`}>
                    <div className="file-item-info">
                      <i className={`bi ${ex.type === 'link' ? 'bi-link-45deg text-info' : 'bi-file-zip text-warning'}`}></i>
                      <span className="text-truncate" style={{ maxWidth: '250px' }}>
                        {ex.type === 'link' ? ex.data : ex.data.name}
                      </span>
                      {ex.type === 'file' && (
                        <span className="text-muted small">({(ex.data.size / 1024).toFixed(0)} KB)</span>
                      )}
                    </div>
                    <div className="file-item-actions">
                      <button type="button" onClick={() => removeExample(idx)}>
                        <i className="bi bi-x-lg"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-top" style={{ borderColor: 'var(--input-border)' }}>
              <button className="btn btn-primary w-100 rounded-pill" onClick={saveSkill}>
                {editingSkillIndex !== null ? t('teacher.updateBtn') : t('teacher.addBtnModal')}
              </button>
            </div>

          </div>
        </div>
      )}
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
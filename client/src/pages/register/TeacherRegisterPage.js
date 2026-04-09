import React, { useState, useContext } from 'react';
import TeacherForm from '../../components/TeacherForm';
import { getUser } from '../../utils/auth';
import { SettingsContext } from '../../contexts/SettingsContext';
import { submitTeacherApplication } from '../../utils/teacher';

// ── Support Ticket Form ───────────────────────────────────────────────────────
function SupportTicketForm({ initialEmail = '' }) {
  const { t } = useContext(SettingsContext);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: initialEmail,
    subject: '',
    message: '',
    priority: 'normal',
  });
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const onChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!form.firstName || !form.lastName || !form.subject || !form.message) {
      setError(t('support.alertFillRequired'));
      return;
    }
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('data', JSON.stringify({
        firstName: form.firstName,
        lastName:  form.lastName,
        email:     form.email,
        subject:   form.subject,
        message:   form.message,
        priority:  form.priority,
      }));
      await submitTeacherApplication(fd, 'support-ticket');
      setSuccess(t('support.alertSuccess'));
      setForm({ firstName: '', lastName: '', email: initialEmail, subject: '', message: '', priority: 'normal' });
    } catch (err) {
      setError(t('support.alertError') + ' ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 border-0 shadow-sm bg-transparent">
      {error   && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="row g-3 mb-3">
        <div className="col-sm-6">
          <label className="form-label">{t('support.firstName')} <span className="text-danger">*</span></label>
          <input name="firstName" value={form.firstName} onChange={onChange} className="form-control" placeholder={t('teacher.firstNamePlaceholder')} />
        </div>
        <div className="col-sm-6">
          <label className="form-label">{t('support.lastName')} <span className="text-danger">*</span></label>
          <input name="lastName" value={form.lastName} onChange={onChange} className="form-control" placeholder={t('teacher.lastNamePlaceholder')} />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">{t('support.email')}</label>
        <input name="email" type="email" value={form.email} onChange={onChange} className="form-control" placeholder="email@example.com" />
      </div>

      <div className="mb-3">
        <label className="form-label">{t('support.priority')}</label>
        <div className="d-flex gap-2 flex-wrap">
          {[
            { key: 'low',    label: t('support.priorityLow'),    color: 'success' },
            { key: 'normal', label: t('support.priorityNormal'), color: 'primary' },
            { key: 'high',   label: t('support.priorityHigh'),   color: 'warning' },
            { key: 'urgent', label: t('support.priorityUrgent'), color: 'danger'  },
          ].map(p => (
            <button
              key={p.key}
              type="button"
              className={"btn btn-sm rounded-pill px-3 " + (form.priority === p.key ? "btn-" + p.color : "btn-outline-" + p.color)}
              onClick={() => setForm(prev => ({ ...prev, priority: p.key }))}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label">{t('support.subject')} <span className="text-danger">*</span></label>
        <input name="subject" value={form.subject} onChange={onChange} className="form-control" placeholder={t('support.subjectPlaceholder')} />
      </div>

      <div className="mb-4">
        <label className="form-label">{t('support.message')} <span className="text-danger">*</span></label>
        <textarea name="message" value={form.message} onChange={onChange} className="form-control" rows="5" placeholder={t('support.messagePlaceholder')} />
      </div>

      <button className="btn btn-primary btn-lg w-100 rounded-3" type="submit" disabled={sending}>
        {sending ? t('support.submitting') : t('support.submitBtn')}
      </button>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TeacherRegisterPage() {
  const user = getUser();
  const { t } = useContext(SettingsContext);
  const [tab, setTab] = useState('tutor');

  const tabs = [
    { key: 'tutor',   icon: 'bi-person-video3', label: t('nav.applyAsTutor')  || 'Apply as Tutor'  },
    { key: 'support', icon: 'bi-headset',        label: t('nav.supportTicket') || 'Support Ticket'  },
  ];

  return (
    <div className="container my-5 d-flex justify-content-center">
      <div className="card shadow-sm border-0" style={{ width: '100%', maxWidth: '680px', backgroundColor: 'var(--card-bg, #161b22)' }}>
        <div className="card-body p-4 p-md-5">

          {/* Tab switcher */}
          <div className="d-flex gap-2 mb-4 p-1 rounded-3" style={{ background: 'var(--input-bg, rgba(0,0,0,0.1))' }}>
            {tabs.map(tb => (
              <button
                key={tb.key}
                type="button"
                className={"btn flex-fill d-flex align-items-center justify-content-center gap-2 rounded-3 py-2 " + (tab === tb.key ? 'btn-primary shadow-sm' : 'btn-link text-muted text-decoration-none')}
                style={{ fontWeight: tab === tb.key ? 600 : 400, fontSize: '0.92rem' }}
                onClick={() => setTab(tb.key)}
              >
                <i className={"bi " + tb.icon} />
                {tb.label}
              </button>
            ))}
          </div>

          {/* Description */}
          <p className="text-muted small mb-4">
            {tab === 'tutor'
              ? (t('teacher.roleTeacherDesc') || 'Apply to teach live sessions and mentor students.')
              : (t('support.desc')            || 'Submit a support request. Our team will get back to you as soon as possible.')}
          </p>

          {tab === 'tutor'
            ? <TeacherForm initialEmail={user?.email} />
            : <SupportTicketForm initialEmail={user?.email} />}

        </div>
      </div>
    </div>
  );
}
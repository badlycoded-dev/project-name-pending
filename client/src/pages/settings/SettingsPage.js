import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUser, setUser as setUserStorage } from '../../utils/auth';
import { SettingsContext } from '../../contexts/SettingsContext';

export default function SettingsPage() {
  const { t, theme } = useContext(SettingsContext);
  const navigate = useNavigate();
  const user = getUser();

  // Инициализируем стейт полями из схемы mongo.users.js
  const [formData, setFormData] = useState({
    nickname: user?.name || '',
    email: user?.email || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: user?.phone || '',
    github: user?.github || ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    // Обновляем данные в localStorage
    const updatedUser = { ...user, ...formData, name: formData.nickname };
    setUserStorage(updatedUser);
    alert(t('common.profileUpdated'));
    navigate('/account');
  };

  return (
    <div className={`min-vh-100 py-5 ${theme === 'dark' ? 'bg-dark' : 'bg-light'}`}>
      <div className="container" style={{ maxWidth: '600px' }}>
        <div className={`card border-0 shadow-sm p-4 ${theme === 'dark' ? 'bg-dark text-light' : ''}`}>
        <h3 className="fw-bold mb-4">{t('settings')}</h3>
        <form onSubmit={handleSave}>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-bold">{t('settingsPage.nickname')}</label>
              <input name="nickname" className="form-control" value={formData.nickname} onChange={handleChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold">{t('settingsPage.email')}</label>
              <input name="email" className="form-control" value={formData.email} disabled />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold">{t('settingsPage.firstName')}</label>
              <input name="firstName" className="form-control" value={formData.firstName} onChange={handleChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-bold">{t('settingsPage.lastName')}</label>
              <input name="lastName" className="form-control" value={formData.lastName} onChange={handleChange} />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">{t('settingsPage.phone')}</label>
              <input name="phone" className="form-control" value={formData.phone} onChange={handleChange} placeholder="+380..." />
            </div>
            <div className="col-12">
              <label className="form-label small fw-bold">{t('settingsPage.githubProfile')}</label>
              <input name="github" className="form-control" value={formData.github} onChange={handleChange} />
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-4">
            <button type="button" className="btn btn-light" onClick={() => navigate('/account')}>{t('settingsPage.cancel')}</button>
            <button type="submit" className="btn btn-primary px-4">{t('settingsPage.save')}</button>
          </div>
        </form>
      </div>
      </div>
    </div>
  );
}
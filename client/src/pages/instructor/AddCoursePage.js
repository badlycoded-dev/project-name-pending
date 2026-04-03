import React, { useContext } from 'react';
import AddCourseForm from '../../components/AddCourseForm';
import { SettingsContext } from '../../contexts/SettingsContext';

export default function AddCoursePage() {
  const { t, theme } = useContext(SettingsContext);

  return (
    <div className={`min-vh-100 py-4 ${theme === 'dark' ? 'bg-dark' : 'bg-light'}`}>
      <div className="container my-4" style={{ maxWidth: '700px' }}>
        <div className={`card shadow-sm border-0 ${theme === 'dark' ? 'bg-dark text-light' : ''}`}>
          <div className="card-body p-4">
            <h3 className="mb-2 fw-bold">{t('addCourseForm.addTitle')}</h3>
            <p className={`mb-4 ${theme === 'dark' ? 'text-muted' : 'text-muted'}`}>{t('addCourseForm.addLead')}</p>
            
            <AddCourseForm />
            
          </div>
        </div>
      </div>
    </div>
  );
}
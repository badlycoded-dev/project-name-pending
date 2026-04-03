import React, { useContext } from 'react';
import TeacherForm from '../../components/TeacherForm';
import { getUser } from '../../utils/auth';
import { SettingsContext } from '../../contexts/SettingsContext';

export default function TeacherRegisterPage() {
  const user = getUser();
  const { t } = useContext(SettingsContext);

  return (
    <div className="container my-5 d-flex justify-content-center">
      <div className="card shadow-sm border-0" style={{ width: '100%', maxWidth: '650px', backgroundColor: 'var(--card-bg, #161b22)' }}>
        <div className="card-body p-4 p-md-5">
          <TeacherForm initialEmail={user?.email} />
        </div>
      </div>
    </div>
  );
}
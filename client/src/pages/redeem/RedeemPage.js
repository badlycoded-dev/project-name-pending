import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import config from '../../config/config';

const API_URL = config.API_URL;
const BASE_URL = API_URL.replace('/api', '');

function RedeemPage() {
  const { t } = useTranslation();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);
  const navigate = useNavigate();

  const handleRedeem = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessData(null);

    try {
      const response = await fetch(`${API_URL}/keys/redeem`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // Достаем токен (если у вас он хранится под другим именем в localStorage, поменяй 'token')
          'Authorization': `Bearer ${localStorage.getItem('token')}` 
        },
        body: JSON.stringify({ code: key })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccessData(data.data); // Миша возвращает данные в объекте data
        setKey(''); // Очищаем инпут
      } else {
        // Если Мишин обработчик ошибок возвращает текст в поле message
        setError(data.message || t('redeem.apiError') || 'Ошибка активации ключа');
      }
    } catch (err) {
      setError('\u041eшибка соединения с сервером. Проверьте подключение.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center py-5 page-bg">
      <div className="container" style={{ maxWidth: '600px' }}>
        <div className="text-center mb-5">
          <h2 className="fw-bold mb-3">{t('redeem.title')}</h2>
          <p className="text-muted">{t('redeem.subtitle')}</p>
        </div>

        <div className="card shadow-sm border-0 p-4 p-md-5 mb-4">
          <form onSubmit={handleRedeem}>
            <div className="mb-4">
              <label className="form-label fw-bold text-muted small text-uppercase">{t('redeem.keyCode')}</label>
              <input 
                type="text" 
                className={`form-control form-control-lg text-center fw-bold text-uppercase ${error ? 'is-invalid' : ''}`} 
                placeholder="XXXXX-XXXXX-XXXXX" 
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setError(null); // убираем ошибку при новом вводе
                }}
                style={{ letterSpacing: '2px', fontSize: '1.25rem' }}
                required
                disabled={loading}
              />
              {error && <div className="invalid-feedback text-center mt-2 fw-medium">{error}</div>}
              {!error && <div className="form-text mt-2 text-center">{t('redeem.hint')}</div>}
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-lg w-100 fw-bold d-flex justify-content-center align-items-center gap-2"
              disabled={loading || !key.trim()}
            >
              {loading ? (
                <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              ) : (
                <i className="bi bi-key"></i>
              )}
              {loading ? t('redeem.btnLoading') : t('redeem.btnDefault')}
            </button>
          </form>
        </div>

        {/* БЛОК УСПЕШНОЙ АКТИВАЦИИ */}
        {successData && (
          <div className="alert alert-success border-0 shadow-sm rounded-4 p-4 mb-4">
            <h5 className="alert-heading fw-bold mb-3">
              <i className="bi bi-check-circle-fill me-2"></i> {t('redeem.successTitle')}
            </h5>
            <p className="mb-2">
              {t('redeem.unlockedText')} <strong>{successData.newlyUnlocked}</strong> {t('redeem.newCourses')}
              {successData.alreadyOwned > 0 && ` (${successData.alreadyOwned} ${t('redeem.alreadyOwned')}).`}
            </p>
            
            {/* Список разблокированных курсов */}
            {successData.courses && successData.courses.length > 0 && (
              <div className="mt-3">
                {successData.courses.map(course => {
                  let thumbnailSrc = 'https://placehold.co/100x60/21262d/e6edf3?text=No+Image';
                  if (course.thumbnail) {
                    thumbnailSrc = `${API_URL}/files/courses/${course._id}/${course.thumbnail}`;
                  }
                  return (
                  <div key={course._id} className="d-flex align-items-center gap-3 bg-white bg-opacity-50 p-2 rounded mb-2">
                    <img 
                      src={thumbnailSrc} 
                      alt="Thumbnail" 
                      className="rounded"
                      style={{ width: '60px', height: '40px', objectFit: 'cover' }}
                      onError={(e) => { e.target.src = 'https://placehold.co/100x60/21262d/e6edf3?text=No+Image'; }}
                    />
                    <span className="fw-medium text-dark">{course.title}</span>
                  </div>
                  );
                })}
              </div>
            )}
            
            <button 
              className="btn btn-success btn-sm mt-3 fw-bold"
              onClick={() => navigate('/account')}
            >
              {t('redeem.goToCourses')} <i className="bi bi-arrow-right"></i>
            </button>
          </div>
        )}

        <div className="text-center mt-4">
          <p className="text-muted">
            {t('redeem.lookingForLibrary')} <span className="text-primary fw-bold" style={{ cursor: 'pointer' }} onClick={() => navigate('/account')}>{t('redeem.goToCourses')}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

export default RedeemPage;
import React, { useState, useEffect, useContext } from 'react';
import { SettingsContext } from '../../contexts/SettingsContext';
import { getUser } from '../../utils/auth';
import config from '../../config/config';
import { UtilityModal } from '../../components/UtilityModal';

const API_URL = config.API_URL;

function CreatorKeysPage() {
  const { theme, t } = useContext(SettingsContext);
  const [user] = useState(() => { try { return getUser(); } catch(e) { return null; } });
  
  const [keysData, setKeysData] = useState([]);
  const [myCourses, setMyCourses] = useState([]); // Стейт для реальных курсов
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [infoModal, setInfoModal] = useState({ show: false, title: '', message: '' });
  
  // Состояния для формы генерации
  const [newKeyData, setNewKeyData] = useState({
    courseId: '',
    note: '',
    amount: 1,
    expiresAt: ''
  });

  // 1. Загрузка ключей при открытии страницы
  const fetchKeys = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/keys`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (response.ok) {
        setKeysData(result.data || []);
      } else {
        console.error(t('common.keysLoadError'), result.message);
      }
    } catch (error) {
      console.error('Ошибка сервера:', error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Загрузка списка курсов для выпадающего меню (логика из AccountPage)
  const fetchCourses = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/manage/courses`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      const res = await response.json();
      
      if (response.ok) {
        const allCourses = Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
        // Фильтруем, чтобы оставить только курсы текущего пользователя
        const createdByMe = allCourses.filter(c => {
          const courseOwnerId = String(c.userId?._id || c.userId || '');
          const currentUserId = String(user.id || user._id || user.email || '');
          const sameById = courseOwnerId && courseOwnerId === currentUserId;
          const courseOwnerNick = String(c.userId?.nickname || '').toLowerCase();
          const userName = String(user.name || '').toLowerCase();
          const sameByNick = courseOwnerNick && courseOwnerNick === userName;
          return sameById || sameByNick;
        });
        setMyCourses(createdByMe);
      }
    } catch (error) {
      console.error("Ошибка загрузки курсов для селекта:", error);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchCourses();
  }, [user]);

  // 3. Генерация нового ключа
  const handleGenerate = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      
      const payload = {
        courseIds: newKeyData.courseId ? [newKeyData.courseId] : [],
        amount: Number(newKeyData.amount),
        note: newKeyData.note
      };
      
      if (newKeyData.expiresAt) {
        payload.expiresAt = new Date(newKeyData.expiresAt).toISOString();
      }

      const response = await fetch(`${API_URL}/keys`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        setShowModal(false);
        setNewKeyData({ courseId: '', note: '', amount: 1, expiresAt: '' });
        fetchKeys(); // Обновляем таблицу
      } else {
        const errorData = await response.json();
        setInfoModal({ show: true, title: 'Error', message: `${t('common.generationError')}: ${errorData.message}` });
      }
    } catch (error) {
      console.error('Ошибка сервера:', error);
      setInfoModal({ show: true, title: 'Error', message: t('common.connectionError') || 'Connection error.' });
    }
  };

  // 4. Удаление ключа
  const handleDeleteKey = (id) => {
    setDeleteTarget(id);
  };

  const confirmDeleteKey = async () => {
    const id = deleteTarget;
    setDeleteTarget(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setKeysData(keysData.filter(k => k._id !== id));
      } else {
        const err = await response.json();
        setInfoModal({ show: true, title: 'Error', message: `${t('common.deleteError')}: ${err.message}` });
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div className={`min-vh-100 py-5 ${theme === 'dark' ? 'bg-dark text-light' : 'page-bg'}`}>
      <div className="container">
        
        {/* Шапка */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 className="fw-bold mb-1">Product Keys</h2>
            <p className="text-muted mb-0">Generate and manage course redemption keys</p>
          </div>
          <button 
            className="btn btn-primary fw-bold d-flex align-items-center gap-2 shadow-sm"
            onClick={() => setShowModal(true)}
          >
            <i className="bi bi-plus-lg"></i> {t('common.generateKeys')}
          </button>
        </div>

        {/* Таблица */}
        <div className={`card shadow-sm border-0 overflow-hidden ${theme === 'dark' ? 'bg-secondary' : ''}`}>
          <div className="table-responsive">
            <table className={`table table-hover mb-0 align-middle ${theme === 'dark' ? 'table-dark' : ''}`}>
              <thead className={`${theme === 'dark' ? 'table-dark' : 'table-light'} text-muted small text-uppercase`}>
                <tr>
                  <th className="py-3 px-4 fw-semibold">{t('common.code')}</th>
                  <th className="py-3 fw-semibold">{t('common.coursesColumn')}</th>
                  <th className="py-3 fw-semibold">{t('common.noteColumn')}</th>
                  <th className="py-3 fw-semibold text-center">{t('common.status')}</th>
                  <th className="py-3 fw-semibold">{t('common.redeemedBy')}</th>
                  <th className="py-3 fw-semibold">{t('common.expires')}</th>
                  <th className="py-3 px-4 fw-semibold text-end">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="border-top-0">
                {loading ? (
                  <tr><td colSpan="7" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : keysData.length === 0 ? (
                  <tr><td colSpan="7" className="text-center py-5 text-muted">{t('common.noKeysGenerated')}</td></tr>
                ) : (
                  keysData.map((item) => (
                    <tr key={item._id}>
                      <td className="py-3 px-4">
                        <span className="text-danger fw-bold me-2" style={{ letterSpacing: '1px' }}>{item.code}</span>
                      </td>
                      <td className="py-3 fw-medium">
                        {item.courses && item.courses.length > 0 ? item.courses.map(c => c.title).join(', ') : '—'}
                      </td>
                      <td className="py-3 text-muted">{item.note || '—'}</td>
                      <td className="py-3 text-center">
                        <span className={`badge ${item.isRedeemed ? 'bg-success' : 'bg-primary'}`}>
                          {item.isRedeemed ? t('common.redeemed') : t('common.available')}
                        </span>
                      </td>
                      <td className="py-3 small text-muted">
                        {item.isRedeemed ? (
                          <>
                            <span className="fw-bold">{item.redeemedBy || 'unknown'}</span><br/>
                            {new Date(item.redeemedAt).toLocaleDateString()}
                          </>
                        ) : '—'}
                      </td>
                      <td className="py-3 small text-muted">
                        {item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="py-3 px-4 text-end">
                        {!item.isRedeemed && (
                          <button 
                            className="btn btn-sm btn-outline-danger rounded-circle"
                            onClick={() => handleDeleteKey(item._id)}
                            title={t('common.deleteKey')}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* МОДАЛЬНОЕ ОКНО ГЕНЕРАЦИИ */}
      {showModal && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ zIndex: 1055 }}>
            <div className="modal-dialog modal-dialog-centered">
              <div className={`modal-content border-0 shadow-lg rounded-4 ${theme === 'dark' ? 'bg-dark text-light' : ''}`}>
                <div className="modal-header border-bottom-0 pb-0">
                  <h5 className="modal-title fw-bold">Generate New Key(s)</h5>
                  <button type="button" className={`btn-close ${theme === 'dark' ? 'btn-close-white' : ''}`} onClick={() => setShowModal(false)}></button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleGenerate}>
                    
                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted text-uppercase">Select Course</label>
                      <select 
                        className={`form-select ${theme === 'dark' ? 'bg-secondary text-light border-secondary' : ''}`}
                        required
                        value={newKeyData.courseId}
                        onChange={(e) => setNewKeyData({...newKeyData, courseId: e.target.value})}
                      >
                        <option value="" disabled>Choose a course to unlock...</option>
                        {/* МАПИМ РЕАЛЬНЫЕ КУРСЫ ИЗ БАЗЫ */}
                        {myCourses.map(c => (
                          <option key={c._id || c.id} value={c._id || c.id}>{c.trans[0].title}</option>
                        ))}
                      </select>
                      {myCourses.length === 0 && (
                        <div className="form-text text-danger mt-1">You haven't created any courses yet.</div>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted text-uppercase">Amount</label>
                      <input 
                        type="number" 
                        min="1" max="100"
                        className={`form-control ${theme === 'dark' ? 'bg-secondary text-light border-secondary' : ''}`}
                        value={newKeyData.amount}
                        onChange={(e) => setNewKeyData({...newKeyData, amount: e.target.value})}
                      />
                    </div>

                    <div className="mb-3">
                      <label className="form-label fw-semibold small text-muted text-uppercase">Internal Note (Optional)</label>
                      <input 
                        type="text" 
                        className={`form-control ${theme === 'dark' ? 'bg-secondary text-light border-secondary' : ''}`}
                        placeholder="e.g. For evening group / Giveaway" 
                        value={newKeyData.note}
                        onChange={(e) => setNewKeyData({...newKeyData, note: e.target.value})}
                      />
                    </div>

                    <div className="mb-4">
                      <label className="form-label fw-semibold small text-muted text-uppercase">Expiration Date (Optional)</label>
                      <input 
                        type="datetime-local" 
                        className={`form-control ${theme === 'dark' ? 'bg-secondary text-light border-secondary' : ''}`}
                        value={newKeyData.expiresAt}
                        onChange={(e) => setNewKeyData({...newKeyData, expiresAt: e.target.value})}
                      />
                      <div className="form-text small">Leave blank for a key that never expires.</div>
                    </div>

                    <div className="d-grid gap-2">
                      <button 
                        type="submit" 
                        className="btn btn-primary fw-bold py-2"
                        disabled={myCourses.length === 0}
                      >
                        <i className="bi bi-magic me-2"></i> Generate Key(s)
                      </button>
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                        Cancel
                      </button>
                    </div>

                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" style={{ zIndex: 1050 }}></div>
        </>
      )}
      <UtilityModal
        show={!!deleteTarget}
        type="confirm"
        danger
        title="Delete key?"
        message="This key will be permanently deleted and can no longer be redeemed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDeleteKey}
        onCancel={() => setDeleteTarget(null)}
      />
      <UtilityModal
        show={infoModal.show}
        type="info"
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => setInfoModal({ show: false, title: '', message: '' })}
      />
    </div>
  );
}

export default CreatorKeysPage;
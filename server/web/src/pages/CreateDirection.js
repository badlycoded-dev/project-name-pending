import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

function CreateDirection({ data, onLogout }) {
  const navigate = useNavigate();
  const [directionName, setDirectionName] = useState('');
  const [loading, setLoading] = useState(false);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });

  const token = localStorage.getItem('token');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!directionName.trim()) {
      showInfo('Validation', 'Please enter a direction name');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/directions', {
        method: 'POST',
        headers: {
          'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          directionName: directionName.trim()
        })
      });

      if (response.ok) {
        showInfo('Success', 'Direction created successfully');
        navigate('/manage/directions');
      } else {
        const error = await response.json();
        showInfo('Error', error.message || 'Failed to create direction');
      }
    } catch (err) {
      console.error('Error creating direction:', err);
      showInfo('Error', 'Failed to create direction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout data={data} onLogout={onLogout} title="Create Direction">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Create Direction</h2>
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate('/manage/directions')}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Directions
          </button>
        </div>

        <div className="row">
          <div className="col-lg-6">
            <div className="card shadow-sm">
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      Direction Name <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={directionName}
                      onChange={(e) => setDirectionName(e.target.value)}
                      placeholder="e.g., Programming, Design, Marketing"
                      required
                    />
                    <small className="text-muted">
                      Enter a unique direction name for course categorization
                    </small>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2"></span>
                          Creating...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Create Direction
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => navigate('/manage/directions')}
                      disabled={loading}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="alert alert-info mt-3">
              <i className="bi bi-info-circle me-2"></i>
              <strong>Note:</strong> Directions are used to categorize courses.
              You can create levels for each direction to further organize courses.
            </div>
          </div>
        </div>
      </div>
        <UtilityModal
                show={modal.show}
                type={modal.type}
                title={modal.title}
                message={modal.message}
                danger={modal.danger}
                onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
                onCancel={modal.onCancel || closeModal}
                onClose={modal.onClose || closeModal}
            />

    </AppLayout>

  );
}

export default CreateDirection;
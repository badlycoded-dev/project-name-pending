import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

function CreateLevel({ data, onLogout }) {
  const navigate = useNavigate();
  const [levelName, setLevelName] = useState('');
  const [directionName, setDirectionName] = useState('');
  const [minTutorRank, setMinTutorRank] = useState('assistant');
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchDirections();
  }, []);

  const fetchDirections = async () => {
    setLoading(true);
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/directions');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data } = await response.json();

      // Ensure data is an array
      if (Array.isArray(data)) {
        setDirections(data);
      } else {
        console.error('API returned non-array data:', data);
        setDirections([]);
      }
    } catch (err) {
      console.error('Error fetching directions:', err);
      setDirections([]);
      showInfo('Error', 'Failed to load directions. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!levelName.trim()) {
      showInfo('Validation', 'Please enter a level name');
      return;
    }

    if (!directionName) {
      showInfo('Validation', 'Please select a direction');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/levels', {
        method: 'POST',
        headers: {
          'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          levelName: levelName.trim(),
          directionName: directionName,
          minTutorRank: minTutorRank
        })
      });

      if (response.ok) {
        showInfo('Success', 'Level created successfully');
        navigate('/manage/levels');
      } else {
        const error = await response.json();
        showInfo('Error', error.message || 'Failed to create level');
      }
    } catch (err) {
      console.error('Error creating level:', err);
      showInfo('Error', 'Failed to create level');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
    <AppLayout data={data} onLogout={onLogout} title="Create Level">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data} onLogout={onLogout} title="Create Level">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Create Level</h2>
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate('/manage/levels')}
          >
            <i className="bi bi-arrow-left me-2"></i>
            Back to Levels
          </button>
        </div>

        <div className="row">
          <div className="col-lg-6">
            {directions.length === 0 ? (
              <div className="alert alert-warning">
                <i className="bi bi-exclamation-triangle me-2"></i>
                <strong>No directions found!</strong> You need to create at least one direction first.
                <div className="mt-2">
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => navigate('/manage/directions/create')}
                  >
                    <i className="bi bi-plus-circle me-1"></i>
                    Create Direction
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="card shadow-sm">
                  <div className="card-body">
                    <form onSubmit={handleSubmit}>
                      <div className="mb-3">
                        <label className="form-label fw-bold">
                          Direction <span className="text-danger">*</span>
                        </label>
                        <select
                          className="form-select"
                          value={directionName}
                          onChange={(e) => setDirectionName(e.target.value)}
                          required
                        >
                          <option value="">Select a direction</option>
                          {directions.map((dir) => (
                            <option key={dir._id} value={dir.directionName}>
                              {dir.directionName}
                            </option>
                          ))}
                        </select>
                        <small className="text-muted">
                          Choose the direction this level belongs to
                        </small>
                      </div>

                      <div className="mb-3">
                        <label className="form-label fw-bold">
                          Level Name <span className="text-danger">*</span>
                        </label>
                        <input
                          type="text"
                          className="form-control"
                          value={levelName}
                          onChange={(e) => setLevelName(e.target.value)}
                          placeholder="e.g., Beginner, Intermediate, Advanced"
                          required
                        />
                        <small className="text-muted">
                          Enter a level name for the selected direction
                        </small>
                      </div>

                      <div className="d-flex gap-2">
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <span className="spinner-border spinner-border-sm me-2"></span>
                              Creating...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-check-circle me-2"></i>
                              Create Level
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() => navigate('/manage/levels')}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="alert alert-info mt-3">
                  <i className="bi bi-info-circle me-2"></i>
                  <strong>Note:</strong> Levels help organize courses within a direction.
                  For example, "Programming" direction might have "Beginner", "Intermediate",
                  and "Advanced" levels.
                </div>
              </>
            )}
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

export default CreateLevel;
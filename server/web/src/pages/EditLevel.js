import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

function EditLevel({ data, onLogout }) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [levelName, setLevelName] = useState('');
  const [directionName, setDirectionName] = useState('');
  const [minTutorRank, setMinTutorRank] = useState('assistant');
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
  // ── Modal state ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
  const closeModal = () => setModal(p => ({ ...p, show: false }));
  const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
  const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
  const showDelete = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch both the level and all directions
      const [levelRes, directionsRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_URL}/levels/${id}`),
        fetch(process.env.REACT_APP_API_URL + '/directions')
      ]);

      if (levelRes.ok) {
        const {data} = await levelRes.json();
        setLevelName(data.levelName);
        setDirectionName(data.directionName);
        setMinTutorRank(data.minTutorRank || 'assistant');
      } else {
        showInfo('Error', 'Level not found');
        navigate('/manage/levels');
        return;
      }

      if (directionsRes.ok) {
        const directionsData = await directionsRes.json();

        // Ensure data is an array
        if (Array.isArray(directionsData)) {
          setDirections(directionsData);
        } else {
          console.error('Directions API returned non-array data:', directionsData);
          setDirections([]);
        }
      } else {
        console.error('Failed to fetch directions');
        setDirections([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setDirections([]);
      showInfo('Error', 'Failed to load data. Please check your connection.');
      navigate('/manage/levels');
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
      const response = await fetch(`${process.env.REACT_APP_API_URL}/levels/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          levelName: levelName.trim(),
          directionName: directionName,
          minTutorRank: minTutorRank,
          updatedAt: new Date()
        })
      });

      if (response.ok) {
        showInfo('Success', 'Level updated successfully');
        navigate('/manage/levels');
      } else {
        const error = await response.json();
        showInfo('Error', error.message || 'Failed to update level');
      }
    } catch (err) {
      console.error('Error updating level:', err);
      showInfo('Error', 'Failed to update level');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
    <AppLayout data={data} onLogout={onLogout} title="Edit Level">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data} onLogout={onLogout} title="Edit Level">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Edit Level</h2>
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
            <div className="card shadow-sm">
              <div className="card-body">
                <form onSubmit={handleSubmit}>
                  <div className="mb-3">
                    <label className="form-label fw-bold">
                      Direction <span className="text-danger">*</span>
                    </label>
                    <input
                      className="form-control"
                      value={directionName}
                      onChange={(e) => setDirectionName(e.target.value)}
                      required
                      disabled
                    >
                    </input>
                    <small className="text-muted">
                      Change the direction this level belongs to
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
                      Update the level name
                    </small>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">Minimum Tutor Sub-Rank</label>
                    <select
                      className="form-select"
                      value={minTutorRank}
                      onChange={(e) => setMinTutorRank(e.target.value)}
                    >
                      {['assistant','teacher','lecturer','instructor','tutor','professor'].map(r => (
                        <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                      ))}
                    </select>
                    <small className="text-muted">
                      Tutors must have at least this sub-rank to host courses at this level
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
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-circle me-2"></i>
                          Save Changes
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

            <div className="alert alert-warning mt-3">
              <i className="bi bi-exclamation-triangle me-2"></i>
              <strong>Warning:</strong> Changing this level's direction or name
              will affect all courses associated with this level.
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
        confirmToken={modal.confirmToken}
        tokenLabel={modal.tokenLabel}
        deleteLabel={modal.deleteLabel || 'Delete'}
        onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
        onDelete={() => { modal.onDelete?.(); closeModal(); }}
        onCancel={modal.onCancel || closeModal}
        onClose={modal.onClose || closeModal}
      />
    </AppLayout>
  );
}

export default EditLevel;
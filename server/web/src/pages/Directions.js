import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { extendSession } from "../utils/utils";
import { UtilityModal } from '../components/UtilityModal';

function Directions({ data, onLogout }) {
  const navigate = useNavigate();
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete  = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');   // 'name' | 'created' | 'updated'
  const [sortDir, setSortDir] = useState('asc');

  useEffect(() => {
    fetchDirections();
  }, []);

  const fetchData = async () => {
    await fetchDirections();
  }

  const fetchDirections = async () => {
    setLoading(true);
    try {
      const response = await fetch(process.env.REACT_APP_API_URL + '/directions');

      if (response.status === 401) {
        await extendSession(data)
      }
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const { data } = await response.json();
      // Ensure data is an array
      if (Array.isArray(data)) {
        setDirections(data);
      } else {
        console.warn('API returned empty-array data:', data);
        setDirections([]);
      }
    } catch (err) {
      console.error('Error fetching directions:', err);
      setDirections([]); // Set to empty array on error
      showInfo('Error', 'Failed to load directions. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (directions) => {
    showDelete('Delete Direction',
      `You are about to permanently delete direction "${directions.directionName}". This cannot be undone.`,
      directions.directionName, "Type the direction's name to confirm",
      async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${process.env.REACT_APP_API_URL}/directions/${directions._id}`, {
            method: 'DELETE', headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' }
          });
          if (response.ok) { showInfo('Deleted', `Direction "${directions.directionName}" has been deleted.`); fetchDirections(); }
        } catch (e) { showInfo('Error', 'Failed to delete direction.'); }
      }
    );
  };

  const filteredDirections = (() => {
    let result = Array.isArray(directions)
      ? directions.filter(d => d.directionName.toLowerCase().includes(searchTerm.toLowerCase()))
      : [];
    result = [...result].sort((a, b) => {
      let av, bv;
      if (sortBy === 'name')    { av = a.directionName || ''; bv = b.directionName || ''; return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av); }
      if (sortBy === 'created') { av = new Date(a.createdAt); bv = new Date(b.createdAt); }
      else if (sortBy === 'updated') { av = new Date(a.updatedAt); bv = new Date(b.updatedAt); }
      else { return 0; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
    return result;
  })();

  if (loading) {
    return (
    <AppLayout data={data} onLogout={onLogout} title="Directions">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data} onLogout={onLogout} title="Directions">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Directions</h2>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/manage/directions/create')}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Add Direction
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => fetchData()}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                  Loading...
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16" style={{ verticalAlign: 'middle' }}>
                    <path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14zm6-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
                    <path d="M8 4a.5.5 0 0 1 .5.5v3.362l2.236-1.618a.5.5 0 0 1 .894.447l-4 2.9a.5.5 0 0 1-.06.03.5.5 0 0 1-.894-.447l4-2.9a.5.5 0 0 1 .06-.03V4.5A.5.5 0 0 1 8 4z" />
                  </svg>
                  Refresh
                </>
              )}
            </button>
          </div>
        </div>

        <div className="card shadow-sm mb-4">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-5">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Search directions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="col-md-3">
                <div className="input-group">
                  <select className="form-select form-select-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                    <option value="name">Sort: Name</option>
                    <option value="created">Sort: Created</option>
                    <option value="updated">Sort: Updated</option>
                  </select>
                  <button className="btn btn-outline-secondary btn-sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} title="Toggle order">
                    {sortDir === 'asc' ? '↑' : '↓'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card shadow-sm">
          <div className="card-body">
            {filteredDirections.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
                <p className="mt-3">No directions found</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Direction Name</th>
                      <th>Created At</th>
                      <th>Updated At</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDirections.map((direction) => (
                      <tr key={direction._id}>
                        <td className="fw-bold">{direction.directionName}</td>
                        <td>{new Date(direction.createdAt).toLocaleDateString()}</td>
                        <td>{new Date(direction.updatedAt).toLocaleDateString()}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={() => navigate(`/manage/direction/${direction._id}`)}
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(direction)}
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 text-muted">
          <small>Total: {filteredDirections.length} direction(s)</small>
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

export default Directions;
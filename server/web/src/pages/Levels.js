import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { extendSession } from "../utils/utils";
import { UtilityModal } from '../components/UtilityModal';

function Levels({ data, onLogout }) {
  const navigate = useNavigate();
  const [levels, setLevels] = useState([]);
  const [directions, setDirections] = useState([]);
  const [loading, setLoading] = useState(true);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete  = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRank, setFilterRank] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [filterDirection, setFilterDirection] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch both levels and directions
      const [levelsRes, directionsRes] = await Promise.all([
        fetch(process.env.REACT_APP_API_URL + '/levels'),
        fetch(process.env.REACT_APP_API_URL + '/directions')
      ]);
      if (levelsRes.status === 401 || directionsRes.status === 401) {
        await extendSession(data)
      }

      if (!levelsRes.ok || !directionsRes.ok) {
        throw new Error('HTTP error! One or more requests failed');
      }

      const levelData = await levelsRes.json();

      // Ensure data is arrays
      if (Array.isArray(levelData.data)) {
        setLevels(levelData.data);
      } else {
        console.warn('Levels API returned empty-array data:', levelData);
        setLevels([]);
      }

      const directionData = await directionsRes.json();

      if (Array.isArray(directionData.data)) {
        setDirections(directionData.data);
      } else {
        console.warn('Directions API returned empty-array data:', directionData);
        setDirections([]);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setLevels([]); // Set to empty arrays on error
      setDirections([]);
      showInfo('Error', 'Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (level) => {
    showDelete('Delete Level',
      `You are about to permanently delete level "${level.levelName}" (${level.directionName}). This cannot be undone.`,
      level.levelName, "Type the level's name to confirm",
      async () => {
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(`${process.env.REACT_APP_API_URL}/levels/${level._id}`, {
            method: 'DELETE', headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' }
          });
          if (response.ok) { showInfo('Deleted', `Level "${level.levelName}" has been deleted.`); fetchData(); }
        } catch (e) { showInfo('Error', 'Failed to delete level.'); }
      }
    );
  };

  const filteredLevels = (() => {
    let result = Array.isArray(levels) ? levels.filter(level => {
      const matchesSearch = level.levelName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        level.directionName?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesDirection = !filterDirection || level.directionName === filterDirection;
      const matchesRank = !filterRank || (level.minTutorRank || 'assistant') === filterRank;
      return matchesSearch && matchesDirection && matchesRank;
    }) : [];
    result = [...result].sort((a, b) => {
      const ranks = ['assistant','teacher','lecturer','instructor','tutor','professor'];
      if (sortBy === 'name')    return sortDir==='asc' ? a.levelName.localeCompare(b.levelName) : b.levelName.localeCompare(a.levelName);
      if (sortBy === 'rank')    { const ai=ranks.indexOf(a.minTutorRank||'assistant'), bi=ranks.indexOf(b.minTutorRank||'assistant'); return sortDir==='asc' ? ai-bi : bi-ai; }
      if (sortBy === 'created') return sortDir==='asc' ? new Date(a.createdAt)-new Date(b.createdAt) : new Date(b.createdAt)-new Date(a.createdAt);
      return 0;
    });
    return result;
  })();

  // Group levels by direction
  const levelsByDirection = filteredLevels.reduce((acc, level) => {
    if (!acc[level.directionName]) {
      acc[level.directionName] = [];
    }
    acc[level.directionName].push(level);
    return acc;
  }, {});

  if (loading) {
    return (
    <AppLayout data={data} onLogout={onLogout} title="Levels">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
          <div className="text-center py-5">
            <div className="spinner-border text-primary"></div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout data={data} onLogout={onLogout} title="Levels">
<div className="p-3 p-md-4 bg-light" style={{ minHeight: 'calc(100vh - 56px)' }}>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="mb-0">Levels</h2>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/manage/levels/create')}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Add Level
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
                  placeholder="Search levels..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="col-md-4">
                <select
                  className="form-select"
                  value={filterDirection}
                  onChange={(e) => setFilterDirection(e.target.value)}
                >
                  <option value="">All Directions</option>
                  {directions.map((dir) => (
                    <option key={dir._id} value={dir.directionName}>
                      {dir.directionName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                              <select className="form-select" value={filterRank} onChange={e => setFilterRank(e.target.value)} style={{maxWidth:170}}>
                <option value="">All Ranks</option>
                {['assistant','teacher','lecturer','instructor','tutor','professor'].map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>
                ))}
              </select>
              <div className="input-group" style={{maxWidth:200}}>
                <select className="form-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                  <option value="name">Name</option>
                  <option value="rank">Min. Rank</option>
                  <option value="created">Created</option>
                </select>
                <button className="btn btn-outline-secondary" onClick={() => setSortDir(d => d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑':'↓'}</button>
              </div>
              <button
                  className="btn btn-outline-secondary w-100"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterDirection('');
                  }}
                >
                  <i className="bi bi-x-circle me-2"></i>
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {filteredLevels.length === 0 ? (
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="text-center py-5 text-muted">
                <i className="bi bi-inbox" style={{ fontSize: '3rem' }}></i>
                <p className="mt-3">No levels found</p>
                {filterDirection && (
                  <button
                    className="btn btn-primary mt-2"
                    onClick={() => setFilterDirection('')}
                  >
                    Clear Direction Filter
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            {Object.keys(levelsByDirection).sort().map((directionName) => (
              <div key={directionName} className="card shadow-sm mb-3">
                <div className="card-header bg-primary text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-folder me-2"></i>
                    {directionName}
                    <span className="badge bg-light text-primary ms-2">
                      {levelsByDirection[directionName].length}
                    </span>
                  </h5>
                </div>
                <div className="card-body">
                  <div className="table-responsive">
                    <table className="table table-hover mb-0">
                      <thead>
                        <tr>
                          <th>Level Name</th>
                          <th>Created At</th>
                          <th>Updated At</th>
                          <th className="text-end">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {levelsByDirection[directionName].map((level) => (
                          <tr key={level._id}>
                            <td className="fw-bold">{level.levelName}</td>
                            <td>{new Date(level.createdAt).toLocaleDateString()}</td>
                            <td>{new Date(level.updatedAt).toLocaleDateString()}</td>
                            <td className="text-end">
                              <button
                                className="btn btn-sm btn-outline-primary me-2"
                                onClick={() => navigate(`/manage/level/${level._id}`)}
                              >
                                <i className="bi bi-pencil"></i>
                              </button>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(level)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="mt-3 text-muted">
          <small>
            Total: {filteredLevels.length} level(s)
            {filterDirection && ` in ${filterDirection}`}
          </small>
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

export default Levels;
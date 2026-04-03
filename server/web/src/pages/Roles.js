import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { extendSession } from "../utils/utils";
import { UtilityModal } from '../components/UtilityModal';
import { ItemModal } from '../components/ItemModal';

function Roles({ data, onLogout }) {
    const [loading, setLoading] = useState(true);
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState(null);
    const [showModal, setShowModal] = useState(false);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal = () => setShowModal(false);
    const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
    const [searchText, setSearchText] = useState('');
    const [selectedAccessLevel, setSelectedAccessLevel] = useState('');
    const [sortBy, setSortBy] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const navigate = useNavigate();

    const token = localStorage.getItem('token');

    useEffect(() => {

        if (token) {
            fetchRoles();
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await fetchRoles();
        setLoading(false);
    }

    const fetchRoles = async () => {
        setLoading(true);
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/manage/roles', {
                method: 'GET',
                headers: {
                    'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 401) {
                await extendSession(data)
            }
            if (response.ok) {
                const res = await response.json();
                setRoles(res.data || res);
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        } finally {
            setLoading(false);
        }
    };

    const uniqueAccessLevels = [...new Set(roles.map(r => r.accessLevel))].sort((a, b) => a - b);

    const filteredRoles = (() => {
        const ORDER = ['default','create','tutor','quality','manage','admin','root'];
        let result = roles.filter((r) => {
            const text = searchText.toLowerCase();
            const matchesText = !text ||
                (r.roleName || '').toLowerCase().includes(text) ||
                (r.accessLevel?.toString() || '').includes(text);
            const matchesAccessLevel = !selectedAccessLevel || r.accessLevel?.toString() === selectedAccessLevel;
            return matchesText && matchesAccessLevel;
        });
        if (sortBy) {
            result = [...result].sort((a,b) => {
                if (sortBy==='name')  { const cmp=(a.roleName||'').localeCompare(b.roleName||''); return sortDir==='asc'?cmp:-cmp; }
                if (sortBy==='level') { const ai=ORDER.indexOf(a.accessLevel), bi=ORDER.indexOf(b.accessLevel); return sortDir==='asc'?ai-bi:bi-ai; }
                if (sortBy==='date')  { const av=new Date(a.createdAt), bv=new Date(b.createdAt); return sortDir==='asc'?av-bv:bv-av; }
                return 0;
            });
        }
        return result;
    })();

    const openModal = (role) => {
        setSelectedRole(role);
        setShowModal(true);
    };

    const handleEdit = (role) => {
        navigate(`/manage/role/${role._id}`);
    };

    const handleDelete = (role) => {
        showDelete('Delete Role',
            `You are about to permanently delete role "${role.roleName}" (${role.accessLevel}). This cannot be undone.`,
            role.roleName, "Type the role's name to confirm",
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/roles/${role._id}`, {
                        method: 'DELETE', headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' }
                    });
                    if (response.ok) { showInfo('Deleted', `Role "${role.roleName}" has been deleted.`); setRoles(prev => prev.filter(r => r._id !== role._id)); }
                } catch (e) { showInfo('Error', 'Failed to delete role.'); }
            }
        );
    };

    const getAccessLevelBadgeColor = (level) => {
        switch (level) {
            case 'root': return 'bg-dark';
            case 'admin': return 'bg-danger';
            case 'manage': case 'manager': return 'bg-warning text-dark';
            case 'quality': return 'bg-success';
            case 'tutor': return 'bg-info text-warning';
            case 'create': return 'bg-info text-white';
            case 'user': return 'bg-primary';
            default: return 'bg-secondary';
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
    <AppLayout data={data} onLogout={onLogout} title="Roles">
<div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 56px)' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" style={{ width: '2.5rem', height: '2.5rem' }}></div>
                        <p className="text-muted small mb-0">Loading roles…</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
    <AppLayout data={data} onLogout={onLogout} title="Roles">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
                            <div>
                                <h1 className="h3 fw-bold text-dark mb-1">Roles</h1>
                                <p className="text-muted mb-0 small">Manage system roles and access levels</p>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <button className="btn btn-success btn-sm" onClick={() => navigate('/manage/roles/create')}>
                                    <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                    </svg>
                                    Add Role
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
                                <span className="badge bg-primary rounded-pill p-2 px-3">
                                    {filteredRoles.length}{filteredRoles.length !== roles.length ? ` / ${roles.length}` : ''} {roles.length === 1 ? 'role' : 'roles'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card border-0 shadow-sm mb-3">
                    <div className="card-body p-3">
                        <div className="row g-2 align-items-center">
                            <div className="col-12 col-sm-7 col-md-8">
                                <div className="input-group input-group-sm">
                                    <span className="input-group-text bg-white border-end-0">
                                        <svg width="16" height="16" fill="#6c757d" viewBox="0 0 16 16">
                                            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242 6a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                                        </svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="form-control border-start-0 ps-0"
                                        placeholder="Search by role name or access level..."
                                        value={searchText}
                                        onChange={(e) => setSearchText(e.target.value)}
                                    />
                                    {searchText && (
                                        <button className="btn btn-outline-secondary btn-sm border-start-0" onClick={() => setSearchText('')} title="Clear">
                                            <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                                                <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div className="col-12 col-sm-5 col-md-4">
                                <select
                                    className="form-select form-select-sm"
                                    value={selectedAccessLevel}
                                    onChange={(e) => setSelectedAccessLevel(e.target.value)}
                                >
                                    <option value="">All access levels</option>
                                    {uniqueAccessLevels.map((level) => (
                                        <option key={level} value={level}>Level {level}</option>
                                    ))}
                                </select>
                            </div>
                        <div className="col-auto">
                            <div className="input-group input-group-sm">
                                <select className="form-select form-select-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                    <option value="">Sort…</option>
                                    <option value="name">Name</option>
                                    <option value="level">Level</option>
                                    <option value="date">Created</option>
                                </select>
                                <button className="btn btn-outline-secondary btn-sm" onClick={() => setSortDir(d=>d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑':'↓'}</button>
                            </div>
                        </div>
                        </div>

                        {(searchText || selectedAccessLevel) && (
                            <div className="d-flex align-items-center flex-wrap gap-2 mt-2">
                                <small className="text-muted">Filters:</small>
                                {searchText && (
                                    <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                                        Text: "{searchText}"
                                        <svg width="10" height="10" fill="currentColor" viewBox="0 0 16 16" style={{ cursor: 'pointer' }} onClick={() => setSearchText('')}>
                                            <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                                        </svg>
                                    </span>
                                )}
                                {selectedAccessLevel && (
                                    <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                                        Access Level: {selectedAccessLevel}
                                        <svg width="10" height="10" fill="currentColor" viewBox="0 0 16 16" style={{ cursor: 'pointer' }} onClick={() => setSelectedAccessLevel('')}>
                                            <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                                        </svg>
                                    </span>
                                )}
                                <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => { setSearchText(''); setSelectedAccessLevel(''); }}>
                                    Clear all
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card border-0 shadow-sm">
                    <div className="table-responsive">
                        <table className="table table-hover mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th className="fw-semibold text-muted small text-uppercase py-3" style={{ width: '60px' }}>#</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Role Name</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Access Level</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3 text-end" style={{ width: '200px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRoles.length > 0 ? (
                                    filteredRoles.map((r, index) => {
                                        return (
                                            <tr key={index} className="align-middle">
                                                <td className="text-muted">{index + 1}</td>
                                                <td>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className={`rounded-circle ${getAccessLevelBadgeColor(r.accessLevel)} d-flex align-items-center justify-content-center text-white flex-shrink-0`}
                                                            style={{ width: '34px', height: '34px', fontSize: '0.8rem' }}>
                                                            {r.roleName ? r.roleName.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                        <span className="fw-semibold">{r.roleName || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge rounded-pill ${getAccessLevelBadgeColor(r.accessLevel)}`}>
                                                        {r.accessLevel.toUpperCase() ?? '—'}
                                                    </span>
                                                </td>
                                                <td className="text-end">
                                                    <div className="btn-group btn-group-sm" role="group">
                                                        <button type="button" className="btn btn-outline-primary" onClick={() => openModal(r)} title="View details">
                                                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                                                <path d="M7.002 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM7.1 4.995a.905.905 0 1 0 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                                                            </svg>
                                                        </button>
                                                        <button type="button" className="btn btn-outline-warning" onClick={() => handleEdit(r)} title="Edit role">
                                                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                <path d="M12.146.146a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1 0 .707l-10 10a.5.5 0 0 1-.203.134l-6 2a.5.5 0 0 1-.633-.633l2-6a.5.5 0 0 1 .134-.203l10-10zM11.207 1.5 13.5 3.793 14.793 2.5 12.5.207l-1.293 1.293zm1.386 1.386L9.3 0.207 10.5 1.407l2.293 2.293-0.207.207z" />
                                                            </svg>
                                                        </button>
                                                        <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(r)} title="Delete role">
                                                            <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                <path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" />
                                                                <path d="M5 0 4.5.5l-.5 1H2a1 1 0 0 0-1 1v1h12V2.5a1 1 0 0 0-1-1H10.5l-.5-1L9.5 0h-5zM3 14.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4H3v10.5zM4.5 3h7L11 2H5l-.5 1z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="text-center py-5">
                                            <div className="text-muted">
                                                <svg width="40" height="40" fill="currentColor" viewBox="0 0 16 16" className="mb-3 opacity-50">
                                                    <path d="M1 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
                                                    <path fillRule="evenodd" d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5z" />
                                                </svg>
                                                {roles.length === 0 ? (
                                                    <>
                                                        <p className="mb-0 fw-semibold">No roles found</p>
                                                        <small>The role list is empty</small>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="mb-0 fw-semibold">No matches</p>
                                                        <small>No roles match your current search or filter</small>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <ItemModal
                show={showModal}
                type="role"
                item={selectedRole}
                onClose={() => setShowModal(false)}
                onEdit={selectedRole ? () => navigate(`/manage/role/${selectedRole._id}`) : undefined}
                onDelete={selectedRole ? () => { setShowModal(false); handleDelete(selectedRole); } : undefined}
            />
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

export default Roles;
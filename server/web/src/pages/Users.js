import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import AuthImage from "../components/AuthImage";
import { extendSession } from "../utils/utils";
import { UtilityModal } from '../components/UtilityModal';
import { ItemModal } from '../components/ItemModal';

function Users({ data, onLogout }) {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showModal, setShowModal] = useState(false);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    // At the top of the component, add a dedicated closer:
    const closeModal = () => setShowModal(false);
    const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
    const [searchText, setSearchText] = useState('');
    const [sortBy, setSortBy] = useState('');
    const [sortDir, setSortDir] = useState('asc');
    const [filterTutorRank, setFilterTutorRank] = useState('');
    const [selectedRole, setSelectedRole] = useState('');
    const navigate = useNavigate();

    const token = localStorage.getItem('token');
    const isRoot = data?.role?.accessLevel === 'root' || data?.role?.roleName === 'root';

    useEffect(() => {

        if (token) {

            fetchUsers();
            fetchRoles();
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await fetchUsers();
        await fetchRoles();
        setLoading(false);
    }

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/manage/users', {
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
                let userList = res.data || [];
                // If the current user is root and not already in the list, fetch and prepend self
                if (isRoot && data?._id && !userList.find(u => u._id === data._id)) {
                    try {
                        const selfRes = await fetch(process.env.REACT_APP_API_URL + '/users/c', {
                            method: 'GET',
                            headers: {
                                'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                                'Content-Type': 'application/json'
                            }
                        });
                        if (selfRes.ok) {
                            const selfData = await selfRes.json();
                            if (selfData.user) userList = [selfData.user, ...userList];
                        }
                    } catch (_) {}
                }
                setUsers(userList);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRoles = async () => {
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/manage/roles', {
                method: 'GET',
                headers: {
                    'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.ok) {
                const res = await response.json();
                setRoles(isRoot ? (res.data || res) : (res.data || res).filter((d) => d.roleName !== 'root'));
            }
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const getAccessLevelBadgeColor = (level) => {
        switch (level) {
            case 'root': return 'bg-dark';
            case 'admin': return 'bg-danger';
            case 'manage': case 'manager': return 'bg-warning text-dark';
            case 'quality': case 'tester': return 'bg-success';
            case 'tutor': return 'bg-info text-warning';
            case 'create': return 'bg-info text-white';
            case 'user': return 'bg-primary';
            default: return 'bg-secondary';
        }
    };

    const getRoleName = (roleId) => {
        if (!roleId) return '—';
        // If role is already a populated object, return its name directly
        if (typeof roleId === 'object' && roleId.roleName) return roleId.roleName;
        // Otherwise look it up by ID
        const found = roles.find((r) => r._id === roleId);
        return found ? found.roleName : (typeof roleId === 'string' ? roleId : '—');
    };

    // Helper to get the first profile picture URL from links array
    const getProfilePictureUrl = (user) => {
        if (!user.links || user.links.length === 0) return null;

        // Find the first profile picture (type === 'image' and description matches)
        const profilePic = user.links.find(link =>
            link.type === 'image' &&
            link.description &&
            link.description.toLowerCase() === 'profile picture' &&
            link.url
        );

        // If no profile picture found, use first image with a URL
        return profilePic ? profilePic.url : (user.links[0]?.url || null);
    };

    const filteredUsers = (() => {
        let result = users.filter((u) => {
            const text = searchText.toLowerCase();
            const roleName = getRoleName(u.role);
            const matchesText = !text ||
                (u.nickname || '').toLowerCase().includes(text) ||
                (u.email || '').toLowerCase().includes(text) ||
                roleName.includes(text);
            const matchesRole = !selectedRole || u.role === selectedRole || u.role?._id === selectedRole;
            const matchesTutorRank = !filterTutorRank || u.tutorRank === filterTutorRank;
            return matchesText && matchesRole && matchesTutorRank;
        });
        if (sortBy) {
            result = [...result].sort((a,b) => {
                let av, bv;
                if (sortBy==='nickname') { av=a.nickname||''; bv=b.nickname||''; const cmp=av.localeCompare(bv); return sortDir==='asc'?cmp:-cmp; }
                if (sortBy==='email')    { av=a.email||'';    bv=b.email||'';    const cmp=av.localeCompare(bv); return sortDir==='asc'?cmp:-cmp; }
                if (sortBy==='date')     { av=new Date(a.createdAt); bv=new Date(b.createdAt); return sortDir==='asc'?av-bv:bv-av; }
                if (sortBy==='courses')  { av=a.courses?.length||0; bv=b.courses?.length||0; return sortDir==='asc'?av-bv:bv-av; }
                return 0;
            });
        }
        return result;
    })();

    const activeRoleLabel = selectedRole ? getRoleName(selectedRole) : '';

    const openModal = (user) => {
        setSelectedUser(user);
        setShowModal(true);
    };

    const handleEdit = (user) => {
        navigate(`/manage/user/${user._id}`);
    };

    const handleDelete = (user) => {
        showDelete('Delete User',
            `You are about to permanently delete user "${user.nickname}" (${user.email}). This cannot be undone.`,
            user.email, "Type the user's email to confirm",
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/users/${user._id}`, {
                        method: 'DELETE', headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' }
                    });
                    if (response.ok) { showInfo('Deleted', `User "${user.nickname}" has been deleted.`); setUsers(prev => prev.filter(u => u._id !== user._id)); }
                } catch (e) { showInfo('Error', 'Failed to delete user.'); }
            }
        );
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
    <AppLayout data={data} onLogout={onLogout} title="Users">
<div className="flex-grow-1 d-flex align-items-center justify-content-center" style={{ minHeight: 'calc(100vh - 56px)' }}>
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" style={{ width: '2.5rem', height: '2.5rem' }}></div>
                        <p className="text-muted small mb-0">Loading users…</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
    <AppLayout data={data} onLogout={onLogout} title="Users">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
                            <div>
                                <h1 className="h3 fw-bold text-dark mb-1">Users</h1>
                                <p className="text-muted mb-0 small">Manage all registered users</p>
                            </div>
                            <div className="d-flex align-items-center gap-2">
                                <button className="btn btn-success btn-sm" onClick={() => navigate('/manage/users/create')}>
                                    <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                    </svg>
                                    Add User
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
                                    {filteredUsers.length}{filteredUsers.length !== users.length ? ` / ${users.length}` : ''} {users.length === 1 ? 'user' : 'users'}
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
                                        placeholder="Search by nickname, email or role..."
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
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                >
                                    <option value="">All roles</option>
                                    {roles.map((r) => (
                                        <option key={r._id} value={r._id}>{r.roleName}</option>
                                    ))}
                                </select>
                            </div>
                                <div className="col-12 col-sm-4 col-md-2">
                                    <select className="form-select form-select-sm" value={filterTutorRank} onChange={e => setFilterTutorRank(e.target.value)}>
                                        <option value="">All ranks</option>
                                        {['assistant','teacher','lecturer','instructor','tutor','professor'].map(r => (
                                            <option key={r} value={r}>{r.charAt(0).toUpperCase()+r.slice(1)}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12 col-sm-4 col-md-2">
                                    <div className="input-group input-group-sm">
                                        <select className="form-select form-select-sm" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                            <option value="">Sort…</option>
                                            <option value="nickname">Nickname</option>
                                            <option value="email">Email</option>
                                            <option value="date">Joined</option>
                                            <option value="courses">Courses</option>
                                        </select>
                                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSortDir(d=>d==='asc'?'desc':'asc')}>{sortDir==='asc'?'↑':'↓'}</button>
                                    </div>
                                </div>
                        </div>

                        {(searchText || selectedRole) && (
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
                                {selectedRole && (
                                    <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                                        Role: {activeRoleLabel}
                                        <svg width="10" height="10" fill="currentColor" viewBox="0 0 16 16" style={{ cursor: 'pointer' }} onClick={() => setSelectedRole('')}>
                                            <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                                        </svg>
                                    </span>
                                )}
                                <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => { setSearchText(''); setSelectedRole(''); }}>
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
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Nickname</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Email</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3">Role</th>
                                    <th className="fw-semibold text-muted small text-uppercase py-3 text-end" style={{ width: '200px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.length > 0 ? (
                                    filteredUsers.map((u, index) => {
                                        const roleName = getRoleName(u.role);
                                        {
                                            // (u.role.roleName === 'dev') ? return(
                                            //     <tr key={index} className="align-middle">
                                            //         <td className="text-muted">{index + 1}</td>
                                            //         <td rowSpan={4}></td>
                                            //     </tr>
                                            // ) : 
                                            return (
                                                <tr key={index} className="align-middle">
                                                    <td className="text-muted">{index + 1}</td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            {(() => {
                                                                const avatarUrl = getProfilePictureUrl(u);
                                                                return avatarUrl ? (
                                                                    <AuthImage
                                                                        src={avatarUrl}
                                                                        alt={u.nickname}
                                                                        className="rounded-circle flex-shrink-0"
                                                                        style={{ width: '34px', height: '34px', objectFit: 'cover' }}
                                                                        fallback={
                                                                            <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                                                                style={{ width: '34px', height: '34px', fontSize: '0.8rem' }}>
                                                                                {u.nickname ? u.nickname.charAt(0).toUpperCase() : '?'}
                                                                            </div>
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white flex-shrink-0"
                                                                        style={{ width: '34px', height: '34px', fontSize: '0.8rem' }}>
                                                                        {u.nickname ? u.nickname.charAt(0).toUpperCase() : '?'}
                                                                    </div>
                                                                );
                                                            })()}
                                                            <span className="fw-semibold">{u.nickname || 'Unknown'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="text-muted">{u.email || '—'}</td>
                                                    <td>
                                                        <span className={`badge rounded-pill ${getAccessLevelBadgeColor(roleName)}`}>
                                                            {roleName.toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="text-end">
                                                        <div className="btn-group btn-group-sm" role="group">
                                                            <button type="button" className="btn btn-outline-primary" onClick={() => openModal(u)} title="View details">
                                                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                                                    <path d="M7.002 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM7.1 4.995a.905.905 0 1 0 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                                                                </svg>
                                                            </button>
                                                            <button type="button" className="btn btn-outline-warning" onClick={() => handleEdit(u)} title="Edit user">
                                                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                    <path d="M12.146.146a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1 0 .707l-10 10a.5.5 0 0 1-.203.134l-6 2a.5.5 0 0 1-.633-.633l2-6a.5.5 0 0 1 .134-.203l10-10zM11.207 1.5 13.5 3.793 14.793 2.5 12.5.207l-1.293 1.293zm1.386 1.386L9.3 0.207 10.5 1.407l2.293 2.293-0.207.207z" />
                                                                </svg>
                                                            </button>
                                                            <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(u)} title="Delete user">
                                                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                    <path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" />
                                                                    <path d="M5 0 4.5.5l-.5 1H2a1 1 0 0 0-1 1v1h12V2.5a1 1 0 0 0-1-1H10.5l-.5-1L9.5 0h-5zM3 14.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4H3v10.5zM4.5 3h7L11 2H5l-.5 1z" />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        }
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="5" className="text-center py-5">
                                            <div className="text-muted">
                                                <svg width="40" height="40" fill="currentColor" viewBox="0 0 16 16" className="mb-3 opacity-50">
                                                    <path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0z" />
                                                    <path fillRule="evenodd" d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8zm8-7a7 7 0 0 0-5.468 11.37C3.242 11.226 4.805 10 8 10s4.757 1.225 5.468 2.37A7 7 0 0 0 8 1z" />
                                                </svg>
                                                {users.length === 0 ? (
                                                    <>
                                                        <p className="mb-0 fw-semibold">No users found</p>
                                                        <small>The user list is empty</small>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="mb-0 fw-semibold">No matches</p>
                                                        <small>No users match your current search or filter</small>
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
                type="user"
                item={selectedUser}
                extraData={{ roles }}
                onClose={() => setShowModal(false)}
                onEdit={selectedUser ? () => navigate(`/manage/user/${selectedUser._id}`) : undefined}
                onDelete={selectedUser ? () => { setShowModal(false); handleDelete(selectedUser); } : undefined}
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

export default Users;
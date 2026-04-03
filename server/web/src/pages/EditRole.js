import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

function EditRole({ data, onLogout }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        roleName: '',
        accessLevel: {
            num: '',
            val: ''
        }
    });
    const [errors, setErrors] = useState({});
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal = () => setModal(p => ({ ...p, show: false }));
    const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });
    const isRoot = data?.role?.accessLevel === 'root' || data?.role?.roleName === 'root';

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (token) {
            const headers = {
                'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                'Content-Type': 'application/json'
            };

            const fetchRole = async () => {
                try {
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/roles/${id}`, {
                        method: 'GET',
                        headers
                    });
                    if (response.ok) {
                        const res = await response.json();
                        const role = res.data || res;
                        setFormData({
                            roleName: role.roleName || '',
                            accessLevel: role.accessLevel?.toString() || ''
                        });
                    } else {
                        showInfo('Error', 'Failed to fetch role details');
                        navigate('/manage/roles');
                    }
                } catch (error) {
                    console.error('Error fetching role:', error);
                    showInfo('Error', 'Error loading role details');
                    navigate('/manage/roles');
                } finally {
                    setLoading(false);
                }
            };

            fetchRole();
        }
    }, [id, navigate]);

    const handleAccessLevel = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error for this field
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.roleName.trim()) {
            newErrors.roleName = 'Role name is required';
        }

        if (!formData.accessLevel) {
            newErrors.accessLevel = 'Access level is required';
        } else if (!['user', 'create', 'quality', 'manage', 'admin'].includes(formData.accessLevel)) {
            newErrors.accessLevel = 'Please select a valid access level';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setSaving(true);

        try {
            const token = localStorage.getItem('token');
            const headers = {
                'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                'Content-Type': 'application/json'
            };

            const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/roles/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({
                    roleName: formData.roleName,
                    accessLevel: formData.accessLevel
                })
            });

            if (response.ok) {
                showInfo('Success', 'Role updated successfully!');
                navigate('/manage/roles');
            } else {
                const errorData = await response.json();
                showInfo('Error', `Failed to update role: ${errorData.message || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Error updating role:', error);
            showInfo('Error', 'Error updating role. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        showConfirm('Cancel', 'Are you sure you want to cancel? Any unsaved changes will be lost.', () => navigate('/manage/roles'));
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

    const getAccessLevelDescription = (level) => {
        switch (level) {
            case 'admin': return 'Administrator - Full system access';
            case 'manage': return 'Manager - High-level permissions';
            case 'quality': return 'Quality Control - Content creation and control access';
            case 'tutor': return 'Tutor - Create and manage sessions to teach students(users)';
            case 'create': return 'Create - Content creation access';
            case 'user': return 'User - Standard user permissions';
            default: return 'Not set';
        }
    };

    if (loading) {
        return (
    <AppLayout data={data} onLogout={onLogout} title="Edit Role">
<div className="flex-grow-1 d-flex align-items-center justify-content-center">
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted">Loading role details...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
    <AppLayout data={data} onLogout={onLogout} title="Edit Role">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                {/* Page Header */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="d-flex align-items-center gap-3 mb-2">
                            <button
                                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                onClick={() => navigate('/manage/roles')}
                            >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
                                </svg>
                                Back to Roles
                            </button>
                        </div>
                        <h1 className="h3 fw-bold text-dark mb-1">Edit Role</h1>
                        <p className="text-muted mb-0 small">Update role name and access level</p>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="row">
                    <div className="col-12 col-lg-8 col-xl-6">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <form onSubmit={handleSubmit}>
                                    {/* Role Icon Preview */}
                                    <div className="text-center mb-4">
                                        <div className={`rounded-circle ${getAccessLevelBadgeColor(formData.accessLevel)} d-flex align-items-center justify-content-center text-white mx-auto mb-2`}
                                            style={{ width: '80px', height: '80px', fontSize: '2rem' }}>
                                            {formData.roleName ? formData.roleName.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        {formData.accessLevel && (
                                            <span className={`badge rounded-pill ${getAccessLevelBadgeColor(formData.accessLevel)}`}>
                                                Level {formData.accessLevel}
                                            </span>
                                        )}
                                    </div>

                                    {/* Role Name Field */}
                                    <div className="mb-3">
                                        <label htmlFor="roleName" className="form-label fw-semibold">
                                            Role Name <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={`form-control ${errors.roleName ? 'is-invalid' : ''}`}
                                            id="roleName"
                                            name="roleName"
                                            value={formData.roleName}
                                            onChange={handleChange}
                                            placeholder="Enter role name"
                                        />
                                        {errors.roleName && (
                                            <div className="invalid-feedback">{errors.roleName}</div>
                                        )}
                                        <small className="text-muted">
                                            The display name for this role (e.g., Admin, Teacher, Student)
                                        </small>
                                    </div>

                                    {/* Access Level Field */}
                                    <div className="mb-4">
                                        <label htmlFor="accessLevel" className="form-label fw-semibold">
                                            Access Level <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className={`form-select ${errors.accessLevel ? 'is-invalid' : ''}`}
                                            id="accessLevel"
                                            name="accessLevel"
                                            value={formData.accessLevel}
                                            onChange={handleAccessLevel}
                                        >
                                            <option value="">Select an access level</option>
                                            <option value="user">User - Standard user permissions</option>
                                            <option value="create">Create - Content creation access</option>
                                            <option value="quality">Quality Control - Content creation and control access</option>
                                            <option value="manage">Manage - High-level permissions</option>
                                            <option value="admin">Admin - Full system access</option>
                                            {
                                                (isRoot || formData.accessLevel === 'root') ? <option value="root">Root - Full access</option> : null
                                            }

                                        </select>
                                        {errors.accessLevel && (
                                            <div className="invalid-feedback">{errors.accessLevel}</div>
                                        )}

                                        {/* Access Level Visual Indicator */}
                                        {formData.accessLevel && !errors.accessLevel && (
                                            <div className="mt-3">
                                                <small className="text-muted mt-2 d-block">
                                                    {getAccessLevelDescription(formData.accessLevel)}
                                                </small>
                                            </div>
                                        )}
                                    </div>

                                    {/* Form Actions */}
                                    <div className="d-flex gap-2 justify-content-end pt-3 border-top">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={handleCancel}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                            disabled={saving}
                                        >
                                            {saving ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                    Saving...
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                                        <path d="M2 1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H9.5a1 1 0 0 0-1 1v7.293l2.646-2.647a.5.5 0 0 1 .708.708l-3.5 3.5a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L7.5 9.293V2a2 2 0 0 1 2-2H14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h2.5a.5.5 0 0 1 0 1H2z" />
                                                    </svg>
                                                    Save Changes
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Help Card */}
                        <div className="card border-0 bg-light mt-3">
                            <div className="card-body p-3">
                                <h6 className="fw-semibold mb-2 small">
                                    <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                        <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533L8.93 6.588zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" />
                                    </svg>
                                    Access Level Guidelines
                                </h6>
                                <ul className="small text-muted mb-0 ps-3">
                                    <li><strong>User:</strong> Standard user permissions</li>
                                    <li><strong>Create:</strong> Content creation access</li>
                                    <li><strong>Quality(Quality Control):</strong> Content creation and control access</li>
                                    <li><strong>Manage:</strong> High-level permissions (manager)</li>
                                    <li><strong>Admin:</strong> Full system access (administrator)</li>
                                </ul>
                            </div>
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

export default EditRole;
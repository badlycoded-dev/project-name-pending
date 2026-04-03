import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

function CreateUser({ data, onLogout }) {
    const navigate = useNavigate();
    const [saving, setSaving] = useState(false);
    const [roles, setRoles] = useState([]);
    const [autoGeneratePassword, setAutoGeneratePassword] = useState(false);
    const [formData, setFormData] = useState({
        nickname: '',
        email: '',
        tutorRank: null,
        password: '',
        role: ''
    });
    const [errors, setErrors] = useState({});
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
    const showDelete  = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeModal, deleteLabel: 'Delete' });

    // Profile picture state
    const [profilePicture, setProfilePicture] = useState(null);
    const [profilePreview, setProfilePreview] = useState(null);

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (token) {
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
                        setRoles(res.data || res);
                    }
                } catch (error) {
                    console.error('Error fetching roles:', error);
                }
            };

            fetchRoles();
        }
    }, []);

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    };

    const handleAutoGenerateChange = (e) => {
        const isChecked = e.target.checked;
        setAutoGeneratePassword(isChecked);
        if (isChecked) {
            const newPassword = generatePassword();
            setFormData(prev => ({
                ...prev,
                password: newPassword
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                password: ''
            }));
        }
    };

    const handleChange = (e) => {
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

    const handleProfilePictureChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setErrors(prev => ({ ...prev, profilePicture: 'Please select an image file' }));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({ ...prev, profilePicture: 'Image must be less than 5MB' }));
                return;
            }
            setProfilePicture(file);
            setProfilePreview(URL.createObjectURL(file));
            setErrors(prev => ({ ...prev, profilePicture: '' }));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.nickname.trim()) {
            newErrors.nickname = 'Nickname is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        if (!formData.role) {
            newErrors.role = 'Role is required';
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

            // Step 1: Create user
            const response = await fetch(process.env.REACT_APP_API_URL + '/manage/users', {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    nickname: formData.nickname,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    tutorRank: formData.tutorRank || null
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                showInfo('Error', `Failed to create user: ${errorData.message || 'Unknown error'}`);
                setSaving(false);
                return;
            }

            const { data: userData } = await response.json();
            const userId = userData._id;

            // Step 2: Upload profile picture if provided
            if (profilePicture) {
                const profileFormData = new FormData();
                profileFormData.append('profilePicture', profilePicture);

                await fetch(`${process.env.REACT_APP_API_URL}/manage/users/${userId}/profile-picture`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`
                    },
                    body: profileFormData
                });
            }

            showInfo('Success', 'User created successfully!');
            navigate('/manage/users');
        } catch (error) {
            console.error('Error creating user:', error);
            showInfo('Error', 'Error creating user. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        showConfirm('Cancel', 'Are you sure you want to cancel? All entered data will be lost.', () => navigate('/manage/users'));
    };

    const getRoleName = (roleId) => {
        const found = roles.find((r) => r._id === roleId);
        return found ? found.roleName : roleId;
    };

    return (
    <AppLayout data={data} onLogout={onLogout} title="Create User">
<div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                {/* Page Header */}
                <div className="row mb-4">
                    <div className="col-12">
                        <div className="d-flex align-items-center gap-3 mb-2">
                            <button
                                className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                                onClick={() => navigate('/manage/users')}
                            >
                                <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                    <path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" />
                                </svg>
                                Back to Users
                            </button>
                        </div>
                        <h1 className="h3 fw-bold text-dark mb-1">Create User</h1>
                        <p className="text-muted mb-0 small">Add a new user to the system</p>
                    </div>
                </div>

                {/* Create Form */}
                <div className="row">
                    <div className="col-12 col-lg-8 col-xl-6">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <form onSubmit={handleSubmit}>
                                    {/* Profile Picture Preview */}
                                    <div className="text-center mb-4">
                                        {profilePreview ? (
                                            <img
                                                src={profilePreview}
                                                alt="Profile preview"
                                                className="rounded-circle mb-2"
                                                style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                            />
                                        ) : (
                                            <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white mx-auto mb-2"
                                                style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}>
                                                {formData.nickname ? formData.nickname.charAt(0).toUpperCase() : '?'}
                                            </div>
                                        )}

                                        {/* Button Logic: Show Upload button when no avatar, Show Change/Delete when avatar exists */}
                                        <div className="mb-2 d-flex justify-content-center gap-2">
                                            <input
                                                type="file"
                                                id="profilePicture"
                                                className="d-none"
                                                accept="image/*"
                                                onChange={handleProfilePictureChange}
                                            />

                                            {!profilePreview ? (
                                                // No avatar - show only Upload button
                                                <label htmlFor="profilePicture" className="btn btn-sm btn-primary">
                                                    <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                                        <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                                                        <path d="M7.646 1.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1-.708.708L8.5 2.707V11.5a.5.5 0 0 1-1 0V2.707L5.354 4.854a.5.5 0 1 1-.708-.708l3-3z" />
                                                    </svg>
                                                    Upload Photo
                                                </label>
                                            ) : (
                                                // Avatar exists - show Change and Delete buttons
                                                <>
                                                    <label htmlFor="profilePicture" className="btn btn-sm btn-warning">
                                                        <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                                            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.203.134l-6 2a.5.5 0 0 1-.633-.633l2-6a.5.5 0 0 1 .134-.203l10-10z" />
                                                        </svg>
                                                        Change Photo
                                                    </label>
                                                    <button
                                                        type="button"
                                                        className="btn btn-sm btn-danger"
                                                        onClick={() => {
                                                            setProfilePicture(null);
                                                            setProfilePreview(null);
                                                        }}
                                                    >
                                                        <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                                            <path d="M5.5 5.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5z" />
                                                            <path d="M5 0 4.5.5l-.5 1H2a1 1 0 0 0-1 1v1h12V2.5a1 1 0 0 0-1-1H10.5l-.5-1L9.5 0h-5zM3 14.5a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4H3v10.5zM4.5 3h7L11 2H5l-.5 1z" />
                                                        </svg>
                                                        Delete Photo
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                        {errors.profilePicture && (
                                            <small className="text-danger d-block">{errors.profilePicture}</small>
                                        )}
                                        <small className="text-muted">Optional profile picture (max 5MB)</small>
                                    </div>

                                    {/* Nickname Field */}
                                    <div className="mb-3">
                                        <label htmlFor="nickname" className="form-label fw-semibold">
                                            Nickname <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            className={`form-control ${errors.nickname ? 'is-invalid' : ''}`}
                                            id="nickname"
                                            name="nickname"
                                            value={formData.nickname}
                                            onChange={handleChange}
                                            placeholder="Enter nickname"
                                        />
                                        {errors.nickname && (
                                            <div className="invalid-feedback">{errors.nickname}</div>
                                        )}
                                    </div>

                                    {/* Email Field */}
                                    <div className="mb-3">
                                        <label htmlFor="email" className="form-label fw-semibold">
                                            Email <span className="text-danger">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            className={`form-control ${errors.email ? 'is-invalid' : ''}`}
                                            id="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleChange}
                                            placeholder="Enter email address"
                                        />
                                        {errors.email && (
                                            <div className="invalid-feedback">{errors.email}</div>
                                        )}
                                    </div>

                                    {/* Auto-Generate Password Checkbox */}
                                    <div className="mb-3">
                                        <div className="form-check">
                                            <input
                                                className="form-check-input"
                                                type="checkbox"
                                                id="autoGeneratePassword"
                                                checked={autoGeneratePassword}
                                                onChange={handleAutoGenerateChange}
                                            />
                                            <label className="form-check-label fw-semibold" htmlFor="autoGeneratePassword">
                                                Auto-generate secure password
                                            </label>
                                        </div>
                                        <small className="text-muted d-block mt-1">Generate a random 12-character password automatically</small>
                                    </div>

                                    {/* Password Field */}
                                    <div className="mb-3">
                                        <label htmlFor="password" className="form-label fw-semibold">
                                            Password <span className="text-danger">*</span>
                                        </label>
                                        {autoGeneratePassword ? (
                                            <div className="input-group">
                                                <input
                                                    type="text"
                                                    className="form-control bg-light"
                                                    value={formData.password}
                                                    readOnly
                                                />
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-secondary"
                                                    onClick={() => {
                                                        const newPassword = generatePassword();
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            password: newPassword
                                                        }));
                                                    }}
                                                >
                                                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                        <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2v1z" />
                                                        <path d="M8 4.5a.5.5 0 0 1 .5.5v2.5h2.5a.5.5 0 0 1 0 1H8.5V11a.5.5 0 0 1-1 0V8.5H5a.5.5 0 0 1 0-1h2.5V5a.5.5 0 0 1 .5-.5z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <input
                                                type="password"
                                                className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                                                id="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleChange}
                                                placeholder="Enter password"
                                            />
                                        )}
                                        {errors.password && (
                                            <div className="invalid-feedback d-block">{errors.password}</div>
                                        )}
                                        <small className="text-muted">{autoGeneratePassword ? 'Click refresh to generate a new password' : 'Minimum 6 characters'}</small>
                                    </div>

                                    {/* Role Field */}
                                    <div className="mb-4">
                                        <label htmlFor="role" className="form-label fw-semibold">
                                            Role <span className="text-danger">*</span>
                                        </label>
                                        <select
                                            className={`form-select ${errors.role ? 'is-invalid' : ''}`}
                                            id="role"
                                            name="role"
                                            value={formData.role}
                                            onChange={handleChange}
                                        >
                                            <option value="">Select a role</option>
                                            {roles.map((r) => (
                                                <option key={r._id} value={r._id}>
                                                    {r.accessLevel}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.role && (
                                            <div className="invalid-feedback">{errors.role}</div>
                                        )}
                                        {formData.role && (
                                            <small className="text-muted">
                                                Selected: <span className="fw-semibold">{getRoleName(formData.role)}</span>
                                            </small>
                                        )}
                                    </div>

                                        {/* Tutor Sub-Rank */}
                                        <div className="col-12 col-md-6">
                                            <label htmlFor="tutorRank" className="form-label fw-semibold">Tutor Sub-Rank</label>
                                            <select
                                                className="form-select"
                                                id="tutorRank"
                                                value={formData.tutorRank || ''}
                                                onChange={(e) => setFormData(prev => ({ ...prev, tutorRank: e.target.value || null }))}
                                            >
                                                <option value="">None (not a tutor)</option>
                                                {['assistant','teacher','lecturer','instructor','tutor','professor'].map(r => (
                                                    <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                                                ))}
                                            </select>
                                            <small className="text-muted">Only applies if user has tutor access level</small>
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
                                                    Creating...
                                                </>
                                            ) : (
                                                <>
                                                    <svg width="16" height="16" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                                        <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                                    </svg>
                                                    Create User
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
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

export default CreateUser;
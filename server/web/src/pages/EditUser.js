import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from '../components/Layout';
import AuthImage from "../components/AuthImage";
import { jwtDecode } from 'jwt-decode';
import { UtilityModal } from '../components/UtilityModal';


function EditUser({ data, onLogout }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [roles, setRoles] = useState([]);
    const [formData, setFormData] = useState({
        nickname: '',
        email: '',
        role: '',
        tutorRank: null,
        links: []
    });
    const [isCurrent, setIsCurrent] = useState(false)
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

    // Password reset state
    const [showPasswordSection, setShowPasswordSection] = useState(false);
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [autoGeneratePassword, setAutoGeneratePassword] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [currentPassword, setCurrentPassword] = useState('');
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');

        if (token) {
            const headers = {
                'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                'Content-Type': 'application/json'
            };

            const fetchUser = async () => {
                try {
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/users/${id}`, {
                        method: 'GET',
                        headers
                    });
                    if (response.ok) {
                        const res = await response.json();
                        const user = res.data || res;
                        setIsCurrent(data.role.roleName === 'root' || data._id === user._id)
                        setFormData({
                            nickname: user.nickname || '',
                            email: user.email || '',
                            role: user.role || '',
                            tutorRank: user.tutorRank || null,
                            links: user.links || []
                        });
                        try {
                            const { _ } = await jwtDecode(user.password)
                            setCurrentPassword(_ || '')
                        } catch {
                            setCurrentPassword('')
                        }
                    } else {
                        showInfo('Error', 'Failed to fetch user details');
                        navigate('/manage/users');
                    }
                } catch (error) {
                    console.error('Error fetching user:', error);
                    showInfo('Error', 'Error loading user details');
                    navigate('/manage/users');
                } finally {
                    setLoading(false);
                }
            };

            const fetchRoles = async () => {
                try {
                    const response = await fetch(process.env.REACT_APP_API_URL + '/manage/roles', {
                        method: 'GET',
                        headers
                    });
                    if (response.ok) {
                        const res = await response.json();
                        setRoles(res.data || res);
                    }
                } catch (error) {
                    console.error('Error fetching roles:', error);
                }
            };

            fetchUser();
            fetchRoles();
        }
    }, [id, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        setHasChanges(true);
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

        if (!formData.nickname.trim()) {
            newErrors.nickname = 'Nickname is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
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
                'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`
            };

            // Step 1: Update user data
            const updatePayload = {
                nickname: formData.nickname,
                email: formData.email,
                role: formData.role,
                tutorRank: formData.tutorRank || null
            };

            // Add password if being reset
            if (showPasswordSection && newPassword) {
                updatePayload.password = newPassword;
            }

            const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/users/${id}`, {
                method: 'PATCH',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatePayload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                showInfo('Error', `Failed to update user: ${errorData.message || 'Unknown error'}`);
                setSaving(false);
                return;
            }

            // Step 2: Upload profile picture if provided
            if (profilePicture) {
                const profileFormData = new FormData();
                profileFormData.append('profilePicture', profilePicture);

                const uploadResponse = await fetch(`${process.env.REACT_APP_API_URL}/manage/users/${id}/profile-picture`, {
                    method: 'PUT',
                    headers,
                    body: profileFormData
                });

                if (!uploadResponse.ok) {
                    const uploadData = await uploadResponse.json();
                    console.warn('Profile picture upload warning:', uploadData);
                }
            }

            showInfo('Success', 'User updated successfully!');
            setHasChanges(false);
            setProfilePicture(null);
            setProfilePreview(null);
            navigate('/manage/users');
        } catch (error) {
            console.error('Error updating user:', error);
            showInfo('Error', 'Error updating user. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        showConfirm('Cancel', 'Are you sure you want to cancel? Any unsaved changes will be lost.', () => navigate('/manage/users'));
    };

    const getRoleName = (roleId) => {
        const found = roles.find((r) => r._id === roleId);
        return found ? found.roleName : roleId;
    };

    // Helper to get the profile picture URL from links array
    const getProfilePictureUrl = () => {
        if (!formData.links || formData.links.length === 0) return null;

        // Find the first profile picture (type === 'image' and description matches)
        const profilePic = formData.links.find(link =>
            link.type === 'image' &&
            link.description &&
            link.description.toLowerCase() === 'profile picture' &&
            link.url
        );

        // If no profile picture found, use first image with a URL
        return profilePic ? profilePic.url : (formData.links[0]?.url || null);
    };

    const generatePassword = () => {
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
        let password = '';
        for (let i = 0; i < 16; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
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
            setHasChanges(true);
            setErrors(prev => ({ ...prev, profilePicture: '' }));
        }
    };

    const handleAutoGeneratePasswordChange = (e) => {
        const isChecked = e.target.checked;
        setAutoGeneratePassword(isChecked);
        if (isChecked) {
            setNewPassword(generatePassword());
        } else {
            setNewPassword('');
        }
    };

    if (loading) {
        return (
    <AppLayout data={data} onLogout={onLogout} title="Edit User">
<div className="flex-grow-1 d-flex align-items-center justify-content-center">
                    <div className="text-center">
                        <div className="spinner-border text-primary mb-3" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="text-muted">Loading user details...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
    <AppLayout data={data} onLogout={onLogout} title="Edit User">
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
                        <h1 className="h3 fw-bold text-dark mb-1">Edit User</h1>
                        <p className="text-muted mb-0 small">Update user information and role assignment</p>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="row">
                    <div className="col-12 col-lg-8 col-xl-6">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                {/* Change Detection Alert */}
                                {hasChanges && (
                                    <div className="alert alert-warning alert-dismissible fade show mb-4" role="alert">
                                        <svg width="16" height="16" fill="currentColor" className="me-2" viewBox="0 0 16 16">
                                            <path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0l-5.708 9.7a1.13 1.13 0 0 0 .98 1.734h11.396a1.13 1.13 0 0 0 .98-1.734l-5.708-9.7z" />
                                            <path d="m8 4a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 3a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 7z" />
                                        </svg>
                                        <strong>Unsaved Changes!</strong> Your changes won't be applied until you save them.
                                        <button type="button" className="btn-close" onClick={() => setHasChanges(false)} aria-label="Close"></button>
                                    </div>
                                )}

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
                                        ) : (() => {
                                            const existingUrl = getProfilePictureUrl();
                                            return existingUrl ? (
                                                <AuthImage
                                                    src={existingUrl}
                                                    alt="Current profile picture"
                                                    className="rounded-circle mb-2"
                                                    style={{ width: '100px', height: '100px', objectFit: 'cover' }}
                                                    fallback={
                                                        <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white mx-auto mb-2"
                                                            style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}>
                                                            {formData.nickname ? formData.nickname.charAt(0).toUpperCase() : '?'}
                                                        </div>
                                                    }
                                                />
                                            ) : (
                                                <div className="rounded-circle bg-primary d-flex align-items-center justify-content-center text-white mx-auto mb-2"
                                                    style={{ width: '100px', height: '100px', fontSize: '2.5rem' }}>
                                                    {formData.nickname ? formData.nickname.charAt(0).toUpperCase() : '?'}
                                                </div>
                                            );
                                        })()}

                                        {/* Button Logic: Show Upload button when no avatar, Show Change/Delete when avatar exists */}
                                        <div className="mb-2 d-flex justify-content-center gap-2">
                                            <input
                                                type="file"
                                                id="profilePicture"
                                                className="d-none"
                                                accept="image/*"
                                                onChange={handleProfilePictureChange}
                                                disabled={!isCurrent}
                                            />

                                            {!profilePreview && !getProfilePictureUrl() ? (
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
                                                        onClick={() => showConfirm('Delete Profile Picture', 'Are you sure you want to delete this profile picture?', async () => {
                                                            try {
                                                                const token = localStorage.getItem('token');
                                                                const headers = {
                                                                    'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`
                                                                };
                                                                const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/users/${id}/profile-picture`, {
                                                                    method: 'DELETE',
                                                                    headers
                                                                });
                                                                if (response.ok) {
                                                                    setProfilePicture(null);
                                                                    setProfilePreview(null);
                                                                    setFormData(prev => ({ ...prev, links: [] }));
                                                                    setHasChanges(false);
                                                                    showInfo('Success', 'Profile picture deleted successfully');
                                                                } else {
                                                                    const errorData = await response.json();
                                                                    showInfo('Error', `Failed to delete profile picture: ${errorData.message || 'Unknown error'}`);
                                                                }
                                                            } catch (error) {
                                                                console.error('Error deleting profile picture:', error);
                                                                showInfo('Error', 'Error deleting profile picture. Please try again.');
                                                            }
                                                        }, true)}
                                                        disabled={!isCurrent}
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
                                            <small className="text-danger">{errors.profilePicture}</small>
                                        )}
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
                                            disabled={!isCurrent}
                                        />
                                        {errors.nickname && (
                                            <div className="invalid-feedback">{errors.nickname}</div>
                                        )}
                                    </div>

                                    {/* Role Field */}
                                    <div className="mb-3">
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
                                                Selected: <span className="fw-semibold">{([].includes(getRoleName(formData.role)))?'':''}</span>
                                            </small>
                                        )}
                                    </div>

                                    {/* Tutor Sub-Rank */}
                                    <div className="col-12 col-md-6">
                                        <label className="form-label fw-semibold">Tutor Sub-Rank</label>
                                        <select
                                            className="form-select"
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
                                            disabled={!isCurrent}
                                        />
                                        {errors.email && (
                                            <div className="invalid-feedback">{errors.email}</div>
                                        )}
                                    </div>

                                    {/* Password Reset Section */}
                                    <div className="mb-4">
                                        <div className="card border-0 bg-white">
                                            <div className={`card-header bg-transparent border ${showPasswordSection ? '' : 'rounded'}`}>
                                                <button
                                                    type="button"
                                                    className="btn btn-link text-decoration-none text-start w-100 p-0 fw-semibold"
                                                    onClick={() => setShowPasswordSection(!showPasswordSection)}
                                                    disabled={!isCurrent}
                                                >
                                                    <svg width="16" height="16" fill="currentColor" className="me-2" viewBox="0 0 16 16">
                                                        <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z" />
                                                    </svg>
                                                    {showPasswordSection ? 'Hide' : 'Show'} Password Settings
                                                </button>
                                            </div>
                                            {showPasswordSection && (
                                                <div className="card-body pt-3 border border-top-0 rounded-bottom">

                                                    {/* Current Password Field */}
                                                    <div className="mb-3">
                                                        <label htmlFor="currentPassword" className="form-label fw-semibold">
                                                            Current Password
                                                        </label>
                                                        <div className="input-group">
                                                            <input
                                                                type={showCurrentPassword ? "text" : "password"}
                                                                className="form-control bg-light"
                                                                id="currentPassword"
                                                                value={currentPassword}
                                                                disabled
                                                            />
                                                            <button
                                                                type="button"
                                                                className="btn btn-outline-secondary"
                                                                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                                                title={showCurrentPassword ? "Hide password" : "Reveal password"}
                                                            >
                                                                {showCurrentPassword ? (
                                                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                                        <path d="m10.79 12.912-1.614-1.615a3.5 3.5 0 1 0-4.474-4.474l-2.06-2.06C.938 6.278 0 8 0 8s3 5.5 8 5.5a7 7 0 0 0 2.79-.588zM5.21 2.088A7 7 0 0 1 8 2.5c5 0 8-5.5 8-5.5s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l2.06 2.06a3.5 3.5 0 0 1 4.474 4.474L5.21 2.089z" />
                                                                        <path d="M5.525 7.646a2.5 2.5 0 1 1 3.536 3.536 2.5 2.5 0 0 1-3.536-3.536Zm6-6a6 6 0 0 1 .708 11.97l1.5 1.5A7 7 0 0 0 15 8s-3-5.5-8-5.5a6.98 6.98 0 0 0-1.293.12l1.508 1.508z" />
                                                                    </svg>
                                                                ) : (
                                                                    <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                                                                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8a13 13 0 0 1-1.66 2.043C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
                                                                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </div>
                                                        <small className="text-muted">Protected - use password reset below to change</small>
                                                    </div>

                                                    <div className="form-check mb-3">
                                                        <input
                                                            className="form-check-input"
                                                            type="checkbox"
                                                            id="autoGenerateNewPassword"
                                                            checked={autoGeneratePassword}
                                                            onChange={handleAutoGeneratePasswordChange}
                                                            disabled={!isCurrent}
                                                        />
                                                        <label className="form-check-label fw-semibold" htmlFor="autoGenerateNewPassword">
                                                            Auto-generate new password
                                                        </label>
                                                    </div>

                                                    <div className="mb-3">
                                                        <label htmlFor="newPassword" className="form-label fw-semibold">
                                                            New Password <span className="text-danger">*</span>
                                                        </label>
                                                        {autoGeneratePassword ? (
                                                            <div className="input-group">
                                                                <input
                                                                    type="text"
                                                                    className="form-control bg-light"
                                                                    value={newPassword}
                                                                    readOnly
                                                                />
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-outline-secondary"
                                                                    onClick={() => setNewPassword(generatePassword())}
                                                                    disabled={!isCurrent}
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
                                                                className="form-control"
                                                                id="newPassword"
                                                                value={newPassword}
                                                                onChange={(e) => {
                                                                    setNewPassword(e.target.value);
                                                                    setHasChanges(true);
                                                                }}
                                                                placeholder="Enter new password"
                                                                disabled={!isCurrent}
                                                            />
                                                        )}
                                                        <small className="text-muted">{autoGeneratePassword ? 'Click refresh to generate a new password' : 'Minimum 6 characters'}</small>
                                                    </div>

                                                    <div className="d-grid gap-2">
                                                        <button
                                                            type="button"
                                                            className="btn btn-warning"
                                                            onClick={() => {
                                                                if (!newPassword) {
                                                                    showInfo('Validation', 'Please enter or generate a new password');
                                                                    return;
                                                                }
                                                                setHasChanges(true);
                                                            }}
                                                            disabled={!isCurrent}
                                                        >
                                                            <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                                                <path d="M5.338 1.59a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.045.1.028.2.11.255l.212.212a.5.5 0 0 0 .334.157 61 61 0 0 0 2.928.16.5.5 0 0 0 .314-.154l.216-.216c.11-.11.252-.126.355-.079.1.046.172.146.172.276v1.803a.5.5 0 0 0 .828.372l2.35-1.758a.5.5 0 0 0 0-.792L9.172.428A.5.5 0 0 0 8.5.9v1.803c0 .13-.072.23-.172.276-.103.048-.244.031-.355-.079l-.216-.216a.5.5 0 0 0-.314-.154 61 61 0 0 0-2.928.16.5.5 0 0 0-.334.157l-.212.212c-.083.054-.156.046-.11-.255a61 61 0 0 0 2.837-.856.48.48 0 0 0 .328-.39c.045-.1-.028-.2-.11-.255l-.212-.212a.5.5 0 0 0-.334-.157 61 61 0 0 0-2.928-.16.5.5 0 0 0-.314.154l-.216.216c-.11.11-.252.126-.355.079-.1-.046-.172-.146-.172-.276V6.5a.5.5 0 0 0-.828-.372l-2.35 1.758a.5.5 0 0 0 0 .792l2.35 1.758a.5.5 0 0 0 .828-.372V9.3c0-.13.072-.23.172-.276.103-.048.244-.031.355.079l.216.216a.5.5 0 0 0 .314.154 61 61 0 0 0 2.928-.16.5.5 0 0 0 .334-.157l.212-.212c.083-.054.156-.046.11.255a61 61 0 0 0-2.837.856.48.48 0 0 0-.328.39c-.045.1.028.2.11.255l.212.212a.5.5 0 0 0 .334.157 61 61 0 0 0 2.928.16.5.5 0 0 0 .314-.154l.216-.216c.11-.11.252-.126.355-.079.1.046.172.146.172.276v1.803a.5.5 0 0 0 .828.372l2.35-1.758a.5.5 0 0 0 0-.792l-2.35-1.758a.5.5 0 0 0-.828.372v1.803c0 .13-.072.23-.172.276-.103.047-.244.03-.355-.08l-.216-.215a.5.5 0 0 0-.314-.154 61 61 0 0 0-2.928.16.5.5 0 0 0-.334-.157l-.212-.212c-.083-.054-.156-.046-.11.255a61 61 0 0 0 2.837.856.48.48 0 0 0 .328.39c.045.1-.028.2-.11.255l-.212.212a.5.5 0 0 0-.334.157 61 61 0 0 0-2.928-.16.5.5 0 0 0-.314.154l-.216.216c-.11.11-.252.126-.355.079-.1-.047-.172-.147-.172-.277V3.5a.5.5 0 0 0-.828-.372l-2.35 1.758a.5.5 0 0 0 0 .792l2.35 1.758a.5.5 0 0 0 .828-.372V3.3c0-.13.072-.23.172-.276.103-.048.244-.031.355.079l.216.216a.5.5 0 0 0 .314.154 61 61 0 0 0 2.928-.16.5.5 0 0 0 .334-.157l.212-.212c.083-.054.156-.046.11.255a61 61 0 0 0-2.837-.856.48.48 0 0 0-.328-.39zm-7.141 2.267a.5.5 0 0 1 .431.866c-.1.168-.19.339-.273.514a.5.5 0 1 1-.906-.329c.09-.188.186-.371.29-.55a.5.5 0 0 1 .458-.501z" />
                                                            </svg>
                                                            Change Password
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
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
                                    Tips
                                </h6>
                                <ul className="small text-muted mb-0 ps-3">
                                    <li>All fields marked with <span className="text-danger">*</span> are required</li>
                                    <li>Email must be a valid email address format</li>
                                    <li>Changing the role will affect user permissions</li>
                                    <li>Use the Password Reset section to reset a user's password</li>
                                    <li>Profile picture can be changed by clicking the Change Photo button</li>
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

        </AppLayout>

    );
}

export default EditUser;
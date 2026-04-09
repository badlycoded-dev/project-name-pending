import React, { useState, useContext } from 'react';
import config from '../config/config';
import { useNavigate } from 'react-router-dom';
import { SettingsContext } from '../contexts/SettingsContext';
import { getUser } from '../utils/auth';
import { UtilityModal } from './UtilityModal';

const API_URL = config.API_URL;

export default function AddCourseForm() {
    const { t } = useContext(SettingsContext);
    const navigate = useNavigate();

    const [saving, setSaving] = useState(false);
    const [skillInput, setSkillInput] = useState('');
    const [errors, setErrors] = useState({});

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        skills: [],
        direction: 'Programming',
        level: 'Junior',
        price: '',
        courseType: 'SELF_TAUGHT',
        base_lang: 'en'
    });

    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [contentFiles, setContentFiles] = useState([]);
    const [modal, setModal] = useState({ show: false, title: '', message: '', onClose: null });

    const showModal = (title, message, onClose = null) => setModal({ show: true, title, message, onClose });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                setErrors(prev => ({ ...prev, thumbnail: t('addCourseForm.alertSelectImage') }));
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                setErrors(prev => ({ ...prev, thumbnail: t('addCourseForm.alertImageSize') }));
                return;
            }
            setThumbnailFile(file);
            setThumbnailPreview(URL.createObjectURL(file));
            setErrors(prev => ({ ...prev, thumbnail: '' }));
        }
    };

    const ALLOWED_MIME_TYPES = [
        // Images
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        // Documents
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/json', 'text/plain',
        // Videos
        'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-mpeg',
        // Audio
        'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac',
        'audio/flac', 'audio/x-m4a', 'audio/webm',
        // Archives
        'application/zip', 'application/x-zip-compressed',
        'application/x-rar-compressed', 'application/x-7z-compressed'
    ];

    const handleContentFilesChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];
        const invalidFiles = [];

        files.forEach(file => {
            if (file.size > 50 * 1024 * 1024) {
                invalidFiles.push(`${file.name} (exceeds 50MB limit)`);
            } else if (!ALLOWED_MIME_TYPES.includes(file.type)) {
                invalidFiles.push(`${file.name} (${file.type || 'unknown type'} not supported)`);
            } else {
                validFiles.push(file);
            }
        });

        if (invalidFiles.length > 0) {
            setErrors(prev => ({
                ...prev,
                contentFiles: `Invalid files: ${invalidFiles.join(', ')}. Allowed: images, documents, videos, audio, archives.`
            }));
        } else {
            setErrors(prev => ({ ...prev, contentFiles: '' }));
        }

        setContentFiles(prev => [...prev, ...validFiles]);
    };

    const removeContentFile = (index) => {
        setContentFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleAddSkill = () => {
        const trimmedSkill = skillInput.trim();
        if (trimmedSkill && !formData.skills.includes(trimmedSkill)) {
            setFormData(prev => ({ ...prev, skills: [...prev.skills, trimmedSkill] }));
            setSkillInput('');
        }
    };

    const handleRemoveSkill = (skillToRemove) => {
        setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skillToRemove) }));
    };

    const handleSkillInputKeyPress = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.title.trim()) newErrors.title = t('addCourseForm.alertTitleReq');
        if (formData.price && isNaN(parseFloat(formData.price))) newErrors.price = t('addCourseForm.alertPriceInvalid');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const getAuthHeader = () => {
        const token = localStorage.getItem('token');
        return token ? (token.startsWith('Bearer ') ? token : `Bearer ${token}`) : '';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);

        try {
            const authHeader = getAuthHeader();
            const currentUser = getUser();
            const userId = currentUser?._id || currentUser?.id;

            if (!userId) {
                showModal('Error', t('addCourseForm.alertAuthRequired') || 'You must be logged in to create a course');
                setSaving(false);
                return;
            }

            // КОНТРАКТ: POST /courses — create+
            // title/description/skills ОБЯЗАТЕЛЬНО внутри trans[]
            const payload = {
                userId: userId,
                status: "editing",
                direction: formData.direction,
                level: formData.level,
                price: formData.price ? parseFloat(formData.price) : 0,
                base_lang: formData.base_lang,
                courseType: formData.courseType,
                trans: [
                    {
                        title: formData.title,
                        description: formData.description,
                        skills: formData.skills
                    }
                ]
            };

            const response = await fetch(`${API_URL}/courses`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                showModal('Error', `${t('addCourseForm.alertCreateFailed')} ${errorData.message || 'Unknown error'}`);
                setSaving(false);
                return;
            }

            const { data: courseData } = await response.json();
            const courseId = courseData._id || courseData.id;

            // КОНТРАКТ: POST /courses/:id/files?thumbnail=true — create+
            if (thumbnailFile && courseId) {
                const thumbnailFormData = new FormData();
                thumbnailFormData.append('file', thumbnailFile);
                const thumbnailRes = await fetch(`${API_URL}/courses/${courseId}/files?thumbnail=true`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader },
                    body: thumbnailFormData
                });
                if (!thumbnailRes.ok) {
                    const errData = await thumbnailRes.json().catch(() => ({}));
                    console.warn('Thumbnail upload error:', errData);
                }
            }

            // КОНТРАКТ: POST /courses/:id/files/multiple — create+
            if (contentFiles.length > 0 && courseId) {
                const contentFormData = new FormData();
                contentFiles.forEach(file => contentFormData.append('files', file));
                
                const filesRes = await fetch(`${API_URL}/courses/${courseId}/files/multiple?lang=${formData.base_lang}`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader },
                    body: contentFormData
                });
                
                if (!filesRes.ok) {
                    const contentType = filesRes.headers.get('content-type');
                    let errData = {};
                    if (contentType && contentType.includes('application/json')) {
                        errData = await filesRes.json();
                    } else {
                        const text = await filesRes.text();
                        console.error('Content files upload response:', text);
                    }
                    console.error('Content files upload error (status ' + filesRes.status + '):', errData);
                    showModal('Upload Error', `File upload failed: ${errData.message || filesRes.statusText}`);
                }
            }

            showModal('✓ Success', t('addCourseForm.alertCreateSuccess'), () => navigate('/account'));
        } catch (error) {
            console.error('Error creating course:', error);
            showModal('Error', t('addCourseForm.alertCreateError'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
        <form onSubmit={handleSubmit}>
            {/* Обложка курса */}
            <div className="text-center mb-4">
                {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="Thumbnail preview" className="rounded mb-3 shadow-sm"
                        style={{ width: '200px', height: '120px', objectFit: 'cover' }} />
                ) : (
                    <div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary mx-auto mb-3"
                        style={{ width: '200px', height: '120px' }}>
                        <i className="bi bi-image fs-1"></i>
                    </div>
                )}

                <div className="mb-2 d-flex justify-content-center gap-2">
                    <input type="file" id="thumbnail" className="d-none" accept="image/*" onChange={handleThumbnailChange} />
                    {!thumbnailPreview ? (
                        <label htmlFor="thumbnail" className="btn btn-sm btn-primary">
                            <i className="bi bi-upload me-2"></i> {t('addCourseForm.uploadCover')}
                        </label>
                    ) : (
                        <>
                            <label htmlFor="thumbnail" className="btn btn-sm btn-warning">
                                <i className="bi bi-pencil me-1"></i> {t('addCourseForm.changeCover')}
                            </label>
                            <button type="button" className="btn btn-sm btn-danger"
                                onClick={() => { setThumbnailFile(null); setThumbnailPreview(null); }}>
                                <i className="bi bi-trash me-1"></i> {t('addCourseForm.removeCover')}
                            </button>
                        </>
                    )}
                </div>
                {errors.thumbnail && <small className="text-danger d-block">{errors.thumbnail}</small>}
            </div>

            <div className="row g-3">
                {/* Название */}
                <div className="col-12">
                    <label className="form-label fw-semibold">{t('addCourseForm.courseTitle')} <span className="text-danger">*</span></label>
                    <input type="text" className={`form-control ${errors.title ? 'is-invalid' : ''}`}
                        name="title" value={formData.title} onChange={handleChange} />
                    {errors.title && <div className="invalid-feedback">{errors.title}</div>}
                </div>

                {/* Описание */}
                <div className="col-12">
                    <label className="form-label fw-semibold">{t('addCourseForm.description')}</label>
                    <textarea className="form-control" name="description"
                        value={formData.description} onChange={handleChange} rows="4" />
                </div>

                {/* Направление */}
                <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold">{t('addCourseForm.direction')} <span className="text-danger">*</span></label>
                    <select className="form-select" name="direction" value={formData.direction} onChange={handleChange}>
                        <option value="Programming">{t('directions.programming')}</option>
                        <option value="Game Dev">{t('directions.gameDev')}</option>
                        <option value="Data Science">{t('directions.dataSciense')}</option>
                        <option value="Design">{t('directions.design')}</option>
                    </select>
                </div>

                {/* Уровень */}
                <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold">{t('addCourseForm.level')} <span className="text-danger">*</span></label>
                    <select className="form-select" name="level" value={formData.level} onChange={handleChange}>
                        <option value="Junior">{t('levels.junior')}</option>
                        <option value="Middle">{t('levels.middle')}</option>
                        <option value="Senior">{t('levels.senior')}</option>
                        <option value="Guru">{t('levels.guru')}</option>
                    </select>
                </div>

                {/* Цена */}
                <div className="col-12 col-md-4">
                    <label className="form-label fw-semibold">{t('addCourseForm.price')}</label>
                    <div className="input-group">
                        <span className="input-group-text">$</span>
                        <input type="number" className={`form-control ${errors.price ? 'is-invalid' : ''}`}
                            name="price" value={formData.price} onChange={handleChange} min="0" />
                    </div>
                </div>

                {/* Skills */}
                <div className="col-12">
                    <label className="form-label fw-semibold">{t('addCourseForm.skills')}</label>
                    <div className="input-group mb-2">
                        <input type="text" className="form-control" value={skillInput}
                            onChange={(e) => setSkillInput(e.target.value)} onKeyPress={handleSkillInputKeyPress}
                            placeholder={t('addCourseForm.skillsPlaceholder')} />
                        <button className="btn btn-outline-primary" type="button" onClick={handleAddSkill}>
                            <i className="bi bi-plus-lg"></i>
                        </button>
                    </div>
                    {formData.skills.length > 0 && (
                        <div className="d-flex flex-wrap gap-2">
                            {formData.skills.map((skill, idx) => (
                                <span key={idx} className="badge bg-primary d-flex align-items-center p-2">
                                    {skill}
                                    <i className="bi bi-x-lg ms-2" style={{ cursor: 'pointer' }} onClick={() => handleRemoveSkill(skill)}></i>
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Файлы */}
                <div className="col-12 mt-4">
                    <label className="form-label fw-semibold">{t('addCourseForm.courseMaterials')}</label>
                    <div className="border rounded p-3 bg-light">
                        <input type="file" id="contentFiles" className="d-none" multiple onChange={handleContentFilesChange} />
                        <label htmlFor="contentFiles" className="btn btn-outline-primary mb-3">
                            <i className="bi bi-upload me-2"></i> {t('addCourseForm.uploadMaterials')}
                        </label>
                        {errors.contentFiles && <div className="alert alert-danger small mb-3">{errors.contentFiles}</div>}
                        {contentFiles.length > 0 && (
                            <ul className="list-group">
                                {contentFiles.map((file, idx) => (
                                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                                        <span className="text-truncate" style={{ maxWidth: '80%' }}>{file.name}</span>
                                        <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeContentFile(idx)}>
                                            <i className="bi bi-x-lg"></i>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </div>

            <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                <button type="button" className="btn btn-outline-secondary" onClick={() => navigate(-1)} disabled={saving}>
                    {t('addCourseForm.cancel')}
                </button>
                <button type="submit" className="btn btn-success" disabled={saving}>
                    {saving ? (
                        <><span className="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>{t('addCourseForm.saving')}</>
                    ) : t('addCourseForm.createCourse')}
                </button>
            </div>
        </form>
        <UtilityModal
            show={modal.show}
            type="info"
            title={modal.title}
            message={modal.message}
            onClose={() => { setModal({ show: false, title: '', message: '', onClose: null }); modal.onClose?.(); }}
        />
        </>
    );
}
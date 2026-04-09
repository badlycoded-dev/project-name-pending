import { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../../components/NavBar"; 
import AuthImage from "../../components/AuthImage";
import { SettingsContext } from '../../contexts/SettingsContext';
import config from '../../config/config';
import { UtilityModal } from '../../components/UtilityModal';

const API_URL = config.API_URL;
const BASE_URL = API_URL.replace('/api', '');

function EditCoursePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useContext(SettingsContext);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [users, setUsers] = useState([]);
    const [directions, setDirections] = useState([]);
    const [levels, setLevels] = useState([]);
    const [formData, setFormData] = useState({
        userId: '',
        status: '',
        title: '',
        description: '',
        skills: [],
        direction: '',
        level: '',
        price: '',
        links: []
    });
    const [skillInput, setSkillInput] = useState('');
    const [errors, setErrors] = useState({});

    const [thumbnail, setThumbnail] = useState(null);
    const [thumbnailPreview, setThumbnailPreview] = useState(null);
    const [courseFiles, setCourseFiles] = useState([]);
    const [courseFilesPreview, setCourseFilesPreview] = useState([]);
    const [existingFiles, setExistingFiles] = useState([]); 
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [fileTypeFilter, setFileTypeFilter] = useState('all');
    const [deleteFileTarget, setDeleteFileTarget] = useState(null); // { fileIndex, name }
    const [modal, setModal] = useState({ show: false, title: '', message: '', onClose: null });

    const token = localStorage.getItem('token');
    const authHeader = `Bearer ${token}`; 

    const isSystemTextFile = (filename) => {
        return /^vol-\d+-ch-\d+-item-\d+-\d+\.txt$/i.test(filename);
    };

    useEffect(() => {
        if (token) {
            const headers = {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            };

            const fetchData = async () => {
                try {
                    const [courseRes, usersRes, directionsRes, levelsRes, filesRes] = await Promise.all([
                        fetch(`${API_URL}/manage/courses/${id}`, { method: 'GET', headers }),
                        fetch(`${API_URL}/manage/users`, { method: 'GET', headers }),
                        fetch(`${API_URL}/directions`, { method: 'GET', headers }),
                        fetch(`${API_URL}/levels`, { method: 'GET', headers }),
                        fetch(`${API_URL}/manage/courses/${id}/files`, { method: 'GET', headers })
                    ]);

                    let course = {};
                    if (courseRes.ok) {
                        try {
                            const res = await courseRes.json();
                            course = res.data || res;
                            setFormData({
                                userId: course.userId || '',
                                status: course.status || '',
                                // trans: [{
                                //     title: formData.title || '',
                                //     description: formData.description || '',
                                //     skills: formData.skills || [],
                                // }],
                                title: course.trans[0].title || '',
                                description: course.trans[0].description || '',
                                skills: course.trans[0].skills || [],
                                direction: course.direction || '',
                                level: course.level || '',
                                price: course.price?.toString() || '',
                                links: course.links || []
                            });
                        } catch (jsonErr) {
                            console.error('Failed to parse course response:', jsonErr);
                        }
                    }

                    if (usersRes.ok) {
                        try {
                            const res = await usersRes.json();
                            setUsers(res.data || res);
                        } catch (jsonErr) {
                            console.warn('Failed to parse users response:', jsonErr);
                        }
                    }
                    if (directionsRes.ok) {
                        try {
                            const res = await directionsRes.json();
                            if (Array.isArray(res.data)) setDirections(res.data);
                        } catch (jsonErr) {
                            console.warn('Failed to parse directions response:', jsonErr);
                        }
                    }
                    if (levelsRes.ok) {
                        try {
                            const res = await levelsRes.json();
                            if (Array.isArray(res.data)) setLevels(res.data);
                        } catch (jsonErr) {
                            console.warn('Failed to parse levels response:', jsonErr);
                        }
                    }

                    let fetchedFiles = [];
                    if (filesRes.ok) {
                        try {
                            const res = await filesRes.json();
                            const allFiles = Array.isArray(res.data) ? res.data : (Array.isArray(res.files) ? res.files : (res.data?.files || []));
                            
                            fetchedFiles = allFiles.filter((file) => {
                                const fileName = (file.originalName || file.filename || '').toLowerCase();
                                const isThumbnail = fileName.includes('thumbnail') || 
                                                  (fileName.endsWith('.png') && allFiles.indexOf(file) === 0 && file.mimetype?.startsWith('image/'));
                                const isSystemText = isSystemTextFile(file.originalName || file.filename || '');
                                return !isThumbnail && !isSystemText;
                            });
                        } catch (jsonErr) {
                            console.warn('Failed to parse files response:', jsonErr);
                        }
                    }

                    if (fetchedFiles.length === 0 && course.links && course.links.length > 1) {
                        fetchedFiles = course.links.slice(1).map(link => ({
                            originalName: link.filename || link.url.split('/').pop(),
                            filename: link.filename || link.url.split('/').pop(),
                            url: link.url,
                            mimetype: link.type === 'video' ? 'video/mp4' : (link.type === 'image' ? 'image/jpeg' : 'application/pdf'),
                            size: null
                        }));
                    }
                    
                    setExistingFiles(fetchedFiles);

                } catch (error) {
                    console.error('Error fetching data:', error);
                } finally {
                    setLoading(false);
                    setLoadingFiles(false);
                }
            };

            fetchData();
        }
    }, [id, navigate, token]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
    };

    const handleAddSkill = () => {
        const trimmedSkill = skillInput.trim();
        if (trimmedSkill && !formData.skills.includes(trimmedSkill)) {
            setFormData(prev => ({ ...prev, skills: [...prev.skills, trimmedSkill] }));
            setSkillInput('');
        }
    };

    const handleRemoveSkill = (skillToRemove) => {
        setFormData(prev => ({ ...prev, skills: prev.skills.filter(skill => skill !== skillToRemove) }));
    };

    const handleSkillInputKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddSkill();
        }
    };

    const handleThumbnailChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) return;
            setThumbnail(file);
            setThumbnailPreview(URL.createObjectURL(file));
        }
    };

    const handleCourseFilesChange = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = files.filter(f => f.size <= 512 * 1024 * 1024);
        setCourseFiles(prev => [...prev, ...validFiles]);
        setCourseFilesPreview(prev => [...prev, ...validFiles.map(f => ({ name: f.name, size: (f.size / (1024 * 1024)).toFixed(2) }))]);
    };

    const removeCourseFile = (index) => {
        setCourseFiles(prev => prev.filter((_, i) => i !== index));
        setCourseFilesPreview(prev => prev.filter((_, i) => i !== index));
    };

    const deleteExistingFile = (fileIndex) => {
        const file = existingFiles[fileIndex];
        setDeleteFileTarget({ fileIndex, name: file.originalName || file.filename });
    };

    const confirmDeleteFile = async () => {
        if (!deleteFileTarget) return;
        const { fileIndex } = deleteFileTarget;
        const file = existingFiles[fileIndex];
        try {
            const fileIdentifier = file.filename || file.originalName;
            const response = await fetch(`${API_URL}/manage/courses/${id}/files/${fileIdentifier}`, {
                method: 'DELETE',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
            });
            if (response.ok) {
                setExistingFiles(prev => prev.filter((_, i) => i !== fileIndex));
            } else {
                setModal({ show: true, title: 'Error', message: t('editCourse.alertDeleteFailed'), onClose: null });
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
        setDeleteFileTarget(null);
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.userId) newErrors.userId = t('editCourse.alertOwnerReq');
        if (!formData.status) newErrors.status = t('editCourse.alertStatusReq');
        if (!formData.title.trim()) newErrors.title = t('editCourse.alertTitleReq');
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaving(true);

        try {
            const jsonHeaders = { 'Authorization': authHeader, 'Content-Type': 'application/json' };
            const multipartHeaders = { 'Authorization': authHeader };

            const updatePayload = {
                userId: formData.userId,
                status: formData.status,
                trans: [{
                    title: formData.title,
                    description: formData.description,
                    skills: formData.skills,
                }],
                direction: formData.direction,
                level: formData.level,
                price: formData.price ? parseFloat(formData.price) : 0
            };

            await fetch(`${API_URL}/manage/courses/${id}`, {
                method: 'PATCH',
                headers: jsonHeaders,
                body: JSON.stringify(updatePayload)
            });

            if (thumbnail) {
                const thumbnailFormData = new FormData();
                thumbnailFormData.append('file', thumbnail);
                await fetch(`${API_URL}/manage/courses/${id}/files?thumbnail=true`, {
                    method: 'POST',
                    headers: multipartHeaders,
                    body: thumbnailFormData
                });
            }

            if (courseFiles.length > 0) {
                const filesFormData = new FormData();
                courseFiles.forEach(file => filesFormData.append('files', file));
                await fetch(`${API_URL}/manage/courses/${id}/files/multiple`, {
                    method: 'POST',
                    headers: multipartHeaders,
                    body: filesFormData
                });
            }

            setModal({ show: true, title: '✓ Saved', message: t('editCourse.alertSuccess'), onClose: () => navigate('/account') });
        } catch (error) {
            console.error('Error updating course:', error);
            setModal({ show: true, title: 'Error', message: t('editCourse.alertError'), onClose: null });
        } finally {
            setSaving(false);
        }
    };

    const getStatusBadgeColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'deployed': return 'bg-success';
            case 'on-check': return 'bg-warning text-dark';
            case 'editing': return 'bg-secondary';
            default: return 'bg-light text-dark';
        }
    };

    if (loading) {
        return (
            <div className="flex-grow-1 d-flex align-items-center justify-content-center min-vh-100">
                <div className="spinner-border text-primary" role="status"></div>
            </div>
        );
    }

    return (
        <div className="page-bg min-vh-100">
            <div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                <div className="row mb-4 justify-content-center">
                    <div className="col-12 col-lg-10 col-xl-8">
                        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => navigate('/account')}>
                            <i className="bi bi-arrow-left me-1"></i> {t('editCourse.backToAccount')}
                        </button>
                        <h1 className="h3 fw-bold text-dark mb-1">{t('editCourse.title')}</h1>
                        <p className="text-muted mb-0 small">{t('editCourse.subtitle')}</p>
                    </div>
                </div>

                <div className="row justify-content-center">
                    <div className="col-12 col-lg-10 col-xl-8">
                        <div className="card border-0 shadow-sm">
                            <div className="card-body p-4">
                                <form onSubmit={handleSubmit}>
                                    
                                    <div className="text-center mb-4">
                                        <label className="form-label fw-semibold d-block mb-3">{t('editCourse.courseThumbnail')}</label>
                                        {thumbnailPreview ? (
                                            <img src={thumbnailPreview} alt="preview" className="rounded mb-2" style={{ height: '150px', objectFit: 'cover' }} />
                                        ) : formData.links && formData.links[0] && formData.links[0].url ? (
                                            <AuthImage src={formData.links[0].url} className="rounded mb-2" style={{ height: '150px', objectFit: 'cover' }} />
                                        ) : (
                                            <div className="rounded bg-primary bg-opacity-10 d-flex justify-content-center align-items-center text-primary mx-auto mb-2" style={{ width: '150px', height: '150px' }}>
                                                <i className="bi bi-image fs-1"></i>
                                            </div>
                                        )}

                                        <div className="mb-2 d-flex justify-content-center gap-2">
                                            <input type="file" id="thumbnail" className="d-none" accept="image/*" onChange={handleThumbnailChange} />
                                            <label htmlFor="thumbnail" className="btn btn-sm btn-warning"><i className="bi bi-pencil me-1"></i> {t('editCourse.change')}</label>
                                        </div>
                                        
                                        {formData.status && (
                                            <div className="mt-2">
                                                <span className={`badge rounded-pill ${getStatusBadgeColor(formData.status)}`}>{formData.status.toUpperCase()}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="row g-3">
                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">{t('editCourse.courseOwner')}</label>
                                            <select className="form-select" name="userId" value={formData.userId} onChange={handleChange}>
                                                <option value="">{t('editCourse.selectOwner')}</option>
                                                {users.map((u) => <option key={u._id} value={u._id}>{u.nickname}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-6">
                                            <label className="form-label fw-semibold">{t('editCourse.status')}</label>
                                            <select className="form-select" name="status" value={formData.status} onChange={handleChange}>
                                                <option value="editing">{t('editCourse.statusDraft')}</option>
                                                <option value="on-check">{t('editCourse.statusCheck')}</option>
                                                <option value="deployed">{t('editCourse.statusDeployed')}</option>
                                            </select>
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold">{t('editCourse.courseTitle')}</label>
                                            <input type="text" className="form-control" name="title" value={formData.title} onChange={handleChange} />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold">{t('editCourse.description')}</label>
                                            <textarea className="form-control" name="description" value={formData.description} onChange={handleChange} rows="4" />
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold">{t('editCourse.skills')}</label>
                                            <div className="input-group mb-2">
                                                <input type="text" className="form-control" value={skillInput} onChange={(e) => setSkillInput(e.target.value)} onKeyPress={handleSkillInputKeyPress} placeholder={t('editCourse.skillPlaceholder')} />
                                                <button className="btn btn-outline-primary" type="button" onClick={handleAddSkill}>{t('editCourse.add')}</button>
                                            </div>
                                            {formData.skills.map((skill, idx) => (
                                                <span key={idx} className="badge bg-primary me-2 p-2">{skill} <i className="bi bi-x ms-1" style={{cursor: 'pointer'}} onClick={() => handleRemoveSkill(skill)}></i></span>
                                            ))}
                                        </div>

                                        <div className="col-12">
                                            <label className="form-label fw-semibold mt-3">{t('editCourse.courseFiles')}</label>

                                            {/* ── Существующие файлы с фильтрацией ── */}
                                            {existingFiles.length > 0 && (() => {
                                                const getFileCategory = (file) => {
                                                    const name = (file.originalName || file.filename || '').toLowerCase();
                                                    const mime = (file.mimetype || '').toLowerCase();
                                                    if (mime.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(name)) return 'video';
                                                    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) return 'image';
                                                    if (mime === 'application/pdf' || /\.(pdf|doc|docx|ppt|pptx)$/.test(name)) return 'document';
                                                    if (/\.(zip|rar|7z|tar|gz)$/.test(name)) return 'archive';
                                                    return 'other';
                                                };

                                                const FILE_FILTERS = [
                                                    { key: 'all',      label: 'All',       icon: 'bi-grid' },
                                                    { key: 'video',    label: 'Videos',    icon: 'bi-camera-video' },
                                                    { key: 'image',    label: 'Images',    icon: 'bi-image' },
                                                    { key: 'document', label: 'Docs',      icon: 'bi-file-earmark-pdf' },
                                                    { key: 'archive',  label: 'Archives',  icon: 'bi-file-zip' },
                                                    { key: 'other',    label: 'Other',     icon: 'bi-file-earmark' },
                                                ];

                                                const FILE_ICONS = {
                                                    video:    { icon: 'bi-camera-video-fill', color: '#ef4444' },
                                                    image:    { icon: 'bi-image-fill',         color: '#3b82f6' },
                                                    document: { icon: 'bi-file-earmark-pdf-fill', color: '#f59e0b' },
                                                    archive:  { icon: 'bi-file-zip-fill',      color: '#8b5cf6' },
                                                    other:    { icon: 'bi-file-earmark-fill',  color: '#6b7280' },
                                                };

                                                const categorized = existingFiles.map(f => ({ ...f, _cat: getFileCategory(f) }));
                                                const filtered = fileTypeFilter === 'all'
                                                    ? categorized
                                                    : categorized.filter(f => f._cat === fileTypeFilter);

                                                const counts = FILE_FILTERS.reduce((acc, { key }) => {
                                                    acc[key] = key === 'all' ? existingFiles.length : categorized.filter(f => f._cat === key).length;
                                                    return acc;
                                                }, {});

                                                return (
                                                    <div className="mb-3 border rounded-3 overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
                                                        {/* Заголовок */}
                                                        <div className="d-flex align-items-center justify-content-between px-3 py-2"
                                                            style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-color)' }}>
                                                            <span className="small fw-semibold text-success">
                                                                <i className="bi bi-check-circle me-1"></i>
                                                                {t('editCourse.uploadedFiles')} ({existingFiles.length})
                                                            </span>
                                                        </div>

                                                        {/* Фильтр-чипсы */}
                                                        <div className="d-flex flex-wrap gap-1 px-3 py-2"
                                                            style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border-color)' }}>
                                                            {FILE_FILTERS.filter(f => f.key === 'all' || counts[f.key] > 0).map(({ key, label, icon }) => (
                                                                <button
                                                                    key={key}
                                                                    type="button"
                                                                    onClick={() => setFileTypeFilter(key)}
                                                                    className="btn btn-sm"
                                                                    style={{
                                                                        borderRadius: 20,
                                                                        padding: '2px 10px',
                                                                        fontSize: 12,
                                                                        fontWeight: 600,
                                                                        border: `1.5px solid ${fileTypeFilter === key ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                                        background: fileTypeFilter === key ? 'var(--primary-color)' : 'transparent',
                                                                        color: fileTypeFilter === key ? '#fff' : 'var(--muted)',
                                                                        transition: 'all .15s',
                                                                    }}
                                                                >
                                                                    <i className={`bi ${icon} me-1`}></i>
                                                                    {label}
                                                                    <span className="ms-1 opacity-75">({counts[key]})</span>
                                                                </button>
                                                            ))}
                                                        </div>

                                                        {/* Список файлов */}
                                                        <div className="p-2" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                                            {filtered.length === 0 ? (
                                                                <p className="text-muted small text-center py-3 mb-0">No files in this category</p>
                                                            ) : (
                                                                filtered.map((file, idx) => {
                                                                    const fi = FILE_ICONS[file._cat] || FILE_ICONS.other;
                                                                    const realIdx = existingFiles.findIndex(f =>
                                                                        (f.originalName || f.filename) === (file.originalName || file.filename));
                                                                    return (
                                                                        <div key={idx}
                                                                            className="d-flex align-items-center gap-2 p-2 rounded mb-1"
                                                                            style={{ border: '1px solid var(--border-color)', background: 'var(--bg)' }}>
                                                                            <i className={`bi ${fi.icon} fs-5 flex-shrink-0`} style={{ color: fi.color }}></i>
                                                                            <span className="text-truncate small fw-semibold flex-grow-1" style={{ maxWidth: '65%' }}>
                                                                                {file.originalName || file.filename}
                                                                            </span>
                                                                            {file.size && (
                                                                                <span className="text-muted" style={{ fontSize: 11, flexShrink: 0 }}>
                                                                                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                                                                                </span>
                                                                            )}
                                                                            <button
                                                                                type="button"
                                                                                className="btn btn-sm btn-outline-danger flex-shrink-0"
                                                                                style={{ padding: '1px 7px' }}
                                                                                onClick={() => deleteExistingFile(realIdx)}
                                                                            >
                                                                                <i className="bi bi-trash"></i>
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* ── Загрузка новых файлов ── */}
                                            <div className="border rounded-3 p-3" style={{ borderColor: 'var(--border-color)', background: 'var(--bg)' }}>
                                                {/* Разные кнопки по типу */}
                                                <div className="d-flex flex-wrap gap-2 justify-content-center mb-2">
                                                    {[
                                                        { label: 'Videos',    accept: 'video/*',                              icon: 'bi-camera-video',        color: 'btn-outline-danger'   },
                                                        { label: 'Images',    accept: 'image/*',                              icon: 'bi-image',               color: 'btn-outline-primary'  },
                                                        { label: 'Documents', accept: 'application/pdf,.doc,.docx,.ppt,.pptx', icon: 'bi-file-earmark-pdf',    color: 'btn-outline-warning'  },
                                                        { label: 'Archives',  accept: '.zip,.rar,.7z,.tar,.gz',               icon: 'bi-file-zip',            color: 'btn-outline-secondary' },
                                                    ].map(({ label, accept, icon, color }) => (
                                                        <label key={label} className={`btn btn-sm ${color} d-flex align-items-center gap-1`}
                                                            style={{ cursor: 'pointer', borderRadius: 20, paddingInline: 14 }}>
                                                            <i className={`bi ${icon}`}></i> {label}
                                                            <input
                                                                type="file"
                                                                className="d-none"
                                                                multiple
                                                                accept={accept}
                                                                onChange={handleCourseFilesChange}
                                                            />
                                                        </label>
                                                    ))}
                                                    {/* Кнопка загрузить всё */}
                                                    <label className="btn btn-sm btn-success d-flex align-items-center gap-1"
                                                        style={{ cursor: 'pointer', borderRadius: 20, paddingInline: 14 }}>
                                                        <i className="bi bi-upload"></i> {t('editCourse.uploadMore')}
                                                        <input
                                                            type="file"
                                                            id="courseFiles"
                                                            className="d-none"
                                                            multiple
                                                            accept="video/*,image/*,application/pdf,.doc,.docx,.zip,.rar,.7z"
                                                            onChange={handleCourseFilesChange}
                                                        />
                                                    </label>
                                                </div>

                                                {/* Новые файлы в очереди */}
                                                {courseFilesPreview.length > 0 && (
                                                    <div className="mt-2 text-start">
                                                        <strong className="small text-primary d-block mb-1">
                                                            <i className="bi bi-clock-history me-1"></i>
                                                            {t('editCourse.newFiles')} ({courseFilesPreview.length})
                                                        </strong>
                                                        {courseFilesPreview.map((f, idx) => (
                                                            <div key={idx}
                                                                className="d-flex align-items-center gap-2 p-2 rounded mb-1"
                                                                style={{ border: '1px solid var(--border-color)', background: 'var(--card-bg)' }}>
                                                                <i className="bi bi-file-earmark-plus text-success"></i>
                                                                <span className="small text-truncate flex-grow-1">{f.name}</span>
                                                                <span className="text-muted" style={{ fontSize: 11, flexShrink: 0 }}>{f.size} MB</span>
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-danger flex-shrink-0"
                                                                    style={{ padding: '1px 7px' }}
                                                                    onClick={() => removeCourseFile(idx)}
                                                                >
                                                                    <i className="bi bi-x"></i>
                                                                </button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="col-12 col-md-4 mt-4">
                                            <label className="form-label fw-semibold">{t('editCourse.direction')}</label>
                                            <select className="form-select" name="direction" value={formData.direction} onChange={handleChange}>
                                                <option value="">{t('editCourse.selectDirection')}</option>
                                                {directions.map(dir => <option key={dir._id} value={dir.directionName}>{dir.directionName}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-4 mt-4">
                                            <label className="form-label fw-semibold">{t('editCourse.level')}</label>
                                            <select className="form-select" name="level" value={formData.level} onChange={handleChange}>
                                                <option value="">{t('editCourse.selectLevel')}</option>
                                                {levels.filter(l => l.directionName === formData.direction).map(l => <option key={l._id} value={l.levelName}>{l.levelName}</option>)}
                                            </select>
                                        </div>

                                        <div className="col-12 col-md-4 mt-4">
                                            <label className="form-label fw-semibold">{t('editCourse.price')}</label>
                                            <input type="number" className="form-control" name="price" value={formData.price} onChange={handleChange} min="0" />
                                        </div>
                                    </div>

                                    <div className="d-flex gap-2 justify-content-end pt-4 mt-4 border-top">
                                        <button type="button" className="btn btn-light px-4" onClick={() => navigate('/account')} disabled={saving}>{t('editCourse.cancel')}</button>
                                        <button type="submit" className="btn btn-primary px-4" disabled={saving} onClick={handleSubmit}>
                                            {saving ? t('editCourse.saving') : t('editCourse.savePublish')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        <UtilityModal
            show={!!deleteFileTarget}
            type="confirm"
            danger
            title={t('editCourse.confirmDeleteFile') || 'Delete file?'}
            message={deleteFileTarget ? `"${deleteFileTarget.name}" will be permanently removed.` : ''}
            confirmLabel="Delete"
            cancelLabel="Cancel"
            onConfirm={confirmDeleteFile}
            onCancel={() => setDeleteFileTarget(null)}
        />
        <UtilityModal
            show={modal.show}
            type="info"
            title={modal.title}
            message={modal.message}
            onClose={() => { setModal({ show: false, title: '', message: '', onClose: null }); modal.onClose?.(); }}
        />
        </div>
    );
}

export default EditCoursePage;
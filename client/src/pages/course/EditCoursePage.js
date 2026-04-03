import { useEffect, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../../components/NavBar"; 
import AuthImage from "../../components/AuthImage";
import { SettingsContext } from '../../contexts/SettingsContext';

const API_URL = process.env.REACT_APP_API_URL || '${API_URL}';
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
                        fetch('${API_URL}/manage/users', { method: 'GET', headers }),
                        fetch('${API_URL}/directions', { method: 'GET', headers }),
                        fetch('${API_URL}/levels', { method: 'GET', headers }),
                        fetch(`${API_URL}/manage/courses/${id}/files`, { method: 'GET', headers })
                    ]);

                    let course = {};
                    if (courseRes.ok) {
                        const res = await courseRes.json();
                        course = res.data || res;
                        setFormData({
                            userId: course.userId || '',
                            status: course.status || '',
                            title: course.title || '',
                            description: course.description || '',
                            skills: course.skills || [],
                            direction: course.direction || '',
                            level: course.level || '',
                            price: course.price?.toString() || '',
                            links: course.links || []
                        });
                    }

                    if (usersRes.ok) {
                        const res = await usersRes.json();
                        setUsers(res.data || res);
                    }
                    if (directionsRes.ok) {
                        const res = await directionsRes.json();
                        if (Array.isArray(res.data)) setDirections(res.data);
                    }
                    if (levelsRes.ok) {
                        const res = await levelsRes.json();
                        if (Array.isArray(res.data)) setLevels(res.data);
                    }

                    let fetchedFiles = [];
                    if (filesRes.ok) {
                        const res = await filesRes.json();
                        const allFiles = Array.isArray(res.data) ? res.data : (Array.isArray(res.files) ? res.files : (res.data?.files || []));
                        
                        fetchedFiles = allFiles.filter((file) => {
                            const fileName = (file.originalName || file.filename || '').toLowerCase();
                            const isThumbnail = fileName.includes('thumbnail') || 
                                              (fileName.endsWith('.png') && allFiles.indexOf(file) === 0 && file.mimetype?.startsWith('image/'));
                            const isSystemText = isSystemTextFile(file.originalName || file.filename || '');
                            return !isThumbnail && !isSystemText;
                        });
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

    const deleteExistingFile = async (fileIndex) => {
        const file = existingFiles[fileIndex];
        if (!window.confirm(`${t('editCourse.confirmDeleteFile')} "${file.originalName || file.filename}"?`)) return;

        try {
            const fileIdentifier = file.filename || file.originalName;
            const response = await fetch(`${API_URL}/manage/courses/${id}/files/${fileIdentifier}`, {
                method: 'DELETE',
                headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                setExistingFiles(prev => prev.filter((_, i) => i !== fileIndex));
            } else {
                alert(t('editCourse.alertDeleteFailed'));
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
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
                title: formData.title,
                description: formData.description,
                skills: formData.skills,
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

            alert(t('editCourse.alertSuccess'));
            navigate('/account'); 
        } catch (error) {
            console.error('Error updating course:', error);
            alert(t('editCourse.alertError'));
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
                                            
                                            {existingFiles.length > 0 && (
                                                <div className="mb-3 border rounded p-2 bg-light">
                                                    <div className="small fw-semibold text-success mb-2"><i className="bi bi-check-circle me-1"></i> {t('editCourse.uploadedFiles')} ({existingFiles.length})</div>
                                                    {existingFiles.map((file, idx) => (
                                                        <div key={idx} className="d-flex justify-content-between align-items-center bg-white p-2 rounded mb-2 border shadow-sm">
                                                            <div className="text-truncate small fw-semibold" style={{maxWidth: '70%'}}>
                                                                <i className="bi bi-file-earmark me-2 text-primary"></i>
                                                                {file.originalName || file.filename}
                                                            </div>
                                                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteExistingFile(idx)}><i className="bi bi-trash"></i></button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="border rounded p-3 text-center bg-light">
                                                <input type="file" id="courseFiles" className="d-none" multiple onChange={handleCourseFilesChange} />
                                                <label htmlFor="courseFiles" className="btn btn-success"><i className="bi bi-upload me-2"></i> {t('editCourse.uploadMore')}</label>
                                                
                                                {courseFilesPreview.length > 0 && (
                                                    <div className="mt-3 text-start">
                                                        <strong className="small text-primary">{t('editCourse.newFiles')}</strong>
                                                        {courseFilesPreview.map((f, idx) => (
                                                            <div key={idx} className="d-flex justify-content-between align-items-center bg-white p-2 rounded mt-1 border">
                                                                <span className="small">{f.name} ({f.size} MB)</span>
                                                                <button type="button" className="btn btn-sm btn-outline-danger py-0 px-2" onClick={() => removeCourseFile(idx)}><i className="bi bi-x"></i></button>
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
                                        <button type="submit" className="btn btn-primary px-4" disabled={saving}>
                                            {saving ? t('editCourse.saving') : t('editCourse.savePublish')}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default EditCoursePage;
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from '../components/Layout';
import { extendSession } from "../utils/utils";
import AuthImage from "../components/AuthImage";
import { UtilityModal } from '../components/UtilityModal';
import { ItemModal } from '../components/ItemModal';

function Courses({ data, onLogout }) {
    const [courses, setCourses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [showModal, setShowModal] = useState(false);
    // ── Modal state ──────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', confirmToken: '', tokenLabel: '', onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    // closeItemModal  — closes the "View Details" ItemModal
    const closeItemModal = () => setShowModal(false);
    // closeUtilityModal — closes UtilityModal (confirm/delete/info dialogs)
    const closeUtilityModal = () => setModal(p => ({ ...p, show: false }));
    // Legacy alias used in older code paths
    const closeModal = closeUtilityModal;
    const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeUtilityModal });
    const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeUtilityModal });
    const showDelete = (title, message, confirmToken, tokenLabel, onDelete) => setModal({ show: true, type: 'delete', title, message, confirmToken, tokenLabel, onDelete, onCancel: closeUtilityModal, deleteLabel: 'Delete' });
    const [searchText, setSearchText] = useState('');
    const [selectedStatus, setSelectedStatus] = useState(''); // filter by status
    const [selectedDirection, setSelectedDirection] = useState(''); // filter by direction
    const [selectedCourseType, setSelectedCourseType] = useState(''); // filter by courseType
    const [sortBy, setSortBy] = useState('');  // 'title'|'price'|'date'|'level'
    const [sortDir, setSortDir] = useState('asc');
    const navigate = useNavigate();

    const token = localStorage.getItem('token');

    useEffect(() => {
        if (token) {
            fetchCourses();
            fetchUsers();
        }
    }, []);

    const fetchData = async () => {
        setLoading(true);
        await fetchCourses();
        await fetchUsers();
        setLoading(false);
    }

    const fetchCourses = async () => {
        setLoading(true);
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/manage/courses', {
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
                setCourses(res.data || res);
            }
        } catch (error) {
            console.error('Error fetching courses:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchUsers = async () => {
        try {
            const response = await fetch(process.env.REACT_APP_API_URL + '/manage/users', {
                method: 'GET',
                headers: {
                    'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
                    'Content-Type': 'application/json'
                }
            });
            if (response.status === 401) {
                extendSession(data)
            }
            if (response.ok) {
                const res = await response.json();
                setUsers(res.data || res);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    };

    // Helper: find user by userId from the users array
    const getUserInfo = (userId) => {
        const found = users.find((u) => u._id === userId);
        return found ? { nickname: found.nickname, email: found.email } : { nickname: 'BADLYCODED.EDU', email: 'badlycoded.edu@local.com' };
    };

    // Helper to get the first course thumbnail URL from links array
    const getCourseThumbnailUrl = (course) => {
        if (!course.links || course.links.length === 0) return null;

        // Find the first thumbnail (type === 'image' and description matches, or just first link)
        const thumbnail = course.links.find(link =>
            link.type === 'image' &&
            link.description &&
            (link.description.toLowerCase() === 'thumbnail' || link.description.toLowerCase() === 'course thumbnail') &&
            link.url
        );

        // If no thumbnail found, use first image with a URL
        return thumbnail ? thumbnail.url : (course.links[0]?.url || null);
    };

    // Get unique statuses and directions for filter dropdowns
    const uniqueStatuses = [...new Set(courses.map(c => c.status))].filter(Boolean);
    const uniqueDirections = [...new Set(courses.map(c => c.direction))].filter(Boolean);

    // Derived filtered list
    const filteredCourses = (() => {
        let result = courses.filter((c) => {
        const text = searchText.toLowerCase();
        const userInfo = getUserInfo(c.userId);
        const matchesText =
            !text ||
            (c.trans?.[0]?.title || '').toLowerCase().includes(text) ||
            (userInfo.nickname || '').toLowerCase().includes(text) ||
            (userInfo.email || '').toLowerCase().includes(text) ||
            (c.direction || '').toLowerCase().includes(text) ||
            (c.level || '').toLowerCase().includes(text);
        const matchesStatus = !selectedStatus || c.status === selectedStatus;
        const matchesDirection = !selectedDirection || c.direction === selectedDirection;
        const matchesCourseType = !selectedCourseType || (c.courseType || 'SELF_TAUGHT') === selectedCourseType;
        return matchesText && matchesStatus && matchesDirection && matchesCourseType;
        });
        if (sortBy) {
            result = [...result].sort((a, b) => {
                let av, bv;
                if (sortBy === 'title') { av = a.trans?.[0]?.title || ''; bv = b.trans?.[0]?.title || ''; }
                else if (sortBy === 'price') { av = a.price || 0; bv = b.price || 0; }
                else if (sortBy === 'date') { av = new Date(a.createdAt); bv = new Date(b.createdAt); }
                else if (sortBy === 'level') { av = a.level || ''; bv = b.level || ''; }
                else { av = 0; bv = 0; }
                const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
                return sortDir === 'asc' ? cmp : -cmp;
            });
        }
        return result;
    })();

    const openModal = (course) => {
        setSelectedCourse(course);
        setShowModal(true);
    };

    const handleEdit = (course) => {
        navigate(`/manage/course/${course._id}`);
    };

    const handleDelete = (course) => {
        const authorEmail = getUserInfo(course.userId).email;
        showDelete('Delete Course',
            `You are about to permanently delete course "${course.trans?.[0]?.title}" by ${authorEmail}. This cannot be undone.`,
            authorEmail, "Type the author's email to confirm",
            async () => {
                try {
                    const token = localStorage.getItem('token');
                    const response = await fetch(`${process.env.REACT_APP_API_URL}/manage/courses/${course._id}`, {
                        method: 'DELETE', headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' }
                    });
                    if (response.ok) { showInfo('Deleted', `Course "${course.trans?.[0]?.title}" has been deleted.`); fetchCourses(); fetchUsers(); }
                } catch (e) { showInfo('Error', 'Failed to delete course.'); }
            }
        );
    };

    // Helper function to get badge color based on status
    const getStatusBadgeColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'deployed':
                return 'bg-success';
            case 'on-check':
                return 'bg-warning text-dark';
            case 'editing':
                return 'bg-secondary';
            default:
                return 'bg-light text-dark';
        }
    };

    // Helper function to format date
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

    return (
    <AppLayout data={data} onLogout={onLogout} title="Courses">
<div className="d-flex flex-column flex-lg-row min-vh-100 bg-light">

                <div className="flex-grow-1 p-3 p-md-4" style={{ minWidth: 0 }}>
                    {/* Page Header */}
                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
                                <div>
                                    <h1 className="h3 fw-bold text-dark mb-1">Courses</h1>
                                    <p className="text-muted mb-0 small">Manage all courses and content</p>
                                </div>
                                <div className="d-flex align-items-center gap-2">
                                    <select className="form-select form-select-sm"
                                        onChange={e => navigate(`${e.target.value}`)}>
                                        <option value="#">Select Form</option>
                                        <option value="/creator/apply">Creator Form</option>
                                        <option value="/tutor/apply">Tutor Form</option>
                                        <option value="/support/open-ticket">Support Ticket</option>
                                    </select>
                                    <button className="btn btn-success btn-sm" onClick={() => navigate('/manage/courses/create')}>
                                        <svg width="14" height="14" fill="currentColor" className="me-1" viewBox="0 0 16 16">
                                            <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                            <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z" />
                                        </svg>
                                        Add Course
                                    </button>
                                    <button
                                        className="btn btn-sm btn-outline-primary"
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
                                        {filteredCourses.length}{filteredCourses.length !== courses.length ? ` / ${courses.length}` : ''} {courses.length === 1 ? 'course' : 'courses'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search & Filter Bar */}
                    <div className="card border-0 shadow-sm mb-3">
                        <div className="card-body p-3">
                            <div className="row g-2 align-items-center">
                                {/* Text search */}
                                <div className="col-12 col-md-6">
                                    <div className="input-group input-group-sm">
                                        <span className="input-group-text bg-white border-end-0">
                                            <svg width="16" height="16" fill="#6c757d" viewBox="0 0 16 16">
                                                <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85zm-5.242 6a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z" />
                                            </svg>
                                        </span>
                                        <input
                                            type="text"
                                            className="form-control border-start-0 ps-0"
                                            placeholder="Search by title, owner, direction..."
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

                                {/* Status dropdown */}
                                <div className="col-6 col-md-3">
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedStatus}
                                        onChange={(e) => setSelectedStatus(e.target.value)}
                                    >
                                        <option value="">All statuses</option>
                                        {uniqueStatuses.map((status) => (
                                            <option key={status} value={status}>{status}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Direction dropdown */}
                                <div className="col-6 col-md-3">
                                    <select
                                        className="form-select form-select-sm"
                                        value={selectedDirection}
                                        onChange={(e) => setSelectedDirection(e.target.value)}
                                    >
                                        <option value="">All directions</option>
                                        {uniqueDirections.map((direction) => (
                                            <option key={direction} value={direction}>{direction}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12 col-sm-4 col-md-2">
                                    <select className="form-select form-select-sm"
                                        value={selectedCourseType} onChange={e => setSelectedCourseType(e.target.value)}>
                                        <option value="">All types</option>
                                        <option value="SELF_TAUGHT">Self-Taught</option>
                                        <option value="MENTORED">Mentored</option>
                                        <option value="HOSTED">Hosted</option>
                                    </select>
                                </div>
                                <div className="col-12 col-sm-4 col-md-2">
                                    <div className="input-group input-group-sm">
                                        <select className="form-select form-select-sm" value={sortBy}
                                            onChange={e => setSortBy(e.target.value)}>
                                            <option value="">Sort by…</option>
                                            <option value="title">Title</option>
                                            <option value="price">Price</option>
                                            <option value="date">Date</option>
                                            <option value="level">Level</option>
                                        </select>
                                        <button className="btn btn-outline-secondary btn-sm" onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} title="Toggle sort direction">
                                            {sortDir === 'asc' ? '↑' : '↓'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Active-filter chips */}
                            {(searchText || selectedStatus || selectedDirection) && (
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
                                    {selectedStatus && (
                                        <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                                            Status: {selectedStatus}
                                            <svg width="10" height="10" fill="currentColor" viewBox="0 0 16 16" style={{ cursor: 'pointer' }} onClick={() => setSelectedStatus('')}>
                                                <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                                            </svg>
                                        </span>
                                    )}
                                    {selectedDirection && (
                                        <span className="badge bg-light text-dark border d-flex align-items-center gap-1">
                                            Direction: {selectedDirection}
                                            <svg width="10" height="10" fill="currentColor" viewBox="0 0 16 16" style={{ cursor: 'pointer' }} onClick={() => setSelectedDirection('')}>
                                                <path d="M2.146 2.854a.5.5 0 0 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8 2.146 2.854z" />
                                            </svg>
                                        </span>
                                    )}
                                    <button className="btn btn-link btn-sm p-0 text-danger" onClick={() => { setSearchText(''); setSelectedStatus(''); setSelectedDirection(''); }}>
                                        Clear all
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Courses Table */}
                    <div className="card border-0 shadow-sm">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="fw-semibold text-muted small text-uppercase py-3" style={{ width: '60px' }}>#</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3">Title</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3">Owner</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3">Status</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3">Direction</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3">Level</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3">Price</th>
                                        <th className="fw-semibold text-muted small text-uppercase py-3 text-end" style={{ width: '200px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCourses.length > 0 ? (
                                        filteredCourses.map((c, index) => {
                                            const userInfo = getUserInfo(c.userId);
                                            return (
                                                <tr key={index} className="align-middle" style={{ cursor: 'pointer' }}>
                                                    <td className="text-muted">{index + 1}</td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            {(() => {
                                                                const thumbnailUrl = getCourseThumbnailUrl(c);
                                                                return thumbnailUrl ? (
                                                                    <AuthImage
                                                                        src={thumbnailUrl}
                                                                        alt={c.trans?.[0]?.title}
                                                                        className="rounded flex-shrink-0"
                                                                        style={{ width: '34px', height: '34px', objectFit: 'cover' }}
                                                                        fallback={
                                                                            <div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                                                                                style={{ width: '34px', height: '34px', fontSize: '0.9rem' }}>
                                                                                <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                                                                    <path d="M8.211 2.047a.5.5 0 0 0-.422 0l-7.5 3.5a.5.5 0 0 0 .025.917l7.5 3a.5.5 0 0 0 .372 0L14 6.464V13.5a.5.5 0 0 0 1 0V6.236a.5.5 0 0 0-.053-.224l-7.5-3.5z" />
                                                                                    <path d="M4.176 9.032a.5.5 0 0 0-.656.327l-.5 1.7a.5.5 0 0 0 .294.605l4.5 1.8a.5.5 0 0 0 .372 0l4.5-1.8a.5.5 0 0 0 .294-.605l-.5-1.7a.5.5 0 0 0-.656-.327L8 10.466 4.176 9.032z" />
                                                                                </svg>
                                                                            </div>
                                                                        }
                                                                    />
                                                                ) : (
                                                                    <div className="rounded bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary flex-shrink-0"
                                                                        style={{ width: '34px', height: '34px', fontSize: '0.9rem' }}>
                                                                        <svg width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                                                                            <path d="M8.211 2.047a.5.5 0 0 0-.422 0l-7.5 3.5a.5.5 0 0 0 .025.917l7.5 3a.5.5 0 0 0 .372 0L14 6.464V13.5a.5.5 0 0 0 1 0V6.236a.5.5 0 0 0-.053-.224l-7.5-3.5z" />
                                                                            <path d="M4.176 9.032a.5.5 0 0 0-.656.327l-.5 1.7a.5.5 0 0 0 .294.605l4.5 1.8a.5.5 0 0 0 .372 0l4.5-1.8a.5.5 0 0 0 .294-.605l-.5-1.7a.5.5 0 0 0-.656-.327L8 10.466 4.176 9.032z" />
                                                                        </svg>
                                                                    </div>
                                                                );
                                                            })()}
                                                            <span className="fw-semibold">
                                                                {c.isPrivateCopy && <span className="badge bg-warning text-dark me-1" style={{ fontSize: '.68rem', verticalAlign: 'middle' }}><i className="bi bi-lock-fill me-1"></i>Private</span>}
                                                                {c.trans?.[0]?.title || 'Untitled'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <div>
                                                            <div className="fw-semibold small">
                                                                {(userInfo.nickname === 'root')
                                                                    ? 'BADLYCODED.EDU'
                                                                    : userInfo.nickname
                                                                }
                                                            </div>
                                                            <div className="text-muted small">
                                                                {(userInfo.nickname === 'root')
                                                                    ? 'badlycoded.edu@local.com'
                                                                    : userInfo.email
                                                                }
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`badge rounded-pill ${getStatusBadgeColor(c.status)}`}>
                                                            {c.status || '—'}
                                                        </span>
                                                    </td>
                                                    <td className="text-muted">{c.direction || '—'}</td>
                                                    <td className="text-muted">{c.level || '—'}</td>
                                                    <td className="text-muted fw-semibold">{c.price ? `$${c.price}` : '—'}</td>
                                                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                                                        <div className="btn-group btn-group-sm" role="group">
                                                            <button type="button" className="btn btn-outline-secondary" onClick={() => openModal(c)} title="View details">
                                                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                    <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                                                                    <path d="M7.002 11a1 1 0 1 0 2 0 1 1 0 0 0-2 0zM7.1 4.995a.905.905 0 1 0 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z" />
                                                                </svg>
                                                            </button>
                                                            <button type="button" className="btn btn-outline-primary" onClick={() => navigate(`/course/preview/${c._id}${c.isPrivateCopy ? '?private=1' : ''}`)} title="View course">
                                                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z" /><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z" /></svg>
                                                            </button>
                                                            <button type="button" className="btn btn-outline-warning" onClick={() => handleEdit(c)} title="Edit course">
                                                                <svg width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                                                                    <path d="M12.146.146a.5.5 0 0 1 .707 0l3 3a.5.5 0 0 1 0 .707l-10 10a.5.5 0 0 1-.203.134l-6 2a.5.5 0 0 1-.633-.633l2-6a.5.5 0 0 1 .134-.203l10-10zM11.207 1.5 13.5 3.793 14.793 2.5 12.5.207l-1.293 1.293zm1.386 1.386L9.3 0.207 10.5 1.407l2.293 2.293-0.207.207z" />
                                                                </svg>
                                                            </button>
                                                            <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(c)} title="Delete course">
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
                                            <td colSpan="8" className="text-center py-5">
                                                <div className="text-muted">
                                                    <svg width="40" height="40" fill="currentColor" viewBox="0 0 16 16" className="mb-3 opacity-50">
                                                        <path d="M8.211 2.047a.5.5 0 0 0-.422 0l-7.5 3.5a.5.5 0 0 0 .025.917l7.5 3a.5.5 0 0 0 .372 0L14 6.464V13.5a.5.5 0 0 0 1 0V6.236a.5.5 0 0 0-.053-.224l-7.5-3.5z" />
                                                        <path d="M4.176 9.032a.5.5 0 0 0-.656.327l-.5 1.7a.5.5 0 0 0 .294.605l4.5 1.8a.5.5 0 0 0 .372 0l4.5-1.8a.5.5 0 0 0 .294-.605l-.5-1.7a.5.5 0 0 0-.656-.327L8 10.466 4.176 9.032z" />
                                                    </svg>
                                                    {courses.length === 0 ? (
                                                        <>
                                                            <p className="mb-0 fw-semibold">No courses found</p>
                                                            <small>The course list is empty</small>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <p className="mb-0 fw-semibold">No matches</p>
                                                            <small>No courses match your current search or filter</small>
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
            </div>

            {/* Details Modal */}
            <ItemModal
                show={showModal}
                type="course"
                item={selectedCourse}
                extraData={{ users }}
                onClose={closeItemModal}
                onEdit={selectedCourse ? () => navigate(`/manage/course/preview/${selectedCourse._id}`) : undefined}
                onDelete={selectedCourse ? () => { closeItemModal(); handleDelete(selectedCourse); } : undefined}
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

export default Courses;
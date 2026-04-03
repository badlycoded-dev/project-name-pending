import { toHttps } from '../utils/utils';
import AuthImage from './AuthImage';
const BASE_URL = toHttps(process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://localhost:4040');


/**
 * ItemModal — reusable "View Details" modal for Courses, Users, and Roles.
 *
 * Props:
 *   show       — boolean
 *   type       — 'course' | 'user' | 'role'
 *   item       — the data object
 *   onClose    — () => void
 *   onEdit     — () => void  (optional)
 *   onDelete   — () => void  (optional)
 *   extraData  — optional context { users[], roles[] } for cross-lookup
 */

const ACCESS_COLORS = {
    root: '#212529', admin: '#dc3545', manage: '#ffc107',
    quality: '#198754', tutor: '#0dcaf0', create: '#0d6efd', default: '#6c757d',
};
const STATUS_COLORS = {
    deployed: '#198754', editing: '#6c757d', reviewing: '#0d6efd',
    rejected: '#dc3545', archived: '#adb5bd',
};

const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';

function Row({ label, children }) {
    return (
        <tr>
            <td className="text-muted fw-semibold small text-uppercase py-2 align-top" style={{ width: '32%', whiteSpace: 'nowrap' }}>{label}</td>
            <td className="py-2">{children ?? '—'}</td>
        </tr>
    );
}

function Avatar({ url, alt, initials, size = 96 }) {
    const fallback = (
        <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center text-primary"
            style={{ width: size, height: size, fontSize: size * 0.35, fontWeight: 700 }}>
            {initials}
        </div>
    );
    if (!url) return fallback;
    return (
        <AuthImage src={url} alt={alt}
            className="rounded-circle"
            style={{ width: size, height: size, objectFit: 'cover' }}
            fallback={fallback}
        />
    );
}

// ── Course detail body ────────────────────────────────────────────────────────
function CourseDetail({ item, extraData }) {
    const users = extraData?.users || [];
    const owner = users.find(u => u._id === item.userId || u._id === item.userId?._id);
    const thumbUrl = item.links?.find(l =>
        l.description?.toLowerCase().includes('thumbnail') || l.type === 'image'
    )?.url;
    const fullThumb = thumbUrl ? `${BASE_URL}${thumbUrl}` : null;
    const title = item.trans?.[0]?.title || 'Untitled';
    const initials = title.charAt(0).toUpperCase();

    return (
        <>
            <div className="text-center mb-4">
                <Avatar url={fullThumb} alt={title} initials={initials} />
                <h5 className="fw-bold mt-3 mb-1">{title}</h5>
                <span className="badge rounded-pill"
                    style={{ background: STATUS_COLORS[item.status] || '#6c757d', color: '#fff' }}>
                    {item.status || '—'}
                </span>
            </div>
            <table className="table table-sm table-borderless mb-0">
                <tbody>
                    <Row label="Owner">
                        {owner
                            ? <><div className="fw-semibold">{owner.nickname}</div><div className="text-muted small">{owner.email}</div></>
                            : <span className="text-muted">{String(item.userId)}</span>}
                    </Row>
                    <Row label="Direction">{item.direction}</Row>
                    <Row label="Level">{item.level}</Row>
                    <Row label="Type">
                        <span className="badge bg-light text-dark border">{item.courseType || 'SELF_TAUGHT'}</span>
                    </Row>
                    <Row label="Price">{item.price ? `$${item.price}` : 'Free'}</Row>
                    <Row label="Rating">
                        {item.ratings ? `${item.ratings} ★` : '—'}
                        {item.ratingsList?.length ? <small className="text-muted ms-1">({item.ratingsList.length} vote{item.ratingsList.length !== 1 ? 's' : ''})</small> : null}
                    </Row>
                    {item.trans?.[0]?.description && (
                        <Row label="Description">{item.trans[0].description}</Row>
                    )}
                    {item.trans?.[0]?.skills?.length > 0 && (
                        <Row label="Skills">
                            <div className="d-flex flex-wrap gap-1">
                                {item.trans[0].skills.map((s, i) => (
                                    <span key={i} className="badge bg-light text-dark border">{s}</span>
                                ))}
                            </div>
                        </Row>
                    )}
                    {item.add_langs?.length > 0 && (
                        <Row label="Languages">
                            <span className="badge bg-secondary me-1">{item.base_lang?.toUpperCase()}</span>
                            {item.add_langs.map(l => <span key={l} className="badge bg-light text-dark border me-1">{l.toUpperCase()}</span>)}
                        </Row>
                    )}
                    <Row label="Volumes">{item.volumes?.length ?? 0}</Row>
                    <Row label="Comments">{item.comments?.length ?? 0}</Row>
                    <Row label="Created">{fmtDate(item.createdAt)}</Row>
                    <Row label="Updated">{fmtDate(item.updatedAt)}</Row>
                </tbody>
            </table>
        </>
    );
}

// ── User detail body ──────────────────────────────────────────────────────────
function UserDetail({ item, extraData }) {
    const roles = extraData?.roles || [];
    const roleObj = typeof item.role === 'object' ? item.role : roles.find(r => r._id === item.role);
    const avatarUrl = item.links?.find(l => l.type === 'image' && l.description?.toLowerCase() === 'profile picture')?.url
        || item.links?.find(l => l.type === 'image')?.url;
    const fullAvatar = avatarUrl ? `${BASE_URL}${avatarUrl}` : null;
    const initials = (item.nickname || '?').charAt(0).toUpperCase();
    const lvl = roleObj?.accessLevel || '';

    return (
        <>
            <div className="text-center mb-4">
                <Avatar url={fullAvatar} alt={item.nickname} initials={initials} />
                <h5 className="fw-bold mt-3 mb-1">{item.nickname || '—'}</h5>
                {roleObj && (
                    <span className="badge rounded-pill"
                        style={{ background: ACCESS_COLORS[lvl] || '#6c757d', color: lvl === 'manage' ? '#000' : '#fff' }}>
                        {roleObj.roleName?.toUpperCase()}
                    </span>
                )}
            </div>
            <table className="table table-sm table-borderless mb-0">
                <tbody>
                    <Row label="Email">{item.email}</Row>
                    <Row label="Nickname">{item.nickname}</Row>
                    {(item.firstName || item.lastName) && (
                        <Row label="Full Name">{`${item.firstName || ''} ${item.lastName || ''}`.trim()}</Row>
                    )}
                    <Row label="Role">{roleObj ? `${roleObj.roleName} (${roleObj.accessLevel})` : String(item.role)}</Row>
                    {item.tutorRank && (
                        <Row label="Tutor Rank">
                            <span className="badge bg-info text-dark">{item.tutorRank}</span>
                        </Row>
                    )}
                    {item.github && <Row label="GitHub"><a href={`https://github.com/${item.github}`} target="_blank" rel="noopener noreferrer">{item.github}</a></Row>}
                    {item.phone && <Row label="Phone">{item.phone}</Row>}
                    <Row label="Courses">{item.courses?.length ?? 0}</Row>
                    <Row label="Groups">{item.groups?.length ?? 0}</Row>
                    <Row label="Created">{fmtDate(item.createdAt)}</Row>
                    <Row label="Updated">{fmtDate(item.updatedAt)}</Row>
                </tbody>
            </table>
        </>
    );
}

// ── Role detail body ──────────────────────────────────────────────────────────
function RoleDetail({ item }) {
    const lvl = item.accessLevel || '';
    return (
        <>
            <div className="text-center mb-4">
                <div className="rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-bold"
                    style={{ width: 80, height: 80, fontSize: 28,
                        background: ACCESS_COLORS[lvl] || '#6c757d' }}>
                    {(item.roleName || '?').charAt(0).toUpperCase()}
                </div>
                <h5 className="fw-bold mt-3 mb-1">{item.roleName}</h5>
                <span className="badge rounded-pill"
                    style={{ background: ACCESS_COLORS[lvl] || '#6c757d',
                        color: lvl === 'manage' ? '#000' : '#fff' }}>
                    {lvl.toUpperCase()}
                </span>
            </div>
            <table className="table table-sm table-borderless mb-0">
                <tbody>
                    <Row label="Role Name">{item.roleName}</Row>
                    <Row label="Access Level">
                        <span className="badge rounded-pill"
                            style={{ background: ACCESS_COLORS[lvl] || '#6c757d',
                                color: lvl === 'manage' ? '#000' : '#fff' }}>
                            {lvl.toUpperCase()}
                        </span>
                    </Row>
                    <Row label="Created">{fmtDate(item.createdAt)}</Row>
                    <Row label="Updated">{fmtDate(item.updatedAt)}</Row>
                </tbody>
            </table>
        </>
    );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ItemModal({ show, type, item, onClose, onEdit, onDelete, extraData }) {
    if (!show || !item) return null;

    const titles = { course: 'Course Details', user: 'User Details', role: 'Role Details' };

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, zIndex: 1040,
                    background: 'rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(2px)',
                    WebkitBackdropFilter: 'blur(2px)',
                }}
            />
            {/* Dialog */}
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 1050,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '1rem', pointerEvents: 'none',
                }}
            >
                <div
                    className="shadow-lg"
                    style={{
                        pointerEvents: 'auto',
                        background: '#fff',
                        borderRadius: 16,
                        overflow: 'hidden',
                        width: '100%',
                        maxWidth: type === 'course' ? 560 : 480,
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Header */}
                    <div className="d-flex align-items-center justify-content-between px-4 py-3"
                        style={{ background: '#1a1a2e', color: '#fff', flexShrink: 0 }}>
                        <h5 className="mb-0 fw-semibold" style={{ fontSize: '1rem' }}>{titles[type] || 'Details'}</h5>
                        <button className="btn-close btn-close-white btn-sm" onClick={onClose} aria-label="Close" />
                    </div>

                    {/* Scrollable body */}
                    <div className="px-4 py-3" style={{ overflowY: 'auto', flex: 1 }}>
                        {type === 'course' && <CourseDetail item={item} extraData={extraData} />}
                        {type === 'user'   && <UserDetail   item={item} extraData={extraData} />}
                        {type === 'role'   && <RoleDetail   item={item} />}
                    </div>

                    {/* Footer */}
                    <div className="d-flex justify-content-end gap-2 px-4 py-3 border-top" style={{ flexShrink: 0, background: '#f8f9fa' }}>
                        <button className="btn btn-outline-secondary btn-sm" onClick={onClose}>Close</button>
                        {onEdit && (
                            <button className="btn btn-warning btn-sm text-dark" onClick={() => { onClose(); onEdit(); }}>
                                <i className="bi bi-pencil me-1"></i>Edit
                            </button>
                        )}
                        {onDelete && (
                            <button className="btn btn-danger btn-sm" onClick={() => { onClose(); onDelete(); }}>
                                <i className="bi bi-trash me-1"></i>Delete
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}

export default ItemModal;

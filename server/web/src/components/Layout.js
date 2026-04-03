import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthImage from './AuthImage';

const ThemeCtx = createContext({ theme: 'dark', toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
    useEffect(() => { document.documentElement.setAttribute('data-theme', theme); localStorage.setItem('theme', theme); }, [theme]);
    const toggle = useCallback(() => setTheme(t => t === 'light' ? 'dark' : 'light'), []);
    return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

const ACCESS = { default:0, create:1, tutor:1.5, quality:2, manage:3, admin:4, root:5 };
const lvl = (a) => ACCESS[a] ?? 0;

const NAV = [
    {
        section: 'Learning',
        minLvl: 0,
        items: [
        { to: '/my-courses',  icon: 'bi-collection-play',   label: 'My Courses' },
        { to: '/my-grades',   icon: 'bi-award',              label: 'My Grades' },
        { to: '/redeem',      icon: 'bi-key',                label: 'Redeem Key' },
        ],
    },
    {
        section: 'Management', minLvl: 3,
        items: [
            { to: '/',                  icon: 'bi-speedometer2',    label: 'Dashboard' },
            { to: '/manage/courses',  icon: 'bi-book',       label: 'Courses' },
            { to: '/manage/directions', icon: 'bi-compass',         label: 'Directions' },
            { to: '/manage/levels',     icon: 'bi-bar-chart-steps', label: 'Levels' },
            { to: '/manage/users',      icon: 'bi-people-fill',     label: 'Users' },
            { to: '/manage/roles',      icon: 'bi-shield-lock',     label: 'Roles' },
            { to: '/manage/forms',        icon: 'bi-ui-checks',   label: 'Review Forms'},
            { to: '/manage/promos',     icon: 'bi-tag',             label: 'Promo Codes' },
            { to: '/manage/keys',       icon: 'bi-key-fill',        label: 'Product Keys' },
            
        ],
    },
    {
        section: 'Tutor', minLvl: 1.5,
        items: [
            { to: '/manage/sessions', icon: 'bi-people',     label: 'Sessions' },
        ],
    },
    {
        section: 'Support', minLvl: 0,
        items: [
            { to: '/creator/apply',       icon: 'bi-pen',         label: 'Apply as Creator'},
            { to: '/tutor/apply',         icon: 'bi-mortarboard', label: 'Apply as Tutor'},
            { to: '/support/open-ticket', icon: 'bi-headset',     label: 'Support Ticket' },
        ],
    },
    {
        section: 'System', minLvl: 4,
        items: [
            { to: '/manage/settings', icon: 'bi-gear', label: 'Settings & Logs' },
        ],
    },
];

function UserAvatar({ user, size = 32 }) {
    const initials = (user?.nickname || user?.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...(user?.nickname || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    const pic = user?.links?.find(l => l.description?.toLowerCase() === 'profile picture');
    if (pic) return <AuthImage src={pic.url} alt={user.nickname} style={{ width:size, height:size, borderRadius:8, objectFit:'cover' }} fallback={<div className="sidebar-avatar" style={{ width:size, height:size, background:`hsl(${hue},50%,40%)`, fontSize:size*.34 }}>{initials}</div>} />;
    return <div className="sidebar-avatar" style={{ width:size, height:size, background:`hsl(${hue},50%,40%)`, fontSize:size*.34 }}>{initials}</div>;
}

function Sidebar({ data, onLogout, mobileOpen, onClose, collapsed, onCollapseClick }) {
    const location = useLocation();
    const navigate  = useNavigate();
    const { theme, toggle } = useTheme();
    const userLvl   = lvl(data?.accessLevel);
    const isActive  = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

    const roleColor = { root:'#c4b5fd', admin:'#f87171', manage:'#fbbf24', quality:'#34d399', tutor:'#22d3ee', create:'#818cf8' }[data?.accessLevel] || 'var(--nav-text)';

    return (
        <aside className={`app-sidebar${mobileOpen?' mobile-open':''}${collapsed?' sidebar-collapsed':''}`}>
            {/* <button className="sidebar-logo" onClick={onCollapseClick} title={collapsed?'Expand':'Collapse'} >
                <div className="sidebar-logo-mark">📟</div>
                {!collapsed && <span className="sidebar-logo-text">Admin Panel</span>}
            </button> */}
            <Link to="#" className="sidebar-logo" onClick={onCollapseClick}>
                <div className="sidebar-logo-mark">📟</div>
                {!collapsed && <Link className="sidebar-logo-text" onClick={onClose}>Admin Panel</Link>}
            </Link>

            <nav className="nav-sections">
                {NAV.map(sec => {
                    const items = sec.items.filter(it => {
                        if (it.minLvl !== undefined && userLvl < it.minLvl) return false;
                        if (it.maxLvl !== undefined && userLvl > it.maxLvl) return false;
                        return true;
                    });
                    if (userLvl < (sec.minLvl ?? 0) || items.length === 0) return null;
                    return (
                        <div key={sec.section} className="nav-section">
                            {!collapsed && <div className="nav-section-label">{sec.section}</div>}
                            {items.map(item => (
                                <div key={item.to} className="nav-item">
                                    <Link to={item.to} className={isActive(item.to)?'active':''} onClick={onClose} title={collapsed?item.label:undefined}>
                                        <i className={`bi ${item.icon}`} />
                                        {!collapsed && <span className="nav-label">{item.label}</span>}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div onClick={()=>{ navigate(`/manage/user/${data._id}`); onClose?.(); }} style={{ display:'flex', alignItems:'center', gap:'.65rem', flex:1, minWidth:0, cursor:'pointer' }}>
                    <UserAvatar user={data} size={32} />
                    {!collapsed && (
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{data?.nickname || data?.email || 'User'}</div>
                            <div className="sidebar-user-role" style={{ color:roleColor }}>{data?.accessLevel}{data?.tutorRank?` · ${data.tutorRank}`:''}</div>
                        </div>
                    )}
                </div>
                {!collapsed && <button className="sidebar-logout" onClick={toggle} title={theme==='dark'?'Light mode':'Dark mode'}><i className={`bi ${theme==='dark'?'bi-sun':'bi-moon'}`} /></button>}
                {!collapsed && <button className="sidebar-logout" onClick={onLogout} title="Log out"><i className="bi bi-box-arrow-right" /></button>}
            </div>
        </aside>
    );
}

function Topbar({ title, onMenuClick, onCollapseClick, collapsed }) {
    return (
        <div className="app-topbar">
            {/* <button onClick={onMenuClick} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1.1rem', display:'flex', padding:4 }}><i className="bi bi-list" /></button> */}
            <button onClick={onCollapseClick} title={collapsed?'Expand':'Collapse'} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'.9rem', display:'flex', padding:4, marginRight:4 }} hidden><i className={`bi ${collapsed?'bi-layout-sidebar':'bi-layout-sidebar-reverse'}`} /></button>
            {title && <span className="topbar-title">{title}</span>}
        </div>
    );
}

export function AppLayout({ data, onLogout, title = '', children }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed,  setCollapsed]  = useState(() => localStorage.getItem('sidebarCollapsed')==='1');
    const location = useLocation();

    const toggleCollapsed = () => setCollapsed(p => { const n=!p; localStorage.setItem('sidebarCollapsed',n?'1':'0'); return n; });
    useEffect(() => { setMobileOpen(false); }, [location]);

    return (
        <div className={`app-shell${collapsed?' sidebar-collapsed':''}`}>
            <div className={`sidebar-backdrop${mobileOpen?' visible':''}`} onClick={()=>setMobileOpen(false)} />
            <Sidebar data={data} onLogout={onLogout} mobileOpen={mobileOpen} collapsed={collapsed} onCollapseClick={toggleCollapsed} onClose={()=>setMobileOpen(false)} />
            <div className="app-main">
                <Topbar title={title} onMenuClick={()=>setMobileOpen(p=>!p)} onCollapseClick={toggleCollapsed} collapsed={collapsed} />
                {children}
            </div>
        </div>
    );
}

export const Navbar = () => null;
export default AppLayout;

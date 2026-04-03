import { toHttps } from './utils/utils';
import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';

import Login from './pages/Login';
import Main from './pages/Main';
import Courses from './pages/Courses';
import Directions from './pages/Directions';
import Levels from './pages/Levels';
import Roles from './pages/Roles';
import Users from './pages/Users';
import Settings from './pages/Settings';
import CreateDirection from './pages/CreateDirection';
import CreateLevel from './pages/CreateLevel';
import CreateUser from './pages/CreateUser';
import CreateRole from './pages/CreateRole';
import CreateCourse from './pages/CreateCourse';
import EditDirection from './pages/EditDirection';
import EditLevel from './pages/EditLevel';
import EditUser from './pages/EditUser';
import EditRole from './pages/EditRole';
import EditCourse from './pages/EditCourse';
import CoursePreview from './pages/CoursePreview';
import ViewCourse from './pages/ViewCourse';
import ApplicationForm from './pages/ApplicationForm';
import Forms from './pages/Forms';
import Keys from './pages/Keys';
import Promos from './pages/Promos';
import RedeemKey from './pages/RedeemKey';
import ViewForm from './pages/ViewForm';
import Sessions from './pages/Sessions';
import ManageSession from './pages/ManageSession';
import StudentDashboard from './pages/StudentDashboard';
import Grades from './pages/Grades';
import { VideoConference } from './components/VideoConference';

const API = toHttps(process.env.REACT_APP_API_URL || 'http://localhost:4040/api');
const DEFAULT_USER = { id:'', nickname:'', email:'', role:'', tutorRank: null, accessLevel: 'default' };

// ── /meeting?session=ID page ──────────────────────────────────────────────────
// Delegates to App-level pip so mini↔full never remounts VideoConference.
function MeetingRoute({ userData, startMeeting }) {
    const [params] = useSearchParams();
    const navigate  = useNavigate();
    const sessionId = params.get('session');

    useEffect(() => {
        if (!sessionId) { navigate('/'); return; }
        startMeeting({ sessionId, roomId: null });
        navigate('/', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    return null;
}


function App() {
    const navigate = useNavigate();
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [userData,   setUserData]   = useState(DEFAULT_USER);
    const [meeting,    setMeeting]    = useState(null);
    const [meetingMode, setMeetingMode] = useState('full');

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return;
        (async () => {
            try {
                const r = await fetch(`${API}/users/c`, { headers: { Authorization: token } });
                if (r.status === 401) { localStorage.removeItem('token'); return; }
                if (r.ok) {
                    const { user } = await r.json();
                    setUserData({ _id: user._id, nickname: user.nickname, email: user.email, role: user.role, tutorRank: user.tutorRank || null, accessLevel: user.role?.accessLevel || 'default', links: user.links || [] });
                    setIsLoggedIn(true);
                } else { localStorage.removeItem('token'); }
            } catch { localStorage.removeItem('token'); }
        })();
    }, [isLoggedIn]);

    const handleLogin = (user) => {
        setUserData({ _id: user._id, nickname: user.nickname, email: user.email, role: user.role, tutorRank: user.tutorRank || null, accessLevel: user.role?.accessLevel || 'default', links: user.links || [] });
        setIsLoggedIn(true);
        navigate('/');
    };

    const handleLogout = () => {
        setMeeting(null);
        setIsLoggedIn(false);
        setUserData(DEFAULT_USER);
        localStorage.removeItem('token');
        navigate('/login');
    };

    // Floating mini-pip meeting (for meetings started from inside the app, not /meeting route)
    const startMeeting  = useCallback(({ roomId, sessionId }) => { setMeeting({ roomId: roomId || null, sessionId: sessionId || null, nickname: userData.nickname || 'Guest' }); setMeetingMode('full'); }, [userData]);
    const endMeeting    = useCallback(() => { setMeeting(null); navigate('/'); }, [navigate]);
    const minimizeMeeting = useCallback(() => setMeetingMode('mini'), []);
    const expandMeeting   = useCallback(() => setMeetingMode('full'), []);

    const meetingProps = { startMeeting, endMeeting, activeMeeting: meeting };

    const R = (Component, extra = {}) =>
        isLoggedIn ? <Component data={userData} onLogout={handleLogout} {...meetingProps} {...extra} /> : <Login onLogin={handleLogin} />;

    return (
        <>
            <style>{`
                @keyframes vcFadeIn  { from{opacity:0;transform:scale(.97)} to{opacity:1;transform:none} }
                @keyframes vcMiniIn  { from{opacity:0;transform:scale(.8) translateY(12px)} to{opacity:1;transform:none} }
                .vc-full-wrap { position:fixed;inset:0;z-index:3000;animation:vcFadeIn .2s ease }
            `}</style>

            {/* Single persistent instance — mini prop changes in-place, no remount */}
            {meeting && (
                <div className={meetingMode === 'full' ? 'vc-full-wrap' : ''}>
                    <VideoConference
                        key={meeting.roomId || meeting.sessionId}
                        roomId={meeting.roomId}
                        sessionId={meeting.sessionId}
                        nickname={meeting.nickname}
                        onClose={endMeeting}
                        mini={meetingMode === 'mini'}
                        onExpand={expandMeeting}
                        onMinimize={minimizeMeeting}
                    />
                </div>
            )}

            <Routes>
                <Route path="/login" element={isLoggedIn ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} />
                <Route path="/"      element={R(Main)} />

                <Route path="/creator/apply"       element={R(ApplicationForm, { formType: 'creator' })} />
                <Route path="/tutor/apply"         element={R(ApplicationForm, { formType: 'tutor' })} />
                <Route path="/support/open-ticket" element={R(ApplicationForm, { formType: 'support-ticket' })} />
                <Route path="/manage/forms"            element={R(Forms)} />
                <Route path="/manage/forms/detail/:id" element={R(ViewForm)} />

                <Route path="/manage/courses"        element={R(Courses)} />
                <Route path="/manage/courses/create" element={R(CreateCourse)} />
                <Route path="/manage/course/:id"     element={R(EditCourse)} />
                <Route path="/course/preview/:id"    element={R(CoursePreview)} />
                <Route path="/course/view/:id"       element={R(ViewCourse)} />

                <Route path="/manage/settings" element={R(Settings)} />

                <Route path="/manage/directions"        element={R(Directions)} />
                <Route path="/manage/directions/create" element={R(CreateDirection)} />
                <Route path="/manage/direction/:id"     element={R(EditDirection)} />

                <Route path="/manage/levels"        element={R(Levels)} />
                <Route path="/manage/levels/create" element={R(CreateLevel)} />
                <Route path="/manage/level/:id"     element={R(EditLevel)} />

                <Route path="/manage/users"        element={R(Users)} />
                <Route path="/manage/users/create" element={R(CreateUser)} />
                <Route path="/manage/user/:id"     element={R(EditUser)} />

                <Route path="/manage/roles"        element={R(Roles)} />
                <Route path="/manage/roles/create" element={R(CreateRole)} />
                <Route path="/manage/role/:id"     element={R(EditRole)} />

                <Route path="/manage/promos" element={R(Promos)} />
                <Route path="/manage/keys"   element={R(Keys)} />
                <Route path="/redeem"        element={R(RedeemKey)} />

                <Route path="/manage/sessions"    element={R(Sessions)} />
                <Route path="/manage/session/:id" element={R(ManageSession)} />

                <Route path="/my-courses" element={R(StudentDashboard)} />
                <Route path="/my-grades"  element={R(Grades)} />

                {/* ── Sole meeting entry point ── */}
                <Route path="/meeting" element={
                    isLoggedIn
                        ? <MeetingRoute userData={userData} startMeeting={startMeeting} />
                        : <Login onLogin={handleLogin} />
                } />

                <Route path="*" element={<Navigate to={isLoggedIn ? '/' : '/login'} />} />
            </Routes>
        </>
    );
}

export default App;
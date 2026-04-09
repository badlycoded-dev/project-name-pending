import { toHttps } from '../utils/utils';
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AppLayout from '../components/Layout';
import { UtilityModal } from "../components/UtilityModal";
import { VideoConference } from "../components/VideoConference";

const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');
const TUTOR_RANKS = ['assistant','teacher','lecturer','instructor','tutor','professor'];
const MARK_SCALES = ['5','12','100','custom'];

// ── Calendar schedule view ─────────────────────────────────────────────────
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ScheduleCalendar({ schedule = [], onRemove, canEdit, onEventClick, onCopyLink }) {
    const [calYear, setCalYear]   = useState(() => new Date().getFullYear());
    const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
    const [view, setView]         = useState('month'); // 'month' | 'list'

    // Expand recurring events into actual occurrences for this month
    const expandEvents = () => {
        const events = [];
        const start = new Date(calYear, calMonth, 1);
        const end   = new Date(calYear, calMonth + 1, 0, 23, 59, 59);

        schedule.forEach((entry, idx) => {
            const base = new Date(entry.datetime);
            if (!entry.isRecurring) {
                if (base >= start && base <= end) {
                    events.push({ ...entry, _idx: idx, occDate: base });
                }
                return;
            }
            // Generate occurrences
            const freq = entry.recurrence?.frequency || 'weekly';
            const endDate = entry.recurrence?.endDate ? new Date(entry.recurrence.endDate) : null;
            const maxOcc  = entry.recurrence?.maxOccurrences || 52;
            let cursor = new Date(base);
            let count  = 0;
            while (count < maxOcc) {
                if (endDate && cursor > endDate) break;
                if (cursor > end) break;
                if (cursor >= start) {
                    events.push({ ...entry, _idx: idx, occDate: new Date(cursor), _generated: true });
                }
                count++;
                switch (freq) {
                    case 'daily':    cursor.setDate(cursor.getDate() + 1); break;
                    case 'weekly':   cursor.setDate(cursor.getDate() + 7); break;
                    case 'biweekly': cursor.setDate(cursor.getDate() + 14); break;
                    case 'monthly':  cursor.setMonth(cursor.getMonth() + 1); break;
                    default:         cursor.setDate(cursor.getDate() + 7);
                }
            }
        });
        return events;
    };

    const events = expandEvents();

    // Build grid: days array for month view
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const daysInPrev  = new Date(calYear, calMonth, 0).getDate();
    const totalCells  = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    const cells = [];
    for (let i = 0; i < totalCells; i++) {
        let d, isOther = false;
        if (i < firstDay) { d = new Date(calYear, calMonth - 1, daysInPrev - firstDay + i + 1); isOther = true; }
        else if (i < firstDay + daysInMonth) { d = new Date(calYear, calMonth, i - firstDay + 1); }
        else { d = new Date(calYear, calMonth + 1, i - firstDay - daysInMonth + 1); isOther = true; }
        const dayEvents = events.filter(e => e.occDate.toDateString() === d.toDateString());
        cells.push({ date: d, isOther, dayEvents });
    }

    const today = new Date();
    const isToday = (d) => d.toDateString() === today.toDateString();

    return (
        <div>
            {/* Toolbar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.75rem', gap:'1rem', flexWrap:'wrap' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                        if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); }
                        else setCalMonth(m => m-1);
                    }}>‹</button>
                    <span style={{ fontWeight:700, fontSize:'1rem', minWidth:160, textAlign:'center' }}>
                        {MONTHS[calMonth]} {calYear}
                    </span>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => {
                        if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); }
                        else setCalMonth(m => m+1);
                    }}>›</button>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => { setCalMonth(today.getMonth()); setCalYear(today.getFullYear()); }}>Today</button>
                </div>
                <div style={{ display:'flex', gap:'.5rem' }}>
                    <button className={`btn btn-sm ${view==='month'?'btn-primary':'btn-outline-secondary'}`} onClick={() => setView('month')}>
                        <i className="bi bi-grid-3x3-gap me-1" />Month
                    </button>
                    <button className={`btn btn-sm ${view==='list'?'btn-primary':'btn-outline-secondary'}`} onClick={() => setView('list')}>
                        <i className="bi bi-list-ul me-1" />List
                    </button>
                </div>
            </div>

            {/* Month view */}
            {view === 'month' && (
                <div style={{ border:'1px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                    {/* Day headers */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background:'var(--table-head-bg)', borderBottom:'1px solid var(--border)' }}>
                        {DAYS.map(d => (
                            <div key={d} style={{ textAlign:'center', padding:'.45rem', fontSize:'.65rem', fontWeight:700, letterSpacing:'.07em', textTransform:'uppercase', color:'var(--text-muted)' }}>{d}</div>
                        ))}
                    </div>
                    {/* Day cells */}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                        {cells.map((cell, i) => (
                            <div key={i} style={{
                                minHeight:80, padding:'.35rem', borderRight: (i+1)%7===0?'none':'1px solid var(--border)',
                                borderBottom: i >= totalCells-7 ? 'none' : '1px solid var(--border)',
                                background: isToday(cell.date) ? 'var(--accent-light)' : 'var(--surface)',
                                opacity: cell.isOther ? .4 : 1,
                            }}>
                                <div style={{
                                    width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                                    background: isToday(cell.date) ? 'var(--accent)' : 'transparent',
                                    color: isToday(cell.date) ? '#fff' : 'var(--text-2)',
                                    fontWeight:600, fontSize:'.78rem', marginBottom:2
                                }}>{cell.date.getDate()}</div>
                                {cell.dayEvents.slice(0,3).map((ev, j) => (
                                    <div key={j} title={ev.title}
                                        onClick={() => onEventClick?.(ev)}
                                        style={{
                                            fontSize:'.6rem', padding:'1px 4px', borderRadius:3, marginBottom:1,
                                            background: ev.meetingLink ? 'var(--success)' : ev._generated ? 'var(--info)' : 'var(--accent)',
                                            color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                                            cursor:'pointer'
                                        }}>
                                        {new Date(ev.occDate).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} {ev.title}
                                    </div>
                                ))}
                                {cell.dayEvents.length > 3 && (
                                    <div style={{ fontSize:'.6rem', color:'var(--text-muted)', paddingLeft:4 }}>+{cell.dayEvents.length-3} more</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* List view */}
            {view === 'list' && (
                <div>
                    {schedule.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon">📅</div>
                            <div className="empty-state-title">No schedule entries</div>
                            <div style={{ fontSize:'.82rem', color:'var(--text-muted)' }}>Add your first meeting below</div>
                        </div>
                    ) : (
                        <div className="d-flex flex-column gap-2">
                            {schedule.map((s, i) => {
                                const dt = new Date(s.datetime);
                                const isPast = dt < new Date();
                                return (
                                    <div key={i} className="card" style={{ opacity: isPast ? .7 : 1 }}>
                                        <div className="card-body py-2 px-3 d-flex align-items-center gap-3">
                                            <div style={{ textAlign:'center', borderRight:'1px solid var(--border)', paddingRight:12, minWidth:48 }}>
                                                <div style={{ fontWeight:700, fontSize:'1.2rem', color:isPast?'var(--text-muted)':'var(--accent)', lineHeight:1 }}>{dt.getDate()}</div>
                                                <div style={{ fontSize:'.62rem', color:'var(--text-muted)' }}>{dt.toLocaleString('en',{month:'short'})} {dt.getFullYear()}</div>
                                            </div>
                                            <div style={{ flex:1, minWidth:0 }}>
                                                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                                                    <span style={{ fontWeight:600, fontSize:'.88rem' }}>{s.title}</span>
                                                    {isPast && <span className="badge bg-secondary" style={{fontSize:'.6rem'}}>Past</span>}
                                                    {s.isRecurring && <span className="badge bg-info" style={{fontSize:'.6rem'}}><i className="bi bi-arrow-repeat me-1" />{s.recurrence?.frequency}</span>}
                                                </div>
                                                <div style={{ fontSize:'.75rem', color:'var(--text-muted)' }}>
                                                    {dt.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} · {s.durationMin} min
                                                    {s.notes && <> · <em>{s.notes}</em></>}
                                                </div>
                                            </div>
                                            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                                                {s.meetingLink && (
                                                    <>
                                                        <button className="btn btn-sm btn-outline-success" style={{fontSize:'.75rem'}} onClick={() => onEventClick?.(s)}>
                                                            <i className="bi bi-camera-video me-1" />Join
                                                        </button>
                                                        <button className="btn btn-sm btn-outline-secondary" style={{fontSize:'.75rem'}} onClick={() => onCopyLink?.(s)} title="Copy invite link">
                                                            <i className="bi bi-link-45deg" />
                                                        </button>
                                                    </>
                                                )}
                                                {canEdit && (
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => onRemove(i)} title="Remove">
                                                        <i className="bi bi-trash" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}



// ── Per-meeting chat panel ────────────────────────────────────────────────────
function MeetingChatPanel({ schedule, meetingChats, getOrCreateMeetingChat, ah, myId }) {
    const [selectedKey, setSelectedKey] = useState(null);
    const [messages, setMessages]       = useState([]);
    const [text, setText]               = useState('');
    const [loading, setLoading]         = useState(false);
    const [sending, setSending]         = useState(false);
    const [chatId, setChatId]           = useState(null);
    const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');

    const meetingChatKey = (e) => e.isRecurring
        ? `rec:${e.title}:${e.recurrence?.frequency||'weekly'}`
        : `once:${e.title}:${e.datetime}`;

    const uniqueEntries = schedule.reduce((acc, e) => {
        const k = meetingChatKey(e);
        if (!acc.find(x => meetingChatKey(x) === k)) acc.push(e);
        return acc;
    }, []);

    const loadChat = async (entry) => {
        const key = meetingChatKey(entry);
        setSelectedKey(key);
        setLoading(true);
        const cid = await getOrCreateMeetingChat(entry);
        setChatId(cid);
        if (cid) {
            const r = await fetch(`${API}/chats/${cid}/messages?limit=100`, { headers: ah });
            if (r.ok) { const d = await r.json(); setMessages(d.data || []); }
        }
        setLoading(false);
    };

    const send = async (e) => {
        e.preventDefault();
        if (!text.trim() || !chatId || sending) return;
        setSending(true);
        await fetch(`${API}/chats/${chatId}/messages`, { method: 'POST', headers: ah, body: JSON.stringify({ text: text.trim() }) });
        setText('');
        const r = await fetch(`${API}/chats/${chatId}/messages?limit=100`, { headers: ah });
        if (r.ok) { const d = await r.json(); setMessages(d.data || []); }
        setSending(false);
    };

    return (
        <div className="card border-0 shadow-sm mt-3">
            <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                <i className="bi bi-chat-left-text text-info" />Meeting Chats
                <small className="text-muted fw-normal ms-1">— one chat per meeting (recurring meetings share a single chat)</small>
            </div>
            <div className="card-body p-0 d-flex" style={{ minHeight: 320, maxHeight: 420 }}>
                {/* Sidebar: meeting list */}
                <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid var(--bs-border-color,#dee2e6)', overflowY: 'auto' }}>
                    {uniqueEntries.map(entry => {
                        const key = meetingChatKey(entry);
                        const isActive = selectedKey === key;
                        const hasChatId = !!meetingChats[key];
                        return (
                            <button key={key} onClick={() => loadChat(entry)}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '.6rem .9rem', border: 'none', borderBottom: '1px solid var(--bs-border-color,#dee2e6)', background: isActive ? 'var(--bs-primary-bg-subtle,#e7f5ff)' : 'transparent', cursor: 'pointer', transition: 'background .12s' }}>
                                <div style={{ fontWeight: 600, fontSize: '.8rem', color: isActive ? 'var(--bs-primary,#1971c2)' : 'var(--bs-body-color)', marginBottom: 2 }}>{entry.title}</div>
                                <div style={{ fontSize: '.72rem', color: '#868e96' }}>
                                    {entry.isRecurring ? <><i className="bi bi-arrow-repeat me-1" />{entry.recurrence?.frequency||'recurring'}</> : new Date(entry.datetime).toLocaleDateString([], { month:'short', day:'numeric' })}
                                </div>
                                {hasChatId && <div style={{ fontSize: '.65rem', color: '#2f9e44', marginTop: 2 }}><i className="bi bi-chat-dots me-1" />Chat loaded</div>}
                            </button>
                        );
                    })}
                </div>
                {/* Chat area */}
                {selectedKey ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        {loading ? (
                            <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted">
                                <span className="spinner-border spinner-border-sm me-2" />Loading chat…
                            </div>
                        ) : (
                            <>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {messages.length === 0 && <div className="text-center text-muted py-4" style={{ fontSize: '.83rem' }}>No messages yet in this meeting chat.</div>}
                                    {messages.map(msg => {
                                        const isMine = (msg.sender?._id || msg.sender) === myId;
                                        return (
                                            <div key={msg._id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                                                <div style={{ maxWidth: '70%' }}>
                                                    {!isMine && <div style={{ fontSize: '.68rem', color: '#868e96', marginBottom: 2, marginLeft: 4 }}>{msg.sender?.nickname || 'Unknown'}</div>}
                                                    <div style={{ background: isMine ? '#1971c2' : '#f1f3f5', color: isMine ? '#fff' : '#1a1b2e', borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px', padding: '6px 11px', fontSize: '.83rem', wordBreak: 'break-word' }}>{msg.text}</div>
                                                    <div style={{ fontSize: '.65rem', color: '#adb5bd', marginTop: 1, textAlign: isMine ? 'right' : 'left', padding: '0 4px' }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <form onSubmit={send} style={{ padding: '8px 12px', borderTop: '1px solid var(--bs-border-color,#dee2e6)', display: 'flex', gap: 8 }}>
                                    <input className="form-control form-control-sm" placeholder="Type a message…" value={text} onChange={e => setText(e.target.value)} />
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={sending || !text.trim()}>
                                        {sending ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send-fill" />}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="d-flex align-items-center justify-content-center flex-grow-1 text-muted" style={{ fontSize: '.85rem' }}>
                        <span>Select a meeting from the list to open its chat</span>
                    </div>
                )}
            </div>
        </div>
    );
}

function ManageSession({ data, onLogout, startMeeting }) {
    const { id } = useParams();
    const navigate = useNavigate();
    const token = localStorage.getItem("token");
    const ah = { Authorization: `${token?.split(" ")[0]} ${token?.split(" ")[1]}`, "Content-Type": "application/json" };
    const mh = { Authorization: `${token?.split(" ")[0]} ${token?.split(" ")[1]}` };

    // Core state
    const [session, setSession]     = useState(null);
    const [groups, setGroups]       = useState([]);
    const [loading, setLoading]     = useState(true);
    const [tab, setTab]             = useState("overview");
    const [saving, setSaving]       = useState(false);

    // ── Video conference ────────────────────────────────────────────────────
    const [showConference, setShowConference] = useState(false);
    const [inviteCopied, setInviteCopied]     = useState(false);
    const RTC_API = toHttps(process.env.REACT_APP_RTC_URL || 'https://localhost:5050');

    const copyInviteLink = async () => {
        try {
            const token = localStorage.getItem("token");
            const ah2 = { Authorization: `${token?.split(" ")[0]} ${token?.split(" ")[1]}`, "Content-Type": "application/json" };
            await fetch(`${RTC_API}/rooms`, {
                method: "POST",
                headers: ah2,
                body: JSON.stringify({ sessionId: id, displayName: id })
            });
        } catch {}
        const link = `${window.location.origin}/meeting?session=${id}`;
        navigator.clipboard.writeText(link).then(() => {
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2500);
        });
    };

    // Modal
    const [modal, setModal] = useState({ show: false, type: "info", title: "", message: "", confirmToken: "", tokenLabel: "", onConfirm: null, onDelete: null, onCancel: null, onClose: null, danger: false });
    const closeModal  = () => setModal(p => ({ ...p, show: false }));
    const showInfo    = (t, m) => setModal({ show: true, type: "info", title: t, message: m, onClose: closeModal });
    const showConfirm = (t, m, fn, d = false) => setModal({ show: true, type: "confirm", danger: d, title: t, message: m, onConfirm: fn, onCancel: closeModal });

    // ── Schedule state ──────────────────────────────────────────────────────
    const [scheduleForm, setScheduleForm] = useState({
        title: "", datetime: "", durationMin: 60, meetingLink: "", notes: "",
        isRecurring: false,
        recurrence: { frequency: "weekly", daysOfWeek: [], endDate: "", maxOccurrences: "" }
    });
    const [savingSchedule, setSavingSchedule] = useState(false);

    // ── Deadline state ──────────────────────────────────────────────────────
    const [deadlineForm, setDeadlineForm] = useState({ targetType: "item", targetId: "", dueAt: "", description: "", lockAfterDue: false });
    const [savingDeadline, setSavingDeadline] = useState(false);

    // ── Group state ─────────────────────────────────────────────────────────
    const [newGroupName, setNewGroupName] = useState("");
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [memberSearch, setMemberSearch] = useState("");
    const [memberResults, setMemberResults] = useState([]);
    const [addingMember, setAddingMember] = useState(false);

    // ── Assignment state ────────────────────────────────────────────────────
    const [assignmentForm, setAssignmentForm] = useState({
        title: "", description: "", dueAt: "", markScale: "5", maxMark: "5", groupIds: [], files: []
    });
    const [savingAssignment, setSavingAssignment] = useState(false);
    const [assignments, setAssignments]   = useState([]);
    const [submissions, setSubmissions]   = useState({});  // { [assignmentId]: [submission,...] }
    const [gradingId, setGradingId]       = useState(null);
    const [gradeForm, setGradeForm]       = useState({ mark: "", feedback: "", status: "approved" });
    const [editingAssignment, setEditingAssignment] = useState(null);  // assignment being edited
    const [editForm, setEditForm]         = useState(null);
    const [savingEdit, setSavingEdit]     = useState(false);

    // ── Co-tutor state ──────────────────────────────────────────────────────
    const [coTutorSearch, setCoTutorSearch]   = useState("");
    const [coTutorResults, setCoTutorResults] = useState([]);

    // ── Private copy state ──────────────────────────────────────────────────
    const [creatingCopy, setCreatingCopy] = useState(false);

    // ── Global session chat state ────────────────────────────────────────────
    const [globalChatMessages, setGlobalChatMessages] = useState([]);
    const [globalChatText,     setGlobalChatText]     = useState('');
    const [globalChatLoading,  setGlobalChatLoading]  = useState(false);
    const [globalChatSending,  setGlobalChatSending]  = useState(false);
    const [globalChatId,       setGlobalChatId]       = useState(null);
    const globalChatPollRef = useRef(null);

    // ── Per-meeting chat state ────────────────────────────────────────────────
    const [meetingChats, setMeetingChats] = useState({});

    // ── Settings state ────────────────────────────────────────────────────────
    const [settingsForm, setSettingsForm]   = useState({ courseType: '', status: '' });
    const [settingsSaving, setSettingsSaving] = useState(false);

    // ── Host reassign state ───────────────────────────────────────────────────
    const [hostSearch, setHostSearch]   = useState('');
    const [hostResults, setHostResults] = useState([]);

    // ── Fetch ───────────────────────────────────────────────────────────────
    const fetchSession = useCallback(async () => {
        try {
            const res = await fetch(`${API}/sessions/${id}`, { headers: ah });
            if (res.ok) { const d = await res.json(); setSession(d.data);}
            else if (res.status === 403) { showInfo("Access Denied", "You are not a tutor in this session."); navigate("/manage/sessions"); }
        } catch (e) { console.error(e); }
    }, [id]);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await fetch(`${API}/groups?sessionId=${id}`, { headers: ah });
            if (res.ok) { const d = await res.json(); setGroups(d.data || []); }
        } catch (e) { console.error(e); }
    }, [id]);

    const fetchAssignments = useCallback(async (groupId) => {
        if (!groupId) return;
        try {
            const res = await fetch(`${API}/assignments?groupId=${groupId}`, { headers: ah });
            if (res.ok) { const d = await res.json(); setAssignments(d.data || []); }
        } catch (e) { console.error(e); }
    }, []);

    const fetchAllAssignments = useCallback(async () => {
        if (!groups.length) return;
        try {
            const results = await Promise.all(
                groups.map(g => fetch(`${API}/assignments?groupId=${g._id}`, { headers: ah }).then(r => r.ok ? r.json() : { data: [] }))
            );
            const all = results.flatMap(r => r.data || []);
            // deduplicate by _id
            const seen = new Set();
            setAssignments(all.filter(a => { if (seen.has(a._id)) return false; seen.add(a._id); return true; }));
        } catch (e) { console.error(e); }
    }, [groups]);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            await Promise.all([fetchSession(), fetchGroups()]);
            setLoading(false);
        };
        load();
    }, [id]);

    useEffect(() => {
        if (selectedGroup) fetchAssignments(selectedGroup._id);
    }, [selectedGroup]);

    useEffect(() => {
        if (tab === "assignments" && groups.length) fetchAllAssignments();
    }, [tab, groups]);

    // ── Helpers ─────────────────────────────────────────────────────────────
    const courseTitle = (c) => c?.trans?.[0]?.title || c?.title || "(untitled)";
    const isHost = session && String(session.hostTutor?._id || session.hostTutor) === String(data._id);
    const myCoEntry = session?.coTutors?.find(ct => String(ct.userId?._id || ct.userId) === String(data._id));
    const isPrivileged   = ['manage','admin','root','quality'].includes(data.accessLevel);
    const canEditSession = isHost || (myCoEntry?.canSchedule) || isPrivileged;
    const canGrade       = isHost || (myCoEntry?.canGrade) || isPrivileged;
    const canSettings    = (isHost || isPrivileged);  // co-tutors excluded

    const overdueDeduction = (scale) => ['12','100'].includes(scale) ? 2 : 1;

    // ── Status update ───────────────────────────────────────────────────────
    const updateStatus = async (status) => {
        setSaving(true);
        try {
            const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ status }) });
            if (res.ok) fetchSession();
            else { const d = await res.json(); showInfo("Error", d.message); }
        } catch (e) { showInfo("Error", "Network error"); }
        setSaving(false);
    };

    // ── Private copy ────────────────────────────────────────────────────────
    const handleCreatePrivateCopy = async () => {
        setCreatingCopy(true);
        try {
            const res = await fetch(`${API}/sessions/${id}/private-copy`, { method: "POST", headers: ah });
            const d = await res.json();
            if (res.ok) { showInfo("Created", `Private copy created (${d.message})`); fetchSession(); }
            else showInfo("Error", d.message);
        } catch (e) { showInfo("Error", "Network error"); }
        setCreatingCopy(false);
    };

    // ── Toggle copyEditAllowed ───────────────────────────────────────────────
    const toggleCopyEdit = async () => {
        const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah,
            body: JSON.stringify({ copyEditAllowed: !session.copyEditAllowed }) });
        if (res.ok) fetchSession();
    };

    // ── Schedule ────────────────────────────────────────────────────────────
    const addScheduleEntry = async (e) => {
        e.preventDefault();
        if (!scheduleForm.title || !scheduleForm.datetime) { showInfo("Validation", "Title and date/time are required"); return; }
        setSavingSchedule(true);
        const entry = {
            title: scheduleForm.title,
            datetime: scheduleForm.datetime,
            durationMin: +scheduleForm.durationMin,
            meetingLink: scheduleForm.meetingLink,
            notes: scheduleForm.notes,
            isRecurring: scheduleForm.isRecurring,
        };
        if (scheduleForm.isRecurring) {
            entry.recurrence = {
                frequency: scheduleForm.recurrence.frequency,
                daysOfWeek: scheduleForm.recurrence.daysOfWeek,
                endDate: scheduleForm.recurrence.endDate || null,
                maxOccurrences: scheduleForm.recurrence.maxOccurrences ? +scheduleForm.recurrence.maxOccurrences : null,
            };
        }
        const newSchedule = [...(session.schedule || []), entry];
        try {
            const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ schedule: newSchedule }) });
            if (res.ok) {
                fetchSession();
                setScheduleForm({ title: "", datetime: "", durationMin: 60, meetingLink: "", notes: "", isRecurring: false, recurrence: { frequency: "weekly", daysOfWeek: [], endDate: "", maxOccurrences: "" } });
            } else { const d = await res.json(); showInfo("Error", d.message); }
        } catch (e) { showInfo("Error", "Network error"); }
        setSavingSchedule(false);
    };

    const removeScheduleEntry = async (idx) => {
        const newSchedule = session.schedule.filter((_, i) => i !== idx);
        const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ schedule: newSchedule }) });
        if (res.ok) fetchSession();
    };

    // ── Deadlines ───────────────────────────────────────────────────────────
    const addDeadline = async (e) => {
        e.preventDefault();
        if (!deadlineForm.targetId || !deadlineForm.dueAt) { showInfo("Validation", "Target ID and due date required"); return; }
        setSavingDeadline(true);
        const newDeadlines = [...(session.deadlines || []), deadlineForm];
        try {
            const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ deadlines: newDeadlines }) });
            if (res.ok) { fetchSession(); setDeadlineForm({ targetType: "item", targetId: "", dueAt: "", description: "", lockAfterDue: false }); }
            else { const d = await res.json(); showInfo("Error", d.message); }
        } catch (e) { showInfo("Error", "Network error"); }
        setSavingDeadline(false);
    };

    const removeDeadline = async (idx) => {
        const newDeadlines = session.deadlines.filter((_, i) => i !== idx);
        const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ deadlines: newDeadlines }) });
        if (res.ok) fetchSession();
    };

    // ── Groups ──────────────────────────────────────────────────────────────
    const createGroup = async (e) => {
        e.preventDefault();
        if (!newGroupName.trim()) return;
        try {
            const res = await fetch(`${API}/groups`, { method: "POST", headers: ah, body: JSON.stringify({ sessionId: id, name: newGroupName.trim() }) });
            if (res.ok) { setNewGroupName(""); fetchGroups(); }
            else { const d = await res.json(); showInfo("Error", d.message); }
        } catch (e) { showInfo("Error", "Network error"); }
    };

    // ── Live member search ───────────────────────────────────────────────────
    useEffect(() => {
        if (memberSearch.trim().length < 2) { setMemberResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/users?search=${encodeURIComponent(memberSearch.trim())}`, { headers: ah });
                if (res.ok) { const d = await res.json(); setMemberResults(d.data || []); }
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(t);
    }, [memberSearch]);

    const addMember = async (groupId, emailOrNickname) => {
        const query = emailOrNickname || memberSearch.trim();
        if (!query) return;
        setAddingMember(true);
        try {
            const res = await fetch(`${API}/groups/${groupId}/members`, { method: "POST", headers: ah, body: JSON.stringify({ emailOrNickname: query }) });
            const d = await res.json();
            if (res.ok) { showInfo("Added", `${d.data?.nickname} added to group.`); setMemberSearch(""); setMemberResults([]); fetchGroups(); }
            else showInfo("Error", d.message);
        } catch (e) { showInfo("Error", "Network error"); }
        setAddingMember(false);
    };

    const removeMember = (groupId, userId, nickname) => {
        showConfirm("Remove Member", `Remove ${nickname} from this group?`, async () => {
            const res = await fetch(`${API}/groups/${groupId}/members/${userId}`, { method: "DELETE", headers: ah });
            if (res.ok) fetchGroups();
            else { const d = await res.json(); showInfo("Error", d.message); }
        }, true);
    };

    const deleteGroup = (group) => {
        showConfirm("Delete Group", `Delete group "${group.name}"? All assignment records will be lost.`, async () => {
            const res = await fetch(`${API}/groups/${group._id}`, { method: "DELETE", headers: ah });
            if (res.ok) { fetchGroups(); if (selectedGroup?._id === group._id) setSelectedGroup(null); }
            else { const d = await res.json(); showInfo("Error", d.message); }
        }, true);
    };

    // ── Assignments ─────────────────────────────────────────────────────────
    const createAssignment = async (e) => {
        e.preventDefault();
        const groupIds = assignmentForm.groupIds.length ? assignmentForm.groupIds : (selectedGroup ? [selectedGroup._id] : []);
        if (!groupIds.length) { showInfo("Validation", "Select at least one group"); return; }
        if (!assignmentForm.title || !assignmentForm.dueAt || !assignmentForm.maxMark) { showInfo("Validation", "Title, due date, and max mark required"); return; }
        setSavingAssignment(true);
        try {
            const courseId = session.privateCopyId || session.courseId?._id || session.courseId;
            // Create for each group
            for (const gId of groupIds) {
                const formData = new FormData();
                formData.append("sessionId", id);
                formData.append("groupId", gId);
                formData.append("courseId", courseId);
                formData.append("title", assignmentForm.title);
                formData.append("description", assignmentForm.description);
                formData.append("dueAt", assignmentForm.dueAt);
                formData.append("markScale", assignmentForm.markScale);
                formData.append("maxMark", assignmentForm.maxMark);
                (assignmentForm.files || []).forEach(f => formData.append("taskFiles", f));
                await fetch(`${API}/assignments`, { method: "POST", headers: mh, body: formData });
            }
            showInfo("Created", `Assignment created for ${groupIds.length} group(s).`);
            setAssignmentForm({ title: "", description: "", dueAt: "", markScale: "5", maxMark: "5", groupIds: [], files: [] });
            fetchGroups();
            fetchAllAssignments();
        } catch (e) { showInfo("Error", "Network error"); }
        setSavingAssignment(false);
    };

    const startEditAssignment = (a) => {
        setEditingAssignment(a._id);
        setEditForm({
            title: a.title,
            description: a.description,
            dueAt: a.dueAt ? new Date(a.dueAt).toISOString().slice(0, 16) : "",
            markScale: a.markScale,
            maxMark: String(a.maxMark),
            newFiles: [],
            removedFiles: []
        });
    };

    const saveEditAssignment = async (a) => {
        if (!editForm.title || !editForm.dueAt || !editForm.maxMark) { showInfo("Validation", "Title, due date, and max mark required"); return; }
        setSavingEdit(true);
        try {
            const formData = new FormData();
            formData.append("title", editForm.title);
            formData.append("description", editForm.description);
            formData.append("dueAt", editForm.dueAt);
            formData.append("markScale", editForm.markScale);
            formData.append("maxMark", editForm.maxMark);
            (editForm.newFiles || []).forEach(f => formData.append("taskFiles", f));
            if (editForm.removedFiles?.length) formData.append("removeFiles", JSON.stringify(editForm.removedFiles));
            const res = await fetch(`${API}/assignments/${a._id}`, { method: "PATCH", headers: mh, body: formData });
            const d = await res.json();
            if (res.ok) { showInfo("Saved", "Assignment updated."); setEditingAssignment(null); setEditForm(null); fetchAllAssignments(); }
            else showInfo("Error", d.message);
        } catch (e) { showInfo("Error", "Network error"); }
        setSavingEdit(false);
    };

    const deleteAssignment = (a) => {
        showConfirm("Delete Assignment", `Delete assignment "${a.title}"? This cannot be undone.`, async () => {
            const res = await fetch(`${API}/assignments/${a._id}`, { method: "DELETE", headers: ah });
            if (res.ok) { fetchAllAssignments(); }
            else { const d = await res.json(); showInfo("Error", d.message); }
        }, true);
    };

    const loadSubmissions = async (groupId, assignmentId) => {
        try {
            const res = await fetch(`${API}/submissions/${groupId}/${assignmentId}`, { headers: ah });
            if (res.ok) { const d = await res.json(); setSubmissions(p => ({ ...p, [assignmentId]: d.data || [] })); }
        } catch (e) { console.error(e); }
    };

    const submitGrade = async (groupId, assignmentId, studentId) => {
        if (!gradeForm.mark || !gradeForm.status) { showInfo("Validation", "Mark and status required"); return; }
        try {
            const res = await fetch(`${API}/submissions/${groupId}/${assignmentId}/${studentId}/grade`, {
                method: "PATCH", headers: ah,
                body: JSON.stringify({ mark: +gradeForm.mark, feedback: gradeForm.feedback, status: gradeForm.status })
            });
            const d = await res.json();
            if (res.ok) {
                showInfo("Graded", `Submission ${gradeForm.status}. Final mark: ${d.data?.mark}`);
                setGradingId(null);
                loadSubmissions(groupId, assignmentId);
            } else showInfo("Error", d.message);
        } catch (e) { showInfo("Error", "Network error"); }
    };

    // ── Co-tutor search ─────────────────────────────────────────────────────
    useEffect(() => {
        if (coTutorSearch.trim().length < 2) { setCoTutorResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`${API}/users?search=${encodeURIComponent(coTutorSearch.trim())}&tutorOnly=true`, { headers: ah });
                if (res.ok) { const d = await res.json(); setCoTutorResults(d.data || []); }
            } catch (e) { console.error(e); }
        }, 300);
        return () => clearTimeout(t);
    }, [coTutorSearch]);

    // Normalize coTutors: strip populated objects down to plain ID strings before patching
    const normalizeCoTutors = (arr) =>
        arr.map(({ userId, canGrade, canSchedule, canEditCopy }) => ({
            userId: String(userId?._id || userId),
            canGrade: !!canGrade,
            canSchedule: !!canSchedule,
            canEditCopy: !!canEditCopy,
        }));

    const addCoTutor = async (userId) => {
        const existing = session.coTutors || [];
        if (existing.some(ct => String(ct.userId?._id || ct.userId) === String(userId))) {
            showInfo("Info", "Already a co-tutor"); return;
        }
        const newCoTutors = normalizeCoTutors([
            ...existing,
            { userId, canGrade: true, canSchedule: true, canEditCopy: false },
        ]);
        const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ coTutors: newCoTutors }) });
        if (res.ok) { fetchSession(); setCoTutorResults([]); setCoTutorSearch(""); }
        else { const d = await res.json(); showInfo("Error", d.message); }
    };

    const removeCoTutor = (userId) => {
        showConfirm("Remove Co-tutor", "Remove this co-tutor from the session?", async () => {
            const newCoTutors = normalizeCoTutors(
                session.coTutors.filter(ct => String(ct.userId?._id || ct.userId) !== String(userId))
            );
            const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ coTutors: newCoTutors }) });
            if (res.ok) fetchSession();
            else { const d = await res.json(); showInfo("Error", d.message); }
        }, true);
    };

    const toggleCoTutorPerm = async (userId, perm) => {
        const newCoTutors = normalizeCoTutors(
            session.coTutors.map(ct => {
                const ctId = String(ct.userId?._id || ct.userId);
                return ctId === String(userId) ? { ...ct, [perm]: !ct[perm] } : ct;
            })
        );
        const res = await fetch(`${API}/sessions/${id}`, { method: "PATCH", headers: ah, body: JSON.stringify({ coTutors: newCoTutors }) });
        if (res.ok) fetchSession();
        else { const d = await res.json(); showInfo("Error", d.message); }
    };

    // ── Global session chat ──────────────────────────────────────────────────
    const pollGlobalChat = async (cid) => {
        if (!cid) return;
        try {
            const r = await fetch(`${API}/chats/${cid}/messages?limit=100`, { headers: ah });
            if (r.ok) { const d = await r.json(); setGlobalChatMessages(d.data || []); }
        } catch {}
    };

    const fetchOrCreateGlobalChat = useCallback(async () => {
        setGlobalChatLoading(true);
        try {
            const listRes = await fetch(`${API}/chats`, { headers: ah });
            if (listRes.ok) {
                const { data: chats } = await listRes.json();
                const tag = `session:${id}`;
                const existing = (chats || []).find(c => c.name === tag);
                if (existing) {
                    setGlobalChatId(existing._id);
                    await pollGlobalChat(existing._id);
                    setGlobalChatLoading(false);
                    return existing._id;
                }
            }
            const r = await fetch(`${API}/chats`, { method: 'POST', headers: ah, body: JSON.stringify({ name: `session:${id}` }) });
            if (r.ok) { const d = await r.json(); setGlobalChatId(d.data._id); setGlobalChatLoading(false); return d.data._id; }
        } catch (e) { console.error(e); }
        setGlobalChatLoading(false);
        return null;
    }, [id]);

    useEffect(() => {
        if (tab === 'overview') fetchOrCreateGlobalChat();
    }, [tab]);

    useEffect(() => {
        if (!globalChatId) return;
        clearInterval(globalChatPollRef.current);
        globalChatPollRef.current = setInterval(() => pollGlobalChat(globalChatId), 4000);
        return () => clearInterval(globalChatPollRef.current);
    }, [globalChatId]);

    const sendGlobalChat = async (e) => {
        e.preventDefault();
        if (!globalChatText.trim() || !globalChatId || globalChatSending) return;
        setGlobalChatSending(true);
        try {
            await fetch(`${API}/chats/${globalChatId}/messages`, { method: 'POST', headers: ah, body: JSON.stringify({ text: globalChatText.trim() }) });
            setGlobalChatText('');
            pollGlobalChat(globalChatId);
        } catch {}
        setGlobalChatSending(false);
    };

    const deleteGlobalChatMsg = async (msgId) => {
        if (!globalChatId) return;
        await fetch(`${API}/chats/${globalChatId}/messages/${msgId}`, { method: 'DELETE', headers: ah });
        pollGlobalChat(globalChatId);
    };

    // ── Per-meeting chat ──────────────────────────────────────────────────────
    const meetingChatKey = (entry) => entry.isRecurring
        ? `rec:${entry.title}:${entry.recurrence?.frequency || 'weekly'}`
        : `once:${entry.title}:${entry.datetime}`;

    const getOrCreateMeetingChat = async (entry) => {
        const key = meetingChatKey(entry);
        if (meetingChats[key]) return meetingChats[key];
        const chatName = `meeting:${id}:${key}`;
        try {
            const listRes = await fetch(`${API}/chats`, { headers: ah });
            if (listRes.ok) {
                const { data: chats } = await listRes.json();
                const existing = (chats || []).find(c => c.name === chatName);
                if (existing) { setMeetingChats(p => ({ ...p, [key]: existing._id })); return existing._id; }
            }
            const r = await fetch(`${API}/chats`, { method: 'POST', headers: ah, body: JSON.stringify({ name: chatName }) });
            if (r.ok) { const d = await r.json(); setMeetingChats(p => ({ ...p, [key]: d.data._id })); return d.data._id; }
        } catch (e) { console.error(e); }
        return null;
    };

    // ── Settings save ─────────────────────────────────────────────────────────
    const saveSettings = async () => {
        setSettingsSaving(true);
        const patch = {};
        if (settingsForm.courseType && settingsForm.courseType !== session.courseType) patch.courseType = settingsForm.courseType;
        if (settingsForm.status     && settingsForm.status     !== session.status)     patch.status     = settingsForm.status;
        if (Object.keys(patch).length) {
            const r = await fetch(`${API}/sessions/${id}`, { method: 'PATCH', headers: ah, body: JSON.stringify(patch) });
            if (!r.ok) { const d = await r.json(); showInfo('Error', d.message); setSettingsSaving(false); return; }
        }
        fetchSession();
        showInfo('Saved', 'Session settings updated.');
        setSettingsSaving(false);
    };

    // ── Host reassign ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (hostSearch.trim().length < 2) { setHostResults([]); return; }
        const t = setTimeout(async () => {
            try {
                const r = await fetch(`${API}/users?search=${encodeURIComponent(hostSearch.trim())}&tutorOnly=true`, { headers: ah });
                if (r.ok) { const d = await r.json(); setHostResults(d.data || []); }
            } catch {}
        }, 300);
        return () => clearTimeout(t);
    }, [hostSearch]);

    const reassignHost = async (newUserId, newNickname) => {
        showConfirm('Reassign Host', `Make ${newNickname} the new host? Current host keeps co-tutor access.`, async () => {
            const currentHostId = String(session.hostTutor?._id || session.hostTutor);
            const alreadyCo = (session.coTutors || []).some(ct => String(ct.userId?._id || ct.userId) === currentHostId);
            const preserved = alreadyCo
                ? session.coTutors
                : [...(session.coTutors || []), { userId: currentHostId, canGrade: true, canSchedule: true, canEditCopy: true }];
            const newCoTutors = normalizeCoTutors(preserved.filter(ct => String(ct.userId?._id || ct.userId) !== String(newUserId)));
            const r = await fetch(`${API}/sessions/${id}`, { method: 'PATCH', headers: ah, body: JSON.stringify({ hostTutor: newUserId, coTutors: newCoTutors }) });
            if (r.ok) { fetchSession(); setHostSearch(''); setHostResults([]); showInfo('Done', `${newNickname} is now the host.`); }
            else { const d = await r.json(); showInfo('Error', d.message); }
        });
    };

    // ── Override rank restriction ───────────────────────────────────────────
    const overrideRank = async () => {
        const res = await fetch(`${API}/sessions/${id}/override-rank`, {
            method: "POST", headers: ah,
            body: JSON.stringify({ tutorId: data._id })
        });
        if (res.ok) { showInfo("Done", "Rank restriction overridden."); fetchSession(); }
        else { const d = await res.json(); showInfo("Error", d.message); }
    };

    // ────────────────────────────────────────────────────────────────────────
    if (loading) return (
        <AppLayout data={data} onLogout={onLogout} title="Session">
            <div className="d-flex align-items-center justify-content-center" style={{minHeight:300}}>
                <div className="spinner-border text-primary" />
            </div>
        </AppLayout>
    );

    if (!session) return (
        <AppLayout data={data} onLogout={onLogout} title="Session">
            <div className="empty-state"><div className="empty-state-icon">🔍</div><div className="empty-state-title">Session not found</div></div>
        </AppLayout>
    );

    const course = session.courseId;
    const statusColors = { draft: 'secondary', active: 'success', completed: 'primary', archived: 'dark' };
    const statusBg     = { draft: '#868e96', active: '#2f9e44', completed: '#1971c2', archived: '#212529' };
    const link = session.privateCopyId===null ? course._id : session.privateCopyId._id;
    const courseTitle2 = courseTitle(course);
    return (
        <AppLayout data={data} onLogout={onLogout} title={courseTitle2}>

                {/* ══ Page header ══ */}
                <div className="mb-4" style={{ borderBottom: '1px solid var(--bs-border-color)', paddingBottom: '1rem' }}>
                    {/* Breadcrumb */}
                    <nav style={{ fontSize: '.78rem', color: '#868e96', marginBottom: '.5rem' }}>
                        <button className="btn btn-link p-0 text-muted text-decoration-none" style={{ fontSize: '.78rem' }} onClick={() => navigate('/manage/sessions')}>
                            <i className="bi bi-chevron-left me-1" style={{ fontSize: '.65rem' }} />Sessions
                        </button>
                        <span className="mx-1">·</span>
                        <span className="fw-medium" style={{ color: 'var(--bs-body-color)' }}>{courseTitle(course)}</span>
                    </nav>

                    <div className="d-flex align-items-start justify-content-between flex-wrap gap-3">
                        {/* Left: title + badges */}
                        <div>
                            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                                <h1 className="h4 fw-bold mb-0">{courseTitle(course)}</h1>
                                <span className="badge rounded-pill" style={{ background: statusBg[session.status] || '#868e96', fontSize: '.72rem' }}>{session.status}</span>
                                <span className="badge rounded-pill bg-light text-dark border" style={{ fontSize: '.72rem' }}>{session.courseType}</span>
                                {session.privateCopyId && <span className="badge rounded-pill bg-warning text-dark" style={{ fontSize: '.72rem' }}><i className="bi bi-files me-1" />Copy active</span>}
                                {session.restrictionIgnored && <span className="badge rounded-pill bg-info text-dark" style={{ fontSize: '.72rem' }}><i className="bi bi-unlock me-1" />Rank override</span>}
                            </div>
                            <div style={{ fontSize: '.8rem', color: '#868e96' }}>
                                Host: <strong style={{ color: 'var(--bs-body-color)' }}>{session.hostTutor?.nickname || '—'}</strong>
                                {session.hostTutor?.tutorRank && <span className="ms-2 badge bg-light text-dark border" style={{ fontSize: '.68rem' }}>{session.hostTutor.tutorRank}</span>}
                                <span className="mx-2">·</span>
                                <span>{session.coTutors?.length || 0} co-tutor{session.coTutors?.length !== 1 ? 's' : ''}</span>
                                <span className="mx-2">·</span>
                                <span>{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {/* Right: action buttons */}
                        <div className="d-flex gap-2 flex-wrap align-items-center">
                            <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/course/view/${course._id}`)}>
                                <i className="bi bi-eye me-1" />View Course
                            </button>
                            <button className="btn btn-sm btn-outline-success" onClick={() => navigate(`/course/view/${link}?session=${id}`)}>
                                <i className="bi bi-play-circle me-1" />Go to Course
                            </button>
                            <button className="btn btn-sm btn-success d-flex align-items-center gap-1" onClick={async () => {
                                // Use global session chat for the main video button
                                startMeeting({ sessionId: id, meetingChatId: globalChatId, meetingTitle: courseTitle(course) });
                            }}>
                                <i className="bi bi-camera-video-fill" />{isHost ? 'Start Video' : 'Join Video'}
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={copyInviteLink} title="Copy invite link">
                                <i className={`bi ${inviteCopied ? 'bi-check-lg' : 'bi-link-45deg'}`} />
                                {inviteCopied ? ' Copied!' : ' Invite'}
                            </button>
                            {(isHost || isPrivileged) && (
                                <>
                                    {session.status === 'draft' && (
                                        <button className="btn btn-sm btn-success" disabled={saving} onClick={() => updateStatus('active')}>
                                            <i className="bi bi-play-fill me-1" />Start
                                        </button>
                                    )}
                                    {session.status === 'active' && (
                                        <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => updateStatus('completed')}>
                                            <i className="bi bi-check2-all me-1" />Complete
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                {(() => {
                    const isTutorOrManager = isHost || myCoEntry || isPrivileged;
                    const allTabs = [
                        { key: "overview",     label: "Overview",     icon: "bi-info-circle",     always: true },
                        { key: "schedule",     label: "Schedule",     icon: "bi-calendar-event",  always: true },
                        { key: "groups",       label: "Groups",       icon: "bi-people",           always: true },
                        { key: "deadlines",    label: "Deadlines",    icon: "bi-clock",            always: false },
                        { key: "assignments",  label: "Assignments",  icon: "bi-clipboard-check",  always: false },
                        { key: "tutors",       label: "Co-tutors",    icon: "bi-person-badge",     always: false },
                        { key: "settings",     label: "Settings",     icon: "bi-sliders",          always: false, settingsOnly: true },
                    ];
                    const visibleTabs = allTabs.filter(t => {
                        if (t.settingsOnly) return canSettings;
                        return t.always || isTutorOrManager;
                    });
                    return (
                        <div className="d-flex gap-1 flex-wrap mb-4 p-1 rounded-3" style={{ background: 'var(--bs-tertiary-bg,#f1f3f5)', width: 'fit-content', maxWidth: '100%' }}>
                            {visibleTabs.map(t => (
                                <button key={t.key}
                                    className="btn btn-sm d-flex align-items-center gap-1"
                                    style={{
                                        background: tab === t.key ? 'var(--bs-body-bg,#fff)' : 'transparent',
                                        color: tab === t.key ? 'var(--bs-primary,#3b5bdb)' : 'var(--bs-secondary-color,#868e96)',
                                        fontWeight: tab === t.key ? 600 : 400,
                                        border: 'none',
                                        boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                                        borderRadius: 8,
                                        padding: '.35rem .75rem',
                                        fontSize: '.82rem',
                                        transition: 'all .15s',
                                    }}
                                    onClick={() => setTab(t.key)}>
                                    <i className={`bi ${t.icon}`} style={{ fontSize: '.8rem' }} />
                                    {t.label}
                                    {t.key === 'settings' && <i className="bi bi-lock-fill ms-1" style={{ fontSize: '.65rem', opacity: .6 }} title="Host & managers only" />}
                                </button>
                            ))}
                        </div>
                    );
                })()}

                {/* ══ TAB: OVERVIEW ══ */}
                {tab === "overview" && (
                    <div>
                        {/* ── Stat cards ── */}
                        <div className="d-flex gap-2 flex-wrap mb-4">
                            {[
                                { label: 'Groups',          value: groups.length,                                                                         icon: 'bi-people',           color: '#3b5bdb' },
                                { label: 'Active students', value: groups.reduce((s,g) => s+(g.members?.filter(m=>m.status==='active').length||0),0),     icon: 'bi-person-check',     color: '#2f9e44' },
                                { label: 'Schedule',        value: session.schedule?.length || 0,                                                         icon: 'bi-calendar-event',   color: '#f08c00' },
                                { label: 'Deadlines',       value: session.deadlines?.length || 0,                                                        icon: 'bi-clock',            color: '#e03131' },
                                { label: 'Assignments',     value: assignments.length,                                                                    icon: 'bi-clipboard-check',  color: '#7048e8' },
                                { label: 'Pending',         value: Object.values(submissions).flat().filter(s=>s.status==='pending').length,              icon: 'bi-hourglass-split',  color: '#c2255c' },
                            ].map(c => (
                                <div key={c.label} className="d-flex align-items-center gap-2 px-3 py-2 rounded-3" style={{ background: 'var(--bs-tertiary-bg,#f8f9fa)', border: '1px solid var(--bs-border-color,#dee2e6)', minWidth: 120 }}>
                                    <i className={`bi ${c.icon}`} style={{ color: c.color, fontSize: '1.15rem' }} />
                                    <div>
                                        <div className="fw-bold" style={{ fontSize: '1.1rem', lineHeight: 1, color: c.color }}>{c.value}</div>
                                        <div style={{ fontSize: '.68rem', color: '#868e96', textTransform: 'uppercase', letterSpacing: '.04em' }}>{c.label}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="row g-3">
                            {/* Session info */}
                            <div className="col-md-5">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-header bg-white fw-semibold">
                                        <i className="bi bi-info-circle me-2 text-primary"></i>Session info
                                    </div>
                                    <div className="card-body p-0">
                                        <table className="table table-sm table-borderless mb-0">
                                            <tbody>
                                                <tr><td className="text-muted ps-3">Course</td><td className="fw-semibold pe-3">{courseTitle(course)}</td></tr>
                                                <tr><td className="text-muted ps-3">Level</td><td className="pe-3">{course?.level || '—'}</td></tr>
                                                <tr><td className="text-muted ps-3">Type</td><td className="pe-3"><span className="badge bg-light text-dark border">{session.courseType}</span></td></tr>
                                                <tr><td className="text-muted ps-3">Status</td><td className="pe-3"><span className={`badge bg-${statusColors[session.status]}`}>{session.status}</span></td></tr>
                                                <tr><td className="text-muted ps-3">Host</td><td className="pe-3">{session.hostTutor?.nickname || '—'} <small className="text-muted">({session.hostTutor?.tutorRank || 'n/a'})</small></td></tr>
                                                <tr><td className="text-muted ps-3">Private copy</td><td className="pe-3">{session.privateCopyId ? <span className="text-success"><i className="bi bi-check-circle-fill me-1"></i>Created</span> : <span className="text-muted">None</span>}</td></tr>
                                                <tr><td className="text-muted ps-3">Rank override</td><td className="pe-3">{session.restrictionIgnored ? <span className="badge bg-warning text-dark">Active</span> : <span className="text-muted">—</span>}</td></tr>
                                                <tr><td className="text-muted ps-3">Copy editable</td><td className="pe-3">{session.copyEditAllowed ? <span className="text-success">Yes</span> : <span className="text-muted">No</span>}</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            {/* Upcoming schedule */}
                            <div className="col-md-7">
                                <div className="card border-0 shadow-sm h-100">
                                    <div className="card-header bg-white fw-semibold">
                                        <i className="bi bi-calendar-event me-2 text-warning"></i>Upcoming meetings
                                    </div>
                                    <div className="card-body p-0" style={{ maxHeight: 280, overflowY: 'auto' }}>
                                        {(() => {
                                            const now = new Date();
                                            const upcoming = (session.schedule || [])
                                                .filter(s => new Date(s.datetime) > now)
                                                .sort((a,b) => new Date(a.datetime) - new Date(b.datetime))
                                                .slice(0, 6);
                                            if (!upcoming.length) return <p className="text-muted p-3 mb-0">No upcoming meetings.</p>;
                                            return upcoming.map((s, i) => {
                                                const dt = new Date(s.datetime);
                                                const diffDays = Math.ceil((dt - now) / 86400000);
                                                return (
                                                    <div key={i} className="d-flex align-items-center gap-3 px-3 py-2 border-bottom">
                                                        <div className="text-center" style={{ minWidth: 40 }}>
                                                            <div className="fw-bold" style={{ fontSize: '.9rem', color: '#3b5bdb' }}>{dt.getDate()}</div>
                                                            <div style={{ fontSize: '.65rem', color: '#868e96' }}>{dt.toLocaleString('en', {month:'short'})}</div>
                                                        </div>
                                                        <div className="flex-grow-1 overflow-hidden">
                                                            <div className="fw-semibold text-truncate small">{s.title}</div>
                                                            <div style={{ fontSize: '.75rem', color: '#868e96' }}>
                                                                {dt.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} · {s.durationMin}min
                                                                {s.isRecurring && <span className="badge bg-info text-dark ms-1" style={{fontSize:'.6rem'}}>{s.recurrence?.frequency}</span>}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2">
                                                            {diffDays <= 1 && <span className="badge bg-danger" style={{fontSize:'.65rem'}}>Today</span>}
                                                            {diffDays > 1 && diffDays <= 3 && <span className="badge bg-warning text-dark" style={{fontSize:'.65rem'}}>Soon</span>}
                                                            {s.meetingLink && (
                                                                <>
                                                                    <button className="btn btn-sm btn-outline-primary" style={{padding:'2px 8px', fontSize:'.75rem'}}
                                                                        onClick={() => startMeeting({ sessionId: id })}>
                                                                        <i className="bi bi-camera-video me-1"></i>Join
                                                                    </button>
                                                                    <button className="btn btn-sm btn-outline-secondary" style={{padding:'2px 8px', fontSize:'.75rem'}}
                                                                        onClick={copyInviteLink} title="Copy invite link">
                                                                        <i className="bi bi-link-45deg"></i>
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* ── Global session chat ── */}
                        <div className="col-12 mt-3">
                            <div className="card border-0 shadow-sm" style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
                                <div className="card-header bg-white fw-semibold d-flex align-items-center gap-2">
                                    <i className="bi bi-chat-dots text-primary"></i> Session Chat
                                    <span className="badge bg-secondary ms-auto" style={{ fontSize: '.65rem' }}>{globalChatMessages.length} messages</span>
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    {globalChatLoading && <div className="text-center text-muted py-3"><span className="spinner-border spinner-border-sm me-2" />Loading chat…</div>}
                                    {!globalChatLoading && globalChatMessages.length === 0 && (
                                        <div className="text-center text-muted py-4" style={{ fontSize: '.85rem' }}>No messages yet. Be the first to write!</div>
                                    )}
                                    {globalChatMessages.map(msg => {
                                        const isMine = (msg.sender?._id || msg.sender) === data._id;
                                        return (
                                            <div key={msg._id} style={{ display: 'flex', flexDirection: isMine ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                                                <div style={{ maxWidth: '70%' }}>
                                                    {!isMine && <div style={{ fontSize: '.7rem', color: '#868e96', marginBottom: 2, marginLeft: 4 }}>{msg.sender?.nickname || 'Unknown'}</div>}
                                                    <div style={{ background: isMine ? '#3b5bdb' : '#f1f3f5', color: isMine ? '#fff' : '#1a1b2e', borderRadius: isMine ? '12px 12px 3px 12px' : '12px 12px 12px 3px', padding: '7px 12px', fontSize: '.85rem', wordBreak: 'break-word' }}>
                                                        {msg.text}
                                                    </div>
                                                    <div style={{ fontSize: '.67rem', color: '#adb5bd', marginTop: 2, textAlign: isMine ? 'right' : 'left', padding: '0 4px' }}>
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        {isMine && (
                                                            <button onClick={() => deleteGlobalChatMsg(msg._id)} style={{ background: 'none', border: 'none', color: '#adb5bd', cursor: 'pointer', padding: '0 0 0 6px', fontSize: '.67rem' }} title="Delete">✕</button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <form onSubmit={sendGlobalChat} style={{ padding: '8px 12px', borderTop: '1px solid #dee2e6', display: 'flex', gap: 8 }}>
                                    <input className="form-control form-control-sm" placeholder="Type a message…" value={globalChatText} onChange={e => setGlobalChatText(e.target.value)} disabled={!globalChatId} />
                                    <button type="submit" className="btn btn-primary btn-sm" disabled={globalChatSending || !globalChatText.trim() || !globalChatId}>
                                        {globalChatSending ? <span className="spinner-border spinner-border-sm" /> : <i className="bi bi-send-fill" />}
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══ TAB: SCHEDULE ══ */}
                {tab === "schedule" && (
                    <div>
                        {canEditSession && (
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-header bg-white fw-semibold">Add Schedule Entry</div>
                                <div className="card-body">
                                    <form onSubmit={addScheduleEntry}>
                                        <div className="row g-3">
                                            <div className="col-md-4">
                                                <label className="form-label fw-semibold">Title <span className="text-danger">*</span></label>
                                                <input type="text" className="form-control" placeholder="e.g. Week 1 — Introduction"
                                                    value={scheduleForm.title} onChange={e => setScheduleForm(p => ({ ...p, title: e.target.value }))} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-semibold">Date & Time <span className="text-danger">*</span></label>
                                                <input type="datetime-local" className="form-control"
                                                    value={scheduleForm.datetime} onChange={e => setScheduleForm(p => ({ ...p, datetime: e.target.value }))} />
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label fw-semibold">Duration (min)</label>
                                                <input type="number" className="form-control" min={15} step={15}
                                                    value={scheduleForm.durationMin} onChange={e => setScheduleForm(p => ({ ...p, durationMin: e.target.value }))} />
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-semibold">Meeting Link</label>
                                                <input type="url" className="form-control" placeholder="https://meet.google.com/…"
                                                    value={scheduleForm.meetingLink} onChange={e => setScheduleForm(p => ({ ...p, meetingLink: e.target.value }))} />
                                            </div>
                                            <div className="col-12">
                                                <label className="form-label fw-semibold">Notes</label>
                                                <textarea className="form-control" rows={2}
                                                    value={scheduleForm.notes} onChange={e => setScheduleForm(p => ({ ...p, notes: e.target.value }))} />
                                            </div>
                                            {/* Recurrence toggle */}
                                            <div className="col-12">
                                                <div className="form-check">
                                                    <input className="form-check-input" type="checkbox" id="isRecurring"
                                                        checked={scheduleForm.isRecurring}
                                                        onChange={e => setScheduleForm(p => ({ ...p, isRecurring: e.target.checked }))} />
                                                    <label className="form-check-label fw-semibold" htmlFor="isRecurring">
                                                        Repeating schedule
                                                    </label>
                                                </div>
                                            </div>
                                            {scheduleForm.isRecurring && (
                                                <>
                                                    <div className="col-md-3">
                                                        <label className="form-label fw-semibold">Frequency</label>
                                                        <select className="form-select"
                                                            value={scheduleForm.recurrence.frequency}
                                                            onChange={e => setScheduleForm(p => ({ ...p, recurrence: { ...p.recurrence, frequency: e.target.value } }))}>
                                                            <option value="daily">Daily</option>
                                                            <option value="weekly">Weekly</option>
                                                            <option value="biweekly">Biweekly</option>
                                                            <option value="monthly">Monthly</option>
                                                        </select>
                                                    </div>
                                                    {["weekly","biweekly"].includes(scheduleForm.recurrence.frequency) && (
                                                        <div className="col-md-5">
                                                            <label className="form-label fw-semibold">Days of week</label>
                                                            <div className="d-flex gap-2 flex-wrap">
                                                                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d, i) => (
                                                                    <div key={i} className="form-check form-check-inline">
                                                                        <input className="form-check-input" type="checkbox" id={`dow-${i}`}
                                                                            checked={scheduleForm.recurrence.daysOfWeek.includes(i)}
                                                                            onChange={e => {
                                                                                const days = scheduleForm.recurrence.daysOfWeek;
                                                                                const next = e.target.checked ? [...days, i] : days.filter(x => x !== i);
                                                                                setScheduleForm(p => ({ ...p, recurrence: { ...p.recurrence, daysOfWeek: next } }));
                                                                            }} />
                                                                        <label className="form-check-label" htmlFor={`dow-${i}`}>{d}</label>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="col-md-2">
                                                        <label className="form-label fw-semibold">End date</label>
                                                        <input type="date" className="form-control"
                                                            value={scheduleForm.recurrence.endDate}
                                                            onChange={e => setScheduleForm(p => ({ ...p, recurrence: { ...p.recurrence, endDate: e.target.value } }))} />
                                                    </div>
                                                    <div className="col-md-2">
                                                        <label className="form-label fw-semibold">Max occurrences</label>
                                                        <input type="number" className="form-control" min={1}
                                                            placeholder="Unlimited"
                                                            value={scheduleForm.recurrence.maxOccurrences}
                                                            onChange={e => setScheduleForm(p => ({ ...p, recurrence: { ...p.recurrence, maxOccurrences: e.target.value } }))} />
                                                    </div>
                                                </>
                                            )}
                                            <div className="col-12 d-flex justify-content-end">
                                                <button type="submit" className="btn btn-primary" disabled={savingSchedule}>
                                                    {savingSchedule ? <span className="spinner-border spinner-border-sm me-2" /> : null}
                                                    Add Entry
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}
                        <ScheduleCalendar
                            schedule={session.schedule || []}
                            onRemove={removeScheduleEntry}
                            canEdit={canEditSession}
                            onEventClick={async (ev) => {
                                if (ev.meetingLink) {
                                    const chatId = await getOrCreateMeetingChat(ev);
                                    startMeeting({ sessionId: id, meetingChatId: chatId, meetingTitle: ev.title });
                                }
                            }}
                            onCopyLink={() => copyInviteLink()}
                        />

                        {/* ── Per-meeting chat: click a schedule event to load ── */}
                        {session.schedule?.length > 0 && (
                            <MeetingChatPanel
                                schedule={session.schedule}
                                meetingChats={meetingChats}
                                getOrCreateMeetingChat={getOrCreateMeetingChat}
                                ah={ah}
                                myId={data._id}
                            />
                        )}
                    </div>
                )}

                {/* ══ TAB: DEADLINES ══ */}
                {tab === "deadlines" && (
                    <div>
                        {canEditSession && (() => {
                            // Build selectable options per targetType from session's course structure
                            const courseData = session.courseId;
                            const volumes = courseData?.volumes || [];
                            const deadlineTargetOptions = (() => {
                                if (deadlineForm.targetType === "volume") {
                                    return volumes.map(v => ({ id: v.vid, label: v.title || v.vid }));
                                }
                                if (deadlineForm.targetType === "chapter") {
                                    return volumes.flatMap(v => (v.chapters || []).map(c => ({ id: c.cid, label: `${v.title || v.vid} → ${c.title || c.cid}` })));
                                }
                                if (deadlineForm.targetType === "item") {
                                    return volumes.flatMap(v => (v.chapters || []).flatMap(c => (c.items || []).map(i => ({ id: i.iid, label: `${v.title || v.vid} → ${c.title || c.cid} → ${i.title || i.iid}` }))));
                                }
                                if (deadlineForm.targetType === "assignment") {
                                    return assignments.map(a => ({ id: a._id, label: a.title }));
                                }
                                return [];
                            })();
                            return (
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-header bg-white fw-semibold">Add Deadline</div>
                                <div className="card-body">
                                    <form onSubmit={addDeadline}>
                                        <div className="row g-3">
                                            <div className="col-md-2">
                                                <label className="form-label fw-semibold">Target Type</label>
                                                <select className="form-select" value={deadlineForm.targetType}
                                                    onChange={e => setDeadlineForm(p => ({ ...p, targetType: e.target.value, targetId: "" }))}>
                                                    <option value="volume">Volume</option>
                                                    <option value="chapter">Chapter</option>
                                                    <option value="item">Item</option>
                                                    <option value="assignment">Assignment</option>
                                                </select>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-semibold">Target <span className="text-danger">*</span></label>
                                                {deadlineTargetOptions.length > 0 ? (
                                                    <select className="form-select" value={deadlineForm.targetId}
                                                        onChange={e => setDeadlineForm(p => ({ ...p, targetId: e.target.value }))}>
                                                        <option value="">Select {deadlineForm.targetType}…</option>
                                                        {deadlineTargetOptions.map(opt => (
                                                            <option key={opt.id} value={opt.id}>{opt.label}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input type="text" className="form-control" placeholder={`${deadlineForm.targetType} ID`}
                                                        value={deadlineForm.targetId} onChange={e => setDeadlineForm(p => ({ ...p, targetId: e.target.value }))} />
                                                )}
                                                <small className="text-muted">
                                                    {deadlineTargetOptions.length === 0 && "No items found — enter ID manually"}
                                                </small>
                                            </div>
                                            <div className="col-md-3">
                                                <label className="form-label fw-semibold">Due At <span className="text-danger">*</span></label>
                                                <input type="datetime-local" className="form-control"
                                                    value={deadlineForm.dueAt} onChange={e => setDeadlineForm(p => ({ ...p, dueAt: e.target.value }))} />
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label fw-semibold">Description</label>
                                                <input type="text" className="form-control" placeholder="Optional note"
                                                    value={deadlineForm.description} onChange={e => setDeadlineForm(p => ({ ...p, description: e.target.value }))} />
                                            </div>
                                            <div className="col-md-2">
                                                <label className="form-label fw-semibold">Lock after due</label>
                                                <div className="form-check mt-2">
                                                    <input className="form-check-input" type="checkbox" id="lockAfterDue"
                                                        checked={deadlineForm.lockAfterDue}
                                                        onChange={e => setDeadlineForm(p => ({ ...p, lockAfterDue: e.target.checked }))} />
                                                    <label className="form-check-label small" htmlFor="lockAfterDue">Lock content</label>
                                                </div>
                                            </div>
                                            <div className="col-12 d-flex justify-content-end">
                                                <button type="submit" className="btn btn-primary" disabled={savingDeadline}>Add Deadline</button>
                                            </div>
                                        </div>
                                    </form>
                                </div>
                            </div>
                            );
                        })()}
                        {!session.deadlines?.length ? (
                            <p className="text-muted">No deadlines set.</p>
                        ) : (
                            <div className="d-flex flex-column gap-2">
                                {session.deadlines.map((dl, i) => {
                                    const isPast = new Date() > new Date(dl.dueAt);
                                    const typeColors = { volume:'#3b5bdb', chapter:'#f08c00', item:'#2f9e44', assignment:'#e03131' };
                                    const typeIcons = { volume:'bi-collection', chapter:'bi-journal', item:'bi-file-text', assignment:'bi-clipboard-check' };
                                    // Try to resolve human-readable target label from course structure
                                    const courseVols = session.courseId?.volumes || [];
                                    let targetLabel = dl.targetId;
                                    if (dl.targetType === 'volume') {
                                        const v = courseVols.find(v => v.vid === dl.targetId);
                                        if (v) targetLabel = v.title || dl.targetId;
                                    } else if (dl.targetType === 'chapter') {
                                        for (const v of courseVols) {
                                            const c = (v.chapters||[]).find(c => c.cid === dl.targetId);
                                            if (c) { targetLabel = `${v.title} → ${c.title}`; break; }
                                        }
                                    } else if (dl.targetType === 'item') {
                                        for (const v of courseVols) {
                                            for (const c of (v.chapters||[])) {
                                                const it = (c.items||[]).find(it => it.iid === dl.targetId);
                                                if (it) { targetLabel = `${v.title} → ${c.title} → ${it.title}`; break; }
                                            }
                                        }
                                    } else if (dl.targetType === 'assignment') {
                                        const a = assignments.find(a => a._id === dl.targetId);
                                        if (a) targetLabel = a.title;
                                    }
                                    return (
                                        <div key={i} className={`card border-0 shadow-sm ${isPast ? 'opacity-75' : ''}`}>
                                            <div className="card-body py-2 px-3 d-flex align-items-center gap-3">
                                                <div className="text-center border-end pe-3" style={{ minWidth: 52 }}>
                                                    <i className={`bi ${typeIcons[dl.targetType] || 'bi-clock'}`}
                                                        style={{ fontSize: '1.3rem', color: typeColors[dl.targetType] || '#6c757d' }}></i>
                                                    <div style={{ fontSize: '.63rem', color: '#868e96', marginTop: 2 }}>{dl.targetType}</div>
                                                </div>
                                                <div className="flex-grow-1 overflow-hidden">
                                                    <div className="d-flex align-items-center gap-2 flex-wrap">
                                                        <span className="fw-semibold small text-truncate" title={targetLabel}>{targetLabel}</span>
                                                        {isPast ? <span className="badge bg-danger" style={{fontSize:'.65rem'}}>Past</span> : <span className="badge bg-success" style={{fontSize:'.65rem'}}>Active</span>}
                                                        {dl.lockAfterDue && <span className="badge bg-warning text-dark" style={{fontSize:'.65rem'}}><i className="bi bi-lock-fill me-1"></i>Locks content</span>}
                                                    </div>
                                                    <div style={{ fontSize: '.75rem', color: isPast ? '#dc3545' : '#868e96' }}>
                                                        Due: {new Date(dl.dueAt).toLocaleString()}
                                                        {dl.description && <><span className="mx-1">·</span>{dl.description}</>}
                                                    </div>
                                                </div>
                                                {canEditSession && (
                                                    <button className="btn btn-sm btn-outline-danger" onClick={() => removeDeadline(i)}>
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ══ TAB: GROUPS ══ */}
                {tab === "groups" && (
                    <div>
                        {/* Create group */}
                        {canEditSession && (
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-body py-2 px-3">
                                    <form onSubmit={createGroup} className="d-flex gap-2 align-items-center">
                                        <i className="bi bi-plus-circle text-primary"></i>
                                        <input type="text" className="form-control form-control-sm"
                                            placeholder="New group name…" value={newGroupName}
                                            onChange={e => setNewGroupName(e.target.value)} style={{ maxWidth: 280 }} />
                                        <button type="submit" className="btn btn-sm btn-primary">Create group</button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {groups.length === 0 && <p className="text-muted">No groups yet. Create one above.</p>}

                        {/* Accordion: one card per group */}
                        <div className="d-flex flex-column gap-3">
                            {groups.map(g => {
                                const isOpen = selectedGroup?._id === g._id;
                                const activeMembers = g.members?.filter(m => m.status === 'active') || [];
                                const groupAssignmentCount = assignments.filter(a => String(a.groupId?._id || a.groupId) === String(g._id)).length;
                                return (
                                    <div key={g._id} className="card border-0 shadow-sm">
                                        {/* Group header */}
                                        <div className="card-header bg-white d-flex align-items-center gap-3"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setSelectedGroup(isOpen ? null : g)}>
                                            <i className={`bi bi-chevron-${isOpen ? 'down' : 'right'} text-muted`}></i>
                                            <div className="flex-grow-1">
                                                <span className="fw-semibold">{g.name}</span>
                                            </div>
                                            <span className="badge bg-light text-dark border">
                                                <i className="bi bi-people me-1"></i>{activeMembers.length} members
                                            </span>
                                            <span className="badge bg-light text-dark border">
                                                <i className="bi bi-clipboard-check me-1"></i>{groupAssignmentCount} assignments
                                            </span>
                                            {isHost && (
                                                <button className="btn btn-sm btn-outline-danger"
                                                    onClick={e => { e.stopPropagation(); deleteGroup(g); }}>
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            )}
                                        </div>

                                        {/* Group body — only when open */}
                                        {isOpen && (
                                            <div className="card-body pt-3">
                                                {session.courseType !== 'HOSTED' && (
                                                    <div className="alert alert-info small py-2 mb-3">
                                                        <i className="bi bi-info-circle me-1"></i>
                                                        <strong>{session.courseType}</strong> — students must own the course before being added.
                                                    </div>
                                                )}

                                                {/* Add member search */}
                                                <div className="position-relative mb-3">
                                                    <div className="input-group">
                                                        <span className="input-group-text"><i className="bi bi-search"></i></span>
                                                        <input type="text" className="form-control"
                                                            placeholder="Search by email or nickname…"
                                                            value={memberSearch}
                                                            onChange={e => setMemberSearch(e.target.value)}
                                                            autoComplete="off" />
                                                        <button className="btn btn-primary" disabled={addingMember || !memberSearch.trim()}
                                                            onClick={() => addMember(g._id)}>
                                                            {addingMember ? <span className="spinner-border spinner-border-sm" /> : 'Add'}
                                                        </button>
                                                    </div>
                                                    {memberResults.length > 0 && (
                                                        <div className="border rounded bg-white shadow-sm position-absolute w-100"
                                                            style={{ top: '100%', maxHeight: 200, overflowY: 'auto', zIndex: 1000 }}>
                                                            {memberResults.map(u => (
                                                                <div key={u._id} className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom"
                                                                    style={{ cursor: 'pointer' }}
                                                                    onMouseDown={e => e.preventDefault()}>
                                                                    <div>
                                                                        <span className="fw-semibold small">{u.nickname}</span>
                                                                        <small className="text-muted ms-2">{u.email}</small>
                                                                    </div>
                                                                    <button className="btn btn-sm btn-outline-primary"
                                                                        onClick={() => { setMemberSearch(u.email); addMember(g._id, u.email); setMemberResults([]); }}>
                                                                        Add
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Members table */}
                                                {!g.members?.length ? (
                                                    <p className="text-muted small">No members yet.</p>
                                                ) : (
                                                    <div className="table-responsive">
                                                        <table className="table table-sm align-middle mb-0">
                                                            <thead className="table-light">
                                                                <tr><th>Student</th><th>Status</th><th>Joined</th><th></th></tr>
                                                            </thead>
                                                            <tbody>
                                                                {g.members.map(m => (
                                                                    <tr key={m._id}>
                                                                        <td>
                                                                            <div className="fw-semibold small">{m.userId?.nickname || '—'}</div>
                                                                            <div className="text-muted" style={{ fontSize: '.75rem' }}>{m.userId?.email}</div>
                                                                        </td>
                                                                        <td>
                                                                            <span className={`badge ${m.status === 'active' ? 'bg-success' : m.status === 'dropped' ? 'bg-danger' : 'bg-secondary'}`}>
                                                                                {m.status}
                                                                            </span>
                                                                        </td>
                                                                        <td><small className="text-muted">{new Date(m.joinedAt).toLocaleDateString()}</small></td>
                                                                        <td>
                                                                            <button className="btn btn-sm btn-outline-danger"
                                                                                onClick={() => removeMember(g._id, m.userId?._id || m.userId, m.userId?.nickname)}>
                                                                                <i className="bi bi-x-lg"></i>
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ══ TAB: ASSIGNMENTS ══ */}
                {tab === "assignments" && (
                    <div>
                        <div className="card border-0 shadow-sm mb-4">
                            <div className="card-header bg-white fw-semibold">
                                <i className="bi bi-plus-circle me-2 text-primary"></i>Create Assignment
                            </div>
                            <div className="card-body">
                                <form onSubmit={createAssignment}>
                                    <div className="row g-3">
                                        <div className="col-md-4">
                                            <label className="form-label fw-semibold">Title <span className="text-danger">*</span></label>
                                            <input type="text" className="form-control" value={assignmentForm.title}
                                                onChange={e => setAssignmentForm(p => ({ ...p, title: e.target.value }))} />
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label fw-semibold">Due date <span className="text-danger">*</span></label>
                                            <input type="datetime-local" className="form-control" value={assignmentForm.dueAt}
                                                onChange={e => setAssignmentForm(p => ({ ...p, dueAt: e.target.value }))} />
                                        </div>
                                        <div className="col-md-1">
                                            <label className="form-label fw-semibold">Scale</label>
                                            <select className="form-select" value={assignmentForm.markScale}
                                                onChange={e => setAssignmentForm(p => ({ ...p, markScale: e.target.value, maxMark: e.target.value !== "custom" ? e.target.value : p.maxMark }))}>
                                                {MARK_SCALES.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </div>
                                        <div className="col-md-2">
                                            <label className="form-label fw-semibold">Max mark</label>
                                            <input type="number" className="form-control" value={assignmentForm.maxMark} min={1}
                                                disabled={assignmentForm.markScale !== "custom"}
                                                onChange={e => setAssignmentForm(p => ({ ...p, maxMark: e.target.value }))} />
                                            <small className="text-muted">Overdue −{overdueDeduction(assignmentForm.markScale)}</small>
                                        </div>
                                        <div className="col-md-3">
                                            <label className="form-label fw-semibold">Groups <span className="text-danger">*</span></label>
                                            <div className="border rounded p-2" style={{ maxHeight: 120, overflowY: "auto" }}>
                                                {groups.length === 0 && <small className="text-muted">No groups yet</small>}
                                                {groups.map(g => (
                                                    <div key={g._id} className="form-check">
                                                        <input className="form-check-input" type="checkbox" id={`grp-${g._id}`}
                                                            checked={assignmentForm.groupIds.includes(g._id)}
                                                            onChange={e => {
                                                                const ids = assignmentForm.groupIds;
                                                                setAssignmentForm(p => ({ ...p, groupIds: e.target.checked ? [...ids, g._id] : ids.filter(x => x !== g._id) }));
                                                            }} />
                                                        <label className="form-check-label small" htmlFor={`grp-${g._id}`}>{g.name}</label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label fw-semibold">Description</label>
                                            <textarea className="form-control" rows={2} value={assignmentForm.description}
                                                onChange={e => setAssignmentForm(p => ({ ...p, description: e.target.value }))} />
                                        </div>
                                        <div className="col-12">
                                            <label className="form-label fw-semibold">Task files <span className="text-muted small">(optional — .pdf, .zip, .txt)</span></label>
                                            <input type="file" className="form-control" multiple accept=".pdf,.zip,.txt"
                                                onChange={e => setAssignmentForm(p => ({ ...p, files: Array.from(e.target.files) }))} />
                                            {assignmentForm.files?.length > 0 && <small className="text-muted">{assignmentForm.files.length} file(s) selected</small>}
                                        </div>
                                        <div className="col-12 d-flex justify-content-end">
                                            <button type="submit" className="btn btn-primary" disabled={savingAssignment}>
                                                {savingAssignment ? <span className="spinner-border spinner-border-sm me-2" /> : null}Create assignment
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {assignments.length === 0 && <p className="text-muted">No assignments yet.</p>}

                        {assignments.map(a => {
                            const subs = submissions[a._id] || [];
                            const isOverdue = new Date() > new Date(a.dueAt);
                            const assignmentGroup = groups.find(g => String(g._id) === String(a.groupId?._id || a.groupId));
                            const pendingCount  = subs.filter(s => s.status === 'pending').length;
                            const approvedCount = subs.filter(s => s.status === 'approved').length;
                            return (
                                <div key={a._id} className="card border-0 shadow-sm mb-3">
                                    <div className="card-header bg-white d-flex align-items-center justify-content-between flex-wrap gap-2">
                                        <div className="d-flex align-items-center gap-2 flex-wrap">
                                            <span className="fw-semibold">{a.title}</span>
                                            <span className="badge bg-light text-dark border">{a.markScale}-pt</span>
                                            <span className="badge bg-light text-dark border">max {a.maxMark}</span>
                                            {assignmentGroup && <span className="badge bg-secondary"><i className="bi bi-people me-1"></i>{assignmentGroup.name}</span>}
                                            {isOverdue && <span className="badge bg-danger">Overdue</span>}
                                            {pendingCount > 0 && <span className="badge bg-warning text-dark"><i className="bi bi-hourglass-split me-1"></i>{pendingCount} pending</span>}
                                            {approvedCount > 0 && <span className="badge bg-success"><i className="bi bi-check-circle me-1"></i>{approvedCount} approved</span>}
                                        </div>
                                        <div className="d-flex gap-2 align-items-center">
                                            <small className="text-muted">Due: {new Date(a.dueAt).toLocaleString()}</small>
                                            <button className="btn btn-sm btn-outline-secondary"
                                                onClick={() => loadSubmissions(assignmentGroup?._id || groups[0]?._id, a._id)}>
                                                <i className="bi bi-arrow-clockwise me-1"></i>Submissions
                                            </button>
                                            {canGrade && <>
                                                <button className="btn btn-sm btn-outline-warning"
                                                    onClick={() => editingAssignment === a._id ? setEditingAssignment(null) : startEditAssignment(a)}>
                                                    <i className="bi bi-pencil"></i>
                                                </button>
                                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteAssignment(a)}>
                                                    <i className="bi bi-trash"></i>
                                                </button>
                                            </>}
                                        </div>
                                    </div>

                                    {editingAssignment === a._id && editForm && (
                                        <div className="card-body bg-light border-bottom">
                                            <div className="row g-2">
                                                <div className="col-md-4">
                                                    <label className="form-label small fw-semibold">Title</label>
                                                    <input type="text" className="form-control form-control-sm" value={editForm.title}
                                                        onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} />
                                                </div>
                                                <div className="col-md-2">
                                                    <label className="form-label small fw-semibold">Due date</label>
                                                    <input type="datetime-local" className="form-control form-control-sm" value={editForm.dueAt}
                                                        onChange={e => setEditForm(p => ({ ...p, dueAt: e.target.value }))} />
                                                </div>
                                                <div className="col-md-1">
                                                    <label className="form-label small fw-semibold">Scale</label>
                                                    <select className="form-select form-select-sm" value={editForm.markScale}
                                                        onChange={e => setEditForm(p => ({ ...p, markScale: e.target.value, maxMark: e.target.value !== "custom" ? e.target.value : p.maxMark }))}>
                                                        {MARK_SCALES.map(s => <option key={s} value={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-md-1">
                                                    <label className="form-label small fw-semibold">Max mark</label>
                                                    <input type="number" className="form-control form-control-sm" value={editForm.maxMark} min={1}
                                                        disabled={editForm.markScale !== "custom"}
                                                        onChange={e => setEditForm(p => ({ ...p, maxMark: e.target.value }))} />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label small fw-semibold">Description</label>
                                                    <textarea className="form-control form-control-sm" rows={2} value={editForm.description}
                                                        onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))} />
                                                </div>
                                                {a.taskFiles?.length > 0 && (
                                                    <div className="col-12">
                                                        <label className="form-label small fw-semibold">Current files</label>
                                                        <div className="d-flex flex-wrap gap-2">
                                                            {a.taskFiles.filter(f => !editForm.removedFiles?.includes(f.filename)).map((f, fi) => (
                                                                <span key={fi} className="badge bg-light text-dark border d-flex align-items-center gap-1">
                                                                    <i className="bi bi-file-earmark"></i>{f.originalName || f.filename}
                                                                    <button type="button" className="btn-close ms-1" style={{ fontSize: 8 }}
                                                                        onClick={() => setEditForm(p => ({ ...p, removedFiles: [...(p.removedFiles||[]), f.filename] }))} />
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="col-12">
                                                    <label className="form-label small fw-semibold">Add files</label>
                                                    <input type="file" className="form-control form-control-sm" multiple accept=".pdf,.zip,.txt"
                                                        onChange={e => setEditForm(p => ({ ...p, newFiles: Array.from(e.target.files) }))} />
                                                </div>
                                                <div className="col-12 d-flex gap-2 justify-content-end">
                                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditingAssignment(null)}>Cancel</button>
                                                    <button className="btn btn-sm btn-primary" disabled={savingEdit} onClick={() => saveEditAssignment(a)}>
                                                        {savingEdit ? <span className="spinner-border spinner-border-sm me-1" /> : null}Save
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {a.description && editingAssignment !== a._id && (
                                        <div className="card-body pt-2 pb-2 border-bottom">
                                            <small className="text-muted">{a.description}</small>
                                        </div>
                                    )}

                                    {subs.length > 0 && (
                                        <div className="card-body pt-2 pb-1">
                                            <div className="table-responsive">
                                                <table className="table table-sm align-middle mb-0">
                                                    <thead className="table-light">
                                                        <tr><th>Student</th><th>Submitted</th><th>Status</th><th>Mark</th><th>Actions</th></tr>
                                                    </thead>
                                                    <tbody>
                                                        {subs.map(s => {
                                                            const studentId = String(s.studentId?._id || s.studentId);
                                                            const isGrading = gradingId === `${a._id}-${studentId}`;
                                                            const groupForDl = assignmentGroup || groups.find(g =>
                                                                g.assignments?.some(ga => String(ga.assignmentId) === String(a._id))
                                                            );
                                                            return (
                                                                <tr key={studentId}>
                                                                    <td>
                                                                        <div className="fw-semibold small">{s.studentId?.nickname || '—'}</div>
                                                                        {s.isOverdue && <span className="badge bg-warning text-dark" style={{fontSize:'.65rem'}}>overdue</span>}
                                                                    </td>
                                                                    <td><small className="text-muted">{new Date(s.submittedAt).toLocaleString()}</small></td>
                                                                    <td>
                                                                        <span className={`badge ${s.status === "approved" ? "bg-success" : s.status === "declined" ? "bg-danger" : "bg-warning text-dark"}`}>
                                                                            {s.status}
                                                                        </span>
                                                                    </td>
                                                                    <td>{s.mark != null ? <span className="fw-semibold">{s.mark}/{a.maxMark}</span> : <span className="text-muted">—</span>}</td>
                                                                    <td>
                                                                        <div className="d-flex gap-1 flex-wrap align-items-start">
                                                                            {groupForDl && (
                                                                                <a className="btn btn-sm btn-outline-info"
                                                                                    href={`${API}/submissions/${groupForDl._id}/${a._id}/${studentId}/file`}
                                                                                    target="_blank" rel="noopener noreferrer" title="Download">
                                                                                    <i className="bi bi-download"></i>
                                                                                </a>
                                                                            )}
                                                                            {canGrade && s.status !== "approved" && (
                                                                                <button className="btn btn-sm btn-outline-primary"
                                                                                    onClick={() => { setGradingId(`${a._id}-${studentId}`); setGradeForm({ mark: s.mark || "", feedback: s.feedback || "", status: "approved" }); }}>
                                                                                    <i className="bi bi-pencil-square me-1"></i>Grade
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                        {isGrading && (
                                                                            <div className="mt-2 p-2 border rounded bg-light">
                                                                                <div className="d-flex gap-2 mb-2 flex-wrap">
                                                                                    <input type="number" className="form-control form-control-sm" placeholder="Mark"
                                                                                        style={{ width: 80 }} value={gradeForm.mark}
                                                                                        onChange={e => setGradeForm(p => ({ ...p, mark: e.target.value }))}
                                                                                        min={0} max={a.maxMark} />
                                                                                    <select className="form-select form-select-sm" style={{ width: 120 }}
                                                                                        value={gradeForm.status} onChange={e => setGradeForm(p => ({ ...p, status: e.target.value }))}>
                                                                                        <option value="approved">Approved</option>
                                                                                        <option value="declined">Declined</option>
                                                                                    </select>
                                                                                </div>
                                                                                <textarea className="form-control form-control-sm mb-2" rows={2}
                                                                                    placeholder="Feedback (optional)"
                                                                                    value={gradeForm.feedback}
                                                                                    onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))} />
                                                                                {s.isOverdue && (
                                                                                    <small className="text-warning d-block mb-1">
                                                                                        ⚠ Overdue — {a.overdueDeduction} point(s) will be deducted.
                                                                                    </small>
                                                                                )}
                                                                                <div className="d-flex gap-2 justify-content-end">
                                                                                    <button className="btn btn-sm btn-outline-secondary" onClick={() => setGradingId(null)}>Cancel</button>
                                                                                    <button className="btn btn-sm btn-primary"
                                                                                        onClick={() => submitGrade(assignmentGroup?._id || groups[0]?._id, a._id, studentId)}>
                                                                                        Submit grade
                                                                                    </button>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ══ TAB: CO-TUTORS ══ */}
                {tab === "tutors" && (
                    <div>
                        {(isHost || isPrivileged) && (
                            <div className="card border-0 shadow-sm mb-4">
                                <div className="card-header bg-white fw-semibold">
                                    <i className="bi bi-person-plus me-2 text-primary"></i>Add Co-tutor
                                </div>
                                <div className="card-body">
                                    <div className="position-relative mb-2">
                                        <div className="input-group">
                                            <span className="input-group-text"><i className="bi bi-search"></i></span>
                                            <input type="text" className="form-control"
                                                placeholder="Search by email or nickname…"
                                                value={coTutorSearch}
                                                onChange={e => setCoTutorSearch(e.target.value)}
                                                autoComplete="off" />
                                        </div>
                                        {coTutorSearch.trim().length >= 2 && coTutorResults.length === 0 && (
                                            <small className="text-muted ms-1 mt-1 d-block">No tutors found</small>
                                        )}
                                    </div>
                                    {coTutorResults.length > 0 && (
                                        <div className="border rounded" style={{ maxHeight: 200, overflowY: "auto" }}>
                                            {coTutorResults.map(u => (
                                                <div key={u._id} className="d-flex justify-content-between align-items-center p-2 border-bottom">
                                                    <div>
                                                        <span className="fw-semibold small">{u.nickname}</span>
                                                        <small className="text-muted ms-2">{u.email}</small>
                                                        {u.tutorRank && <span className="badge bg-light text-dark border ms-2">{u.tutorRank}</span>}
                                                    </div>
                                                    <button className="btn btn-sm btn-primary"
                                                        onClick={() => { addCoTutor(u._id); setCoTutorSearch(""); setCoTutorResults([]); }}>
                                                        Add
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {!session.coTutors?.length ? (
                            <p className="text-muted">No co-tutors yet.</p>
                        ) : (
                            <div className="card border-0 shadow-sm">
                                <div className="card-body p-0">
                                    {session.coTutors.map(ct => {
                                        const u = ct.userId;
                                        const uid = String(u?._id || u);
                                        return (
                                            <div key={uid} className="d-flex align-items-center gap-3 px-3 py-2 border-bottom">
                                                <div className="flex-grow-1">
                                                    <div className="fw-semibold small">{u?.nickname || uid}</div>
                                                    <div style={{ fontSize: '.75rem', color: '#868e96' }}>
                                                        {u?.email}
                                                        {u?.tutorRank && <span className="badge bg-light text-dark border ms-2">{u.tutorRank}</span>}
                                                    </div>
                                                </div>
                                                {isHost ? (
                                                    <div className="d-flex align-items-center gap-3">
                                                        <label className="d-flex flex-column align-items-center gap-1" style={{ fontSize: '.7rem', color: '#6c757d', cursor: 'pointer' }}>
                                                            <div className="form-check form-switch m-0">
                                                                <input className="form-check-input" type="checkbox" checked={ct.canGrade}
                                                                    onChange={() => toggleCoTutorPerm(uid, "canGrade")} />
                                                            </div>
                                                            Grade
                                                        </label>
                                                        <label className="d-flex flex-column align-items-center gap-1" style={{ fontSize: '.7rem', color: '#6c757d', cursor: 'pointer' }}>
                                                            <div className="form-check form-switch m-0">
                                                                <input className="form-check-input" type="checkbox" checked={ct.canSchedule}
                                                                    onChange={() => toggleCoTutorPerm(uid, "canSchedule")} />
                                                            </div>
                                                            Schedule
                                                        </label>
                                                        <label className="d-flex flex-column align-items-center gap-1" style={{ fontSize: '.7rem', color: '#6c757d', cursor: 'pointer' }}>
                                                            <div className="form-check form-switch m-0">
                                                                <input className="form-check-input" type="checkbox" checked={ct.canEditCopy}
                                                                    onChange={() => toggleCoTutorPerm(uid, "canEditCopy")} />
                                                            </div>
                                                            Edit copy
                                                        </label>
                                                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeCoTutor(uid)}>
                                                            <i className="bi bi-x-lg"></i>
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="d-flex gap-3" style={{ fontSize: '.8rem', color: '#6c757d' }}>
                                                        <span>{ct.canGrade ? '✓ Grade' : '— Grade'}</span>
                                                        <span>{ct.canSchedule ? '✓ Schedule' : '— Schedule'}</span>
                                                        <span>{ct.canEditCopy ? '✓ Edit copy' : '— Edit copy'}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* ══ TAB: SETTINGS ══ */}
                {tab === "settings" && canSettings && (
                    <div className="row g-4">
                        {/* ── Status & type ── */}
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-white fw-semibold"><i className="bi bi-toggles me-2 text-primary" />Session State</div>
                                <div className="card-body">
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Status</label>
                                        <select className="form-select"
                                            defaultValue={session.status}
                                            onChange={e => setSettingsForm(p => ({ ...p, status: e.target.value }))}>
                                            <option value="draft">Draft</option>
                                            <option value="active">Active</option>
                                            <option value="completed">Completed</option>
                                            <option value="archived">Archived</option>
                                        </select>
                                        <small className="text-muted">Change session status directly.</small>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold small">Session Type</label>
                                        <select className="form-select"
                                            defaultValue={session.courseType}
                                            onChange={e => setSettingsForm(p => ({ ...p, courseType: e.target.value }))}>
                                            <option value="HOSTED">HOSTED — free access via group</option>
                                            <option value="MENTORED">MENTORED — must own course</option>
                                            <option value="SELF_TAUGHT">SELF_TAUGHT</option>
                                        </select>
                                    </div>
                                    <div className="mb-3">
                                        <div className="form-check form-switch">
                                            <input className="form-check-input" type="checkbox" id="settingsCopyEdit"
                                                checked={session.copyEditAllowed}
                                                onChange={toggleCopyEdit} />
                                            <label className="form-check-label small" htmlFor="settingsCopyEdit">Allow co-tutors to edit private copy</label>
                                        </div>
                                    </div>
                                    {!session.restrictionIgnored && (
                                        <div className="mb-3">
                                            <div className="form-check form-switch">
                                                <input className="form-check-input" type="checkbox" id="settingsRankOverride"
                                                    onChange={e => { if (e.target.checked) overrideRank(); }} />
                                                <label className="form-check-label small" htmlFor="settingsRankOverride">Override tutor rank restriction</label>
                                            </div>
                                        </div>
                                    )}
                                    {session.restrictionIgnored && (
                                        <div className="mb-3">
                                            <span className="badge bg-warning text-dark me-2">Rank override active</span>
                                        </div>
                                    )}
                                    <button className="btn btn-primary btn-sm" disabled={settingsSaving} onClick={saveSettings}>
                                        {settingsSaving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── Host reassign ── */}
                        <div className="col-md-6">
                            <div className="card border-0 shadow-sm h-100">
                                <div className="card-header bg-white fw-semibold"><i className="bi bi-person-fill-gear me-2 text-warning" />Reassign Host</div>
                                <div className="card-body">
                                    <p className="text-muted small mb-3">
                                        Transfer host role to another tutor. The current host will remain as a co-tutor with full permissions.
                                    </p>
                                    <div className="mb-2">
                                        <label className="form-label small fw-semibold">Current host</label>
                                        <div className="d-flex align-items-center gap-2 p-2 rounded bg-light border">
                                            <i className="bi bi-person-circle text-primary fs-5" />
                                            <div>
                                                <div className="fw-semibold small">{session.hostTutor?.nickname || '—'}</div>
                                                <div style={{ fontSize: '.75rem', color: '#868e96' }}>{session.hostTutor?.email}{session.hostTutor?.tutorRank && <span className="badge bg-light text-dark border ms-2">{session.hostTutor.tutorRank}</span>}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <label className="form-label small fw-semibold">Search new host</label>
                                    <div className="position-relative mb-2">
                                        <div className="input-group">
                                            <span className="input-group-text"><i className="bi bi-search" /></span>
                                            <input type="text" className="form-control" placeholder="Search tutors by name or email…"
                                                value={hostSearch} onChange={e => setHostSearch(e.target.value)} autoComplete="off" />
                                        </div>
                                        {hostSearch.trim().length >= 2 && hostResults.length === 0 && (
                                            <small className="text-muted ms-1 mt-1 d-block">No tutors found</small>
                                        )}
                                    </div>
                                    {hostResults.length > 0 && (
                                        <div className="border rounded" style={{ maxHeight: 200, overflowY: 'auto' }}>
                                            {hostResults
                                                .filter(u => String(u._id) !== String(session.hostTutor?._id || session.hostTutor))
                                                .map(u => (
                                                <div key={u._id} className="d-flex justify-content-between align-items-center p-2 border-bottom">
                                                    <div>
                                                        <span className="fw-semibold small">{u.nickname}</span>
                                                        <small className="text-muted ms-2">{u.email}</small>
                                                        {u.tutorRank && <span className="badge bg-light text-dark border ms-2">{u.tutorRank}</span>}
                                                    </div>
                                                    <button className="btn btn-sm btn-warning" onClick={() => reassignHost(u._id, u.nickname)}>
                                                        Make Host
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ── Private copy ── */}
                        <div className="col-12">
                            <div className="card border-0 shadow-sm">
                                <div className="card-header bg-white fw-semibold"><i className="bi bi-files me-2 text-purple" style={{ color: '#7048e8' }} />Private Course Copy</div>
                                <div className="card-body">
                                    {session.privateCopyId ? (
                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                            <span className="badge bg-success"><i className="bi bi-check-circle me-1" />Private copy exists</span>
                                            <button className={`btn btn-sm ${session.copyEditAllowed ? 'btn-warning' : 'btn-outline-secondary'}`} onClick={toggleCopyEdit}>
                                                <i className={`bi bi-pencil${session.copyEditAllowed ? '-fill' : ''} me-1`} />
                                                Co-tutor editing: {session.copyEditAllowed ? 'ON' : 'OFF'}
                                            </button>
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => navigate(`/manage/course/preview/${session.privateCopyId._id || session.privateCopyId}?private=1`)}>
                                                <i className="bi bi-pencil me-1" />Edit Copy
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="d-flex align-items-center gap-3">
                                            <span className="text-muted small">No private copy yet. Create one to customize course content for this session without affecting the original.</span>
                                            <button className="btn btn-sm btn-outline-warning flex-shrink-0" disabled={creatingCopy} onClick={handleCreatePrivateCopy}>
                                                {creatingCopy ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="bi bi-files me-1" />}
                                                Create Private Copy
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            <UtilityModal show={modal.show} type={modal.type} title={modal.title} message={modal.message}
                danger={modal.danger} confirmToken={modal.confirmToken} tokenLabel={modal.tokenLabel}
                deleteLabel={modal.deleteLabel || "Delete"}
                onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
                onDelete={() => { modal.onDelete?.(); closeModal(); }}
                onCancel={modal.onCancel || closeModal} onClose={modal.onClose || closeModal} />
        </AppLayout>
    );
}

export default ManageSession;
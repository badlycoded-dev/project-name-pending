import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '../components/Layout';
import AuthImage from '../components/AuthImage';

const API = process.env.REACT_APP_API_URL + '';
const AVATAR_BREAK_MS = 90 * 60 * 1000; // 1.5 h — force new avatar group

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOther(chat, myId) {
    return chat.participants?.find(p => p._id !== myId) || chat.participants?.[0];
}

function isSameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear()
        && da.getMonth()    === db.getMonth()
        && da.getDate()     === db.getDate();
}

function formatSidebarTime(dateStr) {
    const d   = new Date(dateStr);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000)    return 'just now';
    if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function formatMsgTime(dateStr) {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    return [
        String(d.getDate()).padStart(2, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        d.getFullYear(),
    ].join('/');
}

// ── Avatar ────────────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 36 }) {
    const initials = (user?.nickname || user?.email || '?')
        .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...(user?.nickname || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    const pic = user?.links?.find(l => l.description?.toLowerCase() === 'profile picture');
    const fallback = (
        <div style={{
            width: size, height: size, borderRadius: '50%',
            background: `hsl(${hue},50%,40%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.34, color: '#fff', fontWeight: 700, flexShrink: 0,
        }}>{initials}</div>
    );
    if (pic) return (
        <AuthImage
            src={pic.url} alt={user.nickname}
            style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            fallback={fallback}
        />
    );
    return fallback;
}

// ── Delivery icon ─────────────────────────────────────────────────────────────

function DeliveryIcon({ status }) {
    if (status === 'sending') return (
        <i className="bi bi-clock"
            style={{ fontSize: '.62rem', color: 'var(--text-muted)', flexShrink: 0 }} />
    );
    if (status === 'read') return (
        <span style={{ display: 'inline-flex', color: 'var(--accent)', fontSize: '.68rem', flexShrink: 0, lineHeight: 1 }}>
            <i className="bi bi-check2" style={{ marginRight: -5 }} />
            <i className="bi bi-check2" />
        </span>
    );
    return (
        <i className="bi bi-check2"
            style={{ fontSize: '.68rem', color: 'var(--text-muted)', flexShrink: 0 }} />
    );
}

// ── Date divider ──────────────────────────────────────────────────────────────

function DateDivider({ date }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 8px' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{
                fontSize: '.68rem', color: 'var(--text-muted)', background: 'var(--surface-3)',
                borderRadius: 20, padding: '2px 12px', fontWeight: 600,
                letterSpacing: '.03em', userSelect: 'none',
            }}>{formatDateLabel(date)}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
    );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function Bubble({ msg, isMine, isFirstInGroup, isLastInGroup, myId, onDelete, canDelete }) {
    const [hovered, setHovered] = useState(false);
    const AVATAR_W = 32;

    const ts = msg.createdAt || msg._optimisticTs;
    const delivStatus = msg._optimistic ? 'sending'
        : (msg.readBy?.some(id => (id?._id || id) !== myId) ? 'read' : 'sent');

    return (
        <div style={{
            display: 'flex',
            flexDirection: isMine ? 'row-reverse' : 'row',
            alignItems: 'flex-end',
            gap: 8,
            marginTop: isFirstInGroup ? 10 : 2,
        }}>
            {/* Avatar slot */}
            <div style={{ width: AVATAR_W, flexShrink: 0 }}>
                {!isMine && isLastInGroup && <UserAvatar user={msg.sender} size={AVATAR_W} />}
            </div>

            {/* Bubble column */}
            <div
                style={{ maxWidth: '62%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', position: 'relative' }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                {/* Sender name at top of group */}
                {!isMine && isFirstInGroup && (
                    <span style={{ fontSize: '.7rem', color: 'var(--accent)', fontWeight: 700, paddingLeft: 4, marginBottom: 2 }}>
                        {msg.sender?.nickname || msg.sender?.email || '?'}
                    </span>
                )}

                {/* Bubble */}
                <div style={{
                    position: 'relative',
                    background: isMine ? 'var(--accent)' : 'var(--surface)',
                    color: isMine ? '#fff' : 'var(--text)',
                    border: isMine ? 'none' : '1px solid var(--border)',
                    borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '8px 13px',
                    fontSize: '.875rem',
                    lineHeight: 1.5,
                    wordBreak: 'break-word',
                    boxShadow: 'var(--card-shadow)',
                    opacity: msg._optimistic ? 0.7 : 1,
                    transition: 'opacity .15s',
                }}>
                    {msg.text}

                    {/* Hover delete */}
                    {hovered && canDelete && !msg._optimistic && (
                        <button
                            onClick={() => onDelete(msg._id)}
                            title="Delete message"
                            style={{
                                position: 'absolute',
                                top: -10,
                                [isMine ? 'left' : 'right']: -10,
                                width: 22, height: 22,
                                background: 'var(--danger-bg)',
                                border: '1px solid var(--danger-border)',
                                borderRadius: 6,
                                color: 'var(--danger)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '.6rem', padding: 0, zIndex: 2,
                            }}
                        >
                            <i className="bi bi-trash3-fill" />
                        </button>
                    )}
                </div>

                {/* Time + delivery */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2, paddingLeft: 3, paddingRight: 3 }}>
                    <span style={{ fontSize: '.65rem', color: 'var(--text-muted)' }}>
                        {formatMsgTime(ts)}
                    </span>
                    {isMine && <DeliveryIcon status={delivStatus} />}
                </div>
            </div>
        </div>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Chats({ data, onLogout }) {
    const [params] = useSearchParams();

    const token = localStorage.getItem('token');
    const ah    = { Authorization: token, 'Content-Type': 'application/json' };

    const myId          = data._id;
    const myAccessLevel = data.accessLevel || 'default';
    const canDeleteAny  = ['root', 'admin', 'manage'].includes(myAccessLevel);

    const [chats,      setChats]      = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [activeChat, setActiveChat] = useState(null);
    const [messages,   setMessages]   = useState([]);
    const [msgLoading, setMsgLoading] = useState(false);
    const [text,       setText]       = useState('');
    const [sending,    setSending]    = useState(false);

    const [showNewChat,  setShowNewChat]  = useState(false);
    const [userSearch,   setUserSearch]   = useState('');
    const [userResults,  setUserResults]  = useState([]);
    const [searching,    setSearching]    = useState(false);

    const bottomRef     = useRef(null);
    const textareaRef   = useRef(null);
    const pollRef       = useRef(null);
    const msgPollRef    = useRef(null);
    const activeChatRef = useRef(null);

    // ── Fetch helpers ─────────────────────────────────────────────────────────

    const fetchChats = useCallback(async () => {
        try {
            const r = await fetch(`${API}/chats`, { headers: ah });
            if (r.ok) { const d = await r.json(); setChats(d.data || []); }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchMessages = useCallback(async (chatId) => {
        try {
            const r = await fetch(`${API}/chats/${chatId}/messages?limit=50`, { headers: ah });
            if (r.ok) {
                const d = await r.json();
                setMessages(d.data || []);
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);
            }
        } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Init ──────────────────────────────────────────────────────────────────

    useEffect(() => {
        (async () => { setLoading(true); await fetchChats(); setLoading(false); })();
        pollRef.current = setInterval(fetchChats, 5000);
        return () => clearInterval(pollRef.current);
    }, [fetchChats]);

    useEffect(() => () => clearInterval(msgPollRef.current), []);

    // ?chat=ID param
    useEffect(() => {
        const chatId = params.get('chat');
        if (chatId && chats.length) {
            const found = chats.find(c => c._id === chatId);
            if (found && activeChatRef.current?._id !== chatId) openChat(found);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params, chats]);

    // ── Actions ───────────────────────────────────────────────────────────────

    const openChat = useCallback(async (chat) => {
        activeChatRef.current = chat;
        setActiveChat(chat);
        setMsgLoading(true);
        await fetchMessages(chat._id);
        setMsgLoading(false);
        fetchChats();
        clearInterval(msgPollRef.current);
        msgPollRef.current = setInterval(() => {
            if (activeChatRef.current) fetchMessages(activeChatRef.current._id);
        }, 3000);
    }, [fetchMessages, fetchChats]);

    const sendMessage = async () => {
        const trimmed = text.trim();
        if (!trimmed || !activeChat || sending) return;

        const optimistic = {
            _id: `tmp_${Date.now()}`,
            _optimistic: true,
            _optimisticTs: new Date().toISOString(),
            sender: { _id: myId, nickname: data.nickname, email: data.email, links: data.links },
            text: trimmed,
            readBy: [myId],
            createdAt: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimistic]);
        setText('');
        if (textareaRef.current) { textareaRef.current.style.height = 'auto'; }
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 40);

        setSending(true);
        try {
            const r = await fetch(`${API}/chats/${activeChat._id}/messages`, {
                method: 'POST', headers: ah, body: JSON.stringify({ text: trimmed }),
            });
            if (r.ok) { await fetchMessages(activeChat._id); fetchChats(); }
            else { setMessages(prev => prev.filter(m => m._id !== optimistic._id)); }
        } catch { setMessages(prev => prev.filter(m => m._id !== optimistic._id)); }
        setSending(false);
    };

    const deleteMessage = async (msgId) => {
        setMessages(prev => prev.filter(m => m._id !== msgId));
        try {
            await fetch(`${API}/chats/${activeChat._id}/messages/${msgId}`, { method: 'DELETE', headers: ah });
            fetchChats();
        } catch {}
    };

    const deleteChat = async (chatId) => {
        if (!window.confirm('Delete this chat and all messages?')) return;
        try {
            await fetch(`${API}/chats/${chatId}`, { method: 'DELETE', headers: ah });
            if (activeChat?._id === chatId) {
                activeChatRef.current = null;
                setActiveChat(null); setMessages([]);
                clearInterval(msgPollRef.current);
            }
            fetchChats();
        } catch {}
    };

    const searchUsers = useCallback(async (q) => {
        if (!q.trim()) { setUserResults([]); return; }
        setSearching(true);
        try {
            const r = await fetch(`${API}/users?search=${encodeURIComponent(q)}&limit=10`, { headers: ah });
            if (r.ok) {
                const d   = await r.json();
                const all = d.data || d.users || d || [];
                setUserResults(all.filter(u => u._id !== myId).slice(0, 10));
            }
        } catch {}
        setSearching(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [myId]);

    useEffect(() => {
        const t = setTimeout(() => searchUsers(userSearch), 300);
        return () => clearTimeout(t);
    }, [userSearch, searchUsers]);

    const startChat = async (userId) => {
        try {
            const r = await fetch(`${API}/chats`, {
                method: 'POST', headers: ah, body: JSON.stringify({ userId }),
            });
            if (r.ok) {
                const d = await r.json();
                setShowNewChat(false); setUserSearch(''); setUserResults([]);
                await fetchChats();
                openChat(d.data);
            }
        } catch {}
    };

    // ── Build display list ────────────────────────────────────────────────────

    const displayItems = [];
    for (let i = 0; i < messages.length; i++) {
        const msg  = messages[i];
        const prev = messages[i - 1];
        const next = messages[i + 1];

        const ts     = msg.createdAt  || msg._optimisticTs;
        const tsNext = next?.createdAt || next?._optimisticTs;
        const tsPrev = prev?.createdAt || prev?._optimisticTs;

        const showDate = !prev || !isSameDay(tsPrev, ts);

        const sid  = msg.sender?._id  || msg.sender;
        const sidP = prev?.sender?._id || prev?.sender;
        const sidN = next?.sender?._id || next?.sender;
        const dt_p = prev ? (new Date(ts) - new Date(tsPrev)) : Infinity;
        const dt_n = next ? (new Date(tsNext) - new Date(ts)) : Infinity;

        const isFirstInGroup = !prev || sidP !== sid || dt_p > AVATAR_BREAK_MS;
        const isLastInGroup  = !next || sidN !== sid || dt_n > AVATAR_BREAK_MS;

        displayItems.push({ msg, showDate, isFirstInGroup, isLastInGroup });
    }

    const other = activeChat ? getOther(activeChat, myId) : null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <AppLayout data={data} onLogout={onLogout}>
            <div style={{
                display: 'flex', height: 'calc(100vh - 64px)',
                overflow: 'hidden', borderRadius: 'var(--radius)',
                border: '1px solid var(--border)', background: 'var(--bg)',
            }}>

                {/* ── Sidebar ── */}
                <div style={{
                    width: 300, flexShrink: 0, borderRight: '1px solid var(--border)',
                    display: 'flex', flexDirection: 'column', background: 'var(--surface)',
                }}>
                    <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700, fontSize: '.95rem', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 7 }}>
                            <i className="bi bi-chat-dots-fill" style={{ color: 'var(--accent)' }} />
                            Messages
                        </span>
                        <button
                            onClick={() => setShowNewChat(true)}
                            style={{ background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '5px 11px', fontSize: '.78rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                            <i className="bi bi-pencil-square" /> New
                        </button>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div className="spinner-border spinner-border-sm" />
                            </div>
                        ) : chats.length === 0 ? (
                            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '.85rem' }}>
                                No chats yet.<br />
                                <button onClick={() => setShowNewChat(true)} style={{ marginTop: 8, background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: '.85rem' }}>
                                    Start a conversation
                                </button>
                            </div>
                        ) : chats.map(chat => {
                            const chatOther = getOther(chat, myId);
                            const isActive  = activeChat?._id === chat._id;
                            const lm        = chat.lastMessage;
                            const preview   = lm?.text
                                ? (lm.senderNickname !== chatOther?.nickname ? 'You: ' : '') + lm.text.slice(0, 38) + (lm.text.length > 38 ? '…' : '')
                                : 'No messages yet';

                            return (
                                <div
                                    key={chat._id}
                                    onClick={() => openChat(chat)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px',
                                        cursor: 'pointer', borderBottom: '1px solid var(--border-light)',
                                        background: isActive ? 'var(--accent-light)' : 'transparent',
                                        transition: 'background var(--transition)',
                                    }}
                                    onMouseEnter={e => !isActive && (e.currentTarget.style.background = 'var(--surface-2)')}
                                    onMouseLeave={e => !isActive && (e.currentTarget.style.background = isActive ? 'var(--accent-light)' : 'transparent')}
                                >
                                    {/* Avatar + unread badge */}
                                    <div style={{ position: 'relative', flexShrink: 0 }}>
                                        <UserAvatar user={chatOther} size={42} />
                                        {chat.unread > 0 && (
                                            <span style={{
                                                position: 'absolute', bottom: -2, right: -2,
                                                background: 'var(--accent)', color: '#fff',
                                                borderRadius: 20, fontSize: '.62rem', fontWeight: 700,
                                                minWidth: 16, height: 16, display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', padding: '0 4px',
                                                border: '2px solid var(--surface)',
                                            }}>{chat.unread > 99 ? '99+' : chat.unread}</span>
                                        )}
                                    </div>

                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                                            <span style={{ fontWeight: chat.unread > 0 ? 700 : 600, fontSize: '.88rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {chatOther?.nickname || chatOther?.email || 'Unknown'}
                                            </span>
                                            <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', flexShrink: 0 }}>
                                                {chat.lastActivity ? formatSidebarTime(chat.lastActivity) : ''}
                                            </span>
                                        </div>
                                        <span style={{
                                            display: 'block', marginTop: 1,
                                            fontSize: '.76rem',
                                            color: chat.unread > 0 ? 'var(--text-2)' : 'var(--text-muted)',
                                            fontWeight: chat.unread > 0 ? 500 : 400,
                                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                        }}>
                                            {preview}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Chat area ── */}
                {activeChat ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-2)', minWidth: 0 }}>

                        {/* Header */}
                        <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface)', flexShrink: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <UserAvatar user={other} size={36} />
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '.9rem', lineHeight: 1.2 }}>
                                        {other?.nickname || 'Unknown'}
                                    </div>
                                    <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                                        {other?.email || ''}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => deleteChat(activeChat._id)}
                                title="Delete chat"
                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '.95rem', padding: '4px 8px', opacity: 0.6, transition: 'opacity var(--transition)' }}
                                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                onMouseLeave={e => e.currentTarget.style.opacity = 0.6}
                            >
                                <i className="bi bi-trash3" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 20px 4px' }}>
                            {msgLoading ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 48 }}>
                                    <div className="spinner-border spinner-border-sm" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 60, fontSize: '.88rem' }}>
                                    No messages yet. Say hello! 👋
                                </div>
                            ) : displayItems.map(({ msg, showDate, isFirstInGroup, isLastInGroup }) => {
                                const isMine = (msg.sender?._id || msg.sender) === myId;
                                return (
                                    <div key={msg._id}>
                                        {showDate && <DateDivider date={msg.createdAt || msg._optimisticTs} />}
                                        <Bubble
                                            msg={msg}
                                            isMine={isMine}
                                            isFirstInGroup={isFirstInGroup}
                                            isLastInGroup={isLastInGroup}
                                            myId={myId}
                                            canDelete={isMine || canDeleteAny}
                                            onDelete={deleteMessage}
                                        />
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </div>

                        {/* Input */}
                        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                            <textarea
                                ref={textareaRef}
                                value={text}
                                rows={1}
                                onChange={e => {
                                    setText(e.target.value);
                                    e.target.style.height = 'auto';
                                    e.target.style.height = Math.min(e.target.scrollHeight, 112) + 'px';
                                }}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                                style={{
                                    flex: 1, resize: 'none',
                                    background: 'var(--input-bg)', border: '1px solid var(--input-border)',
                                    borderRadius: 'var(--radius-sm)', padding: '8px 12px',
                                    color: 'var(--text)', fontSize: '.875rem',
                                    outline: 'none', fontFamily: 'var(--font)', lineHeight: 1.5,
                                    overflow: 'hidden', minHeight: 36, maxHeight: 112,
                                    transition: 'border-color var(--transition)',
                                }}
                                onFocus={e => e.target.style.borderColor = 'var(--input-focus)'}
                                onBlur={e  => e.target.style.borderColor = 'var(--input-border)'}
                            />
                            <button
                                onClick={sendMessage}
                                disabled={!text.trim() || sending}
                                style={{
                                    background: 'var(--accent)', color: '#fff', border: 'none',
                                    borderRadius: 'var(--radius-sm)', width: 38, height: 38,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer', flexShrink: 0,
                                    opacity: (!text.trim() || sending) ? 0.45 : 1,
                                    transition: 'opacity var(--transition)',
                                }}
                            >
                                {sending
                                    ? <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14, borderWidth: 2 }} />
                                    : <i className="bi bi-send-fill" style={{ fontSize: '.85rem' }} />
                                }
                            </button>
                        </div>
                    </div>

                ) : (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        <i className="bi bi-chat-square-dots" style={{ fontSize: 44, marginBottom: 14, opacity: 0.22 }} />
                        <div style={{ fontSize: '.95rem', fontWeight: 500 }}>Select a chat to start messaging</div>
                        <div style={{ fontSize: '.82rem', marginTop: 6 }}>
                            or{' '}
                            <button onClick={() => setShowNewChat(true)} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline', fontSize: '.82rem' }}>
                                start a new conversation
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── New Chat Modal ── */}
            {showNewChat && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={e => e.target === e.currentTarget && setShowNewChat(false)}
                >
                    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 24, width: 400, maxWidth: '90vw', boxShadow: 'var(--card-shadow-lg)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                            <h5 style={{ margin: 0, fontWeight: 700, color: 'var(--text)', fontSize: '.95rem' }}>New Conversation</h5>
                            <button onClick={() => setShowNewChat(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}>
                                <i className="bi bi-x-lg" />
                            </button>
                        </div>

                        <input
                            autoFocus
                            value={userSearch}
                            onChange={e => setUserSearch(e.target.value)}
                            placeholder="Search by nickname or email…"
                            style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--text)', fontSize: '.875rem', outline: 'none', boxSizing: 'border-box' }}
                            onFocus={e => e.target.style.borderColor = 'var(--input-focus)'}
                            onBlur={e  => e.target.style.borderColor = 'var(--input-border)'}
                        />

                        <div style={{ marginTop: 10, maxHeight: 300, overflowY: 'auto' }}>
                            {searching && (
                                <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)' }}>
                                    <div className="spinner-border spinner-border-sm" />
                                </div>
                            )}
                            {!searching && userSearch && userResults.length === 0 && (
                                <div style={{ textAlign: 'center', padding: 14, color: 'var(--text-muted)', fontSize: '.85rem' }}>No users found</div>
                            )}
                            {userResults.map(user => (
                                <div
                                    key={user._id}
                                    onClick={() => startChat(user._id)}
                                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', border: '1px solid var(--border-light)', marginBottom: 6, transition: 'background var(--transition)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-2)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                >
                                    <UserAvatar user={user} size={36} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '.875rem' }}>{user.nickname}</div>
                                        <div style={{ fontSize: '.73rem', color: 'var(--text-muted)' }}>{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
import { useState, useEffect, useRef, useCallback, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';

import { toHttps } from '../utils/utils';

const _RTC_BASE = process.env.REACT_APP_USE_HTTPS === 'true'
  ? (process.env.REACT_APP_RTC_URL_S || 'https://localhost:5051')
  : (process.env.REACT_APP_RTC_URL   || 'http://localhost:5050');
const RTC_URL = toHttps(_RTC_BASE);
const API = toHttps(process.env.REACT_APP_API_URL || 'http://localhost:4040/api');

let _io = null;
async function getIO() {
    if (_io) return _io;
    if (window.io) { _io = window.io; return _io; }
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.socket.io/4.7.4/socket.io.min.js';
        s.onload = () => { _io = window.io; resolve(_io); };
        s.onerror = reject;
        document.head.appendChild(s);
    });
}

function createPeerConnection(iceServers, onIceCandidate, onTrack) {
    const pc = new RTCPeerConnection({ iceServers });
    pc.onicecandidate = e => { if (e.candidate) onIceCandidate(e.candidate); };
    pc.ontrack = e => { if (e.streams?.[0]) onTrack(e.streams[0]); };
    return pc;
}

function Avatar({ name, size = 48 }) {
    const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    const hue = [...(name || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return (
        <div style={{ width: size, height: size, borderRadius: '50%', background: `hsl(${hue},55%,38%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.36, fontWeight: 600, color: '#fff', fontFamily: 'var(--vc-font)', flexShrink: 0, userSelect: 'none' }}>{initials}</div>
    );
}

function VideoTile({ stream, label, muted = false, noVideo = false, handRaised, audioOff, isScreen }) {
    const ref = useRef();
    useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
    return (
        <div style={{ position: 'relative', background: '#141519', borderRadius: 10, overflow: 'hidden', aspectRatio: '16/9', border: '1.5px solid rgba(255,255,255,.07)', flex: '1 1 200px', minWidth: 0 }}>
            {!noVideo ? <video ref={ref} autoPlay playsInline muted={muted} style={{ width: '100%', height: '100%', objectFit: isScreen ? 'contain' : 'cover', display: 'block', background: '#000' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#141519' }}><Avatar name={label} size={52} /></div>}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '20px 8px 6px', background: 'linear-gradient(transparent,rgba(0,0,0,.65))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#fff', fontSize: '0.72rem', fontWeight: 500, fontFamily: 'var(--vc-font)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {audioOff && <i className="bi bi-mic-mute-fill" style={{ color: '#ff6b6b', fontSize: '0.68rem' }} />}
                    {isScreen && <i className="bi bi-display" style={{ color: '#74c0fc', fontSize: '0.68rem' }} />}
                    {label}
                </span>
                {handRaised && <span style={{ fontSize: '1rem' }}>✋</span>}
            </div>
        </div>
    );
}

function ToolBtn({ icon, label, active, danger, onClick, badge }) {
    const [hover, setHover] = useState(false);
    return (
        <button onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} title={label}
            style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, width: 56, height: 52, borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'var(--vc-font)', transition: 'background .15s, color .15s', background: danger ? (hover ? '#c92a2a' : '#e03131') : active ? 'rgba(116,143,252,.22)' : hover ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.06)', color: danger ? '#fff' : active ? '#748ffc' : '#c9cdd4', outline: active && !danger ? '1.5px solid rgba(116,143,252,.45)' : 'none', outlineOffset: '-1px' }}>
            <i className={`bi ${icon}`} style={{ fontSize: '1.1rem' }} />
            <span style={{ fontSize: '0.62rem', fontWeight: 500, letterSpacing: '0.01em' }}>{label}</span>
            {badge > 0 && <span style={{ position: 'absolute', top: 6, right: 8, background: '#e03131', color: '#fff', borderRadius: 999, fontSize: '0.6rem', fontWeight: 700, minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{badge > 99 ? '99+' : badge}</span>}
        </button>
    );
}

// ── Delivery status icon ──────────────────────────────────────────────────────
// status: 'sending' | 'sent' | 'read'
function DeliveryIcon({ status }) {
    if (status === 'sending') return (
        <i className="bi bi-clock" style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,.35)', flexShrink: 0 }} />
    );
    if (status === 'read') return (
        <span style={{ display: 'inline-flex', color: '#748ffc', fontSize: '0.65rem', flexShrink: 0, lineHeight: 1 }}>
            <i className="bi bi-check2" style={{ marginRight: -5 }} />
            <i className="bi bi-check2" />
        </span>
    );
    // sent
    return (
        <i className="bi bi-check2" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,.5)', flexShrink: 0 }} />
    );
}

// ── Date divider ──────────────────────────────────────────────────────────────
function DateDivider({ date }) {
    const d = new Date(date);
    const label = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '/');
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 0 6px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
            <span style={{ fontSize: '0.66rem', color: 'rgba(180,185,210,.4)', background: 'rgba(255,255,255,.06)', borderRadius: 20, padding: '2px 10px', fontWeight: 600, letterSpacing: '.04em', fontFamily: 'var(--vc-font)', userSelect: 'none' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
        </div>
    );
}

function isSameDay(a, b) {
    const da = new Date(a), db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

// gap in ms between messages that forces a new avatar group
const AVATAR_BREAK_MS = 90 * 60 * 1000; // 1.5 hours

// ── Improved ChatPanel ────────────────────────────────────────────────────────
function ChatPanel({ messages, mySocketId, myNickname, myAccessLevel, dmTarget, setDmTarget, peers, onSend, onDeleteMsg, onPrivateRoom }) {
    const [text, setText] = useState('');
    const [hoveredId, setHoveredId] = useState(null);
    const bottomRef = useRef();
    const inputRef  = useRef();

    useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const filtered = dmTarget
        ? messages.filter(m => (m.from === mySocketId && m.to === dmTarget) || (m.from === dmTarget && m.to === mySocketId))
        : messages.filter(m => !m.to);

    const submit = () => {
        const t = text.trim();
        if (!t) return;
        onSend(t, dmTarget || null);
        setText('');
        inputRef.current?.focus();
    };

    const dmPeer = dmTarget ? peers.find(p => p.socketId === dmTarget) : null;

    // Can a user delete this msg?
    const canDelete = (msg) => {
        if (msg.from === mySocketId) return true;
        if (['root', 'admin', 'manage'].includes(myAccessLevel)) return true;
        return false;
    };

    // Build display list with metadata
    const items = [];
    for (let i = 0; i < filtered.length; i++) {
        const msg = filtered[i];
        const prev = filtered[i - 1];
        const next = filtered[i + 1];

        // Date divider
        const showDate = !prev || !isSameDay(prev.ts, msg.ts);

        // Avatar grouping
        const sameAuthorAsPrev = prev && prev.from === msg.from;
        const timeSincePrev    = prev ? (new Date(msg.ts) - new Date(prev.ts)) : Infinity;
        const breakGroup       = !sameAuthorAsPrev || timeSincePrev > AVATAR_BREAK_MS;

        // Show avatar only at the LAST message of a group (bottom of run)
        const sameAuthorAsNext = next && next.from === msg.from;
        const timeTilNext      = next ? (new Date(next.ts) - new Date(msg.ts)) : Infinity;
        const isLastInGroup    = !sameAuthorAsNext || timeTilNext > AVATAR_BREAK_MS;

        items.push({ msg, showDate, breakGroup, isLastInGroup });
    }

    const ACCENT = '#748ffc';
    const BG_ME  = 'rgba(116,143,252,.18)';
    const BG_OTH = 'rgba(255,255,255,.07)';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* DM header */}
            {dmTarget && (
                <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => setDmTarget(null)} style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', padding: 0, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <i className="bi bi-arrow-left" /> Back
                    </button>
                    <Avatar name={dmPeer?.nickname} size={22} />
                    <span style={{ color: '#e0e0e0', fontSize: '0.8rem', fontWeight: 600, fontFamily: 'var(--vc-font)' }}>{dmPeer?.nickname || 'DM'}</span>
                    {/* Private room button */}
                    {onPrivateRoom && dmPeer && (
                        <button
                            onClick={() => onPrivateRoom(dmPeer)}
                            title="Start private video call"
                            style={{ marginLeft: 'auto', background: 'rgba(116,143,252,.15)', border: '1px solid rgba(116,143,252,.3)', borderRadius: 7, color: ACCENT, cursor: 'pointer', padding: '4px 9px', fontSize: '0.7rem', fontFamily: 'var(--vc-font)', display: 'flex', alignItems: 'center', gap: 5 }}
                        >
                            <i className="bi bi-camera-video-fill" /> Private call
                        </button>
                    )}
                </div>
            )}

            {/* Message list */}
            <div className="vc-scroll" style={{ flex: 1, overflowY: 'auto', padding: '10px 10px 4px' }}>
                {filtered.length === 0 && (
                    <div style={{ color: '#5c6070', fontSize: '0.78rem', textAlign: 'center', marginTop: 24, fontFamily: 'var(--vc-font)' }}>
                        {dmTarget ? 'Send a private message' : 'No messages yet'}
                    </div>
                )}

                {items.map(({ msg, showDate, breakGroup, isLastInGroup }) => {
                    const isMe = msg.from === mySocketId;
                    const time = new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const delivStatus = msg._sending ? 'sending' : (msg.readByTarget ? 'read' : 'sent');
                    const avatarName  = isMe ? myNickname : (msg.fromNickname || msg.from);
                    const AVATAR_SIZE = 28;

                    return (
                        <div key={msg.id}>
                            {showDate && <DateDivider date={msg.ts} />}

                            <div style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6, marginTop: breakGroup ? 10 : 2 }}>

                                {/* Avatar placeholder (keeps alignment) */}
                                <div style={{ width: AVATAR_SIZE, flexShrink: 0 }}>
                                    {!isMe && isLastInGroup && <Avatar name={avatarName} size={AVATAR_SIZE} />}
                                </div>

                                {/* Bubble */}
                                <div
                                    style={{ maxWidth: '78%', display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 1, position: 'relative' }}
                                    onMouseEnter={() => setHoveredId(msg.id)}
                                    onMouseLeave={() => setHoveredId(null)}
                                >
                                    {/* Sender name — only first of a new group, not mine */}
                                    {!isMe && breakGroup && (
                                        <span style={{ fontSize: '0.67rem', color: ACCENT, fontFamily: 'var(--vc-font)', fontWeight: 700, paddingLeft: 2, marginBottom: 1 }}>
                                            {avatarName}
                                        </span>
                                    )}

                                    <div style={{
                                        position: 'relative',
                                        background: isMe ? BG_ME : BG_OTH,
                                        border: `1px solid ${isMe ? 'rgba(116,143,252,.28)' : 'rgba(255,255,255,.09)'}`,
                                        borderRadius: isMe ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                                        padding: '7px 10px 6px',
                                        color: '#e0e0e0',
                                        fontSize: '0.8rem',
                                        lineHeight: 1.5,
                                        fontFamily: 'var(--vc-font)',
                                        wordBreak: 'break-word',
                                    }}>
                                        {msg.text}

                                        {/* Delete button — shows on hover */}
                                        {hoveredId === msg.id && canDelete(msg) && (
                                            <button
                                                onClick={() => onDeleteMsg(msg.id)}
                                                title="Delete message"
                                                style={{
                                                    position: 'absolute',
                                                    top: -10, right: isMe ? 'auto' : -10, left: isMe ? -10 : 'auto',
                                                    background: '#2a1f1f', border: '1px solid rgba(224,49,49,.4)',
                                                    borderRadius: 6, color: '#ff6b6b',
                                                    width: 22, height: 22, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.6rem', padding: 0, zIndex: 2,
                                                }}
                                            >
                                                <i className="bi bi-trash3-fill" />
                                            </button>
                                        )}
                                    </div>

                                    {/* Time + delivery */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 2, paddingRight: 2 }}>
                                        <span style={{ fontSize: '0.62rem', color: 'rgba(180,185,210,.38)', fontFamily: 'var(--vc-font)' }}>{time}</span>
                                        {isMe && <DeliveryIcon status={delivStatus} />}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ padding: '8px 10px', borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <textarea
                    ref={inputRef}
                    rows={1}
                    value={text}
                    onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'; }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
                    placeholder={dmTarget ? `Message ${dmPeer?.nickname || ''}…` : 'Message everyone…'}
                    style={{ flex: 1, resize: 'none', background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '7px 10px', color: '#e0e0e0', fontSize: '0.8rem', fontFamily: 'var(--vc-font)', outline: 'none', lineHeight: 1.45, overflow: 'hidden', minHeight: 34 }}
                />
                <button
                    onClick={submit}
                    style={{ background: ACCENT, border: 'none', borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 }}
                >
                    <i className="bi bi-send-fill" style={{ fontSize: '0.8rem' }} />
                </button>
            </div>
        </div>
    );
}

function ParticipantsPanel({ peers, mySocketId, myNickname, onDM, onPrivateRoom }) {
    const all = [{ socketId: mySocketId, nickname: myNickname, isSelf: true, video: true, audio: true }, ...peers];
    return (
        <div style={{ overflowY: 'auto', height: '100%', padding: '8px 0' }}>
            {all.map(p => (
                <div key={p.socketId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: p.isSelf ? 'default' : 'pointer' }}
                    onMouseEnter={e => { if (!p.isSelf) e.currentTarget.style.background = 'rgba(255,255,255,.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                    <Avatar name={p.nickname} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#e0e0e0', fontSize: '0.82rem', fontWeight: 500, fontFamily: 'var(--vc-font)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            {p.nickname}{p.isSelf && <span style={{ color: '#4a4f5e', fontSize: '0.68rem' }}>(you)</span>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                            {!p.audio && <span style={{ color: '#ff6b6b', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 2 }}><i className="bi bi-mic-mute-fill" /> Muted</span>}
                            {!p.video && <span style={{ color: '#868e96', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 2 }}><i className="bi bi-camera-video-off-fill" /> No cam</span>}
                            {p.screen && <span style={{ color: '#74c0fc', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 2 }}><i className="bi bi-display" /> Sharing</span>}
                        </div>
                    </div>
                    {!p.isSelf && (
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                            <button
                                onClick={() => onDM(p.socketId)}
                                title="Direct message"
                                style={{ background: 'rgba(116,143,252,.15)', border: '1px solid rgba(116,143,252,.25)', borderRadius: 6, color: '#748ffc', cursor: 'pointer', padding: '4px 7px', fontSize: '0.7rem', fontFamily: 'var(--vc-font)', display: 'flex', alignItems: 'center', gap: 3 }}
                            >
                                <i className="bi bi-chat-text" />
                            </button>
                            {onPrivateRoom && (
                                <button
                                    onClick={() => onPrivateRoom(p)}
                                    title="Start private video call"
                                    style={{ background: 'rgba(105,219,124,.1)', border: '1px solid rgba(105,219,124,.25)', borderRadius: 6, color: '#69db7c', cursor: 'pointer', padding: '4px 7px', fontSize: '0.7rem', fontFamily: 'var(--vc-font)', display: 'flex', alignItems: 'center', gap: 3 }}
                                >
                                    <i className="bi bi-camera-video-fill" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ── Mic activity meter ────────────────────────────────────────────────────────
function MicMeter({ stream, size = 20 }) {
    const [level, setLevel] = useState(0);
    useEffect(() => {
        if (!stream) { setLevel(0); return; }
        let ctx;
        try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
        const src = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        src.connect(analyser);
        const buf = new Uint8Array(analyser.frequencyBinCount);
        let raf;
        const tick = () => {
            analyser.getByteFrequencyData(buf);
            const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
            setLevel(Math.min(1, avg / 60));
            raf = requestAnimationFrame(tick);
        };
        tick();
        return () => { cancelAnimationFrame(raf); ctx.close(); };
    }, [stream]);

    const bars = 5;
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: size }}>
            {Array.from({ length: bars }, (_, i) => {
                const active = level >= (i + 1) / bars;
                return <div key={i} style={{ width: 3, height: `${35 + i * 15}%`, borderRadius: 2, background: active ? (i < 3 ? '#63d68a' : i < 4 ? '#ffc94a' : '#ff6b6b') : 'rgba(255,255,255,.15)', transition: 'background .08s' }} />;
            })}
        </div>
    );
}

// ── Joining screen ────────────────────────────────────────────────────────────
function JoiningScreen({ nickname, roomId, onReady, onCancel }) {
    const [camOn, setCamOn]         = useState(false);
    const [micOn, setMicOn]         = useState(false);
    const [camId, setCamId]         = useState('');
    const [micId, setMicId]         = useState('');
    const [speakerId, setSpeakerId] = useState('');
    const [devices, setDevices]     = useState({ cams: [], mics: [], speakers: [] });
    const [preview, setPreview]     = useState(null);
    const [joining, setJoining]     = useState(false);
    const previewRef  = useRef();
    const stopPreview = useRef(null);

    useEffect(() => {
        (async () => {
            try {
                await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                const devs = await navigator.mediaDevices.enumerateDevices();
                const cams     = devs.filter(d => d.kind === 'videoinput');
                const mics     = devs.filter(d => d.kind === 'audioinput');
                const speakers = devs.filter(d => d.kind === 'audiooutput');
                setDevices({ cams, mics, speakers });
                if (cams[0])     setCamId(cams[0].deviceId);
                if (mics[0])     setMicId(mics[0].deviceId);
                if (speakers[0]) setSpeakerId(speakers[0].deviceId);
            } catch {}
        })();
        return () => stopPreview.current?.();
    }, []);

    useEffect(() => {
        stopPreview.current?.();
        stopPreview.current = null;
        setPreview(null);
        if (!camOn && !micOn) return;
        let cancelled = false;
        (async () => {
            try {
                const s = await navigator.mediaDevices.getUserMedia({
                    video: camOn ? (camId ? { deviceId: { exact: camId } } : true) : false,
                    audio: micOn ? (micId ? { deviceId: { exact: micId } } : true) : false,
                });
                if (cancelled) { s.getTracks().forEach(t => t.stop()); return; }
                stopPreview.current = () => s.getTracks().forEach(t => t.stop());
                setPreview(s);
                if (previewRef.current) previewRef.current.srcObject = s;
            } catch { setPreview(null); }
        })();
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [camOn, micOn, camId, micId]);

    const S = {
        width: '100%', background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)',
        borderRadius: 8, padding: '7px 10px', color: '#c9cdd4', fontSize: '0.8rem',
        fontFamily: 'var(--vc-font)', outline: 'none', cursor: 'pointer', appearance: 'auto',
    };
    const labelStyle = { fontSize: '0.66rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#748ffc', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 };

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, fontFamily: 'var(--vc-font)', background: '#0f1117' }}>
            <div style={{ display: 'flex', gap: 40, width: '100%', maxWidth: 860, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>

                <div style={{ flex: '1 1 360px', maxWidth: 420 }}>
                    <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0a0c12', borderRadius: 14, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,.08)', boxShadow: '0 8px 32px rgba(0,0,0,.5)' }}>
                        {camOn && preview
                            ? <video ref={previewRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Avatar name={nickname} size={72} /></div>
                        }
                        <div style={{ position: 'absolute', bottom: 10, left: 12, color: '#e0e0e0', fontSize: '0.82rem', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,.8)' }}>{nickname}</div>
                        <div style={{ position: 'absolute', bottom: 8, right: 10, display: 'flex', gap: 6 }}>
                            {[
                                { on: micOn, setOn: setMicOn, onIc: 'bi-mic-fill', offIc: 'bi-mic-mute-fill' },
                                { on: camOn, setOn: setCamOn, onIc: 'bi-camera-video-fill', offIc: 'bi-camera-video-off-fill' },
                            ].map(({ on, setOn, onIc, offIc }, i) => (
                                <button key={i} onClick={() => setOn(v => !v)} style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', background: on ? 'rgba(255,255,255,.18)' : '#e03131', color: '#fff', fontSize: '.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                                    <i className={`bi ${on ? onIc : offIc}`} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                        {[{ on: camOn, offLabel: 'Camera off', ic: 'bi-camera-video-off-fill' }, { on: micOn, offLabel: 'Mic off', ic: 'bi-mic-mute-fill' }].map(({ on, offLabel, ic }, i) => !on && (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(224,49,49,.18)', border: '1px solid rgba(224,49,49,.3)', borderRadius: 20, padding: '2px 10px', fontSize: '.72rem', color: '#ff6b6b', fontWeight: 600 }}>
                                <i className={`bi ${ic}`} />{offLabel}
                            </span>
                        ))}
                        {micOn && preview && <MicMeter stream={preview} size={18} />}
                    </div>
                </div>

                <div style={{ flex: '1 1 280px', maxWidth: 360 }}>
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <i className="bi bi-camera-video-fill" style={{ color: '#748ffc', fontSize: '.72rem' }} />
                            <span style={{ color: '#748ffc', fontSize: '.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em' }}>Video Conference</span>
                        </div>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#e6e8f5', lineHeight: 1.2, letterSpacing: '-.02em' }}>Ready to join?</div>
                        {roomId && (
                            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: '.78rem', color: '#5c6484' }}>Room:</span>
                                <code style={{ fontSize: '.74rem', background: 'rgba(115,142,248,.12)', color: '#738ef8', padding: '2px 8px', borderRadius: 6, border: '1px solid rgba(115,142,248,.2)' }}>{roomId}</code>
                            </div>
                        )}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '16px 18px', marginBottom: 16 }}>
                        <div style={{ fontSize: '.75rem', fontWeight: 700, color: '#9aa3c0', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <i className="bi bi-sliders" /> Device settings
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <div style={labelStyle}><i className="bi bi-camera-video-fill" style={{ fontSize: '.7rem' }} /> Camera</div>
                            <select value={camId} onChange={e => setCamId(e.target.value)} style={S}>
                                {devices.cams.length === 0 && <option value="">No camera found</option>}
                                {devices.cams.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Camera'}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: 12 }}>
                            <div style={labelStyle}><i className="bi bi-mic-fill" style={{ fontSize: '.7rem' }} /> Microphone</div>
                            <select value={micId} onChange={e => setMicId(e.target.value)} style={S}>
                                {devices.mics.length === 0 && <option value="">No microphone found</option>}
                                {devices.mics.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Microphone'}</option>)}
                            </select>
                        </div>
                        {devices.speakers.length > 0 && (
                            <div>
                                <div style={labelStyle}><i className="bi bi-volume-up-fill" style={{ fontSize: '.7rem' }} /> Speaker</div>
                                <select value={speakerId} onChange={e => setSpeakerId(e.target.value)} style={S}>
                                    {devices.speakers.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Speaker'}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => { setJoining(true); onReady({ camOn, micOn, camId, micId, stream: preview }); }}
                        disabled={joining}
                        style={{ width: '100%', background: joining ? '#3a3f55' : 'linear-gradient(135deg,#5c7cff,#4263eb)', border: 'none', borderRadius: 10, color: '#fff', fontFamily: 'var(--vc-font)', fontWeight: 700, fontSize: '0.95rem', padding: '13px', cursor: joining ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'opacity .15s', marginBottom: 10, boxShadow: joining ? 'none' : '0 4px 16px rgba(66,99,235,.4)' }}
                    >
                        {joining
                            ? <><div className="spinner-border spinner-border-sm" style={{ width: 14, height: 14, borderWidth: 2 }} /> Joining…</>
                            : <><i className="bi bi-camera-video-fill" /> Join now</>
                        }
                    </button>
                    {onCancel && (
                        <button onClick={onCancel} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, color: '#9aa3c0', fontFamily: 'var(--vc-font)', fontWeight: 500, fontSize: '0.875rem', padding: '11px', cursor: 'pointer' }}>
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

const miniBtn = (bg) => ({ background: bg, border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', flexShrink: 0 });

function MiniVideo({ stream, muted }) {
    const ref = useRef();
    useEffect(() => { if (ref.current && stream) ref.current.srcObject = stream; }, [stream]);
    return <video ref={ref} autoPlay playsInline muted={muted} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />;
}

// ── Private room confirm toast ────────────────────────────────────────────────
function PrivateRoomToast({ peer, onConfirm, onCancel }) {
    return (
        <div style={{
            position: 'absolute', bottom: 84, left: '50%', transform: 'translateX(-50%)',
            background: '#1a1d26', border: '1px solid rgba(116,143,252,.35)', borderRadius: 12,
            padding: '14px 18px', boxShadow: '0 8px 32px rgba(0,0,0,.6)', zIndex: 100,
            fontFamily: 'var(--vc-font)', display: 'flex', flexDirection: 'column', gap: 10, minWidth: 260,
        }}>
            <div style={{ color: '#e0e0e0', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="bi bi-camera-video-fill" style={{ color: '#748ffc' }} />
                Start private call with <span style={{ color: '#748ffc' }}>{peer.nickname}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={onConfirm}
                    style={{ flex: 1, background: 'linear-gradient(135deg,#5c7cff,#4263eb)', border: 'none', borderRadius: 8, color: '#fff', fontFamily: 'var(--vc-font)', fontWeight: 600, fontSize: '0.78rem', padding: '7px', cursor: 'pointer' }}
                >
                    <i className="bi bi-camera-video-fill" /> Start
                </button>
                <button
                    onClick={onCancel}
                    style={{ flex: 1, background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#9aa3c0', fontFamily: 'var(--vc-font)', fontWeight: 500, fontSize: '0.78rem', padding: '7px', cursor: 'pointer' }}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

export function VideoConference({ sessionId, roomId: roomIdProp, nickname, accessLevel, onClose, mini = false, onExpand, onMinimize }) {
    const navigate = useNavigate();
    const roomId = roomIdProp || `session:${sessionId}`;

    const [phase, setPhase]         = useState('pre');
    const [errorMsg, setErrorMsg]   = useState('');
    const [status, setStatus]       = useState('connecting');
    const [localStream, setLocalStream] = useState(null);
    const [peers, setPeers]         = useState([]);
    const [video, setVideo]         = useState(false);
    const [audio, setAudio]         = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [panel, setPanel]         = useState(null);
    const [dmTarget, setDmTarget]   = useState(null);
    const [messages, setMessages]   = useState([]);
    const [unread, setUnread]       = useState(0);
    const [handRaised, setHandRaised] = useState(false);
    const [permBanner, setPermBanner] = useState(null);
    const [copied, setCopied]       = useState(false);
    const [privateRoomPeer, setPrivateRoomPeer] = useState(null); // peer pending confirmation

    // ── Drag state for mini pip ───────────────────────────────────────────────
    const miniPosRef  = useRef({ x: window.innerWidth - 264, y: window.innerHeight - 180 });
    const [miniPos, setMiniPos] = useReducer((_, p) => p, miniPosRef.current);
    const miniDragging = useRef(false);
    const miniOrigin   = useRef({ mx: 0, my: 0, ex: 0, ey: 0 });

    const socketRef   = useRef(null);
    const pcRefs      = useRef({});
    const localRef    = useRef(null);
    const iceServersRef = useRef([]);
    const mySocketId  = socketRef.current?.id;

    const cleanup = useCallback(() => {
        localRef.current?.getTracks().forEach(t => t.stop());
        localRef.current = null;
        screenStream?.getTracks().forEach(t => t.stop());
        Object.values(pcRefs.current).forEach(pc => pc.close());
        pcRefs.current = {};
        socketRef.current?.disconnect();
        socketRef.current = null;
        setPeers([]); setLocalStream(null); setScreenStream(null);
    }, [screenStream]);

    useEffect(() => () => cleanup(), [cleanup]);

    const getPC = useCallback((peerId) => {
        if (pcRefs.current[peerId]) return pcRefs.current[peerId];
        const pc = createPeerConnection(
            iceServersRef.current,
            (c) => socketRef.current?.emit('ice-candidate', { to: peerId, candidate: c }),
            (remoteStream) => setPeers(prev => prev.map(p => p.socketId === peerId ? { ...p, stream: remoteStream } : p))
        );
        pcRefs.current[peerId] = pc;
        return pc;
    }, []);

    const addLocalTracks = useCallback((pc) => {
        if (!localRef.current) return;
        localRef.current.getTracks().forEach(track => {
            const existingSender = pc.getSenders().find(s => s.track?.kind === track.kind);
            if (existingSender) { existingSender.replaceTrack(track); }
            else { pc.addTrack(track, localRef.current); }
        });
    }, []);

    const renegotiateAll = useCallback(async () => {
        const socket = socketRef.current;
        if (!socket) return;
        for (const [peerId, pc] of Object.entries(pcRefs.current)) {
            (localRef.current?.getTracks() || []).forEach(track => {
                const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
                if (sender) { sender.replaceTrack(track); }
                else if (localRef.current) { pc.addTrack(track, localRef.current); }
            });
            pc.getSenders().forEach(sender => {
                if (!sender.track) return;
                const stillActive = localRef.current?.getTracks().some(t => t.kind === sender.track.kind && t.readyState === 'live');
                if (!stillActive) { sender.replaceTrack(null); }
            });
            try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socket.emit('offer', { to: peerId, sdp: offer }); } catch {}
        }
    }, []);

    const connectSocket = useCallback(async (camOn, micOn, camId, micId, previewStream) => {
        try {
            const io = await getIO();
            const stored = localStorage.getItem('token');
            if (!stored) { setPhase('error'); setErrorMsg('Not logged in.'); return; }
            const raw = stored.startsWith('Bearer ') ? stored.slice(7) : stored;
            const socket = io(RTC_URL, { auth: { token: raw }, transports: ['websocket', 'polling'] });
            socketRef.current = socket;

            socket.on('connect_error', err => { setPhase('error'); setErrorMsg(err.message === 'UNAUTHORIZED' ? 'Auth failed — please re-login.' : err.message); });
            socket.on('joined', async ({ peers: existing, iceServers, chatHistory }) => {
                iceServersRef.current = iceServers;
                setStatus('joined');
                setPeers(existing.map(p => ({ ...p, stream: null })));
                setMessages(chatHistory || []);
                if (previewStream) { localRef.current = previewStream; setLocalStream(previewStream); }
                for (const peer of existing) {
                    const pc = getPC(peer.socketId); addLocalTracks(pc);
                    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
                    socket.emit('offer', { to: peer.socketId, sdp: offer });
                }
            });
            socket.on('peer-joined',   ({ peer }) => setPeers(prev => [...prev, { ...peer, stream: null }]));
            socket.on('peer-left',     ({ socketId }) => { pcRefs.current[socketId]?.close(); delete pcRefs.current[socketId]; setPeers(prev => prev.filter(p => p.socketId !== socketId)); });
            socket.on('offer',         async ({ from, sdp }) => { const pc = getPC(from); addLocalTracks(pc); await pc.setRemoteDescription(sdp); const answer = await pc.createAnswer(); await pc.setLocalDescription(answer); socket.emit('answer', { to: from, sdp: answer }); });
            socket.on('answer',        async ({ from, sdp }) => { const pc = pcRefs.current[from]; if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(sdp); });
            socket.on('ice-candidate', async ({ from, candidate }) => { const pc = pcRefs.current[from]; if (pc) try { await pc.addIceCandidate(candidate); } catch {} });
            socket.on('media-state',   ({ socketId, video: v, audio: a }) => setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, video: v, audio: a } : p)));
            socket.on('screen-state',  ({ socketId, active }) => setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, screen: active } : p)));
            socket.on('chat-message',  (msg) => {
                setMessages(prev => {
                    // Replace optimistic if echoed back
                    if (msg._tempId) return prev.map(m => m.id === msg._tempId ? { ...msg, _sending: false } : m);
                    return [...prev, msg];
                });
                setUnread(prev => panel === 'chat' ? 0 : prev + 1);
            });
            socket.on('chat-delete',   ({ id }) => setMessages(prev => prev.filter(m => m.id !== id)));
            socket.on('hand-raised',   ({ socketId, raised }) => setPeers(prev => prev.map(p => p.socketId === socketId ? { ...p, handRaised: raised } : p)));

            socket.emit('join', { roomId, nickname, sessionId, video: camOn, audio: micOn });
            setVideo(camOn); setAudio(micOn);
        } catch (e) { setPhase('error'); setErrorMsg(e.message || 'Connection failed'); }
    }, [roomId, nickname, sessionId, getPC, addLocalTracks, panel]);

    const handleReady = useCallback(async (opts) => {
        setPhase('joined');
        await connectSocket(opts.camOn, opts.micOn, opts.camId, opts.micId, opts.stream);
    }, [connectSocket]);

    const toggleVideo = useCallback(async () => {
        const newVal = !video;
        if (newVal) {
            setPermBanner('prompted');
            try {
                const s = await navigator.mediaDevices.getUserMedia({ video: true });
                setPermBanner(null);
                if (!localRef.current) { localRef.current = s; setLocalStream(s); }
                else { s.getVideoTracks().forEach(t => localRef.current.addTrack(t)); setLocalStream(new MediaStream(localRef.current.getTracks())); }
                await renegotiateAll();
            } catch { setPermBanner('denied'); setTimeout(() => setPermBanner(null), 4000); return; }
        } else {
            localRef.current?.getVideoTracks().forEach(t => { t.stop(); localRef.current.removeTrack(t); });
            setLocalStream(localRef.current ? new MediaStream(localRef.current.getTracks()) : null);
        }
        setVideo(newVal); socketRef.current?.emit('toggle-media', { roomId, video: newVal, audio });
    }, [video, audio, roomId, renegotiateAll]);

    const toggleAudio = useCallback(async () => {
        const newVal = !audio;
        if (newVal) {
            setPermBanner('prompted');
            try {
                const s = await navigator.mediaDevices.getUserMedia({ audio: true });
                setPermBanner(null);
                if (!localRef.current) { localRef.current = s; setLocalStream(s); }
                else { s.getAudioTracks().forEach(t => localRef.current.addTrack(t)); setLocalStream(new MediaStream(localRef.current.getTracks())); }
                await renegotiateAll();
            } catch { setPermBanner('denied'); setTimeout(() => setPermBanner(null), 4000); return; }
        } else {
            localRef.current?.getAudioTracks().forEach(t => { t.stop(); localRef.current.removeTrack(t); });
            setLocalStream(localRef.current ? new MediaStream(localRef.current.getTracks()) : null);
        }
        setAudio(newVal); socketRef.current?.emit('toggle-media', { roomId, video, audio: newVal });
    }, [audio, video, roomId, renegotiateAll]);

    const toggleScreen = useCallback(async () => {
        if (screenStream) { screenStream.getTracks().forEach(t => t.stop()); setScreenStream(null); socketRef.current?.emit('screen-share', { roomId, active: false }); return; }
        try {
            const s = await navigator.mediaDevices.getDisplayMedia({ video: true });
            s.getVideoTracks()[0].onended = () => { setScreenStream(null); socketRef.current?.emit('screen-share', { roomId, active: false }); };
            setScreenStream(s); socketRef.current?.emit('screen-share', { roomId, active: true });
            for (const [peerId, pc] of Object.entries(pcRefs.current)) {
                s.getTracks().forEach(t => { if (!pc.getSenders().find(sd => sd.track === t)) pc.addTrack(t, s); });
                try { const offer = await pc.createOffer(); await pc.setLocalDescription(offer); socketRef.current.emit('offer', { to: peerId, sdp: offer }); } catch {}
            }
        } catch {}
    }, [screenStream, roomId]);

    const toggleHand = useCallback(() => {
        const n = !handRaised;
        setHandRaised(n);
        socketRef.current?.emit('raise-hand', { roomId, raised: n });
    }, [handRaised, roomId]);

    const togglePanel = useCallback((name) => {
        setPanel(p => p === name ? null : name);
        if (name === 'chat') setUnread(0);
    }, []);

    const sendChat = useCallback((text, to) => {
        const tempId = `tmp_${Date.now()}`;
        // Optimistic message
        const optimistic = {
            id: tempId,
            _tempId: tempId,
            _sending: true,
            from: mySocketId,
            fromNickname: nickname,
            to: to || null,
            text,
            ts: new Date().toISOString(),
        };
        setMessages(prev => [...prev, optimistic]);
        socketRef.current?.emit('chat-message', { roomId, text, to, _tempId: tempId });
    }, [roomId, mySocketId, nickname]);

    // Delete message — emit to socket; server broadcasts 'chat-delete' to all
    const deleteMsg = useCallback((msgId) => {
        socketRef.current?.emit('chat-delete', { roomId, id: msgId });
        setMessages(prev => prev.filter(m => m.id !== msgId));
    }, [roomId]);

    // Private room — generate a unique room ID for 2 participants and navigate
    const startPrivateRoom = useCallback((peer) => {
        const privateId = `private:${[mySocketId, peer.socketId].sort().join(':')}`;
        // Notify the peer via DM chat message
        socketRef.current?.emit('chat-message', { roomId, text: `📹 I started a private call. Join at: ${window.location.origin}/meeting?session=${encodeURIComponent(privateId)}`, to: peer.socketId });
        setPrivateRoomPeer(null);
        // Open in new tab so current session continues
        window.open(`${window.location.origin}/meeting?session=${encodeURIComponent(privateId)}`, '_blank');
    }, [roomId, mySocketId]);

    const handleLeave = useCallback(() => {
        socketRef.current?.emit('leave', { roomId });
        cleanup();
        if (onClose) { onClose(); } else { navigate('/'); }
    }, [cleanup, onClose, navigate, roomId]);

    const copyInvite = () => {
        navigator.clipboard.writeText(`${window.location.origin}/meeting?session=${sessionId || roomId}`)
            .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    };

    const allTiles = [
        { socketId: 'local', nickname: nickname || 'You', stream: localStream, muted: true, video, audio, isSelf: true },
        ...peers.map(p => ({ ...p, muted: false })),
        ...(screenStream ? [{ socketId: 'screen', nickname: `${nickname} (screen)`, stream: screenStream, muted: true, video: true, audio: false, isScreen: true }] : [])
    ];
    const gridStyle = (() => {
        const n = allTiles.length;
        if (n === 1) return { gridTemplateColumns: '1fr' };
        if (n === 2) return { gridTemplateColumns: '1fr 1fr' };
        if (n <= 4)  return { gridTemplateColumns: 'repeat(2, 1fr)' };
        if (n <= 9)  return { gridTemplateColumns: 'repeat(3, 1fr)' };
        return { gridTemplateColumns: 'repeat(4, 1fr)' };
    })();

    // ── Mini PIP ──────────────────────────────────────────────────────────────
    if (mini) {
        const firstPeer = peers[0];
        const onPointerDown = (e) => {
            if (e.target.closest('button')) return;
            miniDragging.current = true;
            miniOrigin.current = { mx: e.clientX, my: e.clientY, ex: miniPosRef.current.x, ey: miniPosRef.current.y };
            e.currentTarget.setPointerCapture(e.pointerId);
        };
        const onPointerMove = (e) => {
            if (!miniDragging.current) return;
            const nx = miniOrigin.current.ex + (e.clientX - miniOrigin.current.mx);
            const ny = miniOrigin.current.ey + (e.clientY - miniOrigin.current.my);
            miniPosRef.current = { x: Math.max(0, Math.min(window.innerWidth - 240, nx)), y: Math.max(56, Math.min(window.innerHeight - 160, ny)) };
            setMiniPos({ ...miniPosRef.current });
        };
        const onPointerUp = () => { miniDragging.current = false; };
        return (
            <div onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} style={{ position: 'fixed', left: miniPos.x, top: miniPos.y, zIndex: 9000, width: 240, background: '#141519', borderRadius: 14, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,.7)', border: '1.5px solid rgba(255,255,255,.1)', fontFamily: 'var(--vc-font)', cursor: 'grab', userSelect: 'none', animation: 'vcMiniIn .22s cubic-bezier(.34,1.56,.64,1)' }}>
                <div style={{ position: 'relative', aspectRatio: '16/9', background: '#0d0f12' }}>
                    {firstPeer?.stream ? <MiniVideo stream={firstPeer.stream} /> : localStream ? <MiniVideo stream={localStream} muted /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Avatar name={nickname} size={36} /></div>}
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,.5)', borderRadius: 6, padding: '2px 6px', color: '#aaa', fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: 4 }}><i className="bi bi-people-fill" />{peers.length + 1}</div>
                </div>
                <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={onExpand} title="Open" style={miniBtn('#748ffc')}><i className="bi bi-arrows-fullscreen" style={{ fontSize: '0.8rem' }} /></button>
                    <button onClick={toggleAudio} title={audio ? 'Mute' : 'Unmute'} style={miniBtn(audio ? 'rgba(255,255,255,.1)' : '#e03131')}><i className={`bi ${audio ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`} style={{ fontSize: '0.8rem' }} /></button>
                    <button onClick={toggleVideo} title={video ? 'Cam off' : 'Cam on'} style={miniBtn(video ? 'rgba(255,255,255,.1)' : '#e03131')}><i className={`bi ${video ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`} style={{ fontSize: '0.8rem' }} /></button>
                    <button onClick={handleLeave} title="Leave" style={{ ...miniBtn('#e03131'), marginLeft: 'auto' }}><i className="bi bi-telephone-x-fill" style={{ fontSize: '0.8rem' }} /></button>
                    {unread > 0 && <span style={{ background: '#e03131', color: '#fff', borderRadius: 999, fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>{unread}</span>}
                </div>
            </div>
        );
    }

    // ── Full view ─────────────────────────────────────────────────────────────
    return (
        <>
            <style>{`
                :root { --vc-font: 'Sora', 'Segoe UI', system-ui, sans-serif; }
                @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700&display=swap');
                .vc-scroll::-webkit-scrollbar { width: 4px; }
                .vc-scroll::-webkit-scrollbar-track { background: transparent; }
                .vc-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.12); border-radius: 4px; }
                @keyframes vcPanelIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
                @keyframes vcMiniIn  { from { opacity: 0; transform: scale(.8); } to { opacity: 1; transform: none; } }
            `}</style>
            <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: '#0d0f12', display: 'flex', flexDirection: 'column', fontFamily: 'var(--vc-font)' }}>
                {/* Top bar */}
                <div style={{ height: 52, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: status === 'joined' ? '#69db7c' : '#748ffc', boxShadow: status === 'joined' ? '0 0 6px #69db7c' : '0 0 6px #748ffc' }} />
                        <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: '0.88rem' }}>Video Conference</span>
                        <span style={{ color: '#4a4f5e', fontSize: '0.75rem' }}>·</span>
                        <span style={{ color: '#748ffc', fontSize: '0.75rem', fontWeight: 500 }}>{roomId}</span>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {phase === 'joined' && <>
                            <button onClick={copyInvite} style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 7, color: copied ? '#69db7c' : '#9ba4b5', fontSize: '0.75rem', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--vc-font)' }}>
                                <i className={`bi ${copied ? 'bi-check-lg' : 'bi-link-45deg'}`} />{copied ? 'Copied!' : 'Invite'}
                            </button>
                            <span style={{ color: '#4a4f5e', fontSize: '0.75rem' }}>{peers.length + 1} participants</span>
                        </>}
                        <button onClick={handleLeave} style={{ background: 'rgba(224,49,49,.12)', border: '1px solid rgba(224,49,49,.25)', borderRadius: 7, color: '#ff6b6b', fontSize: '0.75rem', padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'var(--vc-font)' }}>
                            <i className="bi bi-x-lg" /> Leave
                        </button>
                    </div>
                </div>

                {permBanner === 'prompted' && <div style={{ background: '#1c2a3a', color: '#74c0fc', fontSize: '0.78rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}><i className="bi bi-shield-lock-fill" /> Allow camera/mic in the browser prompt above.</div>}
                {permBanner === 'denied'   && <div style={{ background: '#2c1f1f', color: '#ffa8a8', fontSize: '0.78rem', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: 8 }}><i className="bi bi-mic-mute-fill" /> Permission denied — click the lock icon in the address bar.</div>}

                <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                    {/* Main area */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        {phase === 'pre' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <div style={{ width: '100%', maxWidth: 460, background: 'rgba(255,255,255,.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,.07)', overflow: 'hidden' }}>
                                    <JoiningScreen nickname={nickname} roomId={roomId} onReady={handleReady} onCancel={onClose} />
                                </div>
                            </div>
                        )}
                        {phase === 'error' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#fa5252' }}>
                                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem' }} />
                                <span>{errorMsg}</span>
                                <button onClick={handleLeave} style={{ background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, color: '#c9cdd4', padding: '7px 16px', cursor: 'pointer', fontFamily: 'var(--vc-font)' }}>Close</button>
                            </div>
                        )}
                        {phase === 'joined' && status === 'connecting' && (
                            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, color: '#9ba4b5' }}>
                                <div className="spinner-border text-primary" />
                                <span style={{ fontSize: '0.88rem' }}>Connecting to room…</span>
                            </div>
                        )}
                        {phase === 'joined' && status === 'joined' && (
                            <div style={{ flex: 1, padding: 12, overflow: 'hidden' }}>
                                {peers.length === 0 ? (
                                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                                        <div style={{ width: '100%', maxWidth: 580, aspectRatio: '16/9' }}>
                                            <VideoTile stream={localStream} label={`${nickname || 'You'} (you)`} muted noVideo={!video || !localStream?.getVideoTracks().some(t => t.enabled)} />
                                        </div>
                                        <div style={{ color: '#4a4f5e', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 8 }}><i className="bi bi-hourglass-split" /> Waiting for others to join…</div>
                                    </div>
                                ) : (
                                    <div style={{ height: '100%', display: 'grid', gap: 8, alignContent: 'center', ...gridStyle }}>
                                        {allTiles.map(tile => (
                                            <VideoTile key={tile.socketId} stream={tile.stream} label={tile.isSelf ? `${tile.nickname} (you)` : tile.nickname} muted={tile.muted} noVideo={!tile.video || (!tile.stream && !tile.isSelf) || (tile.isSelf && (!localStream || !localStream.getVideoTracks().some(t => t.enabled)))} handRaised={tile.handRaised} audioOff={!tile.audio} isScreen={tile.isScreen} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Side panel */}
                    {panel && (
                        <div style={{ width: 300, flexShrink: 0, borderLeft: '1px solid rgba(255,255,255,.07)', background: '#111318', display: 'flex', flexDirection: 'column', animation: 'vcPanelIn .2s ease', position: 'relative' }}>
                            {/* Private room confirm toast */}
                            {privateRoomPeer && (
                                <PrivateRoomToast
                                    peer={privateRoomPeer}
                                    onConfirm={() => startPrivateRoom(privateRoomPeer)}
                                    onCancel={() => setPrivateRoomPeer(null)}
                                />
                            )}

                            <div style={{ height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid rgba(255,255,255,.07)', gap: 8 }}>
                                {['participants', 'chat'].map(name => (
                                    <button key={name} onClick={() => { setPanel(name); if (name === 'chat') setUnread(0); setDmTarget(null); }}
                                        style={{ background: panel === name ? 'rgba(116,143,252,.15)' : 'transparent', border: panel === name ? '1px solid rgba(116,143,252,.3)' : '1px solid transparent', borderRadius: 7, color: panel === name ? '#748ffc' : '#5c6070', fontFamily: 'var(--vc-font)', fontWeight: 500, fontSize: '0.78rem', padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, position: 'relative' }}>
                                        <i className={`bi ${name === 'chat' ? 'bi-chat-text' : 'bi-people'}`} />{name === 'chat' ? 'Chat' : 'People'}
                                        {name === 'chat' && unread > 0 && <span style={{ background: '#e03131', color: '#fff', borderRadius: 999, fontSize: '0.58rem', fontWeight: 700, minWidth: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>{unread}</span>}
                                    </button>
                                ))}
                                <button onClick={() => { setPanel(null); setDmTarget(null); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#4a4f5e', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', padding: 4 }}><i className="bi bi-x-lg" /></button>
                            </div>

                            <div className="vc-scroll" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                {panel === 'participants' && (
                                    <ParticipantsPanel
                                        peers={peers}
                                        mySocketId={mySocketId}
                                        myNickname={nickname}
                                        onDM={(sid) => { setPanel('chat'); setDmTarget(sid); setUnread(0); }}
                                        onPrivateRoom={(peer) => setPrivateRoomPeer(peer)}
                                    />
                                )}
                                {panel === 'chat' && (
                                    <ChatPanel
                                        messages={messages}
                                        mySocketId={mySocketId}
                                        myNickname={nickname}
                                        myAccessLevel={accessLevel}
                                        dmTarget={dmTarget}
                                        setDmTarget={setDmTarget}
                                        peers={peers}
                                        onSend={sendChat}
                                        onDeleteMsg={deleteMsg}
                                        onPrivateRoom={(peer) => setPrivateRoomPeer(peer)}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom toolbar */}
                {phase === 'joined' && (
                    <div style={{ height: 72, flexShrink: 0, borderTop: '1px solid rgba(255,255,255,.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                            <ToolBtn icon={audio ? 'bi-mic-fill' : 'bi-mic-mute-fill'} label={audio ? 'Mute' : 'Unmute'} active={audio} onClick={toggleAudio} danger={!audio} />
                            {audio && localStream && <MicMeter stream={localStream} size={12} />}
                        </div>
                        <ToolBtn icon={video ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'} label={video ? 'Cam off' : 'Cam on'} active={video} onClick={toggleVideo} danger={!video} />
                        <ToolBtn icon="bi-display" label="Share" active={!!screenStream} onClick={toggleScreen} />
                        <ToolBtn icon={handRaised ? 'bi-hand-index-thumb-fill' : 'bi-hand-index-thumb'} label="Hand" active={handRaised} onClick={toggleHand} />
                        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.08)', margin: '0 4px', flexShrink: 0 }} />
                        <ToolBtn icon="bi-people-fill" label="People" active={panel === 'participants'} onClick={() => togglePanel('participants')} />
                        <ToolBtn icon="bi-chat-text-fill" label="Chat" active={panel === 'chat'} onClick={() => togglePanel('chat')} badge={panel !== 'chat' ? unread : 0} />
                        <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,.08)', margin: '0 4px', flexShrink: 0 }} />
                        <ToolBtn icon="bi-telephone-x-fill" label="Leave" danger onClick={handleLeave} />
                        {onMinimize && <ToolBtn icon="bi-pip" label="Mini" onClick={onMinimize} />}
                    </div>
                )}
            </div>
        </>
    );
}
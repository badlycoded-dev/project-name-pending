import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { VideoConference } from '../components/VideoConference';

// ─── MicMeter ────────────────────────────────────────────────────────────────
function MicMeter({ stream }) {
    const [level, setLevel] = useState(0);
    const rafRef   = useRef(null);
    const nodeRef  = useRef(null);
    const ctxRef   = useRef(null);
    const analRef  = useRef(null);

    useEffect(() => {
        if (!stream || !stream.getAudioTracks().some(t => t.enabled)) {
            setLevel(0);
            return;
        }
        try {
            const ctx      = new AudioContext();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            const src = ctx.createMediaStreamSource(stream);
            src.connect(analyser);
            ctxRef.current  = ctx;
            analRef.current = analyser;
            const buf = new Uint8Array(analyser.frequencyBinCount);

            const tick = () => {
                analyser.getByteFrequencyData(buf);
                const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
                setLevel(Math.min(100, (avg / 128) * 100 * 2.5));
                rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
        } catch {}

        return () => {
            cancelAnimationFrame(rafRef.current);
            ctxRef.current?.close();
        };
    }, [stream]);

    const bars = 20;
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
            {Array.from({ length: bars }).map((_, i) => {
                const threshold = (i / bars) * 100;
                const active    = level > threshold;
                const color     = i < bars * 0.6 ? '#40c057' : i < bars * 0.85 ? '#fab005' : '#fa5252';
                return (
                    <div key={i} style={{
                        width: 4, height: 6 + (i % 3) * 3,
                        borderRadius: 2,
                        background: active ? color : 'rgba(255,255,255,0.12)',
                        transition: 'background 0.05s',
                    }} />
                );
            })}
        </div>
    );
}

// ─── DeviceSelect ─────────────────────────────────────────────────────────────
function DeviceSelect({ label, icon, devices, value, onChange, disabled }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <label style={{ color: '#868e96', fontSize: '.72rem', fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 5 }}>
                <i className={`bi ${icon}`} style={{ fontSize: '.8rem' }}></i>
                {label}
            </label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                disabled={disabled || devices.length === 0}
                style={{
                    background: '#1e2330', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8, color: disabled ? '#495057' : '#ced4da',
                    padding: '8px 12px', fontSize: '.82rem', outline: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer', width: '100%',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%23868e96' d='M6 8L0 0h12z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center',
                    paddingRight: 32,
                }}>
                {devices.length === 0
                    ? <option>No device found</option>
                    : devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 6)}`}</option>)
                }
            </select>
        </div>
    );
}

// ─── Lobby ────────────────────────────────────────────────────────────────────
function Lobby({ roomId, nickname, onJoin, onCancel }) {
    const previewRef = useRef(null);
    const streamRef  = useRef(null);

    const [camOn,  setCamOn]  = useState(true);
    const [micOn,  setMicOn]  = useState(true);
    const [stream, setStream] = useState(null);

    const [cameras,   setCameras]   = useState([]);
    const [mics,      setMics]      = useState([]);
    const [speakers,  setSpeakers]  = useState([]);
    const [camId,     setCamId]     = useState('');
    const [micId,     setMicId]     = useState('');
    const [speakerId, setSpeakerId] = useState('');

    const [permState, setPermState] = useState('idle'); // idle | asking | denied | ready
    const [bgBlur,    setBgBlur]    = useState(false);

    // ── Enumerate devices after permission ────────────────────────────────────
    const enumerateDevices = useCallback(async () => {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter(d => d.kind === 'videoinput'));
        setMics(devices.filter(d => d.kind === 'audioinput'));
        setSpeakers(devices.filter(d => d.kind === 'audiooutput'));
    }, []);

    // ── Start/restart preview stream ──────────────────────────────────────────
    const startPreview = useCallback(async (videoDeviceId, audioDeviceId) => {
        // Stop previous stream
        streamRef.current?.getTracks().forEach(t => t.stop());

        setPermState('asking');
        try {
            const s = await navigator.mediaDevices.getUserMedia({
                video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : true,
                audio: audioDeviceId ? { deviceId: { exact: audioDeviceId } } : true,
            });
            streamRef.current = s;
            setStream(s);
            setPermState('ready');
            await enumerateDevices(); // labels now available after permission
        } catch (e) {
            setPermState('denied');
        }
    }, [enumerateDevices]);

    // Initial permission request
    useEffect(() => {
        startPreview('', '');
        return () => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            cancelAnimationFrame(0);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update video element
    useEffect(() => {
        if (previewRef.current && stream) {
            previewRef.current.srcObject = stream;
        }
    }, [stream]);

    // Camera on/off
    useEffect(() => {
        stream?.getVideoTracks().forEach(t => { t.enabled = camOn; });
    }, [camOn, stream]);

    // Mic on/off
    useEffect(() => {
        stream?.getAudioTracks().forEach(t => { t.enabled = micOn; });
    }, [micOn, stream]);

    // Device change → restart preview
    const handleCamChange = (id) => { setCamId(id); startPreview(id, micId); };
    const handleMicChange = (id) => { setMicId(id); startPreview(camId, id); };

    // On join: stop lobby preview, pass chosen settings to parent
    const handleJoin = () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        setStream(null);
        onJoin({ camOn, micOn, camId, micId });
    };

    const videoOff = !camOn || permState === 'denied';

    return (
        <div style={{
            minHeight: '100vh', background: '#0d0f14',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'DM Sans', system-ui, sans-serif",
            padding: 24,
        }}>
            {/* Subtle grid background */}
            <div style={{
                position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
                backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
            }} />
            {/* Glow blobs */}
            <div style={{ position: 'fixed', top: -80, left: '30%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(100,130,255,0.07) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: -60, right: '20%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(60,200,150,0.05) 0%, transparent 70%)', zIndex: 0, pointerEvents: 'none' }} />

            <div style={{
                position: 'relative', zIndex: 1,
                display: 'flex', gap: 32, alignItems: 'flex-start',
                width: '100%', maxWidth: 900,
                flexWrap: 'wrap',
            }}>
                {/* ── Left: camera preview ─────────────────────────────────── */}
                <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Camera tile */}
                    <div style={{
                        position: 'relative', borderRadius: 16, overflow: 'hidden',
                        aspectRatio: '16/9', background: '#141720',
                        border: '1px solid rgba(255,255,255,0.07)',
                        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                    }}>
                        {/* Video */}
                        <video
                            ref={previewRef}
                            autoPlay playsInline muted
                            style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                display: videoOff ? 'none' : 'block',
                                filter: bgBlur ? 'blur(12px) brightness(.9)' : 'none',
                                transition: 'filter .3s',
                            }}
                        />

                        {/* Avatar placeholder when cam off */}
                        {videoOff && (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                                <div style={{
                                    width: 72, height: 72, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #3b5bdb 0%, #364fc7 100%)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '2rem', color: '#fff', fontWeight: 700,
                                    boxShadow: '0 0 0 4px rgba(59,91,219,0.2)',
                                }}>
                                    {(nickname || '?')[0].toUpperCase()}
                                </div>
                                {permState === 'denied' && (
                                    <span style={{ color: '#868e96', fontSize: '.75rem' }}>Camera blocked</span>
                                )}
                            </div>
                        )}

                        {/* Top-right: bg blur toggle */}
                        {!videoOff && (
                            <button
                                onClick={() => setBgBlur(b => !b)}
                                title={bgBlur ? 'Remove blur' : 'Blur background'}
                                style={{
                                    position: 'absolute', top: 10, right: 10,
                                    background: bgBlur ? 'rgba(59,91,219,0.7)' : 'rgba(0,0,0,0.45)',
                                    border: 'none', borderRadius: 8, color: '#fff',
                                    padding: '5px 9px', fontSize: '.72rem', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: 5, backdropFilter: 'blur(8px)',
                                }}>
                                <i className="bi bi-person-bounding-box"></i>
                                {bgBlur ? 'Blur on' : 'Blur off'}
                            </button>
                        )}

                        {/* Bottom bar: name + cam/mic toggles */}
                        <div style={{
                            position: 'absolute', bottom: 0, left: 0, right: 0,
                            padding: '20px 14px 12px',
                            background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ color: '#fff', fontSize: '.82rem', fontWeight: 500 }}>
                                {nickname || 'You'}
                            </span>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                    onClick={() => setMicOn(m => !m)}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%', border: 'none',
                                        cursor: 'pointer', fontSize: '.95rem',
                                        background: micOn ? 'rgba(255,255,255,0.18)' : 'rgba(224,49,49,0.85)',
                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backdropFilter: 'blur(8px)', transition: 'background .15s',
                                    }}>
                                    <i className={`bi ${micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`}></i>
                                </button>
                                <button
                                    onClick={() => setCamOn(c => !c)}
                                    style={{
                                        width: 36, height: 36, borderRadius: '50%', border: 'none',
                                        cursor: 'pointer', fontSize: '.95rem',
                                        background: camOn ? 'rgba(255,255,255,0.18)' : 'rgba(224,49,49,0.85)',
                                        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        backdropFilter: 'blur(8px)', transition: 'background .15s',
                                    }}>
                                    <i className={`bi ${camOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'}`}></i>
                                </button>
                            </div>
                        </div>

                        {/* Asking-permission overlay */}
                        {permState === 'asking' && (
                            <div style={{
                                position: 'absolute', inset: 0, background: 'rgba(13,15,20,0.75)',
                                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                gap: 12, backdropFilter: 'blur(4px)',
                            }}>
                                <div style={{ width: 32, height: 32, border: '3px solid rgba(255,255,255,0.15)', borderTopColor: '#748ffc', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                <span style={{ color: '#adb5bd', fontSize: '.82rem' }}>Waiting for permission…</span>
                            </div>
                        )}
                    </div>

                    {/* Mic level meter */}
                    <div style={{
                        background: '#141720', borderRadius: 12, padding: '12px 16px',
                        border: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <i className={`bi ${micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'}`}
                            style={{ color: micOn ? '#40c057' : '#fa5252', fontSize: '1rem', flexShrink: 0 }}></i>
                        {micOn && permState === 'ready'
                            ? <MicMeter stream={stream} />
                            : <span style={{ color: '#495057', fontSize: '.78rem' }}>
                                {micOn ? 'Waiting for microphone…' : 'Microphone is off'}
                            </span>
                        }
                    </div>

                    {/* Denied warning */}
                    {permState === 'denied' && (
                        <div style={{
                            background: 'rgba(250,82,82,0.08)', border: '1px solid rgba(250,82,82,0.2)',
                            borderRadius: 10, padding: '10px 14px',
                            color: '#ffa8a8', fontSize: '.78rem', display: 'flex', gap: 8, alignItems: 'flex-start',
                        }}>
                            <i className="bi bi-shield-exclamation" style={{ flexShrink: 0, marginTop: 1 }}></i>
                            Camera and microphone were blocked. Click the lock icon in your browser's address bar to allow access, then refresh.
                        </div>
                    )}
                </div>

                {/* ── Right: info + device settings + join ─────────────────── */}
                <div style={{ flex: '1 1 260px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                    {/* Room info */}
                    <div>
                        <div style={{ color: '#748ffc', fontSize: '.72rem', fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                            <i className="bi bi-camera-video-fill" style={{ marginRight: 5 }}></i>
                            Video Conference
                        </div>
                        <h1 style={{ color: '#fff', fontSize: '1.45rem', fontWeight: 700, margin: '0 0 4px', lineHeight: 1.25 }}>
                            Ready to join?
                        </h1>
                        <p style={{ color: '#868e96', fontSize: '.82rem', margin: 0 }}>
                            Room: <code style={{ color: '#748ffc', background: 'rgba(116,143,252,0.1)', padding: '1px 6px', borderRadius: 4, fontSize: '.78rem' }}>{roomId}</code>
                        </p>
                    </div>

                    {/* Device settings */}
                    <div style={{
                        background: '#141720', border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 14, padding: '18px 16px',
                        display: 'flex', flexDirection: 'column', gap: 14,
                    }}>
                        <span style={{ color: '#ced4da', fontSize: '.82rem', fontWeight: 600 }}>
                            <i className="bi bi-sliders" style={{ marginRight: 6 }}></i>
                            Device settings
                        </span>

                        <DeviceSelect
                            label="Camera"
                            icon="bi-camera-video"
                            devices={cameras}
                            value={camId}
                            onChange={handleCamChange}
                            disabled={!camOn || permState !== 'ready'}
                        />
                        <DeviceSelect
                            label="Microphone"
                            icon="bi-mic"
                            devices={mics}
                            value={micId}
                            onChange={handleMicChange}
                            disabled={!micOn || permState !== 'ready'}
                        />
                        <DeviceSelect
                            label="Speaker"
                            icon="bi-volume-up"
                            devices={speakers}
                            value={speakerId}
                            onChange={setSpeakerId}
                            disabled={permState !== 'ready'}
                        />
                    </div>

                    {/* Join / Cancel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <button
                            onClick={handleJoin}
                            style={{
                                background: 'linear-gradient(135deg, #3b5bdb 0%, #364fc7 100%)',
                                border: 'none', borderRadius: 12, color: '#fff',
                                padding: '13px 24px', fontSize: '.9rem', fontWeight: 700,
                                cursor: 'pointer', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', gap: 8, letterSpacing: '.02em',
                                boxShadow: '0 4px 20px rgba(59,91,219,0.35)',
                                transition: 'transform .12s, box-shadow .12s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(59,91,219,0.5)'; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,91,219,0.35)'; }}>
                            <i className="bi bi-camera-video-fill"></i>
                            Join now
                        </button>
                        <button
                            onClick={onCancel}
                            style={{
                                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 12, color: '#868e96', padding: '11px 24px',
                                fontSize: '.85rem', cursor: 'pointer', transition: 'border-color .15s, color .15s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.color = '#ced4da'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#868e96'; }}>
                            Cancel
                        </button>
                    </div>

                    {/* Status chips */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <Chip icon={camOn ? 'bi-camera-video-fill' : 'bi-camera-video-off-fill'} label={camOn ? 'Camera on' : 'Camera off'} active={camOn} />
                        <Chip icon={micOn ? 'bi-mic-fill' : 'bi-mic-mute-fill'} label={micOn ? 'Mic on' : 'Mic off'} active={micOn} />
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

function Chip({ icon, label, active }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: active ? 'rgba(64,192,87,0.1)' : 'rgba(250,82,82,0.08)',
            border: `1px solid ${active ? 'rgba(64,192,87,0.2)' : 'rgba(250,82,82,0.15)'}`,
            borderRadius: 999, padding: '3px 10px',
            color: active ? '#69db7c' : '#ff8787', fontSize: '.72rem', fontWeight: 500,
        }}>
            <i className={`bi ${icon}`}></i>
            {label}
        </div>
    );
}

// ─── MeetingPage ──────────────────────────────────────────────────────────────
/**
 * Route: /meeting?session=<sessionId>
 *        /meeting?room=<roomId>
 *
 * Shows the Teams-style lobby first, then mounts VideoConference on join.
 */
export default function MeetingPage({ data }) {
    const [searchParams] = useSearchParams();
    const navigate       = useNavigate();

    const sessionId = searchParams.get('session');
    const rawRoom   = searchParams.get('room');
    const roomId    = rawRoom || (sessionId ? `session:${sessionId}` : null);

    const [phase, setPhase]         = useState('lobby'); // 'lobby' | 'conference'
    const [joinSettings, setJoinSettings] = useState(null);

    const nickname = data?.nickname || data?.email || 'Guest';

    // Not logged in
    if (!localStorage.getItem('token')) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/login?returnTo=${returnTo}`, { replace: true });
        return null;
    }

    // No room specified
    if (!roomId) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0f14', color: '#fa5252', fontFamily: 'system-ui', flexDirection: 'column', gap: 12 }}>
                <i className="bi bi-exclamation-triangle" style={{ fontSize: '2rem' }}></i>
                <span>No session or room specified. Use <code>?session=ID</code> or <code>?room=ID</code>.</span>
                <button onClick={() => navigate(-1)} style={{ marginTop: 8, background: 'transparent', border: '1px solid rgba(255,255,255,.2)', color: '#adb5bd', borderRadius: 8, padding: '8px 18px', cursor: 'pointer' }}>Go back</button>
            </div>
        );
    }

    if (phase === 'conference') {
        return (
            <VideoConference
                roomId={roomId}
                nickname={nickname}
                initialCamOn={joinSettings?.camOn ?? false}
                initialMicOn={joinSettings?.micOn ?? false}
                preferredCamId={joinSettings?.camId}
                preferredMicId={joinSettings?.micId}
                onClose={() => navigate(-1)}
            />
        );
    }

    return (
        <Lobby
            roomId={roomId}
            nickname={nickname}
            onJoin={(settings) => { setJoinSettings(settings); setPhase('conference'); }}
            onCancel={() => navigate(-1)}
        />
    );
}

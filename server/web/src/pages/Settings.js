import { toHttps } from '../utils/utils';
import { useEffect, useState, useRef, useCallback } from 'react';
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';
import { formatLaunchTime, formatUptime } from '../utils/utils';

const API     = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');
const RTC_API = toHttps(process.env.REACT_APP_RTC_URL || 'https://localhost:5050');

function Settings({ data, onLogout }) {
    const token = localStorage.getItem('token');
    const ah    = { Authorization: token, 'Content-Type': 'application/json' };
    const isAdmin = ['admin','root'].includes(data?.accessLevel);
    const isManage = ['manage','admin','root'].includes(data?.accessLevel);

    const [tab, setTab] = useState('logs');

    // ── Modal ──────────────────────────────────────────────────────────────
    const [modal, setModal] = useState({ show:false,type:'info',title:'',message:'',onConfirm:null,onCancel:null,onClose:null,danger:false });
    const closeModal  = () => setModal(p => ({...p,show:false}));
    const showInfo    = (t,m) => setModal({show:true,type:'info',title:t,message:m,onClose:closeModal});
    const showConfirm = (t,m,fn,d=false) => setModal({show:true,type:'confirm',danger:d,title:t,message:m,onConfirm:fn,onCancel:closeModal});

    // ══ TAB: LOGS ══
    const [logs, setLogs]           = useState([]);
    const [logFiles, setLogFiles]   = useState([]);
    const [logDate, setLogDate]     = useState('today');
    const [logLines, setLogLines]   = useState(150);
    const [logLoading, setLogLoading] = useState(false);
    const [logSearch, setLogSearch] = useState('');
    const [sseState, setSseState]   = useState('idle');
    const esRef = useRef(null);
    const logEndRef = useRef(null);

    const fetchLogFiles = useCallback(async () => {
        try {
            const r = await fetch(`${API}/utils/logs/files`, { headers: ah });
            if (r.ok) { const d = await r.json(); setLogFiles(d.files || []); }
        } catch {}
    }, []);

    const fetchLogs = useCallback(async (date = logDate, lines = logLines) => {
        setLogLoading(true);
        try {
            const r = await fetch(`${API}/utils/logs?date=${date}&lines=${lines}`, { headers: ah });
            if (r.ok) {
                const d = await r.json();
                const raw = Array.isArray(d.logs) ? d.logs : (typeof d.logs === 'string' ? d.logs.split('\n') : []);
                setLogs(raw.filter(Boolean));
            }
        } catch {} finally { setLogLoading(false); }
    }, [logDate, logLines]);

    useEffect(() => { fetchLogFiles(); }, []);

    // SSE streaming for today's logs
    const startStream = useCallback(() => {
        if (esRef.current) { esRef.current.close(); esRef.current = null; }
        setSseState('connecting');
        const url = `${API}/utils/logs/stream?token=${encodeURIComponent(token)}&date=today&lines=${logLines}`;
        const es = new EventSource(url);
        esRef.current = es;
        es.onopen    = () => setSseState('open');
        es.onerror   = () => setSseState('error');
        es.onmessage = (e) => {
            try {
                const d = JSON.parse(e.data);
                if (d.logs) {
                    const raw = Array.isArray(d.logs) ? d.logs : d.logs.split('\n');
                    setLogs(raw.filter(Boolean));
                    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior:'smooth' }), 100);
                }
            } catch {}
        };
    }, [token, logLines]);

    const stopStream = useCallback(() => {
        esRef.current?.close(); esRef.current = null; setSseState('idle');
    }, []);

    useEffect(() => {
        if (tab === 'logs' && logDate === 'today') { startStream(); }
        else { stopStream(); if (tab === 'logs') fetchLogs(logDate, logLines); }
        return stopStream;
    }, [tab, logDate, logLines]);

    const classifyLine = (line) => {
        const l = line.toLowerCase();
        if (l.includes('error') || l.includes('err:') || l.includes('[error]')) return 'log-error';
        if (l.includes('warn')  || l.includes('[warn]'))  return 'log-warn';
        if (l.includes('[info]') || l.includes('info:'))  return 'log-info';
        if (l.includes('[debug]'))                         return 'log-debug';
        return '';
    };

    const filteredLogs = logSearch
        ? logs.filter(l => l.toLowerCase().includes(logSearch.toLowerCase()))
        : logs;

    // ══ TAB: RTC ══
    const [rtcRooms, setRtcRooms]     = useState([]);
    const [rtcLog, setRtcLog]         = useState([]);
    const [rtcLoading, setRtcLoading] = useState(false);
    const [chatRoom, setChatRoom]     = useState(null);
    const [chatHistory, setChatHistory] = useState([]);

    const fetchRtc = useCallback(async () => {
        setRtcLoading(true);
        try {
            const [roomsR, logsR] = await Promise.all([
                fetch(`${RTC_API}/rooms`, { headers: ah }),
                fetch(`${RTC_API}/rooms/logs`, { headers: ah }),
            ]);
            if (roomsR.ok) { const d = await roomsR.json(); setRtcRooms(d.rooms || []); }
            if (logsR.ok)  { const d = await logsR.json();  setRtcLog(d.lines || []); }
        } catch (e) { console.warn('RTC fetch error:', e.message); }
        finally { setRtcLoading(false); }
    }, []);

    const fetchRtcChat = async (roomId) => {
        try {
            const r = await fetch(`${RTC_API}/rooms/${encodeURIComponent(roomId)}/chat`, { headers: ah });
            if (r.ok) { const d = await r.json(); setChatHistory(d.messages || []); setChatRoom(roomId); }
        } catch {}
    };

    const closeRoom = (roomId) => {
        showConfirm('Close Room', `Force-close room "${roomId}"? All participants will be disconnected.`, async () => {
            const r = await fetch(`${RTC_API}/rooms/${encodeURIComponent(roomId)}`, { method:'DELETE', headers: ah });
            if (r.ok) { showInfo('Done', 'Room closed.'); fetchRtc(); }
            else { const d = await r.json().catch(()=>({})); showInfo('Error', d.error || 'Failed'); }
        }, true);
    };

    const kickPeer = (roomId, socketId, nickname) => {
        showConfirm('Kick Participant', `Remove "${nickname}" from the room?`, async () => {
            const r = await fetch(`${RTC_API}/rooms/${encodeURIComponent(roomId)}/peers/${socketId}`, { method:'DELETE', headers: ah });
            if (r.ok) fetchRtc();
            else { const d = await r.json().catch(()=>({})); showInfo('Error', d.error || 'Failed'); }
        }, true);
    };

    useEffect(() => { if (tab === 'rtc') fetchRtc(); }, [tab]);

    // ══ TAB: SYSTEM ══
    const [sysInfo, setSysInfo] = useState(null);
    const fetchSys = useCallback(async () => {
        try {
            const r = await fetch(`${API}/utils/status`, { headers: ah });
            if (r.ok) { const d = await r.json(); setSysInfo(d); }
        } catch {}
    }, []);
    useEffect(() => { if (tab === 'system') fetchSys(); }, [tab]);

    const TABS = [
        { key:'logs',   icon:'bi-terminal',    label:'Server Logs', show: isManage },
        { key:'rtc',    icon:'bi-camera-video', label:'RTC Rooms',  show: isManage },
        { key:'system', icon:'bi-server',       label:'System',     show: isManage },
    ].filter(t => t.show);

    return (
        <AppLayout data={data} onLogout={onLogout} title="Settings & Logs">
            {/* Tabs */}
            <ul className="nav nav-tabs mb-4">
                {TABS.map(t => (
                    <li key={t.key} className="nav-item">
                        <button className={`nav-link${tab===t.key?' active':''}`} onClick={() => setTab(t.key)}>
                            <i className={`bi ${t.icon} me-1`} />{t.label}
                        </button>
                    </li>
                ))}
            </ul>

            {/* ══ LOGS ══ */}
            {tab === 'logs' && (
                <div>
                    <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                        <select className="form-select form-select-sm" style={{maxWidth:180}}
                            value={logDate} onChange={e => setLogDate(e.target.value)}>
                            <option value="today">Today (live)</option>
                            {logFiles.map(f => (
                                <option key={f} value={f.replace('app-','').replace('.log','')}>
                                    {f.replace('app-','').replace('.log','')}
                                </option>
                            ))}
                        </select>
                        <select className="form-select form-select-sm" style={{maxWidth:120}}
                            value={logLines} onChange={e => setLogLines(+e.target.value)}>
                            {[50,100,150,300,500].map(n => <option key={n} value={n}>Last {n}</option>)}
                        </select>
                        <input type="text" className="form-control form-control-sm" style={{maxWidth:200}}
                            placeholder="Search logs…" value={logSearch} onChange={e => setLogSearch(e.target.value)} />
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => fetchLogs(logDate, logLines)} disabled={logLoading}>
                            <i className="bi bi-arrow-clockwise me-1" />Refresh
                        </button>
                        {logDate === 'today' && (
                            <span className={`status-badge ${sseState==='open'?'active':'warning'}`} style={{fontSize:'.7rem'}}>
                                {sseState==='open'?'● Live':'Connecting…'}
                            </span>
                        )}
                        <span className="text-muted-c small ms-auto">{filteredLogs.length} lines</span>
                    </div>

                    <div className="log-viewer">
                        {logLoading && <div style={{color:'var(--text-muted)'}}>Loading…</div>}
                        {filteredLogs.length === 0 && !logLoading && (
                            <div style={{color:'var(--text-muted)'}}>No logs found.</div>
                        )}
                        {filteredLogs.map((line, i) => (
                            <div key={i} className={`log-line ${classifyLine(line)}`}>{line}</div>
                        ))}
                        <div ref={logEndRef} />
                    </div>
                </div>
            )}

            {/* ══ RTC ROOMS ══ */}
            {tab === 'rtc' && (
                <div>
                    <div className="d-flex align-items-center justify-content-between mb-3 flex-wrap gap-2">
                        <h6 className="mb-0 fw-semibold">Active Rooms <span className="text-muted-c fw-normal">({rtcRooms.length})</span></h6>
                        <button className="btn btn-sm btn-outline-secondary" onClick={fetchRtc} disabled={rtcLoading}>
                            <i className="bi bi-arrow-clockwise me-1" />{rtcLoading ? 'Loading…' : 'Refresh'}
                        </button>
                    </div>

                    {rtcRooms.length === 0 && !rtcLoading && (
                        <div className="empty-state">
                            <div className="empty-state-icon">📡</div>
                            <div className="empty-state-title">No active rooms</div>
                        </div>
                    )}

                    {rtcRooms.map(room => (
                        <div key={room.roomId} className="rtc-room-card mb-3">
                            <div className="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
                                <div>
                                    <div className="fw-semibold">{room.roomId}</div>
                                    <div className="room-id">{room.peers?.length || 0} participant{room.peers?.length !== 1 ? 's' : ''} · {room.chatCount} messages · Created {room.createdAt ? new Date(room.createdAt).toLocaleString() : 'unknown'}</div>
                                </div>
                                <div className="d-flex gap-2">
                                    <button className="btn btn-sm btn-outline-info" onClick={() => fetchRtcChat(room.roomId)}>
                                        <i className="bi bi-chat me-1" />Chat Log
                                    </button>
                                    <button className="btn btn-sm btn-outline-danger" onClick={() => closeRoom(room.roomId)}>
                                        <i className="bi bi-x-circle me-1" />Close Room
                                    </button>
                                </div>
                            </div>
                            {room.peers?.map(p => (
                                <div key={p.socketId} className="rtc-participant">
                                    <span className="status-badge active" style={{fontSize:'.65rem'}}>●</span>
                                    <strong style={{flex:1}}>{p.nickname}</strong>
                                    <span className="text-muted-c small">{p.userId}</span>
                                    <span style={{fontSize:'.8rem',gap:4,display:'flex',alignItems:'center'}}>
                                        {p.video ? <i className="bi bi-camera-video" title="Video on" /> : <i className="bi bi-camera-video-off text-danger" title="Video off" />}
                                        {p.audio ? <i className="bi bi-mic" title="Mic on" /> : <i className="bi bi-mic-mute text-danger" title="Mic off" />}
                                        {p.screen && <i className="bi bi-display" title="Sharing screen" />}
                                        {p.handRaised && <i className="bi bi-hand-index text-warning" title="Hand raised" />}
                                    </span>
                                    <span className="text-muted-c small">{p.joinedAt ? new Date(p.joinedAt).toLocaleTimeString() : ''}</span>
                                    <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => kickPeer(room.roomId, p.socketId, p.nickname)}>
                                        <i className="bi bi-person-x" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}

                    {/* Chat history modal */}
                    {chatRoom && (
                        <div className="modal show d-block" style={{background:'rgba(0,0,0,.5)',position:'fixed',inset:0,zIndex:1050}} onClick={() => setChatRoom(null)}>
                            <div className="modal-dialog modal-lg" onClick={e => e.stopPropagation()}>
                                <div className="modal-content">
                                    <div className="modal-header">
                                        <h5 className="modal-title">Chat: {chatRoom}</h5>
                                        <button className="btn-close" onClick={() => setChatRoom(null)} />
                                    </div>
                                    <div className="modal-body" style={{maxHeight:420,overflowY:'auto'}}>
                                        {chatHistory.length === 0
                                            ? <div className="text-muted-c text-center py-3">No messages</div>
                                            : chatHistory.map((m, i) => (
                                                <div key={i} className="d-flex gap-2 mb-2 align-items-start">
                                                    <span className="badge bg-secondary" style={{fontSize:'.65rem',flexShrink:0}}>
                                                        {new Date(m.ts).toLocaleTimeString()}
                                                    </span>
                                                    <strong style={{flexShrink:0,fontSize:'.82rem'}}>{m.fromNickname}:</strong>
                                                    <span style={{fontSize:'.82rem',wordBreak:'break-word'}}>{m.text}</span>
                                                </div>
                                            ))
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RTC server log */}
                    <hr />
                    <h6 className="fw-semibold mb-2"><i className="bi bi-terminal me-2" />RTC Server Log</h6>
                    <div className="log-viewer">
                        {rtcLog.length === 0
                            ? <div style={{color:'var(--text-muted)'}}>No logs or RTC server not reachable.</div>
                            : rtcLog.map((line, i) => (
                                <div key={i} className={`log-line ${line.level === 'error' ? 'log-error' : line.level === 'warn' ? 'log-warn' : 'log-info'}`}>
                                    <span style={{opacity:.5}}>[{line.ts ? new Date(line.ts).toLocaleTimeString() : ''}]</span> {line.msg}
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* ══ SYSTEM ══ */}
            {tab === 'system' && (
                <div className="row g-3">
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-header"><i className="bi bi-server me-2" />Console API Server</div>
                            <div className="card-body p-0">
                                {sysInfo ? (
                                    <table className="table table-sm table-borderless mb-0">
                                        <tbody>
                                            {[
                                                ['Status',   <span className={`status-badge ${sysInfo.status==='ok'?'active':'danger'}`}>{sysInfo.status}</span>],
                                                ['Database', <span className={`status-badge ${sysInfo.db_status==='connected'?'active':'danger'}`}>{sysInfo.db_status}</span>],
                                                ['Uptime',   formatUptime(sysInfo.uptime)],
                                                ['Launch',   sysInfo.launchTime ? formatLaunchTime(sysInfo.launchTime) : '—'],
                                                ['Courses',  typeof(sysInfo.users) === 'array' ? sysInfo.courses?.length: sysInfo.courses ?? '—'],
                                                ['Users',    typeof(sysInfo.users) === 'array' ? sysInfo.users?.length: sysInfo.users ?? '—'],
                                            ].map(([k,v]) => (
                                                <tr key={k}>
                                                    <td style={{color:'var(--text-muted)',paddingLeft:'1rem',width:'40%'}}><strong>{k}</strong></td>
                                                    <td>{v}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                ) : (
                                    <div className="p-3 text-muted-c">
                                        <button className="btn btn-sm btn-outline-secondary" onClick={fetchSys}>Load system info</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="col-md-6">
                        <div className="card">
                            <div className="card-header"><i className="bi bi-info-circle me-2" />Environment</div>
                            <div className="card-body p-0">
                                <table className="table table-sm table-borderless mb-0">
                                    <tbody>
                                        {[
                                            ['API URL',  process.env.REACT_APP_API_URL || '(default)'],
                                            ['RTC URL',  process.env.REACT_APP_RTC_URL || '(default)'],
                                            ['Build',    process.env.NODE_ENV],
                                        ].map(([k,v]) => (
                                            <tr key={k}>
                                                <td style={{color:'var(--text-muted)',paddingLeft:'1rem',width:'40%'}}><strong>{k}</strong></td>
                                                <td><code>{v}</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <UtilityModal {...modal}
                onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
                onCancel={modal.onCancel || closeModal}
                onClose={modal.onClose || closeModal} />
        </AppLayout>
    );
}

export default Settings;

import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import { SettingsContext } from '../../contexts/SettingsContext';

const SOCKET_URL = process.env.REACT_APP_WEBRTC_URL || 'http://localhost:5001';

// ─── CSS ──────────────────────────────────────────────────────────────────────
const styles = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; }

.lsr {
  font-family: 'DM Sans', sans-serif;
  display: flex; flex-direction: column;
  height: calc(100vh - 70px);
  overflow: hidden;
  background: #08080e;
  color: #e8e8f0;
  position: relative;
}
.lsr.light { background: #ededf3; color: #14141e; }

/* ── HEADER ── */
.lsr-hd {
  display: flex; justify-content: space-between; align-items: center;
  padding: 9px 18px;
  background: rgba(255,255,255,.025);
  border-bottom: 1px solid rgba(255,255,255,.07);
  flex-shrink: 0; z-index: 20;
}
.light .lsr-hd { background: rgba(255,255,255,.8); border-bottom-color: rgba(0,0,0,.09); }

.lsr-hd-l { display: flex; align-items: center; gap: 10px; }
.lsr-hd-r { display: flex; align-items: center; gap: 10px; }

.lsr-live {
  display: flex; align-items: center; gap: 6px;
  background: rgba(220,38,38,.15); border: 1px solid rgba(220,38,38,.3);
  border-radius: 20px; padding: 4px 11px;
  font-size: 11px; font-weight: 700; color: #f87171;
  letter-spacing: .09em; text-transform: uppercase;
}
.lsr-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #ef4444;
  animation: ldot 1.6s ease-in-out infinite;
}
@keyframes ldot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }

.lsr-rid {
  font-family: 'DM Mono', monospace; font-size: 11px;
  color: rgba(255,255,255,.28); padding: 3px 9px;
  background: rgba(255,255,255,.04); border-radius: 6px;
  border: 1px solid rgba(255,255,255,.06);
}
.light .lsr-rid { color: rgba(0,0,0,.3); background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.07); }

.lsr-pcount {
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,.38);
  display: flex; align-items: center; gap: 5px;
}
.light .lsr-pcount { color: rgba(0,0,0,.38); }
.lsr-pcount-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }

.lsr-enc {
  display: flex; align-items: center; gap: 5px;
  font-size: 11px; font-weight: 500; color: #34d399; opacity: .75;
}

/* ── LAYOUT SWITCHER ── */
.lsr-vsw {
  display: flex; gap: 2px;
  background: rgba(255,255,255,.05); border-radius: 8px; padding: 3px;
  border: 1px solid rgba(255,255,255,.07);
}
.light .lsr-vsw { background: rgba(0,0,0,.05); border-color: rgba(0,0,0,.08); }

.lsr-vb {
  display: flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer;
  font-size: 11px; font-weight: 600; font-family: 'DM Sans', sans-serif;
  color: rgba(255,255,255,.35); background: transparent;
  transition: background .15s, color .15s; white-space: nowrap;
}
.lsr-vb:hover:not(:disabled) { color: rgba(255,255,255,.7); background: rgba(255,255,255,.06); }
.lsr-vb.on { background: rgba(59,130,246,.22); color: #93c5fd; }
.lsr-vb:disabled { opacity: .35; cursor: default; }
.light .lsr-vb { color: rgba(0,0,0,.35); }
.light .lsr-vb:hover:not(:disabled) { color: rgba(0,0,0,.7); background: rgba(0,0,0,.05); }
.light .lsr-vb.on { background: rgba(37,99,235,.12); color: #2563eb; }

/* ── VIDEO ZONE ── */
.lsr-zone { flex-grow: 1; display: flex; overflow: hidden; min-height: 0; }

/* GRID */
.lsr-grid {
  flex-grow: 1; display: grid; gap: 10px; padding: 12px;
  align-content: stretch;
}

/* TEAMS */
.lsr-teams { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
.lsr-teams-strip {
  display: flex; gap: 8px; padding: 8px 12px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,.06);
  background: rgba(0,0,0,.18); overflow-x: auto; scrollbar-width: none;
}
.lsr-teams-strip::-webkit-scrollbar { display: none; }
.light .lsr-teams-strip { background: rgba(0,0,0,.04); border-bottom-color: rgba(0,0,0,.07); }
.lsr-teams-main { flex-grow: 1; padding: 10px 12px 12px; min-height: 0; }

/* ZOOM */
.lsr-zoom { flex-grow: 1; display: flex; overflow: hidden; }
.lsr-zoom-main { flex-grow: 1; padding: 12px 0 12px 12px; min-width: 0; }
.lsr-zoom-col {
  width: 186px; flex-shrink: 0; display: flex; flex-direction: column;
  gap: 8px; padding: 12px 10px;
  border-left: 1px solid rgba(255,255,255,.06);
  background: rgba(0,0,0,.14); overflow-y: auto; scrollbar-width: none;
}
.lsr-zoom-col::-webkit-scrollbar { display: none; }
.light .lsr-zoom-col { border-left-color: rgba(0,0,0,.07); background: rgba(0,0,0,.03); }

/* ── TILES ── */
.lsr-tile {
  position: relative; border-radius: 14px; overflow: hidden;
  background: #000; border: 1px solid rgba(255,255,255,.06);
  transition: border-color .2s;
}
.light .lsr-tile { background: #000; border-color: rgba(0,0,0,.09); }

/* ЗДЕСЬ ИСПРАВЛЕНО: С cover на contain */
.lsr-tile video { width: 100%; height: 100%; display: block; object-fit: contain; }
.lsr-tile video.contain { object-fit: contain; }

.lsr-tile-fill { width: 100%; height: 100%; }

.lsr-tile-sm {
  flex-shrink: 0; width: 154px; height: 87px; border-radius: 10px;
  transition: transform .15s;
}
.lsr-tile-sm:hover { transform: scale(1.04); }

.lsr-tile-col { width: 100%; aspect-ratio: 16/9; border-radius: 10px; flex-shrink: 0; }

.lsr-cam-off {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.4); color: rgba(255,255,255,.18); font-size: 2.4rem;
}
.lsr-tile-sm .lsr-cam-off,
.lsr-tile-col .lsr-cam-off { font-size: 1.3rem; }

.lsr-tile-label {
  position: absolute; bottom: 0; left: 0; right: 0;
  padding: 22px 10px 9px;
  background: linear-gradient(transparent, rgba(0,0,0,.72));
  display: flex; justify-content: space-between; align-items: flex-end;
}
.lsr-tile-sm .lsr-tile-label,
.lsr-tile-col .lsr-tile-label { padding: 12px 7px 5px; }

.lsr-pname {
  font-size: 12px; font-weight: 500; color: rgba(255,255,255,.88);
  display: flex; align-items: center; gap: 5px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;
}
.lsr-tile-fill .lsr-pname { font-size: 13px; }

.lsr-muted-dot {
  width: 24px; height: 24px; border-radius: 50%;
  background: rgba(239,68,68,.88); color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; flex-shrink: 0;
}

.lsr-you-tag {
  position: absolute; top: 8px; left: 8px;
  background: rgba(0,0,0,.52); color: rgba(255,255,255,.65);
  border-radius: 5px; padding: 2px 7px; font-size: 10px; font-weight: 600;
}

.lsr-screen-tag {
  position: absolute; top: 10px; right: 10px;
  display: flex; align-items: center; gap: 5px;
  background: rgba(16,185,129,.82); color: #fff;
  border-radius: 7px; padding: 4px 9px;
  font-size: 10px; font-weight: 700; letter-spacing: .04em;
}

/* ── CHAT ── */
.lsr-chat {
  width: 308px; flex-shrink: 0; display: flex; flex-direction: column;
  border-left: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.02);
  animation: slideR .18s ease;
}
.light .lsr-chat { border-left-color: rgba(0,0,0,.08); background: rgba(255,255,255,.85); }
@keyframes slideR { from{transform:translateX(14px);opacity:0} to{transform:translateX(0);opacity:1} }

.lsr-chat-hd {
  padding: 13px 15px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,.07);
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; font-weight: 600;
}
.light .lsr-chat-hd { border-bottom-color: rgba(0,0,0,.08); }

.lsr-chat-x {
  background: none; border: none; cursor: pointer;
  color: rgba(255,255,255,.32); font-size: 15px; padding: 2px 5px;
  border-radius: 6px; transition: background .12s, color .12s; line-height: 1;
}
.lsr-chat-x:hover { background: rgba(255,255,255,.08); color: rgba(255,255,255,.8); }
.light .lsr-chat-x { color: rgba(0,0,0,.3); }
.light .lsr-chat-x:hover { background: rgba(0,0,0,.06); color: rgba(0,0,0,.75); }

.lsr-msgs {
  flex-grow: 1; padding: 10px 13px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 7px;
  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.1) transparent;
}
.lsr-msgs::-webkit-scrollbar { width: 4px; }
.lsr-msgs::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 4px; }

.lsr-msg-empty {
  margin: auto; text-align: center;
  font-size: 12px; color: rgba(255,255,255,.2); line-height: 1.7;
}
.light .lsr-msg-empty { color: rgba(0,0,0,.25); }

.lsr-msg {
  max-width: 87%; padding: 7px 11px; font-size: 13px; line-height: 1.5;
  border-radius: 11px; word-break: break-word;
}
.lsr-msg.mine { align-self: flex-end; background: #3b82f6; color: #fff; border-bottom-right-radius: 3px; }
.lsr-msg.theirs { align-self: flex-start; background: rgba(255,255,255,.08); color: rgba(255,255,255,.85); border-bottom-left-radius: 3px; }
.light .lsr-msg.theirs { background: rgba(0,0,0,.07); color: rgba(0,0,0,.75); }

.lsr-chat-inp-row {
  padding: 11px 13px; flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,.07);
  display: flex; gap: 7px;
}
.light .lsr-chat-inp-row { border-top-color: rgba(0,0,0,.08); }

.lsr-chat-inp {
  flex: 1; background: rgba(255,255,255,.05);
  border: 1px solid rgba(255,255,255,.1); border-radius: 9px;
  padding: 7px 11px; font-size: 13px; color: #e8e8f0;
  font-family: 'DM Sans', sans-serif; outline: none;
  transition: border-color .15s;
}
.lsr-chat-inp:focus { border-color: rgba(59,130,246,.5); }
.lsr-chat-inp::placeholder { color: rgba(255,255,255,.2); }
.light .lsr-chat-inp { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.1); color: #14141e; }
.light .lsr-chat-inp::placeholder { color: rgba(0,0,0,.28); }

.lsr-send {
  width: 34px; height: 34px; border-radius: 9px; background: #3b82f6;
  border: none; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0; transition: background .15s, transform .1s;
}
.lsr-send:hover { background: #2563eb; }
.lsr-send:active { transform: scale(.94); }

/* ── CONTROL BAR ── */
.lsr-ctrl {
  display: flex; justify-content: center; align-items: center; gap: 7px;
  padding: 9px 18px; flex-shrink: 0;
  border-top: 1px solid rgba(255,255,255,.07);
  background: rgba(255,255,255,.02);
}
.light .lsr-ctrl { background: rgba(255,255,255,.85); border-top-color: rgba(0,0,0,.08); }

.lsr-grp { position: relative; display: flex; }

.lsr-cb {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  padding: 9px 16px; border: 1px solid rgba(255,255,255,.1);
  background: rgba(255,255,255,.06); color: rgba(255,255,255,.78);
  font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 500;
  cursor: pointer; transition: background .15s, color .15s, border-color .15s;
  white-space: nowrap;
}
.lsr-cb:first-child { border-radius: 12px 0 0 12px; }
.lsr-cb:last-child  { border-radius: 0 12px 12px 0; }
.lsr-cb:only-child  { border-radius: 12px; }
.lsr-cb + .lsr-cb   { border-left: none; }
.lsr-cb:hover { background: rgba(255,255,255,.11); color: #fff; }
.lsr-cb.on  { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.lsr-cb.mut { background: rgba(239,68,68,.18); border-color: rgba(239,68,68,.32); color: #f87171; }
.lsr-cb.mut:hover { background: rgba(239,68,68,.26); color: #fca5a5; }
.lsr-cb.grn { background: rgba(16,185,129,.15); border-color: rgba(16,185,129,.3); color: #34d399; }
.lsr-cb.grn:hover { background: rgba(16,185,129,.24); }
.lsr-cb.chev { padding: 9px 10px; font-size: 10px; }
.light .lsr-cb { background: rgba(0,0,0,.05); border-color: rgba(0,0,0,.1); color: rgba(0,0,0,.68); }
.light .lsr-cb:hover { background: rgba(0,0,0,.09); color: rgba(0,0,0,.9); }
.light .lsr-cb.on { background: #2563eb; border-color: #2563eb; color: #fff; }

.lsr-leave {
  display: flex; align-items: center; gap: 7px;
  padding: 9px 22px; border-radius: 12px; background: #ef4444; border: none;
  color: #fff; font-size: 13px; font-family: 'DM Sans', sans-serif; font-weight: 700;
  cursor: pointer; transition: background .15s, transform .1s;
}
.lsr-leave:hover { background: #dc2626; }
.lsr-leave:active { transform: scale(.97); }

.lsr-sep { width: 1px; height: 26px; background: rgba(255,255,255,.09); margin: 0 3px; flex-shrink: 0; }
.light .lsr-sep { background: rgba(0,0,0,.09); }

/* ── DROPDOWN ── */
.lsr-dd {
  position: absolute; bottom: calc(100% + 7px); left: 0;
  min-width: 228px; background: #1a1a26;
  border: 1px solid rgba(255,255,255,.1); border-radius: 11px;
  overflow: hidden; z-index: 300;
  box-shadow: 0 18px 44px rgba(0,0,0,.55);
  animation: fadeUp .14s ease;
}
.light .lsr-dd { background: #fff; border-color: rgba(0,0,0,.1); box-shadow: 0 8px 24px rgba(0,0,0,.12); }
@keyframes fadeUp { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

.lsr-dd-hd {
  padding: 9px 13px 5px; font-size: 9px; font-weight: 800;
  letter-spacing: .11em; text-transform: uppercase; color: rgba(255,255,255,.28);
}
.light .lsr-dd-hd { color: rgba(0,0,0,.28); }

.lsr-dd-item {
  display: flex; align-items: center; gap: 9px; width: 100%;
  padding: 8px 13px; background: none; border: none;
  color: rgba(255,255,255,.65); font-size: 12px;
  font-family: 'DM Sans', sans-serif; text-align: left; cursor: pointer;
  transition: background .12s, color .12s;
}
.lsr-dd-item:hover { background: rgba(255,255,255,.06); color: rgba(255,255,255,.95); }
.lsr-dd-item.sel { color: #60a5fa; background: rgba(59,130,246,.09); }
.light .lsr-dd-item { color: rgba(0,0,0,.6); }
.light .lsr-dd-item:hover { background: rgba(0,0,0,.04); color: rgba(0,0,0,.9); }
.light .lsr-dd-item.sel { color: #2563eb; background: rgba(37,99,235,.07); }

/* ── LOADING / ERROR ── */
.lsr-loading {
  flex-grow: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px;
}
.lsr-spin {
  width: 38px; height: 38px; border: 3px solid rgba(59,130,246,.15);
  border-top-color: #3b82f6; border-radius: 50%;
  animation: spin .75s linear infinite;
}
@keyframes spin { to{transform:rotate(360deg)} }
.lsr-load-txt { font-size: 14px; font-weight: 500; color: rgba(255,255,255,.42); }
.light .lsr-load-txt { color: rgba(0,0,0,.38); }

.lsr-err {
  position: absolute; top: 10px; left: 50%; transform: translateX(-50%);
  z-index: 100; background: rgba(239,68,68,.14);
  border: 1px solid rgba(239,68,68,.33); border-radius: 9px;
  padding: 10px 14px; font-size: 12px; color: #f87171;
  display: flex; align-items: center; gap: 9px; white-space: nowrap;
}
.lsr-err-x {
  background: none; border: none; cursor: pointer; color: #f87171;
  font-size: 13px; padding: 0; opacity: .7; transition: opacity .1s;
}
.lsr-err-x:hover { opacity: 1; }
`;

// ─── Icon helpers ─────────────────────────────────────────────────────────────
const IcoGrid = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
    <rect x="0" y="0" width="6" height="6" rx="1.5"/>
    <rect x="8" y="0" width="6" height="6" rx="1.5"/>
    <rect x="0" y="8" width="6" height="6" rx="1.5"/>
    <rect x="8" y="8" width="6" height="6" rx="1.5"/>
  </svg>
);
const IcoTeams = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
    <rect x="0" y="0" width="14" height="4" rx="1.5"/>
    <rect x="0" y="6" width="14" height="8" rx="1.5"/>
  </svg>
);
const IcoZoom = () => (
  <svg width="12" height="12" viewBox="0 0 14 14" fill="currentColor">
    <rect x="0" y="0" width="9" height="14" rx="1.5"/>
    <rect x="11" y="0" width="3" height="4" rx="1"/>
    <rect x="11" y="5" width="3" height="4" rx="1"/>
    <rect x="11" y="10" width="3" height="4" rx="1"/>
  </svg>
);

function LocalVideoTile({ stream, isCameraOff, isMuted, isScreenSharing, tileClass, label }) {
  const vRef = useRef(null);
  
  useEffect(() => {
    if (vRef.current && stream) {
      vRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`lsr-tile ${tileClass}`}>
      <video
        ref={vRef} playsInline muted autoPlay
        className={isScreenSharing ? 'contain' : ''}
        style={{ opacity: isCameraOff && !isScreenSharing ? 0.12 : 1 }}
      />
      {isCameraOff && !isScreenSharing && (
        <div className="lsr-cam-off"><i className="bi bi-person-video-off" /></div>
      )}
      {isScreenSharing && (
        <div className="lsr-screen-tag">
          <i className="bi bi-display" style={{ fontSize: 9 }} /> Sharing
        </div>
      )}
      <div className="lsr-you-tag">You</div>
      <div className="lsr-tile-label">
        <span className="lsr-pname">
          <i className="bi bi-person-fill" style={{ fontSize: 10 }} />
          {label}
        </span>
        {isMuted && (
          <div className="lsr-muted-dot">
            <i className="bi bi-mic-mute-fill" style={{ fontSize: 9 }} />
          </div>
        )}
      </div>
    </div>
  );
}

function RemoteTile({ peerId, stream, name, tileClass }) {
  const vRef = useRef(null);
  useEffect(() => {
    if (vRef.current && stream) {
      vRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`lsr-tile ${tileClass}`}>
      <video ref={vRef} playsInline autoPlay />
      <div className="lsr-tile-label">
        <span className="lsr-pname">
          <i className="bi bi-person-check-fill" style={{ fontSize: 10 }} />
          {name || peerId.substring(0, 8)}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
function LiveSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { theme } = useContext(SettingsContext);
  const isDark = theme === 'dark';

  // ── Refs ──────────────────────────────────────────────────────────────────
  const myStreamRef     = useRef(null);  
  const socketRef       = useRef(null);
  const peersRef        = useRef({});    
  const iceCandQueue    = useRef({});    

  // ── State ─────────────────────────────────────────────────────────────────
  const [localStream,         setLocalStream]         = useState(null);
  const [screenStream,        setScreenStream]        = useState(null);
  
  const [remoteStreams,       setRemoteStreams]       = useState({});
  const [isMuted,             setIsMuted]             = useState(false);
  const [isCameraOff,         setIsCameraOff]         = useState(false);
  const [isScreenSharing,     setIsScreenSharing]     = useState(false);
  const [showMicMenu,         setShowMicMenu]         = useState(false);
  const [showCamMenu,         setShowCamMenu]         = useState(false);
  const [isChatOpen,          setIsChatOpen]          = useState(false);
  const [messages,            setMessages]            = useState([]);
  const [chatInput,           setChatInput]           = useState('');
  const [videoDevices,        setVideoDevices]        = useState([]);
  const [audioDevices,        setAudioDevices]        = useState([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [isLoading,           setIsLoading]           = useState(true);
  const [error,               setError]               = useState('');
  const [layout,              setLayout]              = useState('teams'); 
  const [sessionData,         setSessionData]         = useState(null); 

  const getLocalizedTitle = () => {
    if (!sessionData) return null;
    if (sessionData.courseId && Array.isArray(sessionData.courseId.trans) && sessionData.courseId.trans.length > 0) {
      return sessionData.courseId.trans[0].title;
    }
    if (sessionData.title) return sessionData.title;
    return null;
  };

  const getDevices = async () => {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      const vd = devs.filter(d => d.kind === 'videoinput');
      const ad = devs.filter(d => d.kind === 'audioinput');
      setVideoDevices(vd); setAudioDevices(ad);
      if (vd.length) setSelectedVideoDevice(vd[0].deviceId);
      if (ad.length) setSelectedAudioDevice(ad[0].deviceId);
    } catch (e) { console.error(e); }
  };

  const changeDevice = async (deviceType, deviceId) => {
    try {
      if (!deviceId || !myStreamRef.current) return;
      const constraints = {
        video: deviceType === 'video'
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : false,
        audio: deviceType === 'audio'
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : false,
      };
      const ns = await navigator.mediaDevices.getUserMedia(constraints);
      const kind = deviceType === 'video' ? 'video' : 'audio';
      const newTrack = ns.getTracks().find(t => t.kind === kind);
      if (!newTrack) return;
      
      const old = myStreamRef.current.getTracks().find(t => t.kind === kind);
      if (old) { myStreamRef.current.removeTrack(old); old.stop(); }
      
      myStreamRef.current.addTrack(newTrack);
      
      const updatedStream = new MediaStream(myStreamRef.current.getTracks());
      myStreamRef.current = updatedStream;
      setLocalStream(updatedStream);

      Object.values(peersRef.current).forEach(({ peer }) => {
        if (peer.connectionState === 'closed') return;
        const s = peer.getSenders().find(s => s.track?.kind === kind);
        if (s) s.replaceTrack(newTrack).catch(console.error);
      });
    } catch (e) { setError(`Failed to change ${deviceType}: ${e.message}`); }
  };

  const createPeer = useCallback((targetId, stream, isInitiator) => {
    peersRef.current[targetId]?.peer.close();

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    stream.getTracks().forEach(track => peer.addTrack(track, stream));

    peer.onicecandidate = ({ candidate }) => {
      if (candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', { target: targetId, candidate });
      }
    };

    peer.ontrack = ({ streams }) => {
      if (!streams[0]) return;
      setRemoteStreams(prev => ({
        ...prev,
        [targetId]: { stream: streams[0], name: peersRef.current[targetId]?.name || '' },
      }));
    };

    peer.onconnectionstatechange = () => {
      if (['disconnected', 'failed', 'closed'].includes(peer.connectionState)) {
        setRemoteStreams(prev => { const n = { ...prev }; delete n[targetId]; return n; });
        delete peersRef.current[targetId];
      }
    };

    peersRef.current[targetId] = { peer, name: '' };

    if (isInitiator) {
      peer.createOffer()
        .then(offer => {
          peer.setLocalDescription(offer);
          socketRef.current.emit('offer', {
            target: targetId,
            caller: socketRef.current.id,
            sdp: offer,
          });
        })
        .catch(console.error);
    }

    return peer;
  }, []);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const token = localStorage.getItem('token');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        
        if (!mounted) return;
        
        await getDevices();
        
        setLocalStream(stream);
        myStreamRef.current = stream;

        const socket = io(SOCKET_URL, {
          auth: { token: token }
        });
        
        socketRef.current = socket;
        socket.emit('join-room', id);

        socket.on('user-connected', userID => {
          createPeer(userID, myStreamRef.current, true);
        });

        socket.on('offer', ({ caller, sdp }) => {
          const peer = createPeer(caller, myStreamRef.current, false);
          peer.setRemoteDescription(new RTCSessionDescription(sdp))
            .then(() => peer.createAnswer())
            .then(answer => {
              peer.setLocalDescription(answer);
              socket.emit('answer', { target: caller, caller: socket.id, sdp: answer });
              // Flush ICE queue now that remoteDescription is set
              if (iceCandQueue.current[caller]) {
                iceCandQueue.current[caller].forEach(c =>
                  peer.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
                );
                delete iceCandQueue.current[caller];
              }
            }).catch(console.error);
        });

        socket.on('answer', ({ caller, sdp }) => {
          const entry = peersRef.current[caller];
          if (!entry) return;
          entry.peer.setRemoteDescription(new RTCSessionDescription(sdp))
            .then(() => {
              // Flush ICE queue now that remoteDescription is set
              if (iceCandQueue.current[caller]) {
                iceCandQueue.current[caller].forEach(c =>
                  entry.peer.addIceCandidate(new RTCIceCandidate(c)).catch(() => {})
                );
                delete iceCandQueue.current[caller];
              }
            }).catch(console.error);
        });

        socket.on('ice-candidate', ({ caller, candidate }) => {
          const entry = peersRef.current[caller];
          if (entry && entry.peer.remoteDescription) {
            entry.peer.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          } else {
            if (!iceCandQueue.current[caller]) iceCandQueue.current[caller] = [];
            iceCandQueue.current[caller].push(candidate);
          }
        });

        socket.on('user-disconnected', userID => {
          peersRef.current[userID]?.peer.close();
          delete peersRef.current[userID];
          setRemoteStreams(prev => { const n = { ...prev }; delete n[userID]; return n; });
        });

        socket.on('chat-message', msg =>
          setMessages(prev => [...prev, { text: msg, isMine: false }])
        );

        if (mounted) setIsLoading(false);
      } catch (e) {
        if (mounted) {
          setError('Camera/microphone access denied: ' + e.message);
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      Object.values(peersRef.current).forEach(({ peer }) => peer.close());
      myStreamRef.current?.getTracks().forEach(t => t.stop());
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    };
  }, [id, createPeer]); // eslint-disable-line

  const toggleMic = () => {
    const track = myStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled); }
  };

  const toggleCamera = () => {
    const track = myStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setIsCameraOff(!track.enabled); }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      const camTrack = myStreamRef.current?.getVideoTracks()[0];
      Object.values(peersRef.current).forEach(({ peer }) => {
        const s = peer.getSenders().find(s => s.track?.kind === 'video');
        if (s && camTrack) s.replaceTrack(camTrack).catch(() => {});
      });
      
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
    } else {
      try {
        const ss = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = ss.getVideoTracks()[0];
        
        Object.values(peersRef.current).forEach(({ peer }) => {
          const s = peer.getSenders().find(s => s.track?.kind === 'video');
          if (s) s.replaceTrack(screenTrack).catch(() => {});
        });
        
        setScreenStream(ss);
        setIsScreenSharing(true);
        
        screenTrack.onended = () => toggleScreenShare();
      } catch (e) { /* user cancelled */ }
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    socketRef.current?.emit('send-chat-message', { room: id, message: chatInput });
    setMessages(prev => [...prev, { text: chatInput, isMine: true }]);
    setChatInput('');
  };

  const closeMenus = () => { setShowMicMenu(false); setShowCamMenu(false); };

  // ── Layout logic ────────────────────────────────────────────────────────
  const remoteList   = Object.entries(remoteStreams);
  const totalCount   = remoteList.length + 1; 
  const activeLayout = isScreenSharing ? layout : 'grid';

  const gridCols = (() => {
    if (totalCount === 1) return '1fr';
    if (totalCount === 2) return '1fr 1fr';
    if (totalCount <= 4)  return '1fr 1fr';
    return 'repeat(3, 1fr)';
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{styles}</style>
      <div className={`lsr${isDark ? '' : ' light'}`} onClick={closeMenus}>

        {/* HEADER */}
        <div className="lsr-hd">
          <div className="lsr-hd-l">
            <div className="lsr-live">
              <div className="lsr-dot" />
              {getLocalizedTitle() || t('liveSession.title') || 'Live Session'}
            </div>
            <span className="lsr-rid">#{id?.substring(0, 8).toUpperCase()}</span>
            <span className="lsr-pcount">
              <div className="lsr-pcount-dot" />
              {totalCount} {totalCount === 1 ? 'participant' : 'participants'}
            </span>
          </div>

          <div className="lsr-hd-r">
            <div className="lsr-vsw" onClick={e => e.stopPropagation()}>
              <button
                className={`lsr-vb${!isScreenSharing ? ' on' : ''}`}
                disabled={isScreenSharing}
                title="Grid view (default)"
              >
                <IcoGrid /> Grid
              </button>
              <button
                className={`lsr-vb${isScreenSharing && layout === 'teams' ? ' on' : ''}`}
                disabled={!isScreenSharing}
                onClick={() => setLayout('teams')}
                title="Teams — cameras top, screen bottom"
              >
                <IcoTeams /> Teams
              </button>
              <button
                className={`lsr-vb${isScreenSharing && layout === 'zoom' ? ' on' : ''}`}
                disabled={!isScreenSharing}
                onClick={() => setLayout('zoom')}
                title="Zoom — screen left, cameras right"
              >
                <IcoZoom /> Zoom
              </button>
            </div>

            <div className="lsr-enc">
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="8" rx="2" fill="currentColor" opacity=".8"/>
                <path d="M5 7V5a3 3 0 016 0v2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              </svg>
              End-to-End Encrypted
            </div>
          </div>
        </div>

        {/* LOADING */}
        {isLoading && (
          <div className="lsr-loading">
            <div className="lsr-spin" />
            <p className="lsr-load-txt">{t('liveSession.connecting') || 'Connecting…'}</p>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="lsr-err" onClick={e => e.stopPropagation()}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm-.75 3.5h1.5v5h-1.5v-5zm0 6h1.5v1.5h-1.5V10.5z"/>
            </svg>
            {error}
            <button className="lsr-err-x" onClick={() => setError('')}>✕</button>
          </div>
        )}

        {/* VIDEO ZONE + CHAT */}
        {!isLoading && (
          <div className="lsr-zone">
            
            {/* GRID LAYOUT */}
            {activeLayout === 'grid' && (
              <div className="lsr-grid" style={{ gridTemplateColumns: gridCols }}>
                <LocalVideoTile 
                  stream={localStream} 
                  isCameraOff={isCameraOff} 
                  isMuted={isMuted} 
                  isScreenSharing={false} 
                  tileClass="lsr-tile-fill" 
                  label={t('liveSession.you') || 'You'} 
                />
                {remoteList.map(([sid, { stream, name }]) => (
                  <RemoteTile key={sid} peerId={sid} stream={stream} name={name} tileClass="lsr-tile-fill" />
                ))}
              </div>
            )}

            {/* TEAMS LAYOUT */}
            {activeLayout === 'teams' && (
              <div className="lsr-teams">
                <div className="lsr-teams-strip">
                  <LocalVideoTile 
                    stream={localStream} 
                    isCameraOff={isCameraOff} 
                    isMuted={isMuted} 
                    isScreenSharing={false} 
                    tileClass="lsr-tile-sm" 
                    label="You" 
                  />
                  {remoteList.map(([sid, { stream, name }]) => (
                    <RemoteTile key={sid} peerId={sid} stream={stream} name={name} tileClass="lsr-tile-sm" />
                  ))}
                </div>
                <div className="lsr-teams-main">
                  <LocalVideoTile 
                    stream={screenStream} 
                    isCameraOff={false} 
                    isMuted={false} 
                    isScreenSharing={true} 
                    tileClass="lsr-tile-fill" 
                    label="Your Screen" 
                  />
                </div>
              </div>
            )}

            {/* ZOOM LAYOUT */}
            {activeLayout === 'zoom' && (
              <div className="lsr-zoom">
                <div className="lsr-zoom-main">
                  <LocalVideoTile 
                    stream={screenStream} 
                    isCameraOff={false} 
                    isMuted={false} 
                    isScreenSharing={true} 
                    tileClass="lsr-tile-fill" 
                    label="Your Screen" 
                  />
                </div>
                <div className="lsr-zoom-col">
                  <LocalVideoTile 
                    stream={localStream} 
                    isCameraOff={isCameraOff} 
                    isMuted={isMuted} 
                    isScreenSharing={false} 
                    tileClass="lsr-tile-col" 
                    label="You" 
                  />
                  {remoteList.map(([sid, { stream, name }]) => (
                    <RemoteTile key={sid} peerId={sid} stream={stream} name={name} tileClass="lsr-tile-col" />
                  ))}
                </div>
              </div>
            )}

            {/* CHAT PANEL */}
            {isChatOpen && (
              <div className="lsr-chat">
                <div className="lsr-chat-hd">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <i className="bi bi-chat-dots-fill" style={{ fontSize: 13, color: '#60a5fa' }} />
                    {t('liveSession.chat') || 'Chat'}
                  </span>
                  <button className="lsr-chat-x" onClick={() => setIsChatOpen(false)}>✕</button>
                </div>
                <div className="lsr-msgs">
                  {messages.length === 0 && (
                    <div className="lsr-msg-empty">
                      <div style={{ fontSize: 22, marginBottom: 6 }}>👋</div>
                      {t('liveSession.noMessages') || 'Say hi to start the chat!'}
                    </div>
                  )}
                  {messages.map((m, i) => (
                    <div key={i} className={`lsr-msg ${m.isMine ? 'mine' : 'theirs'}`}>{m.text}</div>
                  ))}
                </div>
                <form onSubmit={sendMessage} className="lsr-chat-inp-row">
                  <input
                    className="lsr-chat-inp"
                    placeholder={t('liveSession.typeMessage') || 'Type a message…'}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                  />
                  <button type="submit" className="lsr-send">
                    <i className="bi bi-send-fill" style={{ fontSize: 12 }} />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}

        {/* CONTROL BAR */}
        {!isLoading && (
          <div className="lsr-ctrl">

            <div className="lsr-grp" onClick={e => e.stopPropagation()}>
              <button className={`lsr-cb${isMuted ? ' mut' : ''}`} onClick={toggleMic}>
                <i className={`bi ${isMuted ? 'bi-mic-mute-fill' : 'bi-mic-fill'}`} style={{ fontSize: 14 }} />
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <button
                className={`lsr-cb chev${isMuted ? ' mut' : ''}`}
                onClick={() => { setShowMicMenu(v => !v); setShowCamMenu(false); }}
              >
                <i className="bi bi-chevron-up" />
              </button>
              {showMicMenu && (
                <div className="lsr-dd">
                  <div className="lsr-dd-hd">Microphone</div>
                  {audioDevices.map(d => (
                    <button
                      key={d.deviceId}
                      className={`lsr-dd-item${selectedAudioDevice === d.deviceId ? ' sel' : ''}`}
                      onClick={() => {
                        changeDevice('audio', d.deviceId);
                        setSelectedAudioDevice(d.deviceId);
                        setShowMicMenu(false);
                      }}
                    >
                      <i className="bi bi-mic" style={{ fontSize: 11 }} />
                      {d.label || `Mic ${d.deviceId.substring(0, 6)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lsr-grp" onClick={e => e.stopPropagation()}>
              <button className={`lsr-cb${isCameraOff ? ' mut' : ''}`} onClick={toggleCamera}>
                <i className={`bi ${isCameraOff ? 'bi-camera-video-off-fill' : 'bi-camera-video-fill'}`} style={{ fontSize: 14 }} />
                {isCameraOff ? 'Start Video' : 'Stop Video'}
              </button>
              <button
                className={`lsr-cb chev${isCameraOff ? ' mut' : ''}`}
                onClick={() => { setShowCamMenu(v => !v); setShowMicMenu(false); }}
              >
                <i className="bi bi-chevron-up" />
              </button>
              {showCamMenu && (
                <div className="lsr-dd">
                  <div className="lsr-dd-hd">Camera</div>
                  {videoDevices.map(d => (
                    <button
                      key={d.deviceId}
                      className={`lsr-dd-item${selectedVideoDevice === d.deviceId ? ' sel' : ''}`}
                      onClick={() => {
                        changeDevice('video', d.deviceId);
                        setSelectedVideoDevice(d.deviceId);
                        setShowCamMenu(false);
                      }}
                    >
                      <i className="bi bi-camera-video" style={{ fontSize: 11 }} />
                      {d.label || `Camera ${d.deviceId.substring(0, 6)}`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="lsr-sep" />

            <button
              className={`lsr-cb${isScreenSharing ? ' grn' : ''}`}
              style={{ borderRadius: 12 }}
              onClick={toggleScreenShare}
            >
              <i className="bi bi-display" style={{ fontSize: 14 }} />
              {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
            </button>

            <button
              className={`lsr-cb${isChatOpen ? ' on' : ''}`}
              style={{ borderRadius: 12 }}
              onClick={() => setIsChatOpen(v => !v)}
            >
              <i className="bi bi-chat-dots" style={{ fontSize: 14 }} />
              Chat
            </button>

            <div className="lsr-sep" />

            <button className="lsr-leave" onClick={() => navigate(-1)}>
              <i className="bi bi-telephone-x-fill" style={{ fontSize: 13 }} />
              Leave
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default LiveSessionPage;
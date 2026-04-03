import { toHttps } from '../utils/utils';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import AppLayout from '../components/Layout';
import { extendSession } from '../utils/utils';
import './ViewCourse.css';
import { UtilityModal } from '../components/UtilityModal';
import { PaymentModal } from '../components/PaymentModal';
import { VideoConference } from '../components/VideoConference';

// ─── Helpers (shared with CoursePreview) ──────────────────────────────────────
const isContainer = (e) => !e?.type || e.type === 'container' || e.type === 'none';

const TYPE_ICON = {
  container: 'bi-folder',
  image: 'bi-image',
  video: 'bi-camera-video',
  audio: 'bi-music-note',
  document: 'bi-file-pdf',
  archive: 'bi-file-zip',
  text: 'bi-file-text',
  form: 'bi-ui-checks',
  other: 'bi-file-earmark',
};
const typeIcon = (t) => TYPE_ICON[t] || 'bi-file-earmark';

const TYPE_COLOR = {
  image: '#16a34a',
  video: '#2563eb',
  audio: '#d97706',
  document: '#dc2626',
  archive: '#6b7280',
  text: '#0891b2',
  form: '#7c3aed',
};
const typeColor = (t) => TYPE_COLOR[t] || '#6b7280';

const extractYouTubeId = url => {
  if (!url) return null;
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  const shorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  const embed = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  return (short || watch || shorts || embed)?.[1] || null;
};

// ─── parseTextSyntax ──────────────────────────────────────────────────────────
// btn syntax is extracted BEFORE HTML-escaping so that arrow functions
// containing => / ' / " are not mangled by the escaper.
function parseTextSyntax(text) {
  if (!text) return '';
  const encAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const encHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 1. Stash code blocks
  const codeBlocks = [];
  let html = text.replace(/~\(([^)]+)\)\[([\s\S]+?)\]~/g, (_, lang, code) => {
    const esc = code
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<div class="vc-code-block"><div class="vc-code-header">` +
      `<span class="vc-code-lang">${lang}</span>` +
      `<button class="vc-code-copy" onclick="(function(b){navigator.clipboard.writeText(` +
      `b.closest('.vc-code-block').querySelector('code').innerText);` +
      `b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',2000)})(this)">Copy</button></div>` +
      `<pre><code>${esc}</code></pre></div>`
    );
    return `\x00CODE${idx}\x00`;
  });

  // 2. Stash btn syntax BEFORE HTML-escaping so => / quotes survive
  //    Arrow fn:  [btn:Label|() => expr]   or  [btn:Label|(x, y) => expr]
  //    Dot-path:  [btn:Label|fn.path:args]
  const btns = [];
  html = html.replace(/\[btn:([^\|]+)\|([^\]]+)\]/g, (_, label, af) => {
    const isArrow = /^\s*(\(.*?\)|[\w$]+)\s*=>/.test(af);
    let a, p;
    if (isArrow) {
      a = af.trim();
      p = '';
    } else {
      const ci = af.indexOf(':');
      a = ci === -1 ? af.trim() : af.slice(0, ci).trim();
      p = ci === -1 ? '' : af.slice(ci + 1).trim();
    }
    const idx = btns.length;
    btns.push({ label, a, p });
    return `\x00BTN${idx}\x00`;
  });

  // 3. HTML-escape the rest
  html = html
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  // 4. Standard syntax transforms
  html = html.replace(/~\(([^\|]+)\)\[([^\]]+)\]~/g, '<code type="$1">$2</code>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`\(([^`]+)\)`/g, '<code class="vc-inline-code">$1</code>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/`\{([^}]+)\}`/g, '<p>$1</p>');
  html = html.replace(/\{(https?:\/\/[^}]+)\}/g, '<video src="$1" class="vc-video-player" controls></video>');
  html = html.replace(/\((https?:\/\/[^)]+)\)/g, (_, u) => {
    const short = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    const watch = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    const shorts = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    const embed = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
    const id = (short || watch || shorts || embed)?.[1];
    const e = id ? `https://www.youtube.com/embed/${id}` : u;
    return `<iframe src="${e}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  });
  html = html.replace(/!\[([^\|]+)\|(https?:\/\/[^\]]+)\]!/g,
    '<a href="$2" download class="vc-dl-link"><i class="bi bi-download"></i> $1</a>');
  html = html.replace(/@(https?:\/\/[^@]+)@/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/#(https?:\/\/[^#]+)#/g,
    '<img alt="image" class="vc-inline-img" src="$1">');
  html = html
    .replace(/^(\d+)\.\s(.+)$/gm, '<li class="numbered-item">$2</li>')
    .replace(/(<li class="numbered-item">.*?<\/li>\n?)+/gs, '<ol>$&</ol>');
  html = html
    .replace(/^[•\-\*]\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*?<\/li>\n?)+/gs, '<ul>$&</ul>');
  html = html.replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\\n/g, '<br>');

  // 5. Restore code blocks & btns
  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[+i]);
  html = html.replace(/\x00BTN(\d+)\x00/g, (_, i) => {
    const { label, a, p } = btns[+i];
    return `<button class="vc-action-btn" data-action="${encAttr(a)}" data-params="${encAttr(p)}">${encHtml(label)}</button>`;
  });
  return html;
}

// ─── ITEM_ACTIONS ─────────────────────────────────────────────────────────────
const ITEM_ACTIONS = {
  'close-item': (p, pr) => pr.onCloseItem?.(),
  'close-chapter': (p, pr) => pr.onCloseChapter?.(),
  'close-volume': (p, pr) => pr.onCloseVolume?.(),
  'move-to-volume': (p, pr) => pr.onScrollToVolume?.(parseInt(p, 10) - 1),
  'move-to-chapter': (p, pr) => { const [vi, ci] = p.split(',').map(s => parseInt(s.trim(), 10) - 1); pr.onScrollToChapter?.(vi, ci); },
  'move-to-item': (p, pr) => { const [vi, ci, ii] = p.split(',').map(s => parseInt(s.trim(), 10) - 1); pr.onScrollToItem?.(vi, ci, ii); },
};

// ─── executeJsAction ──────────────────────────────────────────────────────────
function executeJsAction(action, params) {
  try {
    const trimmed = action.trim();

    // ── Arrow function ─────────────────────────────────────────────────────
    if (/^(\(.*?\)|[\w$]+)\s*=>/.test(trimmed)) {
      const fn = new Function(`return (${trimmed})`)();
      if (typeof fn === 'function') fn();
      return;
    }

    // ── Dot-path call ──────────────────────────────────────────────────────
    const parts = trimmed.split('.');
    let obj = window;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (obj == null) {
        console.warn(`[btn action] '${parts.slice(0, i + 1).join('.')}' is null/undefined`);
        return;
      }
    }
    const methodName = parts[parts.length - 1];
    const fn = parts.length === 1 ? window[methodName] : obj[methodName];

    if (typeof fn !== 'function') {
      console.warn(`[btn action] '${action}' is not a function`);
      return;
    }

    const args = params.trim() !== '' ? params.split(',').map(s => s.trim()) : [];
    fn.apply(obj, args);
  } catch (e) {
    console.warn('[btn action] error:', e);
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────
function ViewCourse({ data, onLogout, startMeeting }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');

  const [course, setCourse] = useState(null);
  const [volumes, setVolumes] = useState([]);
  const [loading, setLoading] = useState(true);
  // ── Modal state ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null, onCancel: null });
  const closeModal = () => setModal(p => ({ ...p, show: false }));
  const showConfirm = (title, message, onConfirm) => setModal({ show: true, type: 'confirm', title, message, onConfirm, onCancel: closeModal });
  const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
  const [locked, setLocked] = useState(true);

  // ── Session / group context (when accessed via ?session=:id) ─────────────
  const location = useLocation();
  const sessionId = new URLSearchParams(location.search).get('session');
  const [session, setSession] = useState(null);
  const [sessionGroup, setSessionGroup] = useState(null);  // student's group in this session
  const [sessionDeadlines, setSessionDeadlines] = useState([]); // from session.deadlines

  // ── Comments state ─────────────────────────────────────────────────────────
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commentPreview, setCommentPreview] = useState(false);
  const [commentPosting, setCommentPosting] = useState(false);
  const [syntaxHelpOpen, setSyntaxHelpOpen] = useState(false);

  // ── Rating state ───────────────────────────────────────────────────────────
  const [myRating, setMyRating] = useState(null);
  const [avgRating, setAvgRating] = useState(0);
  const [totalVotes, setTotalVotes] = useState(0);
  const [ratingHover, setRatingHover] = useState(null);
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // Sidebar expand state
  const [openVolumes, setOpenVolumes] = useState({});
  const [openChapters, setOpenChapters] = useState({});

  // Selected item: { vi, ci, ii } or null
  const [selected, setSelected] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // ── Course completion ──────────────────────────────────────────────────────
  const [courseFinished, setCourseFinished] = useState(false);
  const [mainView, setMainView] = useState('course'); // 'course' | 'assignments'
  const [sessionAssignments, setSessionAssignments] = useState([]);

  // ── Language switcher ──────────────────────────────────────────────────────
  const [activeLangIdx, setActiveLangIdx] = useState(0);
  // Helper: get translated field for current language with fallback to base (index 0)
  const t = (field) => course?.trans?.[activeLangIdx]?.[field] || course?.trans?.[0]?.[field] || '';

  // Helper: resolve volumes for a given lang index
  // Non-base langs use trans[idx].volumes if non-empty, else fall back to base (course.volumes)
  const resolveVolumes = (courseData, langIdx) => {
    const raw = langIdx > 0 && courseData?.trans?.[langIdx]?.volumes?.length
      ? courseData.trans[langIdx].volumes
      : (courseData?.volumes || []);
    return raw.map(v => ({
      ...v, type: v.type || 'container',
      chapters: (v.chapters || []).map(c => ({ ...c, type: c.type || 'container' }))
    }));
  };

  // ── Payment modal ───────────────────────────────────────────────────────────
  const [showPayment, setShowPayment] = useState(false);
  // ── Video conference ────────────────────────────────────────────────────────
  const [showConference, setShowConference] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);
  const RTC_API = toHttps(process.env.REACT_APP_RTC_URL || 'https://localhost:5050');

  const copyInviteLink = async () => {
    if (!sessionId) return;
    try {
      const tok = localStorage.getItem('token');
      const hdrs = { Authorization: `${tok?.split(' ')[0]} ${tok?.split(' ')[1]}`, 'Content-Type': 'application/json' };
      await fetch(`${RTC_API}/rooms`, {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({ sessionId, displayName: course?.title || sessionId })
      });
    } catch { }
    const link = `${window.location.origin}/meeting?session=${sessionId}`;
    navigator.clipboard.writeText(link).then(() => {
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
    });
  };

  // ── Bootstrap ──────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData(); fetchComments(); fetchRating();
    if (sessionId) fetchSession();
    fetchCourseProgress();
  }, [id, sessionId]);

  // Reset lang when course changes
  useEffect(() => { setActiveLangIdx(0); }, [id]);

  // Re-resolve volumes when language switches
  useEffect(() => {
    if (!course) return;
    setVolumes(resolveVolumes(course, activeLangIdx));
  }, [activeLangIdx, course]);

  // ── Session fetch: load session + find student's group ────────────────────
  const fetchSession = async () => {
    if (!sessionId || !token) return;
    try {
      const res = await fetch(`${API}/sessions/${sessionId}`, {
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` }
      });
      if (!res.ok) return;
      const { data: sess } = await res.json();
      setSession(sess);
      setSessionDeadlines(sess.deadlines || []);

      // Find the group that contains this user as a member
      const groupRes = await fetch(
        `${API}/groups?sessionId=${sessionId}`,
        { headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` } }
      );
      if (groupRes.ok) {
        const { data: groups } = await groupRes.json();
        const myGroup = (groups || []).find(g =>
          g.members?.some(m => String(m.userId?._id || m.userId) === String(data._id))
        );
        if (myGroup) setSessionGroup(myGroup);
      }
    } catch (e) { console.error('Session fetch error:', e); }
  };

  const fetchCourseProgress = async () => {
    if (!token || !data?._id) return;
    try {
      const res = await fetch(`${API}/users/${data._id}`, {
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` }
      });
      if (res.ok) {
        const { data: u } = await res.json();
        const entry = u.courses?.find(c => c._id?.toString() === id || c._id === id);
        if (entry?.process >= 1) setCourseFinished(true);
      }
    } catch (e) { console.error('Progress fetch error:', e); }
  };

  // ── Save progress (0–1) — fires when user visits an item ──────────────────
  // progress = (itemIndex + 1) / totalItems, never goes backwards.
  const saveProgress = useCallback(async (visitedFlatIdx) => {
    if (!token || locked || flatItems.length === 0) return;
    const progress = Math.min(1, (visitedFlatIdx + 1) / flatItems.length);
    try {
      await fetch(`${API}/users/me/courses/${id}/progress`, {
        method: 'PATCH',
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ process: progress })
      });
      if (progress >= 1) setCourseFinished(true);
    } catch (e) { console.error('Progress save error:', e); }
  }, [token, locked, id]); // flatItems.length added below after flatItems is built

  const fetchSessionAssignments = async () => {
    if (!sessionId || !token) return;
    try {
      // Get all groups for this session
      const groupRes = await fetch(
        `${API}/groups?sessionId=${sessionId}`,
        { headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` } }
      );
      if (!groupRes.ok) return;
      const { data: groups } = await groupRes.json();

      // Find student's group
      const myGroup = (groups || []).find(g =>
        g.members?.some(m => String(m.userId?._id || m.userId) === String(data._id))
      );
      if (!myGroup) return; // student not added to any group yet

      const res = await fetch(
        `${API}/assignments?groupId=${myGroup._id}`,
        { headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` } }
      );
      if (res.ok) {
        const { data: d } = await res.json();
        setSessionAssignments(d || []);
      }
    } catch (e) { console.error('Assignments fetch error:', e); }
  };

  useEffect(() => { if (sessionId) fetchSessionAssignments(); }, [sessionId]);

  const handleFinishCourse = async () => {
    // Always navigate back to the welcome screen
    setSelected(null);
    if (courseFinished || !token) return;
    try {
      const res = await fetch(`${API}/users/me/courses/${id}/finish`, {
        method: 'PATCH',
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' }
      });
      if (res.ok) { setCourseFinished(true); showInfo('Course Completed!', 'Congratulations! You have finished this course.'); }
      else { const j = await res.json(); showInfo('Error', j.message || 'Could not mark course as finished.'); }
    } catch (e) { showInfo('Error', 'Network error.'); }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const res = await fetch(`${API}/courses/${id}/comments`);
      if (res.ok) {
        const json = await res.json();
        setComments(json.data || []);
      }
    } catch (e) { console.error('Comments fetch error:', e); }
    finally { setCommentsLoading(false); }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setCommentPosting(true);
    try {
      const res = await fetch(`${API}/courses/${id}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: commentText.trim() })
      });
      if (res.ok) {
        const json = await res.json();
        setComments(prev => [...prev, json.data]);
        setCommentText('');
        setCommentPreview(false);
      }
    } catch (e) { console.error('Comment post error:', e); }
    finally { setCommentPosting(false); }
  };

  const fetchRating = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/courses/${id}/rating`, {
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` }
      });
      if (res.ok) {
        const j = await res.json();
        setAvgRating(j.data?.avgRating || 0);
        setTotalVotes(j.data?.totalVotes || 0);
        setMyRating(j.data?.myRating || null);
      }
    } catch (e) { console.error('fetchRating:', e); }
  };

  const handleRate = async (value) => {
    if (locked || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      const res = await fetch(`${API}/courses/${id}/rating`, {
        method: 'POST',
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        const j = await res.json();
        setMyRating(j.data.myRating);
        setAvgRating(j.data.avgRating);
        setTotalVotes(j.data.totalVotes);
      } else showInfo('Error', 'Could not submit rating.');
    } catch (e) { showInfo('Error', 'Network error.'); }
    setRatingSubmitting(false);
  };

  const handleDeleteComment = async (commentId) => {
    showConfirm('Delete Comment', 'Are you sure you want to delete this comment?', async () => {
      try {
        const res = await fetch(`${API}/courses/${id}/comments/${commentId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` }
        });
        if (res.ok) setComments(prev => prev.filter(c => c._id !== commentId));
      } catch (e) { console.error('Comment delete error:', e); }
    });
  };

  const checkAccess = async (fetchedCourse) => {
    try {
      // Creator always gets access
      if (fetchedCourse?.userId && String(fetchedCourse.userId) === String(data._id)) {
        setLocked(false); return;
      }
      // HOSTED course in a session: group membership grants access (no purchase needed)
      if (sessionId && fetchedCourse?.courseType === 'HOSTED') {
        // sessionGroup may not be loaded yet — fetch inline
        const groupRes = await fetch(
          `${API}/groups?sessionId=${sessionId}`,
          { headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` } }
        );
        if (groupRes.ok) {
          const { data: groups } = await groupRes.json();
          const inGroup = (groups || []).some(g =>
            g.members?.some(m => String(m.userId?._id || m.userId) === String(data._id))
          );
          if (inGroup) { setLocked(false); return; }
        }
      }
      // Check purchased courses (SELF_TAUGHT and MENTORED)
      const res = await fetch(`${API}/users/${data._id}`, {
        headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` }
      });
      if (res.ok) {
        const { data: u } = await res.json();
        setLocked(!u.courses?.find(c => c._id === id));
      }
    } catch { setLocked(true); }
  };

  // ── Deadline helpers ───────────────────────────────────────────────────────
  const getDeadlineFor = (targetType, targetId) => {
    if (!sessionDeadlines.length) return null;
    const dl = sessionDeadlines.find(
      d => d.targetType === targetType && d.targetId === targetId
    );
    if (!dl) return null;
    const isPast = new Date() > new Date(dl.dueAt);
    const isLocked = isPast && dl.lockAfterDue;
    return { deadline: dl, isPast, isLocked };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/courses/${id}`);
      if (res.status === 401) await extendSession(data);
      if (res.ok) {
        const { data: d } = await res.json();
        if (d) {
          setCourse(d);
          const resolved = resolveVolumes(d, 0); // start at base lang
          setVolumes(resolved);
          // Auto-expand first volume & chapter
          if (resolved.length) {
            setOpenVolumes({ [resolved[0].vid]: true });
            if (resolved[0].chapters?.length) {
              setOpenChapters({ [resolved[0].chapters[0].cid]: true });
            }
          }
          await checkAccess(d);
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ─── Course Thumbnail (adaptive aspect ratio) ─────────────────────────────────
  function CourseThumbnail({ src, alt }) {
    const [ratio, setRatio] = useState(null);

    const handleLoad = (e) => {
      const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
      const r = w / h;
      if (r >= 1.7) setRatio('wide');
      else if (r >= 1.2 && r < 1.7) setRatio('landscape');
      else if (r >= 0.85 && r < 1.2) setRatio('square');
      else setRatio('portrait');
    };

    return (
      <div className={`vc-thumb${ratio ? ` vc-thumb--${ratio}` : ' vc-thumb--loading'}`}>
        <img
          src={src}
          alt={alt}
          className="vc-thumb-img"
          onLoad={handleLoad}
        />
      </div>
    );
  }

  // ── Navigation helpers used by text action buttons ─────────────────────────
  const selectItem = useCallback((vi, ci, ii) => {
    const vol = volumes[vi]; const ch = vol?.chapters[ci]; const item = ch?.items[ii];
    if (!vol || !ch || !item) return;
    setOpenVolumes(p => ({ ...p, [vol.vid]: true }));
    setOpenChapters(p => ({ ...p, [ch.cid]: true }));
    setSelected({ vi, ci, ii });
  }, [volumes]);

  const selectedItem = selected != null
    ? volumes[selected.vi]?.chapters[selected.ci]?.items[selected.ii]
    : null;

  // ── Sidebar toggling ───────────────────────────────────────────────────────
  const toggleVolume = (vid) => setOpenVolumes(p => ({ ...p, [vid]: !p[vid] }));
  const toggleChapter = (cid) => setOpenChapters(p => ({ ...p, [cid]: !p[cid] }));

  // ── Flatten volumes for "prev / next" navigation ───────────────────────────
  const flatItems = [];
  volumes.forEach((vol, vi) => {
    if (isContainer(vol)) {
      vol.chapters.forEach((ch, ci) => {
        if (isContainer(ch)) {
          ch.items.forEach((item, ii) => flatItems.push({ vi, ci, ii, item }));
        } else {
          flatItems.push({ vi, ci: ci, ii: null, item: ch, isChapterEntity: true });
        }
      });
    } else {
      flatItems.push({ vi, ci: null, ii: null, item: vol, isVolumeEntity: true });
    }
  });

  const currentFlatIdx = selected != null
    ? flatItems.findIndex(f => f.vi === selected.vi && f.ci === selected.ci && f.ii === selected.ii)
    : -1;

  // ── Navigate to item by flat index, saving progress ───────────────────────
  const goTo = (idx) => {
    if (idx < 0 || idx >= flatItems.length) return;
    const { vi, ci, ii } = flatItems[idx];
    setSelected({ vi, ci, ii });
    if (vi != null) setOpenVolumes(p => ({ ...p, [volumes[vi]?.vid]: true }));
    if (ci != null) setOpenChapters(p => ({ ...p, [volumes[vi]?.chapters[ci]?.cid]: true }));
    // Save progress based on how far through the course the user has navigated
    if (!locked && flatItems.length > 0) {
      const progress = Math.min(1, (idx + 1) / flatItems.length);
      fetch(`${API}/users/me/courses/${id}/progress`, {
        method: 'PATCH',
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ process: progress })
      }).then(r => { if (r.ok && progress >= 1) setCourseFinished(true); }).catch(() => { });
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <AppLayout data={data} onLogout={onLogout} title="">
<div className="vc-loading">
        <div className="vc-spinner"></div>
        <p>Loading course…</p>
      </div>
    </AppLayout>
  );

  if (!course) return (
    <AppLayout data={data} onLogout={onLogout} title="">
<div className="vc-error">
        <i className="bi bi-exclamation-circle"></i>
        <p>Course not found.</p>
        <button className="vc-btn-ghost" onClick={() => navigate(-1)}>← Go back</button>
      </div>
    </AppLayout>
  );

  return (
    <AppLayout data={data} onLogout={onLogout} title="">
<div className={`vc-root${sidebarOpen ? '' : ' vc-root--collapsed'}`}>

        {/* ── Sidebar ── */}
        <aside className="vc-sidebar">
          <div className="vc-sidebar-header">
            <span className="vc-sidebar-title" title={course.trans?.[0]?.title}>{course.trans?.[0]?.title}</span>
            <button className="vc-sidebar-toggle" onClick={() => setSidebarOpen(o => !o)} title="Toggle sidebar">
              <i className={`bi bi-layout-sidebar${sidebarOpen ? '' : '-reverse'}`}></i>
            </button>
          </div>

          <nav className="vc-nav" aria-label="Course contents">
            {volumes.length === 0 && (
              <p className="vc-nav-empty">No content yet.</p>
            )}

            {volumes.map((vol, vi) =>
              isContainer(vol) ? (
                /* ── Container Volume ── */
                <div key={vol.vid} className="vc-nav-volume">
                  <button
                    className="vc-nav-volume-btn"
                    onClick={() => toggleVolume(vol.vid)}
                    aria-expanded={!!openVolumes[vol.vid]}
                  >
                    <i className={`bi bi-chevron-${openVolumes[vol.vid] ? 'down' : 'right'} vc-chevron`}></i>
                    <i className="bi bi-folder vc-folder-icon"></i>
                    <span className="vc-nav-label">{vol.title}</span>
                    {!openVolumes[vol.vid] && <span className="vc-nav-count">{vol.chapters.length}</span>}
                  </button>

                  {openVolumes[vol.vid] && (
                    <div className="vc-nav-chapters">
                      {vol.chapters.map((ch, ci) =>
                        isContainer(ch) ? (
                          /* ── Container Chapter ── */
                          <div key={ch.cid} className="vc-nav-chapter">
                            <button
                              className="vc-nav-chapter-btn"
                              onClick={() => toggleChapter(ch.cid)}
                              aria-expanded={!!openChapters[ch.cid]}
                            >
                              <i className={`bi bi-chevron-${openChapters[ch.cid] ? 'down' : 'right'} vc-chevron`}></i>
                              <span className="vc-nav-label">{ch.title}</span>
                              {!openChapters[ch.cid] && <span className="vc-nav-count">{ch.items.length}</span>}
                            </button>

                            {openChapters[ch.cid] && (
                              <div className="vc-nav-items">
                                {ch.items.map((item, ii) => {
                                  const isSel = selected?.vi === vi && selected?.ci === ci && selected?.ii === ii;
                                  const isLocked = locked;
                                  const itemDl = getDeadlineFor('item', item.iid);
                                  const itemDeadlineLocked = itemDl?.isLocked;
                                  return (
                                    <button
                                      key={item.iid}
                                      className={`vc-nav-item-btn${isSel ? ' vc-nav-item-btn--active' : ''}${(isLocked || itemDeadlineLocked) ? ' vc-nav-item-btn--locked' : ''}`}
                                      onClick={() => {
                                        if (isLocked || itemDeadlineLocked) return;
                                        const flatIdx = flatItems.findIndex(f => f.vi === vi && f.ci === ci && f.ii === ii);
                                        // goTo handles state update + progress save
                                        if (flatIdx >= 0) goTo(flatIdx);
                                        else setSelected({ vi, ci, ii });
                                      }}
                                      title={isLocked ? 'Purchase course to unlock' : itemDeadlineLocked ? 'Locked after deadline' : item.title}
                                    >
                                      <i
                                        className={`bi ${typeIcon(item.type)} vc-item-icon`}
                                        style={{ color: isSel ? '#fff' : typeColor(item.type) }}
                                      ></i>
                                      <span className="vc-nav-label">{item.title}</span>
                                      {(isLocked || itemDeadlineLocked) && <i className="bi bi-lock-fill vc-lock-icon"></i>}
                                      {itemDl && !itemDeadlineLocked && itemDl.isPast && (
                                        <span className="vc-deadline-badge vc-deadline-badge--past" title="Past deadline">⚠</span>
                                      )}
                                      {itemDl && !itemDl.isPast && (
                                        <span className="vc-deadline-badge" title={`Due: ${new Date(itemDl.deadline.dueAt).toLocaleDateString()}`}>📅</span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* ── Content Chapter (entity) ── */
                          <button
                            key={ch.cid}
                            className={`vc-nav-entity-btn${selected?.vi === vi && selected?.ci === ci && selected?.ii === null ? ' vc-nav-item-btn--active' : ''}${locked ? ' vc-nav-item-btn--locked' : ''}`}
                            onClick={() => !locked && setSelected({ vi, ci, ii: null })}
                          >
                            <i
                              className={`bi ${typeIcon(ch.type)} vc-item-icon`}
                              style={{ color: typeColor(ch.type) }}
                            ></i>
                            <span className="vc-nav-label">{ch.title}</span>
                            {locked && <i className="bi bi-lock-fill vc-lock-icon"></i>}
                          </button>
                        )
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Content Volume (entity) ── */
                <button
                  key={vol.vid}
                  className={`vc-nav-volume-entity-btn${selected?.vi === vi && selected?.ci === null ? ' vc-nav-item-btn--active' : ''}${locked ? ' vc-nav-item-btn--locked' : ''}`}
                  onClick={() => !locked && setSelected({ vi, ci: null, ii: null })}
                >
                  <i
                    className={`bi ${typeIcon(vol.type)} vc-item-icon`}
                    style={{ color: typeColor(vol.type) }}
                  ></i>
                  <span className="vc-nav-label">{vol.title}</span>
                  {locked && <i className="bi bi-lock-fill vc-lock-icon"></i>}
                </button>
              )
            )}
          </nav>
        </aside>

        {/* ── Main Content ── */}
        <main className="vc-main">
          {/* Collapsed sidebar button */}
          {!sidebarOpen && (
            <button className="vc-sidebar-reopen" onClick={() => setSidebarOpen(true)} title="Open sidebar">
              <i className="bi bi-layout-sidebar"></i>
            </button>
          )}

          {selected == null && mainView === 'assignments' ? (
            /* ── Assignments Tab ── */
            <div className="vc-welcome" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="d-flex align-items-center gap-3 mb-4">
                <button className="btn btn-outline-secondary btn-sm" onClick={() => setMainView('course')}>
                  ← Back to Course
                </button>
                <h2 className="h4 fw-bold mb-0"><i className="bi bi-clipboard-check me-2"></i>My Assignments</h2>
              </div>
              {sessionAssignments.length === 0 ? (
                <p className="text-muted">No assignments in this session yet.</p>
              ) : (
                <div className="w-100" style={{ maxWidth: 860 }}>
                  {sessionAssignments.map(a => {
                    const myEntry = sessionGroup?.assignments?.find(
                      ae => String(ae.assignmentId?._id || ae.assignmentId) === String(a._id)
                    );
                    const mySub = myEntry?.submissions?.find(
                      s => String(s.studentId?._id || s.studentId) === String(data?._id)
                    );
                    const isOverdue = a.dueAt && new Date() > new Date(a.dueAt);
                    return (
                      <div key={a._id} className="card border-0 shadow-sm mb-3">
                        <div className="card-header bg-white d-flex align-items-center justify-content-between">
                          <span className="fw-semibold">{a.title}</span>
                          <div className="d-flex gap-2 align-items-center">
                            <span className="badge bg-light text-dark border">{a.markScale}-pt · max {a.maxMark}</span>
                            {isOverdue && <span className="badge bg-danger">Overdue</span>}
                            {mySub?.status === 'approved' && <span className="badge bg-success">Approved</span>}
                            {mySub?.status === 'declined' && <span className="badge bg-danger">Declined</span>}
                            {mySub?.status === 'pending' && <span className="badge bg-warning text-dark">Pending</span>}
                          </div>
                        </div>
                        <div className="card-body">
                          {a.description && <p className="text-muted small mb-2">{a.description}</p>}
                          <div className="d-flex gap-3 text-muted small mb-3 flex-wrap">
                            <span><i className="bi bi-calendar me-1"></i>Due: {new Date(a.dueAt).toLocaleString()}</span>
                            {mySub?.mark != null && <span><i className="bi bi-star me-1"></i>Mark: {mySub.mark}/{a.maxMark}</span>}
                          </div>
                          {a.taskFiles?.length > 0 && (
                            <div className="mb-3">
                              <strong className="small">Task files:</strong>
                              {a.taskFiles.map((f, i) => (
                                <a key={i} href={`${toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')}${f.url}`} className="btn btn-outline-secondary btn-sm ms-2" target="_blank" rel="noopener noreferrer">
                                  <i className="bi bi-download me-1"></i>{f.originalName || f.filename}
                                </a>
                              ))}
                            </div>
                          )}
                          {mySub && (
                            <div className={`alert alert-${mySub.status === 'approved' ? 'success' : mySub.status === 'declined' ? 'danger' : 'warning'} py-2`}>
                              {mySub.feedback && <div><strong>Feedback:</strong> {mySub.feedback}</div>}
                              <small>Submitted: {new Date(mySub.submittedAt).toLocaleString()}</small>
                            </div>
                          )}
                          {(!mySub || mySub.status === 'declined') && (
                            <AssignmentItemView
                              item={{ title: a.title, assignmentId: a._id }}
                              sessionId={sessionId}
                              sessionGroup={sessionGroup}
                              studentId={data?._id}
                              token={token}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : selected == null ? (
            /* ── Welcome / no selection ── */
            <div className="vc-welcome">
              {/* ── Left: course info ── */}
              <div className="vc-welcome-inner">
                {/* ── Lang switcher ── */}
                {course.add_langs?.length > 0 && (
                  <div className="d-flex gap-1 mb-3 flex-wrap">
                    {[course.base_lang, ...course.add_langs].map((lang, idx) => (
                      <button
                        key={lang}
                        className={`btn btn-sm ${activeLangIdx === idx ? 'btn-primary' : 'btn-outline-secondary'}`}
                        style={{ fontSize: '.75rem', padding: '2px 10px', borderRadius: 999 }}
                        onClick={() => setActiveLangIdx(idx)}
                      >
                        {lang.toUpperCase()}
                        {idx === 0 && <span className="ms-1 opacity-50" style={{ fontSize: '.65rem' }}>base</span>}
                      </button>
                    ))}
                  </div>
                )}
                {course.links[0] ? (
                  <CourseThumbnail
                    src={(toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')) + course.links[0].url}
                    alt={t('title')}
                  />
                ) : (
                  <div className="vc-welcome-icon">
                    <i className="bi bi-book-open" />
                  </div>
                )}
                <h1 className="vc-welcome-title">{t('title')}</h1>
                {t('description') && (
                  <p className="vc-welcome-desc">{t('description')}</p>
                )}
                <div className="vc-welcome-meta">
                  <span className="vc-badge">{course.direction}</span>
                  <span className="vc-badge vc-badge--secondary">{course.level}</span>
                  {course.courseType && course.courseType !== 'SELF_TAUGHT' && (
                    <span className={`vc-badge ${course.courseType === 'HOSTED' ? 'vc-badge--hosted' : 'vc-badge--mentored'}`}>
                      {course.courseType}
                    </span>
                  )}
                  {session && (
                    <span className="vc-badge vc-badge--session">
                      <i className="bi bi-people-fill me-1"></i>
                      Session: {session.hostTutor?.nickname || 'Tutor'}
                    </span>
                  )}
                  {session && !locked && (
                    <>
                      <button
                        className="btn btn-sm btn-success d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '.75rem', padding: '3px 10px', borderRadius: 999 }}
                        onClick={() => startMeeting({ sessionId })}
                        title="Join video conference for this session">
                        <i className="bi bi-camera-video-fill"></i> Join Video
                      </button>
                      <button
                        className="btn btn-sm btn-outline-info d-inline-flex align-items-center gap-1"
                        style={{ fontSize: '.75rem', padding: '3px 10px', borderRadius: 999 }}
                        onClick={copyInviteLink}
                        title="Copy invite link">
                        <i className={`bi ${inviteCopied ? 'bi-check-lg' : 'bi-link-45deg'}`}></i>
                        {inviteCopied ? 'Copied!' : 'Invite'}
                      </button>
                    </>
                  )}
                  {course.isPrivateCopy && (
                    <span className="vc-badge vc-badge--copy" title="This is a tutor-edited version">
                      <i className="bi bi-pencil-fill me-1"></i>Tutor Edition
                    </span>
                  )}
                </div>
                {locked ? (
                  <div className="vc-locked-notice">
                    <i className="bi bi-lock-fill"></i>
                    <span>Purchase this course to access the content.</span>
                    {course.courseType !== 'HOSTED' && (
                      <button className="btn btn-primary btn-sm mt-2"
                        onClick={() => setShowPayment(true)}>
                        {course.price > 0 ? `Buy for $${course.price}` : 'Enrol for free'}
                      </button>
                    )}
                  </div>
                ) : (
                  flatItems.length > 0 && (
                    <div className="d-flex gap-2 flex-wrap align-items-center">
                      {courseFinished ? (
                        <button className="btn btn-success" onClick={handleFinishCourse} disabled={courseFinished}>
                          <i className="bi bi-check-circle-fill me-1"></i>Completed!
                        </button>
                      ) : (
                        <button className="vc-start-btn" onClick={() => goTo(0)}>
                          Start Learning <i className="bi bi-arrow-right ms-1"></i>
                        </button>
                      )}
                      {sessionId && (
                        <button className={`btn btn-outline-primary`} onClick={() => setMainView(v => v === 'assignments' ? 'course' : 'assignments')}>
                          <i className="bi bi-clipboard-check me-1"></i>
                          {mainView === 'assignments' ? 'Back to Course' : 'My Assignments'}
                        </button>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* ── Right: rating + comments ── */}
              {!course.isPrivateCopy && (
                <div className="vc-welcome-right">

                  {/* ── Rate this course ── */}
                  {!locked && (
                    <div className="vc-rate-section">
                      <div className="vc-rate-avg">
                        <span className="vc-rate-num">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</span>
                        <div className="vc-rate-stars-display">
                          {[1, 2, 3, 4, 5].map(n => (
                            <i key={n} className={`bi ${avgRating >= n ? 'bi-star-fill' : avgRating >= n - 0.5 ? 'bi-star-half' : 'bi-star'} vc-star-display`}></i>
                          ))}
                        </div>
                        <span className="vc-rate-count">({totalVotes} {totalVotes === 1 ? 'rating' : 'ratings'})</span>
                      </div>
                      <div className="vc-rate-row">
                        <span className="vc-rate-label">{myRating ? 'Your rating:' : 'Rate this course:'}</span>
                        <div className="vc-stars-interactive">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n}
                              className={`vc-star-btn${(ratingHover || myRating) >= n ? ' active' : ''}`}
                              onMouseEnter={() => setRatingHover(n)}
                              onMouseLeave={() => setRatingHover(null)}
                              onClick={() => handleRate(n)}
                              disabled={ratingSubmitting}
                              title={`${n} star${n > 1 ? 's' : ''}`}
                            >
                              <i className={`bi ${(ratingHover || myRating) >= n ? 'bi-star-fill' : 'bi-star'}`}></i>
                            </button>
                          ))}
                        </div>
                        {myRating && <span className="vc-rated-badge"><i className="bi bi-check-circle-fill me-1"></i>Rated</span>}
                      </div>
                    </div>
                  )}

                  {/* ── Comments section ── */}
                  <div className="vc-comments">
                    <h3 className="vc-comments-title">
                      <i className="bi bi-chat-left-text me-2"></i>
                      Comments {comments.length > 0 && <span className="vc-comments-count">{comments.length}</span>}
                    </h3>

                    {/* Compose box — only for owners */}
                    {!locked && (
                      <div className="vc-comment-compose">
                        <div className="vc-compose-tabs">
                          <button
                            className={`vc-compose-tab${!commentPreview ? ' vc-compose-tab--active' : ''}`}
                            onClick={() => setCommentPreview(false)}
                          >Write</button>
                          <button
                            className={`vc-compose-tab${commentPreview ? ' vc-compose-tab--active' : ''}`}
                            onClick={() => setCommentPreview(true)}
                            disabled={!commentText.trim()}
                          >Preview</button>
                          <button
                            className={`vc-compose-tab vc-compose-tab--help${syntaxHelpOpen ? ' vc-compose-tab--active' : ''}`}
                            onClick={() => setSyntaxHelpOpen(p => !p)}
                            title="Formatting syntax reference"
                          ><i className="bi bi-question-circle me-1"></i>Syntax</button>
                        </div>
                        {syntaxHelpOpen && (
                          <div className="vc-syntax-help">
                            <div className="vc-syntax-grid">
                              <span className="vc-syntax-ex"><code># Heading 1</code></span><span className="vc-syntax-desc">Large heading</span>
                              <span className="vc-syntax-ex"><code>## Heading 2</code></span><span className="vc-syntax-desc">Medium heading</span>
                              <span className="vc-syntax-ex"><code>**bold**</code></span><span className="vc-syntax-desc">Bold text</span>
                              <span className="vc-syntax-ex"><code>*italic*</code></span><span className="vc-syntax-desc">Italic text</span>
                              <span className="vc-syntax-ex"><code>`(inline code)`</code></span><span className="vc-syntax-desc">Inline code</span>
                              <span className="vc-syntax-ex"><code>~(js)[code here]~</code></span><span className="vc-syntax-desc">Code block with language</span>
                              <span className="vc-syntax-ex"><code>- item</code></span><span className="vc-syntax-desc">Bullet list item</span>
                              <span className="vc-syntax-ex"><code>1. item</code></span><span className="vc-syntax-desc">Numbered list item</span>
                              <span className="vc-syntax-ex"><code>---</code></span><span className="vc-syntax-desc">Horizontal rule</span>
                              <span className="vc-syntax-ex"><code>[text](url)</code></span><span className="vc-syntax-desc">Link</span>
                            </div>
                          </div>
                        )}

                        {commentPreview ? (
                          <div
                            className="vc-comment-preview vc-text-body"
                            dangerouslySetInnerHTML={{ __html: parseTextSyntax(commentText) }}
                          />
                        ) : (
                          <textarea
                            className="vc-comment-textarea"
                            rows={4}
                            placeholder={`Write a comment…\nSupports the same text syntax as course content: # headings, **bold**, \`(code)\`, ~(lang)[…]~, etc.`}
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            maxLength={4000}
                          />
                        )}

                        <div className="vc-compose-footer">
                          <span className="vc-char-count">{commentText.length} / 4000</span>
                          <button
                            className="vc-btn-primary vc-compose-submit"
                            onClick={handleAddComment}
                            disabled={!commentText.trim() || commentPosting}
                          >
                            {commentPosting
                              ? <><span className="vc-spinner-sm"></span> Posting…</>
                              : <><i className="bi bi-send me-1"></i>Post</>}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Comment list */}
                    {commentsLoading ? (
                      <div className="vc-comments-loading"><span className="vc-spinner-sm"></span> Loading…</div>
                    ) : comments.length === 0 ? (
                      <p className="vc-comments-empty">No comments yet{locked ? '.' : ' — be the first!'}</p>
                    ) : (
                      <div className="vc-comment-list">
                        {comments.map(comment => (
                          <div key={comment._id} className="vc-comment">
                            <div className="vc-comment-header">
                              <span className="vc-comment-author">
                                <i className="bi bi-person-circle me-1"></i>
                                {comment.nickname}
                              </span>
                              <span className="vc-comment-date">
                                {new Date(comment.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                              </span>
                              {data?._id && comment.userId && (() => {
                                const al = data?.role?.accessLevel;
                                const rn = data?.role?.roleName;
                                const isElevated = al === 'manage' || al === 'admin' || al === 'root' || rn === 'root';
                                const isAuthor = String(data._id) === String(comment.userId);
                                return (isAuthor || isElevated) && (
                                  <button
                                    className="vc-comment-delete"
                                    onClick={() => handleDeleteComment(comment._id)}
                                    title="Delete comment"
                                  >
                                    <i className="bi bi-trash"></i>
                                  </button>
                                );
                              })()}
                            </div>
                            <div
                              className="vc-comment-body vc-text-body"
                              dangerouslySetInnerHTML={{ __html: parseTextSyntax(comment.text) }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Item Content ── */
            <ContentPanel
              key={`${selected.vi}-${selected.ci}-${selected.ii}`}
              selected={selected}
              volumes={volumes}
              locked={locked}
              token={token}
              onSelectItem={selectItem}
              hasPrev={currentFlatIdx > 0}
              hasNext={currentFlatIdx < flatItems.length - 1}
              onPrev={() => goTo(currentFlatIdx - 1)}
              onNext={() => goTo(currentFlatIdx + 1)}
              setOpenVolumes={setOpenVolumes}
              setOpenChapters={setOpenChapters}
              finish={() => handleFinishCourse()}
              sessionId={sessionId}
              sessionGroup={sessionGroup}
              studentId={data?._id}
            />
          )}
        </main>
      </div>
      <UtilityModal
        show={modal.show}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
        onCancel={modal.onCancel || closeModal}
        onClose={closeModal}
      />
      {showPayment && course && (
        <PaymentModal
          course={course}
          onClose={() => setShowPayment(false)}
          onSuccess={() => { setShowPayment(false); setLocked(false); fetchData(); }}
        />
      )}
      {showConference && sessionId && (
        <VideoConference
          sessionId={sessionId}
          nickname={data?.nickname}
          onClose={() => setShowConference(false)}
        />
      )}
    </AppLayout>
  );
}

// ─── Content Pane ─────────────────────────────────────────────────────────────
function ContentPanel({ selected, volumes, locked, token, onSelectItem, hasPrev, hasNext, onPrev, onNext, setOpenVolumes, setOpenChapters, finish, sessionId, sessionGroup, studentId }) {
  const { vi, ci, ii } = selected;
  const vol = volumes[vi];
  const ch = ci != null ? vol?.chapters[ci] : null;
  const item = ii != null ? ch?.items[ii] : (ci != null ? ch : vol);

  if (!item) return (
    <div className="vc-pane-error">
      <i className="bi bi-exclamation-triangle"></i>
      <p>Item not found.</p>
    </div>
  );

  // Build action props for text buttons
  const ap = {
    onCloseItem: () => { },
    onCloseChapter: () => { },
    onCloseVolume: () => { },
    onScrollToVolume: (idx) => {
      const el = document.querySelector('.vc-main');
      if (el) el.scrollTop = 0;
      onSelectItem?.(idx, 0, 0);
    },
    onScrollToChapter: (idx, cidx) => onSelectItem?.(idx, cidx, 0),
    onScrollToItem: (idx, cidx, iidx) => onSelectItem?.(idx, cidx, iidx),
  };

  const breadcrumb = [
    vol?.title,
    ch?.title,
    ii != null ? item.title : null,
  ].filter(Boolean);

  return (
    <div className="vc-pane">
      {/* Breadcrumb */}
      <nav className="vc-breadcrumb" aria-label="breadcrumb">
        {breadcrumb.map((crumb, i) => (
          <span key={i} className="vc-breadcrumb-item">
            {i > 0 && <i className="bi bi-chevron-right vc-bc-sep"></i>}
            <span className={i === breadcrumb.length - 1 ? 'vc-bc-current' : 'vc-bc-ancestor'}>
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      {/* Title */}
      <h1 className="vc-content-title">
        <i
          className={`bi ${typeIcon(item.type)} vc-title-icon`}
          style={{ color: typeColor(item.type) }}
        ></i>
        {item.title}
      </h1>

      {/* Content body */}
      <div className="vc-content-body">
        {locked ? (
          <div className="vc-locked-pane">
            <i className="bi bi-lock-fill"></i>
            <h3>Content Locked</h3>
            <p>Purchase this course to access all lessons.</p>
          </div>
        ) : (
          <ItemRenderer item={item} token={token} actionProps={ap} sessionId={sessionId} sessionGroup={sessionGroup} studentId={studentId} />
        )}
      </div>

      {/* Prev / Next navigation */}
      <div className="vc-pane-nav">
        <button
          className="vc-pane-nav-btn"
          onClick={onPrev}
          disabled={!hasPrev}
        >
          <i className="bi bi-arrow-left"></i> Previous
        </button>
        {!hasNext ? (<button
          className="btn btn-success"
          onClick={finish}
        >
          Finish <i className="bi bi-flag-fill me-1"></i>
        </button>) : (<button
          className="vc-pane-nav-btn vc-pane-nav-btn--next"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next <i className="bi bi-arrow-right"></i>
        </button>)}

      </div>
    </div>
  );
}

// ─── Item Renderer ────────────────────────────────────────────────────────────
function ItemRenderer({ item, token, actionProps, sessionId, sessionGroup, studentId }) {
  const { type, url } = item;

  if (type === 'assignment') return (
    <AssignmentItemView
      item={item}
      sessionId={sessionId}
      sessionGroup={sessionGroup}
      studentId={studentId}
      token={token}
    />
  );
  if (type === 'text') return <TextViewer url={url} token={token} actionProps={actionProps} />;
  if (type === 'form') return <FormViewer url={url} token={token} />;
  if (type === 'video') return <VideoViewer url={url} />;
  if (type === 'image') return <ImageViewer url={url} title={item.title} />;
  if (type === 'audio') return <AudioViewer url={url} title={item.title} />;
  if (type === 'document') return <DocumentViewer url={url} title={item.title} />;
  if (type === 'archive') return <ArchiveViewer url={url} title={item.title} />;

  return (
    <div className="vc-unknown">
      <i className="bi bi-file-earmark"></i>
      <p>Unsupported content type: <code>{type}</code></p>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="vc-btn-ghost">Open file</a>}
    </div>
  );
}

// ─── Text Viewer ──────────────────────────────────────────────────────────────
function TextViewer({ url, token, actionProps }) {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    setLoading(true); setError(null);
    (async () => {
      try {
        const fullUrl = url.startsWith('http') ? url : `${toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')}${url}`;
        const res = await fetch(`${fullUrl}?_=${Date.now()}`, {
          headers: { Authorization: token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' },
        });
        if (res.ok) setHtml(parseTextSyntax(await res.text()));
        else setError('Could not load content.');
      } catch (e) { setError('Network error: ' + e.message); }
      setLoading(false);
    })();
  }, [url]);

  const handleClick = (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.getAttribute('data-action');
    const params = btn.getAttribute('data-params') || '';
    const handler = ITEM_ACTIONS[action];
    if (handler) handler(params, actionProps);
    else executeJsAction(action, params);
  };

  if (loading) return <div className="vc-skeleton"><div className="vc-sk-line vc-sk-line--full"></div><div className="vc-sk-line vc-sk-line--80"></div><div className="vc-sk-line vc-sk-line--60"></div></div>;
  if (error) return <div className="vc-fetch-error"><i className="bi bi-exclamation-triangle"></i> {error}</div>;
  if (!url && !html) return <p className="vc-empty-note">No content available.</p>;

  return (
    <div className="vc-text-body" onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// ─── Video Viewer ─────────────────────────────────────────────────────────────
function VideoViewer({ url }) {
  if (!url) return <p className="vc-empty-note">No video URL set.</p>;
  const ytId = extractYouTubeId(url);
  if (ytId) return (
    <div className="vc-video-wrap">
      <iframe
        src={`https://www.youtube.com/embed/${ytId}`}
        title="YouTube video player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="vc-video-player"
      />
    </div>
  );
  return (
    <div className="vc-video-wrap">
      <video src={url} controls className="vc-video-player" />
    </div>
  );
}

// ─── Image Viewer ─────────────────────────────────────────────────────────────
function ImageViewer({ url, title }) {
  if (!url) return <p className="vc-empty-note">No image URL set.</p>;
  return (
    <div className="vc-image-wrap">
      <img src={url} alt={title || 'Image'} className="vc-image" />
    </div>
  );
}

// ─── Audio Viewer ─────────────────────────────────────────────────────────────
function AudioViewer({ url, title }) {
  if (!url) return <p className="vc-empty-note">No audio URL set.</p>;
  return (
    <div className="vc-audio-wrap">
      <div className="vc-audio-card">
        <i className="bi bi-music-note-beamed vc-audio-icon"></i>
        <p className="vc-audio-label">{title}</p>
        <audio src={url} controls className="vc-audio-player" />
      </div>
    </div>
  );
}

// ─── Document Viewer ──────────────────────────────────────────────────────────
function DocumentViewer({ url, title }) {
  if (!url) return <p className="vc-empty-note">No document URL set.</p>;
  return (
    <div className="vc-doc-wrap">
      <div className="vc-doc-card">
        <i className="bi bi-file-pdf vc-doc-icon"></i>
        <p className="vc-doc-name">{title || url.split('/').pop()}</p>
        <a href={url} target="_blank" rel="noopener noreferrer" className="vc-btn-primary">
          <i className="bi bi-box-arrow-up-right me-1"></i> Open Document
        </a>
      </div>
    </div>
  );
}

// ─── Archive Viewer ───────────────────────────────────────────────────────────
function ArchiveViewer({ url, title }) {
  if (!url) return <p className="vc-empty-note">No archive URL set.</p>;
  return (
    <div className="vc-doc-wrap">
      <div className="vc-doc-card">
        <i className="bi bi-file-zip vc-doc-icon" style={{ color: '#6b7280' }}></i>
        <p className="vc-doc-name">{title || url.split('/').pop()}</p>
        <a href={url} download className="vc-btn-primary">
          <i className="bi bi-download me-1"></i> Download Archive
        </a>
      </div>
    </div>
  );
}

// ─── Form Viewer ─────────────────────────────────────────────────────────────
function FormViewer({ url, token: tok }) {
  const token = tok || localStorage.getItem('token');
  const [formDef, setFormDef] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const shuffles = useRef({});
  const [modal, setModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null, onCancel: null });
  const closeModal = () => setModal(p => ({ ...p, show: false }));
  const showConfirm = (title, message, onConfirm) => setModal({ show: true, type: 'confirm', title, message, onConfirm, onCancel: closeModal });

  const getShuffled = (id, arr) => {
    if (!shuffles.current[id]) shuffles.current[id] = [...arr].sort(() => Math.random() - .5);
    return shuffles.current[id];
  };

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    setLoading(true);
    fetch(`${toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')}${url}?_=${Date.now()}`, {
      headers: { Authorization: token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.questions) setFormDef(d); else setError('Could not load form'); })
      .catch(() => setError('Error loading form'))
      .finally(() => setLoading(false));
  }, [url]);

  const setAns = (id, v) => setAnswers(p => ({ ...p, [id]: v }));
  const toggleMult = (id, oi) => {
    const c = answers[id] || [];
    setAns(id, c.includes(oi) ? c.filter(i => i !== oi) : [...c, oi]);
  };

  const isCorrect = (q) => {
    const a = answers[q.id];
    if (q.type === 'single') return a === q.correctIndex;
    if (q.type === 'multiple') return [...(a || [])].sort().join(',') === [...(q.correctIndices || [])].sort().join(',');
    if (q.type === 'correlation') return q.pairs.every((p, i) => a && a[i] === p.right);
    if (q.type === 'closed') return (a || '').trim().toLowerCase() === (q.correctAnswer || '').trim().toLowerCase();
    return null;
  };

  const handleSubmit = () => {
    const ua = (formDef?.questions || []).filter(q => {
      const a = answers[q.id];
      if (q.type === 'multiple') return !a || !a.length;
      if (q.type === 'open' || q.type === 'closed') return !a || !a.trim();
      return a === undefined || a === null;
    });
    if (ua.length) {
      showConfirm('Submit anyway?', `${ua.length} question(s) unanswered. Submit anyway?`, () => setSubmitted(true));
    } else {
      setSubmitted(true);
    }
  };

  const retry = () => {
    setAnswers({});
    setSubmitted(false);
    shuffles.current = {};
  };

  if (loading) return <div className="vc-skeleton"><div className="vc-sk-line vc-sk-line--full"></div><div className="vc-sk-line vc-sk-line--80"></div></div>;
  if (error) return <div className="vc-fetch-error"><i className="bi bi-exclamation-triangle"></i> {error}</div>;
  if (!formDef) return null;

  const scoreable = formDef.questions.filter(q => ['single', 'multiple', 'correlation', 'closed'].includes(q.type));
  const correct = scoreable.filter(q => isCorrect(q) === true).length;

  return (
    <div className="vc-form">
      {submitted ? (
        <div className="vc-form-results">
          {scoreable.length > 0 && (
            <div className={`vc-score ${correct === scoreable.length ? 'vc-score--perfect' : correct >= scoreable.length * .6 ? 'vc-score--good' : 'vc-score--low'}`}>
              <span className="vc-score-num">{correct}</span>
              <span className="vc-score-sep">/</span>
              <span className="vc-score-total">{scoreable.length}</span>
            </div>
          )}
          <div className="vc-review-list">
            {formDef.questions.map((q, i) => {
              const ok = isCorrect(q); const a = answers[q.id];
              return (
                <div key={q.id} className={`vc-review-item${ok === true ? ' vc-review-item--ok' : ok === false ? ' vc-review-item--wrong' : ''}`}>
                  <div className="vc-review-q"><strong>Q{i + 1}.</strong> {q.question}</div>
                  {q.type === 'single' && <div className="vc-review-a">{ok ? <i className="bi bi-check-circle-fill"></i> : <i className="bi bi-x-circle-fill"></i>} {q.options[a] ?? <em>none</em>}{!ok && <span className="vc-correct-ans"> ✓ {q.options[q.correctIndex]}</span>}</div>}
                  {q.type === 'multiple' && <div className="vc-review-a">{ok ? <i className="bi bi-check-circle-fill"></i> : <i className="bi bi-x-circle-fill"></i>} {(a || []).map(i => q.options[i]).join(', ') || <em>none</em>}{!ok && <span className="vc-correct-ans"> ✓ {(q.correctIndices || []).map(i => q.options[i]).join(', ')}</span>}</div>}
                  {q.type === 'closed' && <div className="vc-review-a">{ok ? <i className="bi bi-check-circle-fill"></i> : <i className="bi bi-x-circle-fill"></i>} "{a || ''}" {!ok && <span className="vc-correct-ans"> ✓ "{q.correctAnswer}"</span>}</div>}
                  {q.type === 'open' && <div className="vc-review-a vc-review-a--open"><i className="bi bi-pencil-square"></i> {a?.trim() || <em>no answer</em>} <span className="vc-badge vc-badge--secondary" style={{ fontSize: '0.7rem' }}>Teacher reviews</span></div>}
                </div>
              );
            })}
          </div>
          <button className="vc-btn-ghost" onClick={retry}>
            <i className="bi bi-arrow-counterclockwise me-1"></i> Try again
          </button>
        </div>
      ) : (
        <div className="vc-form-questions">
          {formDef.questions.map((q, i) => (
            <div key={q.id} className="vc-q-block">
              <div className="vc-q-label"><span className="vc-q-num">Q{i + 1}</span> {q.question}</div>
              {q.type === 'single' && (
                <div className="vc-q-options">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className={`vc-q-option${answers[q.id] === oi ? ' vc-q-option--sel' : ''}`}>
                      <input type="radio" name={`q-${q.id}`} checked={answers[q.id] === oi} onChange={() => setAns(q.id, oi)} />
                      {opt || <em>(empty)</em>}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'multiple' && (
                <div className="vc-q-options">
                  {q.options.map((opt, oi) => (
                    <label key={oi} className={`vc-q-option${(answers[q.id] || []).includes(oi) ? ' vc-q-option--sel' : ''}`}>
                      <input type="checkbox" checked={(answers[q.id] || []).includes(oi)} onChange={() => toggleMult(q.id, oi)} />
                      {opt || <em>(empty)</em>}
                    </label>
                  ))}
                </div>
              )}
              {q.type === 'correlation' && (() => {
                const ro = getShuffled(q.id, q.pairs.map(p => p.right));
                const ca = answers[q.id] || {};
                return (
                  <div className="vc-q-corr">
                    {q.pairs.map((pair, pi) => (
                      <div key={pi} className="vc-q-corr-row">
                        <span className="vc-q-corr-left">{pair.left}</span>
                        <select className="vc-select" value={ca[pi] || ''} onChange={e => setAns(q.id, { ...ca, [pi]: e.target.value })}>
                          <option value="">— Choose —</option>
                          {ro.map((r, ri) => <option key={ri} value={r}>{r}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                );
              })()}
              {q.type === 'closed' && (
                <input className="vc-input" type="text" placeholder="Your answer…"
                  value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} />
              )}
              {q.type === 'open' && (
                <textarea className="vc-textarea" rows={4} placeholder="Write your answer…"
                  value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} />
              )}
            </div>
          ))}
          <button className="vc-btn-primary" onClick={handleSubmit}>
            <i className="bi bi-send me-1"></i> Submit
          </button>
        </div>
      )}
      <UtilityModal
        show={modal.show}
        type={modal.type}
        title={modal.title}
        message={modal.message}
        onConfirm={() => { modal.onConfirm?.(); closeModal(); }}
        onCancel={modal.onCancel || closeModal}
        onClose={closeModal}
      />
    </div>
  );
}


// ─── AssignmentItemView ───────────────────────────────────────────────────────
// Renders an assignment item inside the course view for students.
function AssignmentItemView({ item, sessionId, sessionGroup, studentId, token }) {
  const [assignment, setAssignment] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const API = toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api');
  
  useEffect(() => {
    if (!item?.assignmentId || !sessionGroup) return;
    // Find assignment entry in group
    const entry = sessionGroup.assignments?.find(
      a => String(a.assignmentId?._id || a.assignmentId) === String(item.assignmentId)
    );
    if (entry?.assignmentId) setAssignment(entry.assignmentId);

    // Find own submission
    if (entry && studentId) {
      const sub = entry.submissions?.find(
        s => String(s.studentId?._id || s.studentId) === String(studentId)
      );
      if (sub) setSubmission(sub);
    }
  }, [item, sessionGroup, studentId]);

  const handleSubmit = async () => {
    if (!file || !sessionGroup || !item?.assignmentId) return;
    const formData = new FormData();
    formData.append('submission', file);
    setUploading(true); setError(''); setMessage('');
    try {
      const res = await fetch(
        `${API}/submissions/${sessionGroup._id}/${item.assignmentId}`,
        {
          method: 'POST',
          headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}` },
          body: formData
        }
      );
      const json = await res.json();
      if (res.ok) {
        setMessage(json.message || 'Submitted!');
        setSubmission({ status: 'pending', submittedAt: new Date(), isOverdue: json.data?.isOverdue });
        setFile(null);
      } else { setError(json.message || 'Upload failed'); }
    } catch (e) { setError('Network error'); }
    setUploading(false);
  };

  const isOverdueNow = assignment?.dueAt && (() => {
    const sanctionStart = new Date(assignment.dueAt);
    sanctionStart.setDate(sanctionStart.getDate() + 1);
    sanctionStart.setHours(0, 0, 0, 0);
    return new Date() >= sanctionStart;
  })();

  const canResubmit = !submission || submission.status === 'declined' ||
    (assignment?.dueAt && new Date() <= new Date(assignment.dueAt));

  if (!assignment && !item?.assignmentId) {
    return <div className="vc-assignment-item vc-assignment-item--empty">Assignment not configured.</div>;
  }

  return (
    <div className="vc-assignment-item">
      <div className="vc-assignment-header">
        <i className="bi bi-clipboard-check me-2"></i>
        <h3>{item?.title || 'Assignment'}</h3>
      </div>

      {assignment ? (
        <>
          {assignment.description && (
            <p className="vc-assignment-desc">{assignment.description}</p>
          )}
          <div className="vc-assignment-meta">
            <span>
              <i className="bi bi-calendar me-1"></i>
              Due: <strong>{new Date(assignment.dueAt).toLocaleString()}</strong>
              {isOverdueNow && <span className="badge bg-danger ms-2">Overdue</span>}
            </span>
            <span>
              <i className="bi bi-star me-1"></i>
              Max mark: <strong>{assignment.maxMark}</strong>
              {isOverdueNow && (
                <span className="text-warning ms-2">
                  (overdue penalty: −{assignment.overdueDeduction})
                </span>
              )}
            </span>
          </div>

          {/* Task files from tutor */}
          {assignment.taskFiles?.length > 0 && (
            <div className="vc-assignment-files">
              <strong>Task files:</strong>
              {assignment.taskFiles.map((f, i) => (
                <a key={i} href={`${toHttps(process.env.REACT_APP_API_URL?.replace('/api','') || 'https://localhost:4040')}${f.url}`}
                  className="vc-dl-link ms-2" target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-download me-1"></i>{f.originalName || f.filename}
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-muted small">Loading assignment details…</p>
      )}

      {/* Submission status */}
      {submission && (
        <div className={`vc-submission-status vc-submission-status--${submission.status}`}>
          <div className="d-flex align-items-center gap-2 mb-1">
            <i className={`bi ${submission.status === 'approved' ? 'bi-check-circle-fill text-success' :
              submission.status === 'declined' ? 'bi-x-circle-fill text-danger' :
                'bi-hourglass-split text-warning'
              }`}></i>
            <strong>
              {submission.status === 'approved' ? 'Approved' :
                submission.status === 'declined' ? 'Declined — resubmission required' :
                  'Pending review'}
            </strong>
            {submission.isOverdue && <span className="badge bg-warning text-dark">Was overdue</span>}
          </div>
          {submission.mark !== null && submission.mark !== undefined && (
            <div>Mark: <strong>{submission.mark}</strong> / {assignment?.maxMark}</div>
          )}
          {submission.feedback && (
            <div className="vc-submission-feedback">
              <strong>Tutor feedback:</strong> {submission.feedback}
            </div>
          )}
          <small className="text-muted">
            Submitted: {new Date(submission.submittedAt).toLocaleString()}
          </small>
        </div>
      )}

      {/* Upload form */}
      {sessionGroup && canResubmit && (
        <div className="vc-submission-upload">
          <label className="form-label fw-semibold">
            {submission ? 'Re-submit' : 'Submit your work'} (.zip or .txt file)
          </label>
          <div className="d-flex gap-2 align-items-center flex-wrap">
            <input
              type="file"
              accept=".zip, .txt"
              className="form-control"
              style={{ maxWidth: 340 }}
              onChange={e => { setFile(e.target.files[0]); setError(''); setMessage(''); }}
            />
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={!file || uploading}
            >
              {uploading
                ? <><span className="spinner-border spinner-border-sm me-1" />Uploading…</>
                : <><i className="bi bi-upload me-1" />Submit</>}
            </button>
          </div>
          {isOverdueNow && (
            <small className="text-warning d-block mt-1">
              ⚠ Submitting after deadline — mark may be reduced by {assignment?.overdueDeduction || 1} point(s).
            </small>
          )}
          {error && <div className="text-danger small mt-1">{error}</div>}
          {message && <div className="text-success small mt-1">{message}</div>}
        </div>
      )}
    </div>
  );
}

export default ViewCourse;
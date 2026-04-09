import { toHttps } from '../utils/utils';
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import JSZip from 'jszip';
import AppLayout from '../components/Layout';
import { extendSession } from "../utils/utils";
import './CoursePreview.css';
import { UtilityModal } from '../components/UtilityModal';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isContainer = (entity) =>
  !entity?.type || entity.type === 'container' || entity.type === 'none';

const typeIcon = (t) => ({
  container: 'bi-folder',
  image: 'bi-image',
  video: 'bi-camera-video',
  audio: 'bi-music-note',
  document: 'bi-file-pdf',
  archive: 'bi-file-zip',
  text: 'bi-file-text',
  form: 'bi-ui-checks',
  other: 'bi-file-earmark',
})[t] || 'bi-file-earmark';

const typeColor = (t) => ({
  container: 'text-warning',
  image: 'text-success',
  video: 'text-primary',
  audio: 'text-warning',
  document: 'text-danger',
  archive: 'text-secondary',
  text: 'text-info',
  form: 'text-purple',
  other: 'text-muted',
})[t] || 'text-muted';

const BASE = toHttps(process.env.REACT_APP_API_URL?.replace('/api', '') || 'https://localhost:4040');
const fu = (url) => (!url || url.startsWith('http') ? url : `${BASE}${url}`);
const isYouTube = url => url && (/youtu\.be\/|youtube\.com\/(watch|shorts|embed)/.test(url));

const extractYouTubeId = url => {
  const short = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const watch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  const shorts = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
  const embed = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  return (short || watch || shorts || embed)?.[1] || null;
};

const YoutubeEmbed = ({ url }) => {
  const id = extractYouTubeId(url);
  if (!id) return <video src={fu(url)} controls className="video-player" />;
  return (
    <iframe
      src={`https://www.youtube.com/embed/${id}`}
      title="YouTube video player" frameBorder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      className="video-player"
    />
  );
};

const ENTITY_TYPE_OPTIONS = [
  { type: 'container', icon: 'bi-folder', label: 'Container' },
  { type: 'text', icon: 'bi-file-text', label: 'Text' },
  { type: 'form', icon: 'bi-ui-checks', label: 'Form' },
  { type: 'image', icon: 'bi-image', label: 'Image' },
  { type: 'video', icon: 'bi-camera-video', label: 'Video' },
  { type: 'audio', icon: 'bi-music-note', label: 'Audio' },
  { type: 'document', icon: 'bi-file-pdf', label: 'Document' },
  { type: 'archive', icon: 'bi-file-zip', label: 'Archive' },
];

const ITEM_TYPE_OPTIONS = [
  { type: 'text', icon: 'bi-file-text', label: 'Text' },
  { type: 'form', icon: 'bi-ui-checks', label: 'Form' },
  { type: 'image', icon: 'bi-image', label: 'Image' },
  { type: 'audio', icon: 'bi-music-note', label: 'Audio' },
  { type: 'video', icon: 'bi-camera-video', label: 'Video' },
  { type: 'document', icon: 'bi-file-pdf', label: 'Document' },
  { type: 'archive', icon: 'bi-file-zip', label: 'Archive' },
];

// ─── parseTextSyntax ──────────────────────────────────────────────────────────
function parseTextSyntax(text) {
  if (!text) return '';

  const encAttr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const encHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const codeBlocks = [];
  let html = text.replace(/~\(([^)]+)\)\[([\s\S]+?)\]~/g, (_, lang, code) => {
    const esc = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<div class="code-block"><div class="code-header"><span class="code-lang">${lang}</span>` +
      `<button class="code-copy-btn" onclick="(function(b){navigator.clipboard.writeText(b.closest('.code-block').querySelector('code').innerText);b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',2000)})(this)">Copy</button></div>` +
      `<pre><code>${esc}</code></pre></div>`
    );
    return `\x00CODE${idx}\x00`;
  });

  const btns = [];
  html = html.replace(/\[btn:([^\|]+)\|([^\]]+)\]/g, (_, label, af) => {
    const isArrow = /^\s*(\(.*?\)|[\w$]+)\s*=>/.test(af);
    let a, p;
    if (isArrow) { a = af.trim(); p = ''; }
    else { const ci = af.indexOf(':'); a = ci === -1 ? af.trim() : af.slice(0, ci).trim(); p = ci === -1 ? '' : af.slice(ci + 1).trim(); }
    const idx = btns.length;
    btns.push({ label, a, p });
    return `\x00BTN${idx}\x00`;
  });

  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

  html = html.replace(/~\(([^\|]+)\)\[([^\]]+)\]~/g, '<code type="$1">$2</code>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`\(([^`]+)\)`/g, '<code class="inline-code">$1</code>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h2>$1</h2>').replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/`\{([^}]+)\}`/g, '<p>$1</p>');
  html = html.replace(/\{(https?:\/\/[^}]+)\}/g, '<video src="$1" class="video-player" controls></video>');

  html = html.replace(/\((https?:\/\/[^)]+)\)/g, (_, u) => {
    const short = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    const watch = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    const shorts = u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
    const id = (short || watch || shorts)?.[1];
    const e = id ? `https://www.youtube.com/embed/${id}` : u;
    return `\n    <iframe src="${e}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  });

  html = html.replace(/!\[([^\|]+)\|(https?:\/\/[^\]]+)\]!/g, '<a href="$2" download class="text-download-link"><i class="bi bi-download"></i> $1</a>');
  html = html.replace(/@(https?:\/\/[^@]+)@/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
  html = html.replace(/#(https?:\/\/[^#]+)#/g, '<img alt="image" class="content-image" src="$1">');
  html = html.replace(/^(\d+)\.\s(.+)$/gm, '<li class="numbered-item">$2</li>').replace(/(<li class="numbered-item">.*?<\/li>\n?)+/gs, '<ol>$&</ol>');
  html = html.replace(/^[•\-\*]\s(.+)$/gm, '<li>$1</li>').replace(/(<li>.*?<\/li>\n?)+/gs, '<ul>$&</ul>');
  html = html.replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;').replace(/\\n/g, '<br>');

  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[+i]);
  html = html.replace(/\x00BTN(\d+)\x00/g, (_, i) => {
    const { label, a, p } = btns[+i];
    return `<button class="text-action-btn" data-action="${encAttr(a)}" data-params="${encAttr(p)}">${encHtml(label)}</button>`;
  });
  return html;
}

// ─── Main Component ───────────────────────────────────────────────────────────
function CoursePreview({ data, onLogout }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');

  const [locked, setLocked] = useState(true);

  // ── Promo state ────────────────────────────────────────────────────────────
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null);  // null | { valid, finalPrice, discount, ... }
  const [promoLoading, setPromoLoading] = useState(false);
  const [applyingPromo, setApplyingPromo] = useState(false);
  const [course, setCourse] = useState(null);
  const [author, setAuthor] = useState({});
  const [role, setRole] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedVolumes, setExpandedVolumes] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [expandedItems, setExpandedItems] = useState({});
  const [editMode, setEditMode] = useState(false);

  const [modal, setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null, danger: false });
  const closeModal = () => setModal(p => ({ ...p, show: false }));
  const showInfo = (title, message) => setModal({ show: true, type: 'info', title, message, onClose: closeModal });
  const showConfirm = (title, message, onConfirm, danger = false) => setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: closeModal });
  const [volumes, setVolumes] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [directions, setDirections] = useState([]);
  const [levels, setLevels] = useState([]);
  const [editableCourse, setEditableCourse] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // ── Language switcher (preview mode only) ──────────────────────────────────
  const [previewLangIdx, setPreviewLangIdx] = useState(0);
  const pt = (field) => course?.trans?.[previewLangIdx]?.[field] || course?.trans?.[0]?.[field] || '';

  // Resolve volumes for a given lang index: use trans[idx].volumes if non-empty, else base volumes
  const resolveVolumesForLang = (courseData, volsBase, langIdx) => {
    const raw = langIdx > 0 && courseData?.trans?.[langIdx]?.volumes?.length
      ? courseData.trans[langIdx].volumes
      : volsBase;
    return raw.map(v => ({
      ...v, type: v.type || 'container',
      chapters: (v.chapters || []).map(c => ({ ...c, type: c.type || 'container' }))
    }));
  };

  // previewVolumes: what the sidebar shows in preview mode (lang-aware)
  // In edit mode, `volumes` (base lang) is always used
  const [previewVolumes, setPreviewVolumes] = useState([]);
  const [textRefreshKey, setTextRefreshKey] = useState(0);
  const [localTextContent, setLocalTextContent] = useState({});
  const [textFilesToUpload, setTextFilesToUpload] = useState({});
  const [editingTitle, setEditingTitle] = useState(null);
  const [filesToDelete, setFilesToDelete] = useState([]);

  const [draggedVolume, setDraggedVolume] = useState(null);
  const [draggedChapter, setDraggedChapter] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);

  const [showAddItemModal, setShowAddItemModal] = useState(null);
  const [showFormModal, setShowFormModal] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingForm, setEditingForm] = useState(null);
  const [showAddEntityModal, setShowAddEntityModal] = useState(null);
  const [entityEdit, setEntityEdit] = useState(null);
  const [entityFormModal, setEntityFormModal] = useState(null);

  // ── Comments & Rating state ─────────────────────────────────────────────────
  const [cpComments, setCpComments] = useState([]);
  const [cpCommentsLoading, setCpCommentsLoading] = useState(false);
  const [cpCommentText, setCpCommentText] = useState('');
  const [cpCommentPosting, setCpCommentPosting] = useState(false);
  const [cpCommentPreview, setCpCommentPreview] = useState(false);
  const [cpSyntaxHelp, setCpSyntaxHelp] = useState(false);
  const [cpMyRating, setCpMyRating] = useState(null);   // 1-5 or null
  const [cpAvgRating, setCpAvgRating] = useState(0);
  const [cpTotalVotes, setCpTotalVotes] = useState(0);
  const [cpRatingHover, setCpRatingHover] = useState(null);
  const [cpRatingSubmitting, setCpRatingSubmitting] = useState(false);

  useEffect(() => { fetchData(); setRole(data.role); }, [id]);

  // When language switcher changes in preview mode, resolve the correct volumes
  useEffect(() => {
    if (!course) return;
    setPreviewVolumes(resolveVolumesForLang(course, volumes, previewLangIdx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewLangIdx, course]);
  useEffect(() => { if (course) { fetchUserData(); fetchCpComments(); fetchCpRating(); } }, [course?._id]);
  useEffect(() => {
    const h = e => { if (hasChanges) { e.preventDefault(); e.returnValue = 'Unsaved changes!'; } };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [hasChanges]);

  const fetchCpComments = async () => {
    setCpCommentsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/courses/${id}/comments`);
      if (res.ok) { const j = await res.json(); setCpComments(j.data || []); }
    } catch (e) { console.error('fetchCpComments:', e); }
    setCpCommentsLoading(false);
  };

  const fetchCpRating = async () => {
    const tok = localStorage.getItem('token');
    if (!tok) return;
    try {
      const res = await fetch(`${BASE}/api/courses/${id}/rating`, {
        headers: { Authorization: `${tok.split(' ')[0]} ${tok.split(' ')[1]}` }
      });
      if (res.ok) {
        const j = await res.json();
        setCpAvgRating(j.data?.avgRating || 0);
        setCpTotalVotes(j.data?.totalVotes || 0);
        setCpMyRating(j.data?.myRating || null);
      }
    } catch (e) { console.error('fetchCpRating:', e); }
  };

  const handleCpAddComment = async () => {
    if (!cpCommentText.trim() || cpCommentPosting) return;
    setCpCommentPosting(true);
    const tok = localStorage.getItem('token');
    try {
      const res = await fetch(`${BASE}/api/courses/${id}/comments`, {
        method: 'POST',
        headers: { Authorization: `${tok.split(' ')[0]} ${tok.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cpCommentText.trim() })
      });
      if (res.ok) { setCpCommentText(''); setCpCommentPreview(false); await fetchCpComments(); }
      else showInfo('Error', 'Failed to post comment.');
    } catch (e) { showInfo('Error', 'Network error.'); }
    setCpCommentPosting(false);
  };

  const handleCpDeleteComment = async (commentId) => {
    showConfirm('Delete Comment', 'Are you sure you want to delete this comment?', async () => {
      const tok = localStorage.getItem('token');
      try {
        const res = await fetch(`${BASE}/api/courses/${id}/comments/${commentId}`, {
          method: 'DELETE',
          headers: { Authorization: `${tok.split(' ')[0]} ${tok.split(' ')[1]}` }
        });
        if (res.ok) setCpComments(prev => prev.filter(c => c._id !== commentId));
      } catch (e) { console.error('delete comment:', e); }
    });
  };

  const handleCpRate = async (value) => {
    if (locked || cpRatingSubmitting) return;
    setCpRatingSubmitting(true);
    const tok = localStorage.getItem('token');
    try {
      const res = await fetch(`${BASE}/api/courses/${id}/rating`, {
        method: 'POST',
        headers: { Authorization: `${tok.split(' ')[0]} ${tok.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      });
      if (res.ok) {
        const j = await res.json();
        setCpMyRating(j.data.myRating);
        setCpAvgRating(j.data.avgRating);
        setCpTotalVotes(j.data.totalVotes);
      } else showInfo('Error', 'Could not submit rating.');
    } catch (e) { showInfo('Error', 'Network error.'); }
    setCpRatingSubmitting(false);
  };

  const checkCCourse = async (fetchedCourse) => {
    try {
      // Creator always gets access
      if (fetchedCourse?.userId && String(fetchedCourse.userId) === String(data._id)) {
        setLocked(false); return;
      }
      // Check purchased courses
      const res = await fetch(`${BASE}/api/users/${data._id}`, {
        headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` }
      });
      if (res.ok) {
        const { data: u } = await res.json();
        setLocked(!u.courses?.find(c => c._id === id));
      }
    } catch { setLocked(true); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [courseRes, dirRes, lvlRes, filesRes] = await Promise.all([
        fetch(`${BASE}/api/courses/${id}`).catch(() => null),
        fetch(`${BASE}/api/directions`).catch(() => null),
        fetch(`${BASE}/api/levels`).catch(() => null),
        fetch(`${BASE}/api/courses/${id}/files`, {
          headers: { 'Authorization': token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' }
        }).catch(() => null),
      ]);
      if (courseRes?.status === 401) await extendSession(data);
      if (courseRes?.ok) {
        const { data: d } = await courseRes.json();
        if (d) {
          setCourse(d);
          setEditableCourse({ ...d });
          const baseVols = (d.volumes || []).map(v => ({
            ...v, type: v.type || 'container',
            chapters: (v.chapters || []).map(c => ({ ...c, type: c.type || 'container' }))
          }));
          setVolumes(baseVols);
          setPreviewVolumes(baseVols); // start at base lang
          await checkCCourse(d); // ← pass course data directly, no race condition
        }
      }
      if (dirRes?.ok) { const d = await dirRes.json(); if (Array.isArray(d.data)) setDirections(d.data); }
      if (lvlRes?.ok) { const d = await lvlRes.json(); if (Array.isArray(d.data)) setLevels(d.data); }
      if (filesRes?.ok) {
        const d = await filesRes.json();
        setUploadedFiles((d.data || d.files || []).filter(f => {
          const n = (f.originalName || f.filename || '').toLowerCase();
          return !n.includes('thumbnail') && !/^vol-\d+-ch-\d+-item-\d+-\d+\.txt$/i.test(n);
        }));
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const fetchUserData = async () => {
    if (!course?.userId) return;
    try {
      const res = await fetch(`${BASE}/api/users/${course.userId}`, {
        headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` }
      });
      if (res.ok) { const { data: d } = await res.json(); setAuthor(d); }
    } catch { }
  };

  // ── Volume CRUD ────────────────────────────────────────────────────────────
  const saveNewVolume = (afterIndex, ed, vid) => {
    const newId = vid || `vol-${Date.now()}`;
    const nv = [...volumes];
    nv.splice(afterIndex + 1, 0, { vid: newId, title: ed.title || 'New Volume', type: ed.type || 'container', url: ed.url || '', chapters: [] });
    setVolumes(nv); setHasChanges(true);
    return newId;
  };

  const saveEditVolume = (vi, ed) => {
    const nv = [...volumes];
    nv[vi] = { ...nv[vi], title: ed.title || nv[vi].title, type: ed.type || nv[vi].type, url: ed.url !== undefined ? ed.url : nv[vi].url };
    setVolumes(nv); setHasChanges(true);
  };

  const deleteVolume = (vi) => {
    const v = volumes[vi];
    showConfirm('Delete Volume', `Delete volume "${v.title}"? This cannot be undone.`, () => {
      if (v.url) setFilesToDelete(p => [...p, v.url]);
      v.chapters?.forEach(ch => {
        if (ch.url) setFilesToDelete(p => [...p, ch.url]);
        ch.items?.forEach(item => { if (item.url) setFilesToDelete(p => [...p, item.url]); });
      });
      setVolumes(volumes.filter((_, i) => i !== vi)); setHasChanges(true);
      showInfo('Deleted', 'Volume deleted.');
    }, true);
  };

  const updateVolumeTitle = (vi, title) => {
    const nv = [...volumes]; nv[vi].title = title; setVolumes(nv); setHasChanges(true);
  };

  // ── Chapter CRUD ───────────────────────────────────────────────────────────
  const saveNewChapter = (vi, afterIndex, ed, cid) => {
    const newId = cid || `ch-${Date.now()}`;
    const nv = [...volumes];
    nv[vi].chapters.splice(afterIndex + 1, 0, { cid: newId, title: ed.title || 'New Chapter', type: ed.type || 'container', url: ed.url || '', items: [] });
    setVolumes(nv); setHasChanges(true);
    return newId;
  };

  const saveEditChapter = (vi, ci, ed) => {
    const nv = [...volumes];
    nv[vi].chapters[ci] = { ...nv[vi].chapters[ci], title: ed.title || nv[vi].chapters[ci].title, type: ed.type || nv[vi].chapters[ci].type, url: ed.url !== undefined ? ed.url : nv[vi].chapters[ci].url };
    setVolumes(nv); setHasChanges(true);
  };

  const deleteChapter = (vi, ci) => {
    const ch = volumes[vi].chapters[ci];
    showConfirm('Delete Chapter', `Delete chapter "${ch.title}"? This cannot be undone.`, () => {
      if (ch.url) setFilesToDelete(p => [...p, ch.url]);
      ch.items?.forEach(item => { if (item.url) setFilesToDelete(p => [...p, item.url]); });
      const nv = [...volumes]; nv[vi].chapters = nv[vi].chapters.filter((_, i) => i !== ci);
      setVolumes(nv); setHasChanges(true);
      showInfo('Deleted', 'Chapter deleted.');
    }, true);
  };

  const updateChapterTitle = (vi, ci, title) => {
    const nv = [...volumes]; nv[vi].chapters[ci].title = title; setVolumes(nv); setHasChanges(true);
  };

  // ── Schedule entity text/form file ────────────────────────────────────────
  const _scheduleEntityFile = (entityId, kind, content, isForm, vi, ci) => {
    const key = `entity-${entityId}`;
    const payload = isForm ? JSON.stringify(content) : content;
    const mime = isForm ? 'application/json' : 'text/plain';
    const ext = isForm ? '-form.json' : '.txt';
    const blob = new Blob([payload], { type: mime });
    const file = new File([blob], `${key}${ext}`, { type: mime });
    setTextFilesToUpload(p => ({ ...p, [key]: { file, entityId, kind, vi, ci, isEntity: true } }));
    if (!isForm) setLocalTextContent(p => ({ ...p, [entityId]: content }));
  };

  // ── Entity modal dispatcher ────────────────────────────────────────────────
  const handleEntitySave = (ed) => {
    if (showAddEntityModal) {
      const { kind, vi, afterIndex } = showAddEntityModal;
      const newId = kind === 'volume' ? `vol-${Date.now()}` : `ch-${Date.now()}`;
      if (kind === 'volume') saveNewVolume(afterIndex, ed, newId);
      if (kind === 'chapter') saveNewChapter(vi, afterIndex, ed, newId);
      if (ed.type === 'text' && ed.content)
        _scheduleEntityFile(
          newId, kind, ed.content, false,
          kind === 'volume' ? afterIndex + 1 : vi,
          kind === 'chapter' ? afterIndex + 1 : undefined
        );
      setShowAddEntityModal(null);
    } else if (entityEdit) {
      const { kind, vi, ci } = entityEdit;
      if (kind === 'volume') saveEditVolume(vi, ed);
      if (kind === 'chapter') saveEditChapter(vi, ci, ed);
      if (ed.type === 'text' && ed.content !== undefined) {
        const entityId = kind === 'volume' ? volumes[vi]?.vid : volumes[vi]?.chapters[ci]?.cid;
        if (entityId) _scheduleEntityFile(entityId, kind, ed.content, false, vi, ci);
      }
      setEntityEdit(null);
    }
  };

  // ── Entity form modal dispatcher ───────────────────────────────────────────
  const handleEntityFormSave = (formData) => {
    if (!entityFormModal) return;
    const { kind, vi, afterIndex } = entityFormModal;
    const newId = kind === 'volume' ? `vol-${Date.now()}` : `ch-${Date.now()}`;
    const nv = [...volumes];
    if (kind === 'volume') {
      nv.splice(afterIndex + 1, 0, { vid: newId, title: formData.title, type: 'form', url: '', chapters: [] });
    } else {
      nv[vi].chapters.splice(afterIndex + 1, 0, { cid: newId, title: formData.title, type: 'form', url: '', items: [] });
    }
    setVolumes(nv);
    _scheduleEntityFile(
      newId, kind, formData.formData, true,
      kind === 'volume' ? afterIndex + 1 : vi,
      kind === 'chapter' ? afterIndex + 1 : undefined
    );
    setEntityFormModal(null);
    setHasChanges(true);
  };

  const openAddItem = (vi, ci, type) => {
    if (type === 'form') setShowFormModal({ vi, ci });
    else setShowAddItemModal({ vi, ci, type });
  };

  const _scheduleFile = (itemData, item, vi, ci) => {
    if ((itemData.type === 'text' && itemData.content) || (itemData.type === 'form' && itemData.formData)) {
      const vId = vi !== null ? volumes[vi]?.vid : 'course';
      const cId = ci !== null ? volumes[vi]?.chapters[ci]?.cid : 'root';
      const key = `${vId}-${cId}-${item.iid}`;
      const isForm = itemData.type === 'form';
      const blob = new Blob([isForm ? JSON.stringify(itemData.formData) : itemData.content], { type: isForm ? 'application/json' : 'text/plain' });
      const fname = `${key}${isForm ? '-form.json' : '.txt'}`;
      setTextFilesToUpload(prev => ({ ...prev, [key]: { file: new File([blob], fname, { type: isForm ? 'application/json' : 'text/plain' }), itemId: item.iid, vi, ci } }));
    }
  };

  const saveContentItem = (vi, ci, itemData, afterIndex) => {
    const newItem = { iid: `item-${Date.now()}`, type: itemData.type, title: itemData.title, url: itemData.url || '' };
    const nv = [...volumes];
    const items = nv[vi].chapters[ci].items;
    items.splice(afterIndex !== undefined ? afterIndex + 1 : items.length, 0, newItem);
    setVolumes(nv);
    _scheduleFile(itemData, newItem, vi, ci);
    if (itemData.type === 'text' && itemData.content !== undefined)
      setLocalTextContent(prev => ({ ...prev, [newItem.iid]: itemData.content }));
    setShowAddItemModal(null); setShowFormModal(null); setHasChanges(true);
  };

  const updateContentItem = (vi, ci, ii, itemData) => {
    const nv = [...volumes];
    const orig = nv[vi].chapters[ci].items[ii];
    const updated = { ...orig, type: itemData.type, title: itemData.title, url: itemData.url || orig.url || '' };
    nv[vi].chapters[ci].items[ii] = updated;
    setVolumes(nv);
    _scheduleFile(itemData, updated, vi, ci);
    if (itemData.type === 'text' && itemData.content !== undefined)
      setLocalTextContent(prev => ({ ...prev, [updated.iid]: itemData.content }));
    setEditingItem(null); setEditingForm(null); setHasChanges(true);
  };

  const deleteContentItem = (vi, ci, ii) => {
    showConfirm('Delete Item', 'Delete this item?', async () => {
      const item = volumes[vi].chapters[ci].items[ii];
      if (item.url) setFilesToDelete(p => [...p, item.url]);
      const nv = [...volumes]; nv[vi].chapters[ci].items.splice(ii, 1);
      setVolumes(nv); setHasChanges(true);
    })
  };

  const updateItemTitle = (vi, ci, ii, title) => {
    const nv = [...volumes]; nv[vi].chapters[ci].items[ii].title = title; setVolumes(nv); setHasChanges(true);
  };

  // ── Drag ───────────────────────────────────────────────────────────────────
  const handleDragOver = e => { if (!editMode) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
  const handleVolumeDragStart = (e, i) => { if (!editMode) return; setDraggedVolume(i); e.dataTransfer.effectAllowed = 'move'; };
  const handleVolumeDrop = (e, t) => { if (!editMode || draggedVolume === null) return; e.preventDefault(); const nv = [...volumes]; const [m] = nv.splice(draggedVolume, 1); nv.splice(t, 0, m); setVolumes(nv); setDraggedVolume(null); setHasChanges(true); };
  const handleChapterDragStart = (e, vi, ci) => { if (!editMode) return; setDraggedChapter({ vi, ci }); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); };
  const handleChapterDrop = (e, tvi, tci) => { if (!editMode || !draggedChapter) return; e.preventDefault(); e.stopPropagation(); const nv = [...volumes]; const [m] = nv[draggedChapter.vi].chapters.splice(draggedChapter.ci, 1); nv[tvi].chapters.splice(tci, 0, m); setVolumes(nv); setDraggedChapter(null); setHasChanges(true); };
  const handleItemDragStart = (e, vi, ci, ii) => { if (!editMode) return; setDraggedItem({ vi, ci, ii }); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); };
  const handleItemDrop = (e, tvi, tci, tii) => {
    if (!editMode || !draggedItem) return; e.preventDefault(); e.stopPropagation();
    if (draggedItem.vi !== tvi || draggedItem.ci !== tci) { setDraggedItem(null); return; }
    const nv = [...volumes]; const [m] = nv[draggedItem.vi].chapters[draggedItem.ci].items.splice(draggedItem.ii, 1); nv[tvi].chapters[tci].items.splice(tii, 0, m); setVolumes(nv); setDraggedItem(null); setHasChanges(true);
  };

  // ── Course field helpers ───────────────────────────────────────────────────
  const handleCourseFieldChange = (f, v) => { setEditableCourse(p => ({ ...p, [f]: v })); setHasChanges(true); };
  const handleSkillChange = (i, v) => { const t = editableCourse.trans ? [...editableCourse.trans] : [{}]; const s = [...(t[0]?.skills || [])]; s[i] = v; t[0] = { ...t[0], skills: s }; setEditableCourse(p => ({ ...p, trans: t })); setHasChanges(true); };
  const addSkill = () => { setEditableCourse(p => { const t = p.trans ? [...p.trans] : [{}]; t[0] = { ...t[0], skills: [...(t[0]?.skills || []), ''] }; return { ...p, trans: t }; }); setHasChanges(true); };
  const removeSkill = (i) => { setEditableCourse(p => { const t = p.trans ? [...p.trans] : [{}]; t[0] = { ...t[0], skills: (t[0]?.skills || []).filter((_, x) => x !== i) }; return { ...p, trans: t }; }); setHasChanges(true); };
  const handleThumbnailChange = e => {
    const file = e.target.files[0]; if (!file) return;
    const r = new FileReader(); r.onloadend = () => { setEditableCourse(p => ({ ...p, thumbnail: r.result })); setHasChanges(true); }; r.readAsDataURL(file);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  // NOTE: localTextContent is NOT cleared here — cleared only after fetchData completes
  const resetUnsaved = () => {
    setTextFilesToUpload({});
    setHasChanges(false);
    setTextRefreshKey(k => k + 1);
  };

  const handleSaveChanges = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const urlUpdates = {};

      if (Object.keys(textFilesToUpload).length) {
        const results = await Promise.all(Object.entries(textFilesToUpload).map(async ([key, fd]) => {
          const form = new FormData(); form.append('file', fd.file);
          const res = await fetch(`${BASE}/api/manage/courses/${id}/files`, {
            method: 'POST',
            headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` },
            body: form
          }).catch(() => null);
          if (res?.ok) {
            const r = await res.json();
            const url = r.data?.link?.url || r.data?.url || r.data?.path
              || r.data?.file?.url || r.data?.file?.path
              || r.url || r.path || r.link?.url;
            if (url) urlUpdates[key] = { url, ...fd };
          }
          return !!res?.ok;
        }));

        if (results.some(ok => !ok)) {
          showInfo('Warning', 'Some files failed. Changes discarded.');
          resetUnsaved(); setLocalTextContent({}); await fetchData(); return;
        }
      }

      // Apply uploaded URLs back onto volumes/chapters/items
      const applyEntityUrl = (entity) => {
        const eid = entity.vid || entity.cid;
        const key = `entity-${eid}`;
        if (urlUpdates[key]) return { ...entity, url: urlUpdates[key].url };
        return entity;
      };

      const applyItemUrls = items => items.map(item => {
        const m = Object.values(urlUpdates).find(u => u.itemId === item.iid);
        return m ? { ...item, url: m.url } : item;
      });

      const newVolumes = volumes.map(v => {
        const updatedVol = applyEntityUrl(v);
        return {
          ...updatedVol,
          chapters: updatedVol.chapters.map(c => {
            const updatedCh = applyEntityUrl(c);
            return { ...updatedCh, items: applyItemUrls(updatedCh.items) };
          })
        };
      });

      const res = await fetch(`${BASE}/api/manage/courses/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editableCourse, volumes: newVolumes })
      });

      if (res.ok) {
        setCourse({ ...editableCourse, volumes: newVolumes });
        setEditableCourse({ ...editableCourse, volumes: newVolumes });
        setVolumes(newVolumes);
        resetUnsaved();
        setEditMode(false);
        await fetchData();
        setLocalTextContent({}); // clear AFTER reload so content stays visible during save
        showInfo('Saved', 'Course saved successfully!');
        if (filesToDelete.length) {
          await Promise.allSettled(filesToDelete.map(url =>
            fetch(`${BASE}/api/manage/courses/${id}/files`, {
              method: 'DELETE',
              headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ url })
            })
          ));
          setFilesToDelete([]);
        }
      } else {
        showInfo('Error', `Server error ${res.status}. Changes discarded.`);
        resetUnsaved(); setLocalTextContent({}); await fetchData();
      }
    } catch (e) {
      showInfo('Error', `Save failed: ${e.message}`);
      resetUnsaved(); setLocalTextContent({}); await fetchData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportZip = async () => {
    try {
      const zip = new JSZip();

      // Collect all URLs from course
      const allUrls = [];
      volumes.forEach(v => {
        if (v.url) allUrls.push(v.url);
        v.chapters?.forEach(c => {
          if (c.url) allUrls.push(c.url);
          c.items?.forEach(i => { if (i.url) allUrls.push(i.url); });
        });
      });
      if (editableCourse?.links?.[0]?.url) allUrls.push(editableCourse.links[0].url);

      // Fetch and add each file
      const urlMap = {};
      await Promise.allSettled(allUrls.map(async url => {
        try {
          const fullUrl = fu(url);
          const res = await fetch(fullUrl, { headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` } });
          if (!res.ok) return;
          const blob = await res.blob();
          const filename = `files/${url.split('/').pop()}`;
          zip.file(filename, blob);
          urlMap[url] = filename;
        } catch { }
      }));

      // Save course JSON with url map
      zip.file('course.json', JSON.stringify({ ...editableCourse, volumes, urlMap }, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${editableCourse.trans?.[0]?.title || 'course'}-backup.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { showInfo('Error', 'Export failed: ' + e.message); }
  };

  const handleImportZip = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    showConfirm('Overwrite', 'This will overwrite current course data. Continue?', async () => {
      try {
        const zip = await JSZip.loadAsync(file);

        const courseJson = await zip.file('course.json')?.async('string');
        if (!courseJson) { showInfo('Invalid Backup', 'Invalid backup: missing course.json'); return; }
        const { urlMap, volumes: bkVols, ...bkCourse } = JSON.parse(courseJson);

        // Re-upload all files and build new URL map
        const newUrlMap = {};
        await Promise.allSettled(Object.entries(urlMap).map(async ([origUrl, zipPath]) => {
          try {
            const blob = await zip.file(zipPath)?.async('blob');
            if (!blob) return;
            const form = new FormData();
            form.append('file', new File([blob], zipPath.split('/').pop()));
            const res = await fetch(`${BASE}/api/manage/courses/${id}/files`, {
              method: 'POST',
              headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}` },
              body: form
            });
            if (res.ok) {
              const r = await res.json();
              const newUrl = r.data?.link?.url || r.data?.url || r.data?.path || r.url;
              if (newUrl) newUrlMap[origUrl] = newUrl;
            }
          } catch { }
        }));

        // Remap URLs in volumes
        const remapUrl = url => newUrlMap[url] || url;
        const remappedVolumes = bkVols.map(v => ({
          ...v, url: remapUrl(v.url),
          chapters: v.chapters?.map(c => ({
            ...c, url: remapUrl(c.url),
            items: c.items?.map(i => ({ ...i, url: remapUrl(i.url) }))
          }))
        }));

        const updatedCourse = { ...bkCourse, volumes: remappedVolumes };
        const res = await fetch(`${BASE}/api/manage/courses/${id}`, {
          method: 'PUT',
          headers: { 'Authorization': `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedCourse)
        });

        if (res.ok) { showInfo('Success', 'Import successful!'); await fetchData(); }
        else showInfo('Error', 'Import failed: server error ' + res.status);
      } catch (err) { showInfo('Error', 'Import failed: ' + err.message); }
      e.target.value = '';
    })
  };

  const handleAddToCart = () => showInfo('Cart', `Added "${course.trans?.[0]?.title}" to cart!`);
  const handleEnroll = () => showInfo('Enrolled', `Enrolled in "${course.trans?.[0]?.title}"!`);

  const handleValidatePromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true); setPromoResult(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + '/promos/validate', {
        method: 'POST',
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), courseId: id })
      });
      const json = await res.json();
      setPromoResult(json);
    } catch (e) { setPromoResult({ valid: false, reason: 'Network error' }); }
    setPromoLoading(false);
  };

  const handleApplyPromo = async () => {
    if (!promoResult?.valid) return;
    setApplyingPromo(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch((toHttps(process.env.REACT_APP_API_URL || 'https://localhost:4040/api')) + '/promos/apply', {
        method: 'POST',
        headers: { Authorization: `${token.split(' ')[0]} ${token.split(' ')[1]}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: promoCode.trim().toUpperCase(), courseId: id })
      });
      const json = await res.json();
      if (res.ok) {
        showInfo('Success', json.message);
        setPromoCode(''); setPromoResult(null);
        // Re-fetch page to update locked state
        setTimeout(() => window.location.reload(), 1200);
      } else { showInfo('Error', json.message || 'Failed to apply promo'); }
    } catch (e) { showInfo('Error', 'Network error'); }
    setApplyingPromo(false);
  };
  const formatDate = ds => new Date(ds).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const renderStars = r => {
    const s = []; const f = Math.floor(r);
    for (let i = 0; i < f; i++) s.push(<i key={i} className="bi bi-star-fill text-warning"></i>);
    if (r % 1) s.push(<i key="h" className="bi bi-star-half text-warning"></i>);
    for (let i = 0; i < 5 - s.length; i++) s.push(<i key={`e${i}`} className="bi bi-star text-warning"></i>);
    return s;
  };

  if (loading) return <><div className="course-preview-loading"><div className="spinner-border text-primary"></div></div></>;
  if (!course) return (
    <AppLayout data={data} onLogout={onLogout} title="">
      <div className="course-preview-page">
        <button className="btn btn-outline-secondary btn-sm mb-3" onClick={() => navigate('/manage/courses')}>← Back to Courses</button>
        <div className="course-preview-error"><h3>Course not found</h3></div>
      </div>
    </AppLayout>
  );

  const hasContent = volumes.length > 0;

  const sharedItemProps = {
    editMode, locked, expandedItems, setExpandedItems, editingTitle, setEditingTitle,
    textRefreshKey, localTextContent, volumes: editMode ? volumes : previewVolumes, setExpandedChapters, setExpandedVolumes,
    onUpdateTitle: updateItemTitle,
    onEditItem: (vi, ci, ii) => setEditingItem({ vi, ci, ii, item: volumes[vi].chapters[ci].items[ii] }),
    onEditForm: (vi, ci, ii) => setEditingForm({ vi, ci, ii, item: volumes[vi].chapters[ci].items[ii] }),
    onDeleteItem: deleteContentItem,
    onDragStart: handleItemDragStart,
    onDragOver: handleDragOver,
    onDrop: handleItemDrop,
    onScrollToItem: (vi, ci, ii) => {
      const vol = volumes[vi];
      const ch = vol?.chapters[ci];
      const item = ch?.items[ii];
      if (!vol || !ch || !item) return;
      setExpandedVolumes(p => ({ ...p, [vol.vid]: true }));
      setExpandedChapters(p => ({ ...p, [ch.cid]: true }));
      setExpandedItems(p => ({ ...p, [item.iid]: true }));
      setTimeout(() => {
        const el = document.getElementById(`item-${item.iid}`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 150);
    },
  };

  return (
    <AppLayout data={data} onLogout={onLogout} title="">
      <div className="course-preview-page">
        <div className="d-flex align-items-center gap-3 mb-2">
          <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1" onClick={() => navigate('/manage/courses')}>
            <svg width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M15 8a.5.5 0 0 0-.5-.5H2.707l3.147-3.146a.5.5 0 1 0-.708-.708l-4 4a.5.5 0 0 0 0 .708l4 4a.5.5 0 0 0 .708-.708L2.707 8.5H14.5A.5.5 0 0 0 15 8z" /></svg>
            Back to Courses
          </button>
        </div>

        <div className="course-preview-container">
          <div className="content-wrapper">
            {/* ── Left: course info ── */}
            <div className="course-info-section">
              <div className="mobile-thumbnail">
                {editMode
                  ? <div className="thumbnail-upload"><input type="file" accept="image/*" onChange={handleThumbnailChange} id="mob-thumb" style={{ display: 'none' }} /><label htmlFor="mob-thumb" className="thumbnail-upload-label"><img src={fu(editableCourse.links[0].url)} alt="" /><div className="thumbnail-overlay"><i className="bi bi-camera"></i><span>Change Photo</span></div></label></div>
                  : <img src={fu(editableCourse.links[0].url)} alt="" />}
              </div>

              <div className="title-price-row">
                {/* Lang switcher — only in preview mode when course has extra langs */}
                {!editMode && course.add_langs?.length > 0 && (
                  <div className="d-flex gap-1 mb-2 flex-wrap">
                    {[course.base_lang, ...course.add_langs].map((lang, idx) => (
                      <button key={lang}
                        className={`btn btn-sm ${previewLangIdx === idx ? 'btn-primary' : 'btn-outline-secondary'}`}
                        style={{ fontSize: '.72rem', padding: '2px 10px', borderRadius: 999 }}
                        onClick={() => setPreviewLangIdx(idx)}>
                        {lang.toUpperCase()}
                        {idx === 0 && <span className="ms-1 opacity-50" style={{ fontSize: '.6rem' }}>base</span>}
                      </button>
                    ))}
                  </div>
                )}
                {editMode
                  ? <input type="text" className="form-control course-title-input" value={editableCourse.trans?.[0]?.title || ''} onChange={e => { const t = editableCourse.trans ? [...editableCourse.trans] : [{}]; t[0] = { ...t[0], title: e.target.value }; handleCourseFieldChange('trans', t); }} />
                  : <h1 className="course-title">{course.isPrivateCopy && <span className="text-warning me-1">[PRIVATE]</span>}{pt('title')}</h1>}
                <div className="mobile-price">
                  {editMode
                    ? <input type="number" className="form-control price-input" value={editableCourse.price} onChange={e => handleCourseFieldChange('price', parseFloat(e.target.value))} step="0.01" min="0" />
                    : (course.price > 0 ? '$' + course.price : 'Free')}
                </div>
              </div>

              <div className="badges-row">
                {editMode
                  ? <><select className="form-select badge-input" value={editableCourse.direction} onChange={e => handleCourseFieldChange('direction', e.target.value)}><option value="">Select Direction</option>{directions.map(d => <option key={d._id} value={d.directionName}>{d.directionName}</option>)}</select>
                    <select className="form-select badge-input" value={editableCourse.level} onChange={e => handleCourseFieldChange('level', e.target.value)}><option value="">Select Level</option>{levels.filter(l => l.directionName === editableCourse.direction).map(l => <option key={l._id} value={l.levelName}>{l.levelName}</option>)}</select>
                    <select className="form-select badge-input" value={editableCourse.courseType || 'SELF_TAUGHT'} onChange={e => handleCourseFieldChange('courseType', e.target.value)}>
                      <option value="SELF_TAUGHT">Self-Taught</option>
                      <option value="MENTORED">Mentored</option>
                      <option value="HOSTED">Hosted</option>
                    </select></>
                  : <><span className="badge badge-direction">{course.direction}</span><span className="badge badge-level">{course.level}</span><span className="badge" style={{ background: '#0dcaf0', color: '#000' }}>{course.courseType || 'SELF_TAUGHT'}</span></>}
              </div>

              <div className="description-box">
                {editMode ? <textarea className="form-control" value={editableCourse.trans?.[0]?.description || ''} onChange={e => { const t = editableCourse.trans ? [...editableCourse.trans] : [{}]; t[0] = { ...t[0], description: e.target.value }; handleCourseFieldChange('trans', t); }} rows="3" /> : <p>{pt('description')}</p>}
              </div>

              <div className="mobile-skills">
                <h4 className="section-title">What you'll learn</h4>
                <div className="skills-grid">
                  {editMode
                    ? <>{(editableCourse.trans?.[0]?.skills || []).map((s, i) => <div className="skill-item-edit" key={i}><input type="text" className="form-control skill-input" value={s} onChange={e => handleSkillChange(i, e.target.value)} /><button className="btn btn-sm btn-danger" onClick={() => removeSkill(i)}><i className="bi bi-x"></i></button></div>)}<button className="btn btn-sm btn-primary" onClick={addSkill}><i className="bi bi-plus"></i> Add Skill</button></>
                    : (pt('skills') || []).map((s, i) => <div className="skill-item" key={i}><i className="bi bi-check-circle-fill text-success"></i><span>{s}</span></div>)}
                </div>
              </div>

              <div className="ratings-section">
                <span className="rating-number">{cpAvgRating > 0 ? cpAvgRating.toFixed(1) : (course.ratings || 0)}</span>
                <div className="stars">
                  {[1, 2, 3, 4, 5].map(n => (
                    <i key={n} className={`bi ${(cpAvgRating || course.ratings) >= n ? 'bi-star-fill' : (cpAvgRating || course.ratings) >= n - 0.5 ? 'bi-star-half' : 'bi-star'} text-warning`}></i>
                  ))}
                </div>
                <span className="students-count">({cpTotalVotes} {cpTotalVotes === 1 ? 'rating' : 'ratings'})</span>
                {course.followers > 0 && <span className="students-count ms-2"><i className="bi bi-people me-1"></i>{course.followers} {course.followers === 1 ? 'student' : 'students'}</span>}
              </div>
              {!locked && (
                <div className="cp-inline-rate">
                  <span className="cp-rate-label">{cpMyRating ? 'Your rating:' : 'Rate:'}</span>
                  <div className="cp-stars-interactive">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button key={n} className={`cp-star-btn${(cpRatingHover || cpMyRating) >= n ? ' active' : ''}`}
                        onMouseEnter={() => setCpRatingHover(n)} onMouseLeave={() => setCpRatingHover(null)}
                        onClick={() => handleCpRate(n)} disabled={cpRatingSubmitting} title={`${n} star${n > 1 ? 's' : ''}`}>
                        <i className={`bi ${(cpRatingHover || cpMyRating) >= n ? 'bi-star-fill' : 'bi-star'}`}></i>
                      </button>
                    ))}
                  </div>
                  {cpMyRating && <span className="cp-rated-badge"><i className="bi bi-check-circle-fill me-1"></i>Rated</span>}
                  <button className="btn btn-outline-secondary btn-sm ms-2"
                    onClick={() => document.getElementById('cp-comments-anchor')?.scrollIntoView({ behavior: 'smooth' })}>
                    <i className="bi bi-chat-left-text me-1"></i>Comments
                    {cpComments.length > 0 && <span className="badge bg-primary ms-1">{cpComments.length}</span>}
                  </button>
                </div>
              )}

              <div className="course-meta">
                <span className="meta-item">Created by <strong>{
                  (author.role?.roleName === 'root' || author.role?.accessLevel === 'root' || author.nickname === 'root')
                    ? 'BADLYCODED.EDU'
                    : author.nickname
                }</strong></span>
                <span className="meta-divider">•</span>
                <span className="meta-item">Last updated {formatDate(course.updatedAt)}</span>
              </div>

              {locked
                ? <div className="mobile-buttons">
                  <button className="btn btn-primary btn-lg w-100 mb-2 " onClick={handleAddToCart}>Add to Cart</button>
                  <button className="btn btn-outline-secondary btn-lg w-100 disabled" onClick={handleEnroll}>Enroll Now</button>
                  <p className="guarantee-text">30-Day Money-Back Guarantee</p>
                </div>
                : <div className="mobile-buttons">
                  <button className="btn btn-primary btn-lg w-100 mb-2" onClick={handleAddToCart}>Add to Cart</button>
                  <button className="btn btn-outline-secondary btn-lg w-100" onClick={() => navigate(`/course/view/${id}`)}>View Course</button>
                </div>
              }

              <div className="desktop-skills section-card">
                <h4 className="section-title">What you'll learn</h4>
                <div className="skills-grid">
                  {editMode
                    ? <>{(editableCourse.trans?.[0]?.skills || []).map((s, i) => <div className="skill-item-edit" key={i}><input type="text" className="form-control skill-input" value={s} onChange={e => handleSkillChange(i, e.target.value)} /><button className="btn btn-sm btn-danger" onClick={() => removeSkill(i)}><i className="bi bi-x"></i></button></div>)}<button className="btn btn-sm btn-primary mt-2" onClick={addSkill}><i className="bi bi-plus"></i> Add Skill</button></>
                    : (course.trans?.[0]?.skills || []).map((s, i) => <div className="skill-item" key={i}><i className="bi bi-check-circle-fill text-success"></i><span>{s}</span></div>)}
                </div>
              </div>
            </div>

            {/* ── Right: purchase card ── */}
            <div className="purchase-card-column">
              <div className="purchase-card">
                <div className="course-thumbnail">
                  {editMode
                    ? <div className="thumbnail-upload"><input type="file" accept="image/*" onChange={handleThumbnailChange} id="desk-thumb" style={{ display: 'none' }} /><label htmlFor="desk-thumb" className="thumbnail-upload-label"><img src={fu(editableCourse.links[0].url)} alt="" /><div className="thumbnail-overlay"><i className="bi bi-camera"></i><span>Change Photo</span></div></label></div>
                    : <img src={fu(editableCourse.links[0].url)} alt="" />}
                </div>
                <div className="purchase-card-body">
                  <div className="price-section">
                    <h2 className="price">{editMode ? <input type="number" className="form-control price-input-desktop" value={editableCourse.price} onChange={e => handleCourseFieldChange('price', parseFloat(e.target.value))} step="0.01" min="0" /> : (course.price > 0 ? '$' + course.price : 'Free')}</h2>
                  </div>
                  {locked
                    ? <div className="purchase-buttons">
                      <button className="btn btn-primary btn-lg w-100 mb-2" onClick={handleAddToCart}>Add to Cart</button>
                      <button className="btn btn-outline-secondary btn-lg w-100 disabled" onClick={handleEnroll}>Enroll Now</button>
                    </div>
                    : <div className="purchase-buttons">
                      <button className="btn btn-primary btn-lg w-100 mb-2" onClick={handleAddToCart}>Add to Cart</button>
                      <button className="btn btn-outline-secondary btn-lg w-100" onClick={() => navigate(`/course/view/${id}`)}>View Course</button>
                    </div>
                  }
                  {locked && (
                    <>
                      <p className="guarantee-text">30-Day Money-Back Guarantee</p>
                      {/* ── Promo Code ── */}
                      <div className="mt-3">
                        <label className="form-label small fw-semibold text-muted">Have a promo code?</label>
                        <div className="input-group input-group-sm">
                          <input type="text" className="form-control text-uppercase"
                            placeholder="PROMO CODE" value={promoCode}
                            onChange={e => { setPromoCode(e.target.value.toUpperCase()); setPromoResult(null); }}
                            onKeyDown={e => e.key === 'Enter' && handleValidatePromo()} />
                          <button className="btn btn-outline-secondary" onClick={handleValidatePromo} disabled={promoLoading || !promoCode.trim()}>
                            {promoLoading ? <span className="spinner-border spinner-border-sm" /> : 'Apply'}
                          </button>
                        </div>
                        {promoResult && !promoResult.valid && (
                          <div className="text-danger small mt-1"><i className="bi bi-x-circle me-1"></i>{promoResult.reason}</div>
                        )}
                        {promoResult?.valid && (
                          <div className="mt-2 p-2 bg-success bg-opacity-10 border border-success rounded small">
                            <div className="text-success fw-semibold"><i className="bi bi-check-circle me-1"></i>Code valid!</div>
                            <div className="text-muted mt-1">
                              {promoResult.discountType === 'percent'
                                ? `${promoResult.discountValue}% off`
                                : `$${promoResult.discountValue} off`}
                              {' — '}
                              <span className="text-decoration-line-through">${promoResult.originalPrice}</span>
                              {' → '}
                              <strong>${promoResult.finalPrice}</strong>
                            </div>
                            <button className="btn btn-success btn-sm w-100 mt-2" onClick={handleApplyPromo} disabled={applyingPromo}>
                              {applyingPromo ? <><span className="spinner-border spinner-border-sm me-1" />Applying…</> : 'Enroll with Promo'}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ══ Course Content ══ */}
          <div className="course-content-section">
            {!locked && (
              <div className="admin-controls">
                <button className={`btn ${editMode ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => setEditMode(!editMode)}>
                  <i className="bi bi-pencil-square me-1"></i>{editMode ? 'Exit Edit Mode' : 'Edit Course'}
                </button>
                {hasChanges && (
                  <button className="btn btn-success ms-2" onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <><span className="spinner-border spinner-border-sm me-1"></span>Saving…</> : <><i className="bi bi-save me-1"></i>Save Changes</>}
                  </button>
                )}
                <button className="btn btn-outline-secondary ms-2" onClick={handleExportZip}>
                  <i className="bi bi-box-arrow-down me-1"></i>Export Backup
                </button>
                <label className="btn btn-outline-warning ms-2 mb-0">
                  <i className="bi bi-box-arrow-in-up me-1"></i>Import Backup
                  <input type="file" accept=".zip" onChange={handleImportZip} style={{ display: 'none' }} />
                </label>
              </div>
            )}

            <div className="section-card">
              <div className="section-header">
                <h4 className="section-title">Course Content</h4>
                {editMode && (
                  <EntityAddDropdown
                    label="Volume"
                    onAdd={type => type === 'form'
                      ? setEntityFormModal({ kind: 'volume', vi: null, afterIndex: volumes.length - 1 })
                      : setShowAddEntityModal({ kind: 'volume', vi: null, afterIndex: volumes.length - 1, preType: type })}
                  />
                )}
              </div>

              {!hasContent ? (
                <div className="no-content">
                  <i className="bi bi-inbox"></i><p>No content found/loaded</p>
                  {editMode && (
                    <EntityAddDropdown
                      label="First Volume"
                      onAdd={type => type === 'form'
                        ? setEntityFormModal({ kind: 'volume', vi: null, afterIndex: -1 })
                        : setShowAddEntityModal({ kind: 'volume', vi: null, afterIndex: -1, preType: type })}
                    />
                  )}
                </div>
              ) : (
                <div className="volumes-list">
                  {(editMode ? volumes : previewVolumes).map((volume, vi) =>
                    isContainer(volume)
                      ? (
                        <div key={volume.vid} id={`volume-${volume.vid}`}
                          className={`volume-item ${editMode ? 'draggable' : ''}`}
                          draggable={editMode}
                          onDragStart={e => handleVolumeDragStart(e, vi)} onDragOver={handleDragOver} onDrop={e => handleVolumeDrop(e, vi)}>

                          <div className="volume-header" onClick={() => !editMode && setExpandedVolumes(p => ({ ...p, [volume.vid]: !p[volume.vid] }))}>
                            {editMode ? <i className="bi bi-grip-vertical drag-handle me-2"></i> : <i className={`bi bi-chevron-${expandedVolumes[volume.vid] ? 'down' : 'right'} me-2`}></i>}
                            <i className="bi bi-folder text-warning me-2"></i>
                            {editMode && editingTitle?.type === 'volume' && editingTitle?.vi === vi
                              ? <input className="form-control title-edit-input" value={volume.title} onChange={e => updateVolumeTitle(vi, e.target.value)} onBlur={() => setEditingTitle(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(null); }} autoFocus onClick={e => e.stopPropagation()} />
                              : <span className="volume-title-text">{volume.title}</span>}
                            <span className="volume-count">{volume.chapters.length} {volume.chapters.length === 1 ? 'chapter' : 'chapters'}</span>
                            {editMode && (
                              <div className="header-actions" onClick={e => e.stopPropagation()}>
                                <EntityAddDropdown
                                  label="Chapter"
                                  onAdd={type => type === 'form'
                                    ? setEntityFormModal({ kind: 'chapter', vi, afterIndex: volume.chapters.length - 1 })
                                    : setShowAddEntityModal({ kind: 'chapter', vi, afterIndex: volume.chapters.length - 1, preType: type })}
                                />
                                <button className="btn btn-sm btn-outline-primary" onClick={() => setEntityEdit({ kind: 'volume', vi, entity: volume })}><i className="bi bi-pencil"></i></button>
                                <button className="btn btn-sm btn-outline-danger" onClick={() => deleteVolume(vi)}><i className="bi bi-trash"></i></button>
                              </div>
                            )}
                          </div>

                          {(expandedVolumes[volume.vid] || editMode) && (
                            <div className="volume-content">
                              {volume.chapters.length === 0
                                ? <div className="no-content-small"><p>No chapters in this volume</p></div>
                                : (
                                  <div className={`chapters-list ${locked ? 'muted blocked' : ''}`}>
                                    {volume.chapters.map((chapter, ci) =>
                                      isContainer(chapter)
                                        ? (
                                          <div key={chapter.cid} id={`chapter-${chapter.cid}`}
                                            className={`chapter-item ${editMode ? 'draggable' : ''}`}
                                            draggable={editMode}
                                            onDragStart={e => handleChapterDragStart(e, vi, ci)} onDragOver={handleDragOver} onDrop={e => handleChapterDrop(e, vi, ci)}>

                                            <div className="chapter-header" onClick={() => !editMode && setExpandedChapters(p => ({ ...p, [chapter.cid]: !p[chapter.cid] }))}>
                                              {editMode ? <i className="bi bi-grip-vertical drag-handle me-2"></i> : <i className={`bi bi-chevron-${expandedChapters[chapter.cid] ? 'down' : 'right'} me-2`}></i>}
                                              {editMode && editingTitle?.type === 'chapter' && editingTitle?.vi === vi && editingTitle?.ci === ci
                                                ? <input className="form-control title-edit-input" value={chapter.title} onChange={e => updateChapterTitle(vi, ci, e.target.value)} onBlur={() => setEditingTitle(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(null); }} autoFocus onClick={e => e.stopPropagation()} />
                                                : <span className="chapter-title-text">{chapter.title}</span>}
                                              <span className="chapter-count">{chapter.items.length} {chapter.items.length === 1 ? 'item' : 'items'}</span>
                                              {editMode && (
                                                <div className="header-actions" onClick={e => e.stopPropagation()}>
                                                  <ItemAddDropdown onAdd={type => openAddItem(vi, ci, type)} />
                                                  <button className="btn btn-sm btn-outline-primary" onClick={() => setEntityEdit({ kind: 'chapter', vi, ci, entity: chapter })}><i className="bi bi-pencil"></i></button>
                                                  <button className="btn btn-sm btn-outline-danger" onClick={() => deleteChapter(vi, ci)}><i className="bi bi-trash"></i></button>
                                                </div>
                                              )}
                                            </div>

                                            {(expandedChapters[chapter.cid] || editMode) && !locked && (
                                              <div className="chapter-content">
                                                {chapter.items.length === 0 && !editMode && <div className="no-content-small"><p>No content in this chapter</p></div>}
                                                {chapter.items.map((item, ii) => (
                                                  <ContentItemView key={item.iid} item={item} ii={ii} vi={vi} ci={ci} {...sharedItemProps} />
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        )
                                        : (
                                          <ContentEntityView
                                            key={chapter.cid} entity={chapter} entityId={chapter.cid}
                                            editMode={editMode} locked={locked}
                                            expanded={!!expandedChapters[chapter.cid]}
                                            onToggle={() => setExpandedChapters(p => ({ ...p, [chapter.cid]: !p[chapter.cid] }))}
                                            onEdit={() => setEntityEdit({ kind: 'chapter', vi, ci, entity: chapter })}
                                            onDelete={() => deleteChapter(vi, ci)}
                                            draggable={editMode}
                                            onDragStart={e => handleChapterDragStart(e, vi, ci)} onDragOver={handleDragOver} onDrop={e => handleChapterDrop(e, vi, ci)}
                                            textRefreshKey={textRefreshKey} localTextContent={localTextContent}
                                            volumes={volumes} setExpandedChapters={setExpandedChapters} setExpandedVolumes={setExpandedVolumes}
                                          />
                                        )
                                    )}
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      )
                      : (
                        <ContentEntityView
                          key={volume.vid} entity={volume} entityId={volume.vid}
                          editMode={editMode} locked={locked}
                          expanded={!!expandedVolumes[volume.vid]}
                          onToggle={() => setExpandedVolumes(p => ({ ...p, [volume.vid]: !p[volume.vid] }))}
                          onEdit={() => setEntityEdit({ kind: 'volume', vi, entity: volume })}
                          onDelete={() => deleteVolume(vi)}
                          draggable={editMode}
                          onDragStart={e => handleVolumeDragStart(e, vi)} onDragOver={handleDragOver} onDrop={e => handleVolumeDrop(e, vi)}
                          textRefreshKey={textRefreshKey} localTextContent={localTextContent}
                          volumes={volumes} setExpandedChapters={setExpandedChapters} setExpandedVolumes={setExpandedVolumes}
                        />
                      )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Comments (under course content) ── */}
      <div className="cp-comments-section" id="cp-comments-anchor">
        <div className="cp-comments">
          <h3 className="cp-comments-title">
            <i className="bi bi-chat-left-text me-2"></i>
            Comments {cpComments.length > 0 && <span className="cp-comments-count">{cpComments.length}</span>}
          </h3>

          {!locked && (
            <div className="cp-comment-compose">
              <div className="cp-compose-tabs">
                <button className={`cp-compose-tab${!cpCommentPreview ? ' cp-compose-tab--active' : ''}`} onClick={() => setCpCommentPreview(false)}>Write</button>
                <button className={`cp-compose-tab${cpCommentPreview ? ' cp-compose-tab--active' : ''}`} onClick={() => setCpCommentPreview(true)} disabled={!cpCommentText.trim()}>Preview</button>
                <button className={`cp-compose-tab cp-compose-tab--help${cpSyntaxHelp ? ' cp-compose-tab--active' : ''}`} onClick={() => setCpSyntaxHelp(p => !p)} title="Formatting syntax reference"><i className="bi bi-question-circle me-1"></i>Syntax</button>
              </div>
              {cpSyntaxHelp && (
                <div className="cp-syntax-help">
                  <div className="cp-syntax-grid">
                    <span><code># Heading 1</code></span><span>Large heading</span>
                    <span><code>**bold**</code></span><span>Bold text</span>
                    <span><code>*italic*</code></span><span>Italic text</span>
                    <span><code>`(inline code)`</code></span><span>Inline code</span>
                    <span><code>~(js)[code]~</code></span><span>Code block</span>
                    <span><code>- item</code></span><span>Bullet list</span>
                    <span><code>[text](url)</code></span><span>Link</span>
                  </div>
                </div>
              )}
              {cpCommentPreview
                ? <div className="cp-comment-preview" dangerouslySetInnerHTML={{ __html: parseTextSyntax(cpCommentText) }} />
                : <textarea className="cp-comment-textarea" rows={4}
                  placeholder={"Write a comment…\nSupports: # headings, **bold**, *italic*, `(code)` or ~(lang)[…]~, etc."}
                  value={cpCommentText} onChange={e => setCpCommentText(e.target.value)} maxLength={4000} />
              }
              <div className="cp-compose-footer">
                <span className="cp-char-count">{cpCommentText.length} / 4000</span>
                <button className="btn btn-primary btn-sm cp-compose-submit" onClick={handleCpAddComment} disabled={!cpCommentText.trim() || cpCommentPosting}>
                  {cpCommentPosting ? <><span className="spinner-border spinner-border-sm me-1"></span>Posting…</> : <><i className="bi bi-send me-1"></i>Post</>}
                </button>
              </div>
            </div>
          )}

          {cpCommentsLoading ? (
            <div className="cp-comments-loading"><span className="spinner-border spinner-border-sm me-2"></span>Loading…</div>
          ) : cpComments.length === 0 ? (
            <p className="cp-comments-empty">No comments yet{locked ? '.' : ' — be the first!'}</p>
          ) : (
            <div className="cp-comment-list">
              {cpComments.map(comment => {
                const al = data?.role?.accessLevel;
                const rn = data?.role?.roleName;
                const isElevated = al === 'manage' || al === 'admin' || al === 'root' || rn === 'root';
                const isAuthor = data?._id && String(data._id) === String(comment.userId);
                return (
                  <div key={comment._id} className="cp-comment">
                    <div className="cp-comment-header">
                      <span className="cp-comment-author"><i className="bi bi-person-circle me-1"></i>{comment.nickname}</span>
                      <span className="cp-comment-date">{new Date(comment.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      {(isAuthor || isElevated) && (
                        <button className="cp-comment-delete" onClick={() => handleCpDeleteComment(comment._id)} title="Delete comment"><i className="bi bi-trash"></i></button>
                      )}
                    </div>
                    <div className="cp-comment-body" dangerouslySetInnerHTML={{ __html: parseTextSyntax(comment.text) }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {(showAddEntityModal || entityEdit) && (
        <AddEntityModal
          kind={showAddEntityModal?.kind || entityEdit?.kind}
          initial={entityEdit?.entity || null}
          preType={showAddEntityModal?.preType || null}
          uploadedFiles={uploadedFiles}
          initialTextContent={entityEdit?.entity ? localTextContent[entityEdit.entity.vid || entityEdit.entity.cid] : undefined}
          onSave={handleEntitySave}
          onClose={() => { setShowAddEntityModal(null); setEntityEdit(null); }}
        />
      )}
      {showAddItemModal && (
        <AddItemModal type={showAddItemModal.type}
          onSave={d => saveContentItem(showAddItemModal.vi, showAddItemModal.ci, d, showAddItemModal.afterIndex)}
          onClose={() => setShowAddItemModal(null)} uploadedFiles={uploadedFiles} />
      )}
      {editingItem && (
        <AddItemModal type={editingItem.item.type} isEditing initialData={editingItem.item}
          onSave={d => updateContentItem(editingItem.vi, editingItem.ci, editingItem.ii, d)}
          onClose={() => setEditingItem(null)} uploadedFiles={uploadedFiles} />
      )}
      {entityFormModal && (
        <FormEditorModal uploadedFiles={uploadedFiles}
          onSave={handleEntityFormSave}
          onClose={() => setEntityFormModal(null)} />
      )}
      {editingForm && (
        <FormEditorModal isEditing initialItem={editingForm.item} uploadedFiles={uploadedFiles}
          onSave={d => updateContentItem(editingForm.vi, editingForm.ci, editingForm.ii, d)}
          onClose={() => setEditingForm(null)} />
      )}
      <UtilityModal show={modal.show} type={modal.type} title={modal.title} message={modal.message}
        onConfirm={() => { modal.onConfirm?.(); closeModal(); }} onCancel={modal.onCancel || closeModal} onClose={closeModal} />
    </AppLayout>
  );
}

// ─── Item Add Dropdown ────────────────────────────────────────────────────────
function ItemAddDropdown({ onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="item-add-dropdown-wrapper" onClick={e => e.stopPropagation()}>
      <button className="btn btn-sm btn-outline-success" onClick={() => setOpen(!open)}>
        <i className="bi bi-plus-circle me-1"></i>Item
      </button>
      {open && (
        <div className="item-add-dropdown-menu">
          {ITEM_TYPE_OPTIONS.map(({ type, icon, label }) => (
            <button key={type} className="item-add-dropdown-option" onClick={() => { onAdd(type); setOpen(false); }}>
              <i className={`bi ${icon} me-1`}></i>{label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entity Add Dropdown ──────────────────────────────────────────────────────
function EntityAddDropdown({ onAdd, label = 'Add' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div ref={ref} className="item-add-dropdown-wrapper" onClick={e => e.stopPropagation()}>
      <button className="btn btn-sm btn-outline-success" onClick={() => setOpen(!open)}>
        <i className="bi bi-plus-circle me-1"></i>{label}
      </button>
      {open && (
        <div className="item-add-dropdown-menu">
          {ENTITY_TYPE_OPTIONS.map(({ type, icon, label: lbl }) => (
            <button key={type} className="item-add-dropdown-option" onClick={() => { onAdd(type); setOpen(false); }}>
              <i className={`bi ${icon} me-1`}></i>{lbl}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Entity Modal ─────────────────────────────────────────────────────────
function AddEntityModal({ kind, initial, preType, uploadedFiles, initialTextContent, onSave, onClose }) {
  const [title, setTitle] = useState(initial?.title || '');
  const [type, setType] = useState(initial?.type || preType || 'container');
  const [url, setUrl] = useState(initial?.url || '');
  const [preview, setPreview] = useState(initial?.url || '');
  const [content, setContent] = useState(initialTextContent || '');
  const [showHelp, setShowHelp] = useState(false);
  const [helpGroup, setHelpGroup] = useState(0);
  const [loadingText, setLoadingText] = useState(false);
  const token = localStorage.getItem('token');
  const [_modal, _setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null, onClose: null });
  const _closeModal = () => _setModal(p => ({ ...p, show: false }));
  const _showInfo = (t, message) => _setModal({ show: true, type: 'info', title: t, message, onClose: _closeModal });
  const _showConfirm = (t, message, onConfirm, danger = false) => _setModal({ show: true, type: 'confirm', danger, title: t, message, onConfirm, onCancel: _closeModal });

  const isContent = type && type !== 'container';
  const isText = type === 'text';
  const isForm = type === 'form';
  const isMedia = isContent && !isText && !isForm;
  const kindLabel = kind === 'volume' ? 'Volume' : 'Chapter';
  const acceptMap = { image: 'image/*', video: 'video/*', audio: 'audio/*', document: '.pdf,.doc,.docx', archive: '.zip,.rar,.7z' };

  // When editing an existing text entity, load from server if not already in local state
  useEffect(() => {
    if (initial && initial.type === 'text' && initial.url && !initialTextContent) {
      setLoadingText(true);
      const fullUrl = initial.url.startsWith('http') ? initial.url : `${BASE}${initial.url}`;
      fetch(`${fullUrl}?_=${Date.now()}`, {
        headers: { 'Authorization': token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' }
      })
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(t => setContent(t))
        .catch(() => { })
        .finally(() => setLoadingText(false));
    }
  }, []);

  const ff = () => {
    if (!isMedia || !uploadedFiles?.length) return [];
    return uploadedFiles.filter(f => {
      const n = (f.originalName || f.filename || '').toLowerCase();
      if (type === 'image') return /\.(jpg|jpeg|png|gif|webp)$/i.test(n);
      if (type === 'video') return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(n);
      if (type === 'audio') return /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(n);
      if (type === 'document') return /\.(pdf|doc|docx)$/i.test(n);
      if (type === 'archive') return /\.(zip|rar|7z)$/i.test(n);
      return false;
    });
  };

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onloadend = () => { setPreview(r.result); setUrl(''); };
    r.readAsDataURL(f);
  };

  const handleSave = () => {
    if (!title.trim()) { _showInfo('Validation', 'Please enter a title.'); return; }
    if (isMedia && !url && !preview) { _showInfo('Validation', 'Please provide a file or URL.'); return; }
    onSave({ title, type, url: url || preview || '', content: isText ? content : undefined });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h5><i className={`bi ${typeIcon(type)} me-2`}></i>{initial ? 'Edit' : 'Add'} {kindLabel}</h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">
          <div className="mb-3">
            <label className="form-label">Title</label>
            <input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder={`${kindLabel} title`} />
          </div>
          <div className="mb-3">
            <label className="form-label">Type</label>
            <div className="entity-type-picker">
              {ENTITY_TYPE_OPTIONS.map(opt => (
                <button key={opt.type}
                  className={`entity-type-btn ${type === opt.type ? 'entity-type-btn--active' : ''}`}
                  onClick={() => { setType(opt.type); setUrl(''); setPreview(''); setContent(''); }}>
                  <i className={`bi ${opt.icon}`}></i><span>{opt.label}</span>
                </button>
              ))}
            </div>
            {!isContent && (
              <div className="alert alert-info mt-2 mb-0 py-2">
                <i className="bi bi-info-circle me-1"></i>
                <small><strong>Container</strong> — holds {kind === 'volume' ? 'chapters' : 'items'} inside. No file needed.</small>
              </div>
            )}
          </div>

          {isText && (
            <>
              {loadingText && <div className="alert alert-info mb-2"><span className="spinner-border spinner-border-sm me-2"></span>Loading…</div>}
              <div className="mb-2">
                <button className="btn btn-sm btn-link px-0" onClick={() => setShowHelp(!showHelp)}>
                  <i className={`bi bi-${showHelp ? 'chevron-up' : 'question-circle'} me-1`}></i>
                  {showHelp ? 'Hide syntax help' : 'Syntax help'}
                </button>
              </div>
              {showHelp && (
                <div className="syntax-help-panel mb-3">
                  <div className="syntax-tabs">
                    {SYNTAX_GROUPS.map((g, gi) => (
                      <button key={gi} className={`syntax-tab${helpGroup === gi ? ' active' : ''}`} onClick={() => setHelpGroup(gi)}>
                        <i className={`bi ${g.icon} me-1`}></i>{g.label}
                      </button>
                    ))}
                  </div>
                  <table className="syntax-table">
                    <thead><tr><th>Format</th><th>Syntax</th><th>Note</th></tr></thead>
                    <tbody>{SYNTAX_GROUPS[helpGroup].rows.map((row, ri) => (
                      <tr key={ri}><td>{row.format}</td><td><code>{row.syntax}</code></td><td className="syntax-note">{row.note || ''}</td></tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
              <div className="mb-3">
                <label className="form-label">Content</label>
                <textarea className="form-control" value={content} onChange={e => setContent(e.target.value)} rows="10" disabled={loadingText} />
              </div>
              {content && (
                <div className="mb-3">
                  <label className="form-label">Preview</label>
                  <div className="content-preview" dangerouslySetInnerHTML={{ __html: parseTextSyntax(content) }} />
                </div>
              )}
            </>
          )}

          {isForm && (
            <div className="alert alert-warning mt-1 mb-0">
              <i className="bi bi-ui-checks me-2"></i>
              <strong>Form</strong> — enter a title and save. Use the <i className="bi bi-pencil"></i> edit button on this entry to build the form questions afterwards.
            </div>
          )}

          {isMedia && (
            <>
              {ff().length > 0 && (
                <div className="mb-3">
                  <label className="form-label">Select from uploaded files</label>
                  <select className="form-select" value={url} onChange={e => { setUrl(e.target.value); setPreview(e.target.value ? `${BASE}${e.target.value}` : ''); }}>
                    <option value="">— Choose a file —</option>
                    {ff().map((f, i) => <option key={i} value={f.url || f.path}>{f.originalName || f.filename}</option>)}
                  </select>
                </div>
              )}
              <div className="file-upload-area mb-3"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}>
                <input type="file" id="entity-file" accept={acceptMap[type] || '*/*'} onChange={handleFile} style={{ display: 'none' }} />
                <label htmlFor="entity-file" className="file-upload-label">
                  <i className={`bi ${typeIcon(type)} upload-icon`}></i>
                  <p>Drag file or click to select</p>
                </label>
              </div>
              <div className="text-center my-2"><small className="text-muted">— OR —</small></div>
              <div className="mb-3">
                <label className="form-label">Enter URL</label>
                <input type="url" className="form-control" value={url} onChange={e => { setUrl(e.target.value); setPreview(e.target.value); }} placeholder="https://example.com/file" />
              </div>
              {preview && (
                <div className="mb-3">
                  <label className="form-label">Preview</label>
                  {type === 'image' && <img src={preview} alt="" className="img-preview" />}
                  {type === 'video' && <video src={preview} controls className="video-preview" />}
                  {type === 'audio' && <audio src={preview} controls className="audio-preview" />}
                  {(type === 'document' || type === 'archive') && <div className="alert alert-info"><i className={`bi ${typeIcon(type)} me-2`}></i>{(url || preview).split('/').pop()}</div>}
                </div>
              )}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}><i className="bi bi-check2 me-1"></i>{initial ? 'Update' : 'Add'} {kindLabel}</button>
        </div>
      </div>
      {_modal.show && <UtilityModal show={_modal.show} type={_modal.type} title={_modal.title} message={_modal.message}
        onConfirm={() => { _modal.onConfirm?.(); _closeModal(); }} onCancel={_modal.onCancel || _closeModal} onClose={_modal.onClose || _closeModal} />}
    </div>
  );
}

// ─── Content Entity View ──────────────────────────────────────────────────────
function ContentEntityView({ entity, entityId, editMode, locked, expanded, onToggle, onEdit, onDelete, draggable, onDragStart, onDragOver, onDrop, textRefreshKey, localTextContent, volumes, setExpandedChapters, setExpandedVolumes }) {
  const { title, type, url } = entity;
  return (
    <div className={`content-entity-item ${editMode ? 'draggable' : ''} ${locked ? 'muted blocked' : ''}`}
      draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop}>

      <div className={`content-entity-header ${editMode ? 'content-entity-header--edit' : ''}`} onClick={() => !editMode && onToggle()}>
        {editMode ? <i className="bi bi-grip-vertical drag-handle me-2"></i> : <i className={`bi bi-chevron-${expanded ? 'down' : 'right'} me-2 item-chevron`}></i>}
        <i className={`bi ${typeIcon(type)} ${typeColor(type)} me-2`}></i>
        <span className="item-header-title flex-1">{title}</span>
        <span className="entity-type-badge">{type}</span>
        {editMode && (
          <div className="header-actions" onClick={e => e.stopPropagation()}>
            <button className="btn btn-sm btn-outline-primary" onClick={onEdit}><i className="bi bi-pencil"></i></button>
            <button className="btn btn-sm btn-outline-danger" onClick={onDelete}><i className="bi bi-trash"></i></button>
          </div>
        )}
      </div>

      {(editMode || expanded) && (
        <div className="content-entity-body item-body--expanded">
          <EntityMedia type={type} url={url} entityId={entityId} textRefreshKey={textRefreshKey} localTextContent={localTextContent} />
        </div>
      )}
    </div>
  );
}

// ─── Entity Media ─────────────────────────────────────────────────────────────
function EntityMedia({ type, url, entityId, textRefreshKey, localTextContent }) {
  if (type === 'text') return (
    <TextItemDisplay
      key={`${entityId}-${textRefreshKey}`}
      url={url} refreshKey={textRefreshKey}
      localContent={localTextContent?.[entityId]}
    />
  );
  if (type === 'form') return <FormItemDisplay key={`${entityId}-${textRefreshKey}`} url={url} refreshKey={textRefreshKey} />;
  if (!url) return <p className="text-muted fst-italic p-2 mb-0">No content URL set.</p>;
  if (type === 'video') return <div className="video-item"><YoutubeEmbed url={url} /></div>;
  if (type === 'image') return <div className="image-item"><img src={fu(url)} alt="" className="content-image" /></div>;
  if (type === 'audio') return <div className="audio-item"><audio src={fu(url)} controls className="audio-player" /></div>;
  if (type === 'document') return <div className="document-item"><a href={fu(url)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-info"><i className="bi bi-file-pdf me-1"></i>Open Document</a></div>;
  if (type === 'archive') return <div className="archive-item"><a href={fu(url)} download className="btn btn-sm btn-outline-info"><i className="bi bi-file-zip me-1"></i>Download Archive</a></div>;
  return <a href={fu(url)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-secondary m-2"><i className="bi bi-file-earmark me-1"></i>Open File</a>;
}

// ─── Content Item View ────────────────────────────────────────────────────────
function ContentItemView({ item, ii, vi, ci, editMode, locked, expandedItems, setExpandedItems, editingTitle, setEditingTitle, textRefreshKey, localTextContent, volumes, setExpandedChapters, setExpandedVolumes, onUpdateTitle, onEditItem, onEditForm, onDeleteItem, onDragStart, onDragOver, onDrop, onScrollToItem }) {
  const volume = volumes[vi];
  const chapter = volume?.chapters[ci];
  return (
    <div id={`item-${item.iid}`} className={`content-item ${editMode ? 'draggable' : ''}`}
      draggable={editMode}
      onDragStart={e => onDragStart(e, vi, ci, ii)} onDragOver={onDragOver} onDrop={e => onDrop(e, vi, ci, ii)}>

      {editMode ? (
        <div className="item-controls">
          <i className="bi bi-grip-vertical drag-handle"></i>
          {editingTitle?.type === 'item' && editingTitle?.vi === vi && editingTitle?.ci === ci && editingTitle?.ii === ii
            ? <input className="form-control title-edit-input flex-1" value={item.title} onChange={e => onUpdateTitle(vi, ci, ii, e.target.value)} onBlur={() => setEditingTitle(null)} onKeyDown={e => { if (e.key === 'Enter') setEditingTitle(null); }} autoFocus />
            : <span className="item-title flex-1">{item.title}</span>}
          {item.type === 'form'
            ? <button className="btn btn-sm btn-outline-info" onClick={() => onEditForm(vi, ci, ii)}><i className="bi bi-pencil-fill"></i></button>
            : <button className="btn btn-sm btn-outline-primary" onClick={() => onEditItem(vi, ci, ii)}><i className="bi bi-pencil-fill"></i></button>}
          <button className="btn btn-sm btn-danger" onClick={() => onDeleteItem(vi, ci, ii)}><i className="bi bi-trash"></i></button>
        </div>
      ) : (
        <div className="item-header" onClick={() => setExpandedItems(p => ({ ...p, [item.iid]: !p[item.iid] }))}>
          <i className={`bi bi-chevron-${expandedItems[item.iid] ? 'down' : 'right'} me-2 item-chevron`}></i>
          <span className={`item-header-icon me-2 ${typeColor(item.type)}`}><i className={`bi ${typeIcon(item.type)}`}></i></span>
          <span className="item-header-title">{item.title}</span>
        </div>
      )}

      {(editMode || expandedItems[item.iid]) && (
        <div className={`item-body${editMode ? '' : ' item-body--expanded'}`}>
          {item.type === 'video' && <div className="video-item"><YoutubeEmbed url={item.url} /></div>}
          {item.type === 'image' && <div className="image-item"><img src={fu(item.url)} alt={item.title} className="content-image" /></div>}
          {item.type === 'audio' && <div className="audio-item"><audio src={fu(item.url)} controls className="audio-player" /></div>}
          {item.type === 'document' && <div className="document-item"><a href={fu(item.url)} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-info"><i className="bi bi-file-pdf me-1"></i>Open Document</a></div>}
          {item.type === 'archive' && <div className="archive-item"><a href={fu(item.url)} download className="btn btn-sm btn-outline-info"><i className="bi bi-file-zip me-1"></i>Download Archive</a></div>}
          {item.type === 'text' && (
            <TextItemDisplay key={`${item.iid}-${textRefreshKey}`} url={item.url} refreshKey={textRefreshKey} localContent={localTextContent[item.iid]}
              onCloseItem={() => setExpandedItems(p => ({ ...p, [item.iid]: false }))}
              onCloseChapter={chapter ? () => setExpandedChapters(p => ({ ...p, [chapter.cid]: false })) : undefined}
              onCloseVolume={volume ? () => setExpandedVolumes(p => ({ ...p, [volume.vid]: false })) : undefined}
              onScrollToVolume={idx => { const el = document.getElementById(`volume-${volumes[idx]?.vid}`); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
              onScrollToChapter={(idx, cidx) => { const ch = volumes[idx]?.chapters[cidx]; if (ch) { setExpandedChapters(p => ({ ...p, [ch.cid]: true })); setTimeout(() => { const el = document.getElementById(`chapter-${ch.cid}`); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 100); } }}
              onScrollToItem={onScrollToItem}
            />
          )}
          {item.type === 'form' && <FormItemDisplay key={`${item.iid}-${textRefreshKey}`} url={item.url} refreshKey={textRefreshKey} />}
        </div>
      )}
    </div>
  );
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

function executeJsAction(action, params) {
  try {
    const trimmed = action.trim();
    if (/^(\(.*?\)|[\w$]+)\s*=>/.test(trimmed)) {
      const fn = new Function(`return (${trimmed})`)();
      if (typeof fn === 'function') fn();
      return;
    }
    const parts = trimmed.split('.');
    let obj = window;
    for (let i = 0; i < parts.length - 1; i++) {
      obj = obj[parts[i]];
      if (obj == null) { console.warn(`[btn action] '${parts.slice(0, i + 1).join('.')}' is null/undefined`); return; }
    }
    const methodName = parts[parts.length - 1];
    const fn = parts.length === 1 ? window[methodName] : obj[methodName];
    if (typeof fn !== 'function') { console.warn(`[btn action] '${action}' is not a function`); return; }
    const args = params.trim() !== '' ? params.split(',').map(s => s.trim()) : [];
    fn.apply(obj, args);
  } catch (e) { console.warn('[btn action] error:', e); }
}

// ─── Text Item Display ────────────────────────────────────────────────────────
function TextItemDisplay({ url, refreshKey, localContent, onCloseItem, onCloseChapter, onCloseVolume, onScrollToVolume, onScrollToChapter, onScrollToItem }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (localContent !== undefined) { setContent(localContent); setLoading(false); setError(null); return; }
    if (!url) { setLoading(false); return; }
    setLoading(true); setError(null);
    (async () => {
      try {
        const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
        const res = await fetch(`${fullUrl}?_=${refreshKey || Date.now()}`, {
          headers: { 'Authorization': token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' }
        });
        if (res.ok) setContent(await res.text()); else setError('Could not load content');
      } catch (e) { setError('Error: ' + e.message); }
      setLoading(false);
    })();
  }, [url, refreshKey, localContent]);

  const ap = { onCloseItem, onCloseChapter, onCloseVolume, onScrollToVolume, onScrollToChapter, onScrollToItem };
  const handleClick = e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    e.stopPropagation();
    const action = btn.getAttribute('data-action');
    const params = btn.getAttribute('data-params') || '';
    const h = ITEM_ACTIONS[action];
    if (h) h(params, ap); else executeJsAction(action, params);
  };

  if (loading) return <div className="text-item"><p><em>Loading...</em></p></div>;
  if (error) return <div className="text-item"><p style={{ color: 'red' }}>{error}</p></div>;
  if (!content) return <div className="text-item"><p className="text-muted fst-italic">No content yet.</p></div>;
  return <div className="text-item" onClick={handleClick}><div dangerouslySetInnerHTML={{ __html: parseTextSyntax(content) }} /></div>;
}

// ─── Syntax Help ──────────────────────────────────────────────────────────────
const SYNTAX_GROUPS = [
  {
    label: 'Text & Structure', icon: 'bi-text-left', rows: [
      { format: 'Line break', syntax: '\\n' },
      { format: 'Indentation', syntax: '\\t' },
      { format: 'Heading 1', syntax: '# Text' },
      { format: 'Heading 2', syntax: '## Text' },
      { format: 'Heading 3', syntax: '### Text' },
      { format: 'Paragraph', syntax: '`{text}`' },
      { format: 'Numbered list', syntax: '1. Item' },
      { format: 'Bullet list', syntax: '- Item  or  • Item' },
      { format: 'Code Line', syntax: '`(code)`' },
      { format: 'Code Snippet', syntax: '~(language)[code]~', note: 'JS, TS, Python, Java, C, C++, C#, Go, Rust, SQL, Bash, PHP, Swift, CSS, HTML…' },
    ]
  },
  {
    label: 'Media', icon: 'bi-play-circle', rows: [
      { format: 'Image', syntax: '#https://url#', note: 'Inline image' },
      { format: 'Video', syntax: '{https://url.mp4}', note: 'HTML5 player' },
      { format: 'YouTube', syntax: '(https://youtube.com/watch?v=ID)', note: 'Also youtu.be/ and /shorts/' },
    ]
  },
  {
    label: 'Links & Downloads', icon: 'bi-link-45deg', rows: [
      { format: 'Link', syntax: '@https://url@', note: 'New tab' },
      { format: 'Download', syntax: '![Label|https://url]!', note: 'Download button' },
    ]
  },
  {
    label: 'Buttons', icon: 'bi-ui-radios', rows: [
      { format: 'Arrow function', syntax: '[btn:Label|() => expr]', note: 'full JS, no args passed in' },
      { format: 'Arrow (multi-stmt)', syntax: '[btn:Label|() => { stmt1; stmt2; }]', note: 'wrap body in { }' },
      { format: 'Dot-path call', syntax: '[btn:Label|fn.path:arg1,arg2]', note: 'e.g. alert:Hi  or  console.log:a,b' },
      { format: 'Dot-path (no args)', syntax: '[btn:Label|functionName]', note: 'e.g. myGlobalFn' },
      { format: 'Close item', syntax: '[btn:Collapse|close-item]' },
      { format: 'Close chapter', syntax: '[btn:Close|close-chapter]' },
      { format: 'Close volume', syntax: '[btn:Close|close-volume]' },
      { format: 'Go to volume', syntax: '[btn:Go|move-to-volume:1]', note: '1-based' },
      { format: 'Go to chapter', syntax: '[btn:Go|move-to-chapter:1,2]', note: 'vol,ch (1-based)' },
      { format: 'Go to item', syntax: '[btn:Go|move-to-item:1,2,3]', note: 'vol,ch,item (1-based)' },
    ]
  },
];

// ─── Add Item Modal ───────────────────────────────────────────────────────────
function AddItemModal({ type, isEditing, initialData, onSave, onClose, uploadedFiles = [] }) {
  const [_modal, _setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null });
  const _closeModal = () => _setModal(p => ({ ...p, show: false }));
  const _showInfo = (title, message) => _setModal({ show: true, type: 'info', title, message, onClose: _closeModal });
  const _showConfirm = (title, message, onConfirm, danger = false) => _setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: _closeModal });
  const _ModalEl = () => <UtilityModal show={_modal.show} type={_modal.type} title={_modal.title} message={_modal.message}
    danger={_modal.danger}
    onConfirm={() => { _modal.onConfirm?.(); _closeModal(); }}
    onCancel={_modal.onCancel || _closeModal} onClose={_closeModal} />;
  const [title, setTitle] = useState(initialData?.title || '');
  const [content, setContent] = useState(initialData?.content || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [preview, setPreview] = useState(initialData?.url || '');
  const [selFile, setSelFile] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [helpGroup, setHelpGroup] = useState(0);
  const [loadingTxt, setLoadingTxt] = useState(false);
  const [txtErr, setTxtErr] = useState(null);
  const token = localStorage.getItem('token');

  const ff = () => {
    if (type === 'text' || !uploadedFiles?.length) return [];
    return uploadedFiles.filter(f => {
      const n = (f.originalName || f.filename || '').toLowerCase();
      if (type === 'image') return /\.(jpg|jpeg|png|gif|webp)$/i.test(n);
      if (type === 'video') return /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(n);
      if (type === 'audio') return /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(n);
      if (type === 'document') return /\.(pdf|doc|docx)$/i.test(n);
      if (type === 'archive') return /\.(zip|rar|7z)$/i.test(n);
      return false;
    });
  };

  useEffect(() => {
    if (isEditing && type === 'text' && initialData?.url && !content) {
      setLoadingTxt(true); setTxtErr(null);
      const fullUrl = initialData.url.startsWith('http') ? initialData.url : `${BASE}${initialData.url}`;
      fetch(`${fullUrl}?_=${Date.now()}`, { headers: { 'Authorization': token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' } })
        .then(r => r.ok ? r.text() : Promise.reject())
        .then(t => setContent(t))
        .catch(() => setTxtErr('Could not load'))
        .finally(() => setLoadingTxt(false));
    }
  }, []);

  const handleFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onloadend = () => { setPreview(r.result); setUrl(''); setSelFile(''); }; r.readAsDataURL(f);
  };
  const handleExisting = e => {
    const v = e.target.value; setSelFile(v);
    if (v) { const f = uploadedFiles.find(f => f.url === v || f.path === v); if (f) { const furl = fu(f.url || f.path); setUrl(furl); setPreview(furl); } }
    else { setUrl(''); setPreview(''); }
  };
  const handleSave = () => {
    if (!title.trim()) { _showInfo('Validation', 'Please enter a title'); return; }
    if (type === 'text') { onSave({ type, title, content }); return; }
    if (!url && !preview) { _showInfo('Validation', 'Please provide a file or URL'); return; }
    onSave({ type, title, url: url || preview || '' });
  };
  const fi = ff();
  const tIcon = typeIcon(type);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h5>{isEditing ? 'Edit' : 'Add'} {type.charAt(0).toUpperCase() + type.slice(1)}</h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">
          <div className="mb-3"><label className="form-label">Title</label><input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter title" /></div>
          {type === 'text' ? (
            <>
              {loadingTxt && <div className="alert alert-info mb-3"><span className="spinner-border spinner-border-sm me-2"></span>Loading…</div>}
              {txtErr && <div className="alert alert-danger mb-3">{txtErr}</div>}
              <div className="mb-2"><button className="btn btn-sm btn-link px-0" onClick={() => setShowHelp(!showHelp)}><i className={`bi bi-${showHelp ? 'chevron-up' : 'question-circle'} me-1`}></i>{showHelp ? 'Hide syntax help' : 'Syntax help'}</button></div>
              {showHelp && (
                <div className="syntax-help-panel mb-3">
                  <div className="syntax-tabs">{SYNTAX_GROUPS.map((g, gi) => <button key={gi} className={`syntax-tab${helpGroup === gi ? ' active' : ''}`} onClick={() => setHelpGroup(gi)}><i className={`bi ${g.icon} me-1`}></i>{g.label}</button>)}</div>
                  <table className="syntax-table"><thead><tr><th>Format</th><th>Syntax</th><th>Note</th></tr></thead>
                    <tbody>{SYNTAX_GROUPS[helpGroup].rows.map((row, ri) => <tr key={ri}><td>{row.format}</td><td><code>{row.syntax}</code></td><td className="syntax-note">{row.note || ''}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              <div className="mb-3"><label className="form-label">Content</label><textarea className="form-control" value={content} onChange={e => setContent(e.target.value)} rows="10" disabled={loadingTxt} /></div>
              {content && <div className="mb-3"><label className="form-label">Preview</label><div className="content-preview" dangerouslySetInnerHTML={{ __html: parseTextSyntax(content) }} /></div>}
            </>
          ) : (
            <>
              {fi.length > 0 && <div className="mb-3"><label className="form-label">Select from uploaded files</label><select className="form-select" value={selFile} onChange={handleExisting}><option value="">-- Choose --</option>{fi.map((f, i) => <option key={i} value={f.url}>{f.originalName || f.filename}</option>)}</select></div>}
              {fi.length > 0 && <div className="text-center my-2"><small className="text-muted">— OR —</small></div>}
              <div className="file-upload-area mb-3" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile({ target: { files: [f] } }); }}>
                <input type="file" id="item-file" accept={type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : type === 'audio' ? 'audio/*' : type === 'document' ? '.pdf,.doc,.docx' : type === 'archive' ? '.zip' : '*/*'} onChange={handleFile} style={{ display: 'none' }} />
                <label htmlFor="item-file" className="file-upload-label"><i className={`bi ${tIcon} upload-icon`}></i><p>Drag {type} or click to select</p></label>
              </div>
              <div className="text-center my-2"><small className="text-muted">— OR —</small></div>
              <div className="mb-3"><label className="form-label">Enter URL</label><input type="url" className="form-control" value={url} onChange={e => { setUrl(e.target.value); setPreview(e.target.value); setSelFile(''); }} placeholder="https://example.com/file" /></div>
              {preview && <div className="mb-3"><label className="form-label">Preview</label>
                {type === 'image' && <img src={preview} alt="" className="img-preview" />}
                {type === 'video' && <video src={preview} controls className="video-preview" />}
                {type === 'audio' && <audio src={preview} controls className="audio-preview" />}
                {(type === 'document' || type === 'archive') && <div className="alert alert-info"><i className={`bi ${tIcon} me-2`}></i>{preview.split('/').pop()}</div>}
              </div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{isEditing ? 'Update' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Form Editor Modal ────────────────────────────────────────────────────────
function FormEditorModal({ isEditing, initialItem, uploadedFiles = [], onSave, onClose }) {
  const token = localStorage.getItem('token');
  const genId = () => `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const emptyQ = (type = 'single') => {
    const b = { id: genId(), type, question: '', media: null };
    if (type === 'single') return { ...b, options: ['', ''], correctIndex: 0 };
    if (type === 'multiple') return { ...b, options: ['', ''], correctIndices: [] };
    if (type === 'correlation') return { ...b, pairs: [{ left: '', right: '' }, { left: '', right: '' }] };
    if (type === 'closed') return { ...b, correctAnswer: '' };
    return b;
  };
  const [_modal, _setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null });
  const _closeModal = () => _setModal(p => ({ ...p, show: false }));
  const _showInfo = (title, message) => _setModal({ show: true, type: 'info', title, message, onClose: _closeModal });
  const _showConfirm = (title, message, onConfirm, danger = false) => _setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: _closeModal });
  const _ModalEl = () => <UtilityModal show={_modal.show} type={_modal.type} title={_modal.title} message={_modal.message}
    danger={_modal.danger}
    onConfirm={() => { _modal.onConfirm?.(); _closeModal(); }}
    onCancel={_modal.onCancel || _closeModal} onClose={_closeModal} />;
  const [title, setTitle] = useState(initialItem?.title || '');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(isEditing && !!initialItem?.url);

  useEffect(() => {
    if (isEditing && initialItem?.url) {
      setLoading(true);
      const fullUrl = initialItem.url.startsWith('http') ? initialItem.url : `${BASE}${initialItem.url}`;
      fetch(`${fullUrl}?_=${Date.now()}`, { headers: { 'Authorization': token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' } })
        .then(r => r.ok ? r.json() : null)
        .then(d => setQuestions(d?.questions?.length ? d.questions : [emptyQ()]))
        .catch(() => setQuestions([emptyQ()]))
        .finally(() => setLoading(false));
    } else { setQuestions([emptyQ()]); }
  }, []);

  const setQ = (i, fn) => setQuestions(p => { const a = [...p]; a[i] = fn(a[i]); return a; });
  const changeType = (i, t) => setQ(i, q => ({ ...emptyQ(t), id: q.id, question: q.question, media: q.media }));
  const setOpt = (qi, oi, v) => setQ(qi, q => { const o = [...q.options]; o[oi] = v; return { ...q, options: o }; });
  const addOpt = (qi) => setQ(qi, q => ({ ...q, options: [...q.options, ''] }));
  const removeOpt = (qi, oi) => setQ(qi, q => { const o = q.options.filter((_, i) => i !== oi); return { ...q, options: o, correctIndex: q.correctIndex >= o.length ? Math.max(0, o.length - 1) : q.correctIndex, correctIndices: (q.correctIndices || []).filter(i => i !== oi).map(i => i > oi ? i - 1 : i) }; });
  const setPair = (qi, pi, s, v) => setQ(qi, q => ({ ...q, pairs: q.pairs.map((p, i) => i === pi ? { ...p, [s]: v } : p) }));
  const addPair = (qi) => setQ(qi, q => ({ ...q, pairs: [...q.pairs, { left: '', right: '' }] }));
  const removePair = (qi, pi) => setQ(qi, q => ({ ...q, pairs: q.pairs.filter((_, i) => i !== pi) }));
  const getFF = (mt) => (uploadedFiles || []).filter(f => { const n = (f.originalName || f.filename || '').toLowerCase(); return mt === 'image' ? /\.(jpg|jpeg|png|gif|webp)$/i.test(n) : mt === 'video' ? /\.(mp4|webm|ogg|mov|mkv)$/i.test(n) : /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(n); });
  const handleSave = () => { if (!title.trim()) { _showInfo('Validation', 'Enter form title'); return; } if (questions.find(q => !q.question.trim())) { _showInfo('Validation', 'All questions need text'); return; } onSave({ type: 'form', title, formData: { questions } }); };
  const QL = { single: 'Single Answer (Radio)', multiple: 'Multiple Answers (Checkboxes)', correlation: 'Correlation (Match)', closed: 'Closed Answer (Text)', open: 'Open Answer (Teacher reviews)' };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content--wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h5><i className="bi bi-ui-checks me-2"></i>{isEditing ? 'Edit Form' : 'Create Form'}</h5><button className="btn-close" onClick={onClose}></button></div>
        <div className="modal-body form-editor-body">
          {loading ? <div className="text-center py-4"><div className="spinner-border text-primary"></div></div> : (<>
            <div className="mb-3"><label className="form-label fw-semibold">Form Title</label><input className="form-control" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 1 Quiz" /></div>
            <div className="form-questions-list">
              {questions.map((q, qi) => (
                <div key={q.id} className="form-question-card">
                  <div className="form-question-header">
                    <span className="form-question-num">Q{qi + 1}</span>
                    <select className="form-select form-select-sm form-question-type" value={q.type} onChange={e => changeType(qi, e.target.value)}>{Object.entries(QL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                    <button className="btn btn-sm btn-outline-danger ms-auto" onClick={() => setQuestions(p => p.filter((_, i) => i !== qi))} disabled={questions.length === 1}><i className="bi bi-trash"></i></button>
                  </div>
                  <textarea className="form-control form-question-text" rows={2} placeholder="Question text…" value={q.question} onChange={e => setQ(qi, q2 => ({ ...q2, question: e.target.value }))} />
                  <FormMediaPicker media={q.media} uploadedFiles={uploadedFiles} getFilteredFiles={getFF} onSet={m => setQ(qi, q2 => ({ ...q2, media: m }))} onClear={() => setQ(qi, q2 => ({ ...q2, media: null }))} />
                  {q.type === 'single' && <div className="form-options-list mt-2"><p className="form-options-hint">Mark correct:</p>{q.options.map((opt, oi) => <div key={oi} className="form-option-row"><input type="radio" className="form-check-input" name={`c-${q.id}`} checked={q.correctIndex === oi} onChange={() => setQ(qi, q2 => ({ ...q2, correctIndex: oi }))} /><input type="text" className="form-control form-control-sm" value={opt} onChange={e => setOpt(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} /><button className="btn btn-sm btn-outline-secondary" onClick={() => removeOpt(qi, oi)} disabled={q.options.length <= 2}><i className="bi bi-x"></i></button></div>)}<button className="btn btn-sm btn-outline-primary mt-1" onClick={() => addOpt(qi)}><i className="bi bi-plus me-1"></i>Add Option</button></div>}
                  {q.type === 'multiple' && <div className="form-options-list mt-2"><p className="form-options-hint">Check all correct:</p>{q.options.map((opt, oi) => <div key={oi} className="form-option-row"><input type="checkbox" className="form-check-input" checked={(q.correctIndices || []).includes(oi)} onChange={e => setQ(qi, q2 => { const c = e.target.checked ? [...(q2.correctIndices || []), oi] : (q2.correctIndices || []).filter(i => i !== oi); return { ...q2, correctIndices: c }; })} /><input type="text" className="form-control form-control-sm" value={opt} onChange={e => setOpt(qi, oi, e.target.value)} placeholder={`Option ${oi + 1}`} /><button className="btn btn-sm btn-outline-secondary" onClick={() => removeOpt(qi, oi)} disabled={q.options.length <= 2}><i className="bi bi-x"></i></button></div>)}<button className="btn btn-sm btn-outline-primary mt-1" onClick={() => addOpt(qi)}><i className="bi bi-plus me-1"></i>Add Option</button></div>}
                  {q.type === 'correlation' && <div className="form-corr-list mt-2"><p className="form-options-hint">Left → Right (shuffled for student):</p>{q.pairs.map((pair, pi) => <div key={pi} className="form-corr-row"><span className="form-corr-num">{pi + 1}.</span><input type="text" className="form-control form-control-sm" value={pair.left} onChange={e => setPair(qi, pi, 'left', e.target.value)} placeholder={`Left ${pi + 1}`} /><i className="bi bi-arrow-right text-muted"></i><input type="text" className="form-control form-control-sm" value={pair.right} onChange={e => setPair(qi, pi, 'right', e.target.value)} placeholder={`Match (${String.fromCharCode(65 + pi)})`} /><button className="btn btn-sm btn-outline-secondary" onClick={() => removePair(qi, pi)} disabled={q.pairs.length <= 2}><i className="bi bi-x"></i></button></div>)}<button className="btn btn-sm btn-outline-primary mt-1" onClick={() => addPair(qi)}><i className="bi bi-plus me-1"></i>Add Pair</button></div>}
                  {q.type === 'closed' && <div className="mt-2"><label className="form-label form-options-hint">Expected answer:</label><input type="text" className="form-control form-control-sm" value={q.correctAnswer || ''} onChange={e => setQ(qi, q2 => ({ ...q2, correctAnswer: e.target.value }))} placeholder="Correct answer…" /></div>}
                  {q.type === 'open' && <div className="form-open-hint mt-2"><small className="text-muted"><i className="bi bi-pencil-square me-1"></i>Student writes freely — teacher reviews manually.</small></div>}
                </div>
              ))}
            </div>
            <div className="form-add-question-row">{Object.entries(QL).map(([t, l]) => <button key={t} className="btn btn-sm btn-outline-primary" onClick={() => setQuestions(p => [...p, emptyQ(t)])}><i className="bi bi-plus me-1"></i>{l.split(' (')[0]}</button>)}</div>
          </>)}
        </div>
        <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" onClick={handleSave} disabled={loading}><i className="bi bi-save me-1"></i>{isEditing ? 'Update Form' : 'Save Form'}</button></div>
      </div>
    </div>
  );
}

// ─── Form Media Picker ────────────────────────────────────────────────────────
function FormMediaPicker({ media, uploadedFiles, getFilteredFiles, onSet, onClear }) {
  const [_modal, _setModal] = useState({ show: false, type: 'info', title: '', message: '', onConfirm: null, onCancel: null });
  const _closeModal = () => _setModal(p => ({ ...p, show: false }));
  const _showInfo = (title, message) => _setModal({ show: true, type: 'info', title, message, onClose: _closeModal });
  const _showConfirm = (title, message, onConfirm, danger = false) => _setModal({ show: true, type: 'confirm', danger, title, message, onConfirm, onCancel: _closeModal });
  const _ModalEl = () => <UtilityModal show={_modal.show} type={_modal.type} title={_modal.title} message={_modal.message}
    danger={_modal.danger}
    onConfirm={() => { _modal.onConfirm?.(); _closeModal(); }}
    onCancel={_modal.onCancel || _closeModal} onClose={_closeModal} />;
  const [open, setOpen] = useState(false);
  const [mt, setMt] = useState('image');
  const [urlI, setUrlI] = useState('');
  const [fc, setFc] = useState('');

  if (!open && !media) return <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => setOpen(true)}><i className="bi bi-image me-1"></i>Attach Media</button>;
  if (media) return (
    <div className="form-media-preview mt-2">
      {media.type === 'image' && <img src={media.url} alt="" className="form-media-img" />}
      {media.type === 'video' && <video src={media.url} controls className="form-media-vid" />}
      {media.type === 'audio' && <audio src={media.url} controls className="form-media-aud" />}
      <button className="btn btn-sm btn-outline-danger ms-2" onClick={onClear}><i className="bi bi-x me-1"></i>Remove</button>
    </div>
  );

  const ff = getFilteredFiles(mt);
  const toEmbed = u => {
    const s = u.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/); if (s) return `https://www.youtube.com/embed/${s[1]}`;
    const w = u.match(/[?&]v=([a-zA-Z0-9_-]{11})/); if (w) return `https://www.youtube.com/embed/${w[1]}`;
    return u;
  };
  const attach = () => {
    const u = fc ? ((uploadedFiles.find(f => f.url === fc || f.path === fc)?.url) || fc) : urlI.trim();
    if (!u) { _showInfo('Validation', 'Select or enter URL'); return; }
    const resolved = mt === 'video' ? toEmbed(u) : u;
    onSet({ type: mt, url: fu(resolved) });
    setOpen(false); setUrlI(''); setFc('');
  };

  return (
    <div className="form-media-picker mt-2">
      <div className="d-flex align-items-center gap-2 mb-2">
        <select className="form-select form-select-sm" style={{ maxWidth: 160 }} value={mt} onChange={e => { setMt(e.target.value); setFc(''); setUrlI(''); }}>
          <option value="image">Image</option><option value="video">Video/YouTube</option><option value="audio">Audio</option>
        </select>
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setOpen(false)}>Cancel</button>
      </div>
      {ff.length > 0 && <select className="form-select form-select-sm mb-2" value={fc} onChange={e => { setFc(e.target.value); setUrlI(''); }}><option value="">— Select uploaded file —</option>{ff.map(f => <option key={f.url || f.path} value={f.url || f.path}>{f.originalName || f.filename}</option>)}</select>}
      {!fc && <input type="url" className="form-control form-control-sm mb-2" placeholder={mt === 'video' ? 'YouTube or video URL' : `${mt} URL`} value={urlI} onChange={e => setUrlI(e.target.value)} />}
      <button className="btn btn-sm btn-primary" onClick={attach}><i className="bi bi-paperclip me-1"></i>Attach</button>
    </div>
  );
}

// ─── Form Item Display ────────────────────────────────────────────────────────
function FormItemDisplay({ url, refreshKey }) {
  const [formDef, setFormDef] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const token = localStorage.getItem('token');
  const [shuffles] = useState({});
  const [_modal, _setModal] = useState({ show: false, type: 'confirm', title: '', message: '', onConfirm: null, onCancel: null });
  const _closeModal = () => _setModal(p => ({ ...p, show: false }));
  const _showConfirm = (title, message, onConfirm) => _setModal({ show: true, type: 'confirm', title, message, onConfirm, onCancel: _closeModal });
  const getShuffled = (id, arr) => { if (!shuffles[id]) shuffles[id] = [...arr].sort(() => Math.random() - .5); return shuffles[id]; };

  useEffect(() => {
    if (!url) { setLoading(false); return; }
    setLoading(true); setAnswers({}); setSubmitted(false);
    const fullUrl = url.startsWith('http') ? url : `${BASE}${url}`;
    fetch(`${fullUrl}?_=${refreshKey || Date.now()}`, { headers: { 'Authorization': token ? `${token.split(' ')[0]} ${token.split(' ')[1]}` : '' } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.questions) setFormDef(d); else setError('Could not load form'); })
      .catch(() => setError('Error loading form'))
      .finally(() => setLoading(false));
  }, [url, refreshKey]);

  const setAns = (id, v) => setAnswers(p => ({ ...p, [id]: v }));
  const toggleMult = (id, oi) => { const c = answers[id] || []; setAns(id, c.includes(oi) ? c.filter(i => i !== oi) : [...c, oi]); };
  const isCorrect = q => {
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
    if (ua.length) { _showConfirm('Submit', `${ua.length} question(s) unanswered. Submit anyway?`, () => setSubmitted(true)); } else { setSubmitted(true); }
  };

  const scoreable = (formDef?.questions || []).filter(q => ['single', 'multiple', 'correlation', 'closed'].includes(q.type));
  const correct = scoreable.filter(q => isCorrect(q) === true).length;

  if (loading) return <div className="form-item-display"><p><em>Loading form…</em></p></div>;
  if (error) return <div className="form-item-display"><p style={{ color: 'red' }}>{error}</p></div>;
  if (!formDef) return null;

  return (
    <div className="form-item-display">
      {submitted ? (
        <div className="form-results">
          <div className="form-results-header"><i className="bi bi-check-circle-fill text-success me-2"></i><strong>Submitted</strong></div>
          {scoreable.length > 0 && <div className={`form-score ${correct === scoreable.length ? 'form-score--perfect' : correct >= scoreable.length * .6 ? 'form-score--good' : 'form-score--low'}`}>Score: {correct}/{scoreable.length}</div>}
          <div className="form-review">
            {formDef.questions.map((q, i) => {
              const ok = isCorrect(q); const a = answers[q.id];
              return (
                <div key={q.id} className="form-review-item">
                  {q.media && <FormMediaDisplay media={q.media} />}
                  <div className="form-review-q"><strong>Q{i + 1}:</strong> {q.question}</div>
                  {q.type === 'single' && <div className={`form-review-a ${ok ? 'form-review-a--correct' : 'form-review-a--wrong'}`}><i className={`bi ${ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} me-1`}></i>{q.options[a] ?? <em>none</em>}{!ok && <span className="ms-2 text-success">✓ {q.options[q.correctIndex]}</span>}</div>}
                  {q.type === 'multiple' && <div className={`form-review-a ${ok ? 'form-review-a--correct' : 'form-review-a--wrong'}`}><i className={`bi ${ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} me-1`}></i>{(a || []).map(i => q.options[i]).join(', ') || <em>none</em>}{!ok && <span className="ms-2 text-success">✓ {(q.correctIndices || []).map(i => q.options[i]).join(', ')}</span>}</div>}
                  {q.type === 'correlation' && <div className={`form-review-a ${ok ? 'form-review-a--correct' : 'form-review-a--wrong'}`}><i className={`bi ${ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} me-1`}></i>{q.pairs.map((p, pi) => { const g = a ? a[pi] : undefined; return <span key={pi} className={`form-corr-result ${g === p.right ? 'text-success' : 'text-danger'}`}>{p.left}→{g ?? '?'} {g === p.right ? '✓' : `(✓${p.right})`}</span>; })}</div>}
                  {q.type === 'closed' && <div className={`form-review-a ${ok ? 'form-review-a--correct' : 'form-review-a--wrong'}`}><i className={`bi ${ok ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'} me-1`}></i>"{a || ''}" {!ok && <span className="ms-2 text-success">✓ "{q.correctAnswer}"</span>}</div>}
                  {q.type === 'open' && <div className="form-review-a form-review-a--open"><i className="bi bi-pencil-square text-muted me-1"></i>{a?.trim() || <em>no answer</em>}<span className="badge bg-secondary ms-2">Teacher reviews</span></div>}
                </div>
              );
            })}
          </div>
          <button className="btn btn-sm btn-outline-secondary mt-2" onClick={() => { setAnswers({}); setSubmitted(false); Object.keys(shuffles).forEach(k => delete shuffles[k]); }}><i className="bi bi-arrow-counterclockwise me-1"></i>Retry</button>
        </div>
      ) : (
        <div className="form-questions">
          {formDef.questions.map((q, i) => (
            <div key={q.id} className="form-q-block">
              {q.media && <FormMediaDisplay media={q.media} />}
              <div className="form-q-label"><strong>Q{i + 1}.</strong> {q.question}</div>
              {q.type === 'single' && <div className="form-q-options">{q.options.map((opt, oi) => <label key={oi} className={`form-q-option ${answers[q.id] === oi ? 'form-q-option--selected' : ''}`}><input type="radio" name={`a-${q.id}`} className="form-check-input me-2" checked={answers[q.id] === oi} onChange={() => setAns(q.id, oi)} />{opt || <em className="text-muted">(empty)</em>}</label>)}</div>}
              {q.type === 'multiple' && <div className="form-q-options">{q.options.map((opt, oi) => <label key={oi} className={`form-q-option ${(answers[q.id] || []).includes(oi) ? 'form-q-option--selected' : ''}`}><input type="checkbox" className="form-check-input me-2" checked={(answers[q.id] || []).includes(oi)} onChange={() => toggleMult(q.id, oi)} />{opt || <em className="text-muted">(empty)</em>}</label>)}</div>}
              {q.type === 'correlation' && (() => { const ro = getShuffled(q.id, q.pairs.map(p => p.right)); const ca = answers[q.id] || {}; return <div className="form-corr-answer">{q.pairs.map((pair, pi) => <div key={pi} className="form-corr-answer-row"><span className="form-corr-left">{pair.left}</span><select className="form-select form-select-sm form-corr-select" value={ca[pi] || ''} onChange={e => setAns(q.id, { ...ca, [pi]: e.target.value })}><option value="">— Choose —</option>{ro.map((r, ri) => <option key={ri} value={r}>{r}</option>)}</select></div>)}</div>; })()}
              {q.type === 'closed' && <input type="text" className="form-control form-q-closed" placeholder="Type your answer…" value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} />}
              {q.type === 'open' && <textarea className="form-control form-q-open" rows={3} placeholder="Write your answer…" value={answers[q.id] || ''} onChange={e => setAns(q.id, e.target.value)} />}
            </div>
          ))}
          <button className="btn btn-primary mt-2" onClick={handleSubmit}><i className="bi bi-send me-1"></i>Submit</button>
        </div>
      )}
      {_modal.show && <UtilityModal show={_modal.show} type={_modal.type} title={_modal.title} message={_modal.message}
        onConfirm={() => { _modal.onConfirm?.(); _closeModal(); }} onCancel={_modal.onCancel || _closeModal} onClose={_closeModal} />}
    </div>
  );
}

function FormMediaDisplay({ media }) {
  if (!media?.url) return null;
  return (
    <div className="form-q-media">
      {media.type === 'image' && <img src={media.url} alt="" className="form-q-media-img" />}
      {media.type === 'video' && (media.url.includes('youtube.com/embed') || media.url.includes('youtu.be')
        ? <iframe src={media.url} title="video" frameBorder="0" allowFullScreen className="form-q-media-iframe" />
        : <video src={media.url} controls className="form-q-media-vid" />)}
      {media.type === 'audio' && <audio src={media.url} controls className="form-q-media-aud" />}
    </div>
  );
}

export default CoursePreview;
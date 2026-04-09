import { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { SettingsContext } from '../../contexts/SettingsContext';
import { useCart } from '../../contexts/CartContext';
import AuthImage from '../../components/AuthImage';
import { getUser } from '../../utils/auth';
import './CoursePage.css';
import { UtilityModal } from '../../components/UtilityModal';
import config from '../../config/config';

const API_URL = config.API_URL;
const BASE_URL = API_URL.replace('/api', '');

function CoursePage() {
  const { t } = useContext(SettingsContext);
  const { addItem } = useCart();
  const { id } = useParams();
  const navigate = useNavigate();
  const currentUser = getUser();
  const token = localStorage.getItem('token');
  const authHeader = token ? `Bearer ${token}` : '';

  const [locked, setLocked] = useState(true);
  const [course, setCourse] = useState(null);
  const [author, setAuthor] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedVolumes, setExpandedVolumes] = useState({});
  const [expandedChapters, setExpandedChapters] = useState({});
  const [editMode, setEditMode] = useState(false);
  const [volumes, setVolumes] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [directions, setDirections] = useState([]);
  const [levels, setLevels] = useState([]);
  const [userHasAccess, setUserHasAccess] = useState(false);

  const [draggedVolume, setDraggedVolume] = useState(null);
  const [draggedChapter, setDraggedChapter] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);

  const [editableCourse, setEditableCourse] = useState(null);
  const [showAddItemModal, setShowAddItemModal] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [editingTitle, setEditingTitle] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [textFilesToUpload, setTextFilesToUpload] = useState({});
  const [localTextContent, setLocalTextContent] = useState({});
  const [textRefreshKey, setTextRefreshKey] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [infoModal, setInfoModal] = useState({ show: false, title: '', message: '', onClose: null });

  const isAdmin = currentUser && ['admin', 'root', 'manage', 'quality', 'create', 'tutor', 'teacher'].includes(currentUser.role);

  useEffect(() => {
    fetchData();
    checkCCourse();
  }, [id]);

  useEffect(() => {
    if (course) {
      fetchUserData();
      checkUserAccess();
    }
  }, [course?.userId]);

  const checkUserAccess = async () => {
    if (!currentUser) {
      setUserHasAccess(false);
      return;
    }

    try {
      const response = await fetch(`${API_URL}/users/c`, {
        headers: { 'Authorization': authHeader },
      });

      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data;
        const courseIds = userData.enrolled || [];
        const courseId = id;
        const hasAccess = courseIds.some(cid => String(cid._id || cid.id || cid) === courseId);
        setUserHasAccess(hasAccess);
      } else {
        setUserHasAccess(false);
      }
    } catch (error) {
      console.error('Error checking access:', error);
      setUserHasAccess(false);
    }
  };

  const checkCCourse = async () => {
    if (!currentUser) {
      setLocked(true);
      return;
    }
    if (isAdmin) {
      setLocked(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/users/${currentUser.id || currentUser._id}`, {
        method: 'GET',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const resJson = await response.json();
        const userData = resJson.data || resJson;
        if (userData.courses) {
          const hasCourse = userData.courses.some((ch) => (ch._id || ch) === id);
          setLocked(!hasCourse);
        } else {
          setLocked(true);
        }
      }
    } catch (error) {
      setLocked(true);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const courseEndpoint = isAdmin ? `/api/manage/courses/${id}` : `/api/courses/${id}`;

      const [courseRes, directionsRes, levelsRes, filesRes] = await Promise.all([
        fetch(`${BASE_URL}${courseEndpoint}`, { headers: { 'Authorization': authHeader } }).catch(() => null),
        fetch(`${API_URL}/directions`).catch(() => null),
        fetch(`${API_URL}/levels`).catch(() => null),
        fetch(`${API_URL}/manage/courses/${id}/files`, {
          headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
        }).catch(() => null),
      ]);

      if (courseRes && courseRes.ok) {
        try {
          const courseData = await courseRes.json();
          const dataToSet = courseData.data || courseData;
          if (dataToSet) {
            setCourse(dataToSet);
            setEditableCourse({ ...dataToSet });
            setVolumes(dataToSet.volumes || []);
          }
        } catch (jsonErr) {
          console.error('Failed to parse course response:', jsonErr);
        }
      }

      if (directionsRes && directionsRes.ok) {
        try {
          const directionsData = await directionsRes.json();
          if (Array.isArray(directionsData.data)) setDirections(directionsData.data);
        } catch (jsonErr) {
          console.warn('Failed to parse directions response:', jsonErr);
        }
      }

      if (levelsRes && levelsRes.ok) {
        try {
          const levelsData = await levelsRes.json();
          if (Array.isArray(levelsData.data)) setLevels(levelsData.data);
        } catch (jsonErr) {
          console.warn('Failed to parse levels response:', jsonErr);
        }
      }

      if (filesRes && filesRes.ok) {
        try {
          const filesData = await filesRes.json();
          const allFiles = filesData.data || filesData.files || [];
          const contentFiles = allFiles.filter((file) => {
            const fileName = (file.originalName || file.filename || '').toLowerCase();
            const isThumbnail = fileName.includes('thumbnail') || (fileName.endsWith('.png') && allFiles.indexOf(file) === 0 && file.mimetype?.startsWith('image/'));
            const isSystemText = isSystemTextFile(file.originalName || file.filename || '');
            return !isThumbnail && !isSystemText;
          });
          setUploadedFiles(contentFiles);
        } catch (jsonErr) {
          console.warn('Failed to parse files response:', jsonErr);
        }
      }

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    if (course?.userId?.nickname) {
      setAuthor({
        nickname: course.userId.nickname,
        email: course.userId.email,
        firstName: course.userId.firstName,
        lastName: course.userId.lastName
      });
      return;
    }
    
    try {
      const uId = course?.userId?._id || course?.userId;
      if (!uId) return;
      
      // Try to use the standard /users/:id endpoint first (public with JWT)
      const response = await fetch(`${API_URL}/users/${uId}`, {
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
      }).catch(() => null);
      
      if (response && response.ok) {
        const data = await response.json();
        const userData = data.data || data;
        setAuthor({
          nickname: userData.nickname,
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName
        });
      } else if (response && !response.ok) {
        console.warn(`Failed to fetch user (${response.status}), using course data fallback`);
        // Fallback: use whatever is in the course object
        if (typeof course.userId === 'object' && course.userId) {
          setAuthor(course.userId);
        }
      }
    } catch (error) { 
      console.error('Error fetching user data:', error);
      // Fallback: use whatever is in the course object
      if (typeof course?.userId === 'object' && course.userId) {
        setAuthor(course.userId);
      }
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes!';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasChanges]);

  const isSystemTextFile = (filename) => {
    return /^vol-\d+-ch-\d+-item-\d+-\d+\.txt$/i.test(filename);
  };

  const toggleVolume = (volumeId) => setExpandedVolumes(prev => ({ ...prev, [volumeId]: !prev[volumeId] }));
  const toggleChapter = (chapterId) => setExpandedChapters(prev => ({ ...prev, [chapterId]: !prev[chapterId] }));

  const handleCourseFieldChange = (field, value) => {
    setEditableCourse(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSkillChange = (index, value) => {
    const newSkills = [...editableCourse.skills];
    newSkills[index] = value;
    setEditableCourse(prev => ({ ...prev, skills: newSkills }));
    setHasChanges(true);
  };

  const addSkill = () => {
    setEditableCourse(prev => ({ ...prev, skills: [...prev.skills, ''] }));
    setHasChanges(true);
  };

  const removeSkill = (index) => {
    const newSkills = editableCourse.skills.filter((_, i) => i !== index);
    setEditableCourse(prev => ({ ...prev, skills: newSkills }));
    setHasChanges(true);
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditableCourse(prev => ({ ...prev, thumbnail: reader.result }));
        setHasChanges(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const addVolume = () => {
    const newVolume = { vid: `vol-${Date.now()}`, title: t('coursePage.addVolume'), chapters: [] };
    setVolumes([...volumes, newVolume]);
    setHasChanges(true);
  };

  const deleteVolume = (volumeIndex) => {
    const volume = volumes[volumeIndex];
    const userInput = prompt(`${t('coursePage.deleteVolumePrompt')}:\n"${volume.title}"`);
    if (userInput === volume.title) {
      setVolumes(volumes.filter((_, i) => i !== volumeIndex));
      setHasChanges(true);
    }
  };

  const updateVolumeTitle = (volumeIndex, newTitle) => {
    const newVolumes = [...volumes];
    newVolumes[volumeIndex].title = newTitle;
    setVolumes(newVolumes);
    setHasChanges(true);
  };

  const addChapter = (volumeIndex) => {
    const newChapter = { cid: `ch-${Date.now()}`, title: t('coursePage.newChapter'), items: [] };
    const newVolumes = [...volumes];
    newVolumes[volumeIndex].chapters.push(newChapter);
    setVolumes(newVolumes);
    setHasChanges(true);
  };

  const deleteChapter = (volumeIndex, chapterIndex) => {
    const chapter = volumes[volumeIndex].chapters[chapterIndex];
    const userInput = prompt(`${t('coursePage.deleteChapterPrompt')}:\n"${chapter.title}"`);
    if (userInput === chapter.title) {
      const newVolumes = [...volumes];
      newVolumes[volumeIndex].chapters = newVolumes[volumeIndex].chapters.filter((_, i) => i !== chapterIndex);
      setVolumes(newVolumes);
      setHasChanges(true);
    }
  };

  const updateChapterTitle = (volumeIndex, chapterIndex, newTitle) => {
    const newVolumes = [...volumes];
    newVolumes[volumeIndex].chapters[chapterIndex].title = newTitle;
    setVolumes(newVolumes);
    setHasChanges(true);
  };

  const addContentItem = (volumeIndex, chapterIndex, type) => setShowAddItemModal({ volumeIndex, chapterIndex, type });

  const saveContentItem = (volumeIndex, chapterIndex, itemData) => {
    const newVolumes = [...volumes];
    const newItem = { iid: `item-${Date.now()}`, type: itemData.type, title: itemData.title, url: itemData.url || '' };
    newVolumes[volumeIndex].chapters[chapterIndex].items.push(newItem);
    setVolumes(newVolumes);

    if (itemData.type === 'text' && itemData.content) {
      const fileKey = `${newVolumes[volumeIndex].vid}-${newVolumes[volumeIndex].chapters[chapterIndex].cid}-${newItem.iid}`;
      const textBlob = new Blob([itemData.content], { type: 'text/plain' });
      const textFile = new File([textBlob], `${fileKey}.txt`, { type: 'text/plain' });
      setTextFilesToUpload(prev => ({ ...prev, [fileKey]: { file: textFile, itemId: newItem.iid, volumeIndex, chapterIndex } }));
    }
    setShowAddItemModal(null);
    setHasChanges(true);
  };

  const editContentItem = (volumeIndex, chapterIndex, itemIndex) => {
    const item = volumes[volumeIndex].chapters[chapterIndex].items[itemIndex];
    setEditingItem({ volumeIndex, chapterIndex, itemIndex, item });
  };

  const updateContentItem = (volumeIndex, chapterIndex, itemIndex, itemData) => {
    const newVolumes = [...volumes];
    const updatedItem = {
      ...newVolumes[volumeIndex].chapters[chapterIndex].items[itemIndex],
      type: itemData.type, title: itemData.title, url: itemData.url || newVolumes[volumeIndex].chapters[chapterIndex].items[itemIndex].url || ''
    };
    newVolumes[volumeIndex].chapters[chapterIndex].items[itemIndex] = updatedItem;
    setVolumes(newVolumes);

    if (itemData.type === 'text' && itemData.content) {
      const fileKey = `${newVolumes[volumeIndex].vid}-${newVolumes[volumeIndex].chapters[chapterIndex].cid}-${updatedItem.iid}`;
      const textBlob = new Blob([itemData.content], { type: 'text/plain' });
      const textFile = new File([textBlob], `${fileKey}.txt`, { type: 'text/plain' });
      setTextFilesToUpload(prev => ({ ...prev, [fileKey]: { file: textFile, itemId: updatedItem.iid, volumeIndex, chapterIndex } }));
    }

    setEditingItem(null);
    setHasChanges(true);
    if (itemData.type === 'text' && itemData.content !== undefined) {
      setLocalTextContent(prev => ({ ...prev, [updatedItem.iid]: itemData.content }));
    }
  };

  const deleteContentItem = (volumeIndex, chapterIndex, itemIndex) => {
    if (!window.confirm(t('coursePage.deleteItemConfirm'))) return;
    const newVolumes = [...volumes];
    newVolumes[volumeIndex].chapters[chapterIndex].items.splice(itemIndex, 1);
    setVolumes(newVolumes);
    setHasChanges(true);
  };

  const updateItemTitle = (volumeIndex, chapterIndex, itemIndex, newTitle) => {
    const newVolumes = [...volumes];
    newVolumes[volumeIndex].chapters[chapterIndex].items[itemIndex].title = newTitle;
    setVolumes(newVolumes);
    setHasChanges(true);
  };

  const handleVolumeDragStart = (e, index) => { if (!editMode) return; setDraggedVolume(index); e.dataTransfer.effectAllowed = 'move'; };
  const handleVolumeDrop = (e, targetIndex) => {
    if (!editMode || draggedVolume === null) return;
    e.preventDefault(); const newVolumes = [...volumes]; const [moved] = newVolumes.splice(draggedVolume, 1);
    newVolumes.splice(targetIndex, 0, moved); setVolumes(newVolumes); setDraggedVolume(null); setHasChanges(true);
  };
  const handleChapterDragStart = (e, volumeIndex, chapterIndex) => {
    if (!editMode) return; setDraggedChapter({ volumeIndex, chapterIndex }); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation();
  };
  const handleChapterDrop = (e, targetVolumeIndex, targetChapterIndex) => {
    if (!editMode || !draggedChapter) return; e.preventDefault(); e.stopPropagation(); const newVolumes = [...volumes];
    const [moved] = newVolumes[draggedChapter.volumeIndex].chapters.splice(draggedChapter.chapterIndex, 1);
    newVolumes[targetVolumeIndex].chapters.splice(targetChapterIndex, 0, moved); setVolumes(newVolumes); setDraggedChapter(null); setHasChanges(true);
  };
  const handleItemDragStart = (e, volumeIndex, chapterIndex, itemIndex) => {
    if (!editMode) return; setDraggedItem({ volumeIndex, chapterIndex, itemIndex }); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation();
  };
  const handleItemDrop = (e, targetVolumeIndex, targetChapterIndex, targetItemIndex) => {
    if (!editMode || !draggedItem) return; e.preventDefault(); e.stopPropagation(); const newVolumes = [...volumes];
    const [moved] = newVolumes[draggedItem.volumeIndex].chapters[draggedItem.chapterIndex].items.splice(draggedItem.itemIndex, 1);
    newVolumes[targetVolumeIndex].chapters[targetChapterIndex].items.splice(targetItemIndex, 0, moved); setVolumes(newVolumes); setDraggedItem(null); setHasChanges(true);
  };
  const handleDragOver = (e) => { if (!editMode) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };

  const parseTextSyntax = (text) => {
    if (!text) return '';
    const codeBlocks = [];
    let html = text.replace(/~\(([^)]+)\)\[([\s\S]+?)\]~/g, (_, lang, code) => {
      const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
      const highlighted = highlightSyntax(escaped, lang.toLowerCase().trim());
      const idx = codeBlocks.length;
      codeBlocks.push(
        `<div class="code-block"><div class="code-header"><span class="code-lang">${lang}</span><button class="code-copy-btn" onclick="(function(b){navigator.clipboard.writeText(b.closest('.code-block').querySelector('code').innerText);b.textContent='Copied!';setTimeout(()=>b.textContent='Copy',2000)})(this)">Copy</button></div><pre><code>${highlighted}</code></pre></div>`
      );
      return `\x00CODE${idx}\x00`;
    });
    html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    html = html.replace(/~\(([^\|]+)\)\[([^\]]+)\]~/g, '<code type="$1">$2</code>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/`\{([^}]+)\}`/g, '<p>$1</p>');
    html = html.replace(/\{(https?:\/\/[^}]+)\}/g, '<video src="$1" class="video-player" controls></video>');
    html = html.replace(/\((https?:\/\/[^)]+)\)/g, (_, rawUrl) => {
      const toEmbedUrl = (url) => {
        if (url.includes('youtube.com/embed/')) return url;
        const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
        const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
        if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
        const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/);
        if (shortsMatch) return `https://www.youtube.com/embed/${shortsMatch[1]}`;
        return url;
      };
      return `<iframe src="${toEmbedUrl(rawUrl.trim())}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    });
    html = html.replace(/!\[([^\|]+)\|(https?:\/\/[^\]]+)\]!/g, '<a href="$2" download class="text-download-link"><i class="bi bi-download"></i> $1</a>');
    html = html.replace(/@(https?:\/\/[^@]+)@/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    html = html.replace(/#(https?:\/\/[^#]+)#/g, '<img alt="image" class="content-image" src="$1">');
    html = html.replace(/^(\d+)\.\s(.+)$/gm, '<li class="numbered-item">$2</li>');
    html = html.replace(/(<li class="numbered-item">.*?<\/li>\n?)+/gs, '<ol>$&</ol>');
    html = html.replace(/^[•\-\*]\s(.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*?<\/li>\n?)+/gs, '<ul>$&</ul>');
    html = html.replace(/\\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    html = html.replace(/\\n/g, '<br>');
    html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => codeBlocks[+i]);
    return html;
  };

  function highlightSyntax(code, lang) {
    const langAliases = { js: 'javascript', ts: 'typescript', py: 'python', 'c++': 'cpp', 'c#': 'cs', sh: 'bash', shell: 'bash' };
    const normalized = langAliases[lang] || lang;
    const kwMap = {
      javascript: new Set(['const','let','var','function','return','if','else','for','while','class','import','export','default','new','this','async','await','try','catch','throw','typeof','instanceof','null','undefined','true','false','switch','case','break','continue','do','in','of','from','static','extends','super','yield','delete','void','debugger']),
      python:     new Set(['def','class','return','if','elif','else','for','while','import','from','as','with','try','except','raise','True','False','None','and','or','not','in','is','pass','lambda','yield','global','nonlocal','del','assert','finally','break','continue','async','await','print','len','range','type','int','str','float','bool','list','dict','set','tuple']),
      cpp:        new Set(['auto','break','case','char','const','constexpr','continue','default','delete','do','double','else','enum','explicit','extern','false','float','for','friend','goto','if','inline','int','long','mutable','namespace','new','noexcept','nullptr','operator','override','private','protected','public','register','return','short','signed','sizeof','static','static_cast','struct','switch','template','this','throw','true','try','typedef','typeid','typename','union','unsigned','using','virtual','void','volatile','while','class','catch','string','vector','map','set','pair','cout','cin','endl','std']),
    };
    const kwSet = kwMap[normalized] || new Set();
    const span = (cls, txt) => `<span class="${cls}">${txt}</span>`;
    
    if (['html','xml'].includes(normalized)) {
      return code.replace(/(&lt;\/?)([\w:-]+)([\s\S]*?)(\/?&gt;)/g, (_, open, tagName, attrs, close) => {
        const hlAttrs = attrs.replace(/([\w:-]+)(=)(&quot;[^&]*&quot;|&#039;[^&]*&#039;)/g, (__, name, eq, val) => span('hl-attr', name) + eq + span('hl-string', val));
        return span('hl-tag', open + tagName) + hlAttrs + span('hl-tag', close);
      });
    }
    
    if (['css','scss','less'].includes(normalized)) {
      return code.replace(/(\/\*[\s\S]*?\*\/)/g, span('hl-comment', '$1')).replace(/^([.#]?[\w-]+)(?=\s*\{)/gm, span('hl-fn', '$1')).replace(/([\w-]+)(?=\s*:)/g, span('hl-attr', '$1'));
    }

    const isC = ['c','cpp'].includes(normalized);
    const parts = [];
    parts.push('(\\/\\*[\\s\\S]*?\\*\\/)');
    parts.push('(\\/\\/[^\\n]*)');
    if (normalized === 'sql') parts.push('(--[^\\n]*)');
    if (['py','python','bash','sh','ruby','r'].includes(normalized)) parts.push('(#[^\\n]*)');
    if (isC) parts.push('(^#\\s*(?:include|define|undef|ifdef|ifndef|endif|elif|pragma|error|line|if)\\b[^\\n]*)');
    parts.push('(&quot;(?:[^&]|&(?!quot;))*?&quot;)');
    parts.push('(&#039;(?:[^&]|&(?!#039;))*?&#039;)');
    parts.push('(`[\\s\\S]*?`)');
    parts.push('(\\b\\d+\\.?\\d*(?:[eE][+-]?\\d+)?[uUlLfF]?\\b)');
    parts.push('([a-zA-Z_$][\\w$]*)');

    const tokenRe = new RegExp(parts.join('|'), isC ? 'gm' : 'g');
    return code.replace(tokenRe, (match, ...groups) => {
      const idx = groups.findIndex(g => g !== undefined);
      const strGroupStart = parts.findIndex(p => p.startsWith('(&quot;'));
      if (idx < strGroupStart) return (isC && parts[idx] && parts[idx].startsWith('(^#')) ? span('hl-preprocessor', match) : span('hl-comment', match);
      const numGroupIdx = parts.findIndex(p => p.startsWith('(\\b\\d'));
      const identGroupIdx = parts.findIndex(p => p.startsWith('([a-zA'));
      if (idx >= strGroupStart && idx < numGroupIdx) return span('hl-string', match);
      if (idx === numGroupIdx) return span('hl-number', match);
      if (idx === identGroupIdx) return kwSet.has(match) ? span('hl-keyword', match) : match;
      return match;
    });
  }

  const resetUnsavedState = () => {
    setTextFilesToUpload({});
    setLocalTextContent({});
    setHasChanges(false);
    setTextRefreshKey(k => k + 1);
  };

  const handleSaveChanges = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const urlUpdates = {};
      if (Object.keys(textFilesToUpload).length > 0) {
        const uploadResults = await Promise.all(
          Object.entries(textFilesToUpload).map(async ([fileKey, fileData]) => {
            const formData = new FormData();
            formData.append('file', fileData.file);
            try {
              const res = await fetch(`${API_URL}/manage/courses/${id}/files`, {
                method: 'POST', headers: { 'Authorization': authHeader }, body: formData
              });
              if (res.ok) {
                const result = await res.json();
                const fileUrl = result.data?.link?.url || result.data?.url || result.url;
                if (fileUrl) urlUpdates[fileKey] = { url: fileUrl, ...fileData };
              }
              return res.ok;
            } catch { return false; }
          })
        );
        if (uploadResults.some(ok => !ok)) {
          setInfoModal({ show: true, title: 'Upload Error', message: t('coursePage.alertUploadFailed') || 'Some files failed to upload.', onClose: null });
          resetUnsavedState(); await fetchData(); return;
        }
      }

      const newVolumes = volumes.map(vol => ({
        ...vol,
        chapters: vol.chapters.map(ch => ({
          ...ch,
          items: ch.items.map(item => {
            const matchKey = Object.keys(urlUpdates).find(k => urlUpdates[k].itemId === item.iid);
            return matchKey ? { ...item, url: urlUpdates[matchKey].url } : item;
          })
        }))
      }));

      const response = await fetch(`${API_URL}/manage/courses/${id}`, {
        method: 'PUT',
        headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editableCourse, volumes: newVolumes })
      });

      if (response.ok) {
        setCourse({ ...editableCourse, volumes: newVolumes });
        setEditableCourse({ ...editableCourse, volumes: newVolumes });
        setVolumes(newVolumes);
        resetUnsavedState();
        setEditMode(false);
        await fetchData();
        setInfoModal({ show: true, title: '✓ Saved', message: t('coursePage.alertSaveSuccess') || 'Changes saved successfully.', onClose: null });
      } else {
        setInfoModal({ show: true, title: 'Save failed', message: t('coursePage.alertSaveFailed') || 'Could not save changes.', onClose: null });
        resetUnsavedState(); await fetchData();
      }
    } catch (err) {
      setInfoModal({ show: true, title: 'Error', message: `${t('coursePage.alertError') || 'Error:'} ${err.message}.`, onClose: null });
      resetUnsavedState(); await fetchData();
    } finally { setIsSaving(false); }
  };

  const handleAddToCart = () => {
    if (!course) return;
    const productId = course._id || course.id;
    const productPrice = course.price || course.trans?.[0]?.price || 0;
    const productTitle = course.title || course.trans?.[0]?.title || 'Unknown';
    const productImg = course.links?.[0]?.url || course.img || '';
    
    addItem({
      id: productId,
      title: productTitle,
      price: productPrice,
      img: productImg,
      author: author.nickname || author.firstName || 'Unknown'
    }, 1);
    
    setInfoModal({ show: true, title: t('coursePage.addedToCart') || 'Added to cart', message: `"${productTitle}" has been added to your cart.`, onClose: null });
    navigate('/cart');
  };
  
  const handleEnroll = () => {
    setInfoModal({ show: true, title: '✓ Enrolled', message: `${t('coursePage.enrolledIn') || 'Enrolled in'} "${course.title || course.trans?.[0]?.title}"!`, onClose: null });
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const renderStars = (ratings = 0) => {
    const stars = [];
    const fullStars = Math.floor(ratings);
    for (let i = 0; i < fullStars; i++) stars.push(<i key={i} className="bi bi-star-fill text-warning"></i>);
    if (ratings % 1 !== 0) stars.push(<i key="half" className="bi bi-star-half text-warning"></i>);
    while (stars.length < 5) stars.push(<i key={`empty-${stars.length}`} className="bi bi-star text-warning"></i>);
    return stars;
  };

  if (loading) {
    return (
      <div className="course-preview-loading">
        <div className="spinner-border text-primary"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="course-preview-page">
        <div className="row mb-1">
          <div className="col-12">
            <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 mb-2" onClick={() => navigate('/account')}>
              <i className="bi bi-arrow-left"></i> {t('coursePage.back')}
            </button>
          </div>
        </div>
        <div className="course-preview-error"><h3>{t('coursePage.notFound')}</h3></div>
      </div>
    );
  }

  const hasContent = volumes.length > 0;
  const displayAuthorName = author.firstName ? `${author.firstName} ${author.lastName || ''}` : (author.nickname || 'Unknown');
  const courseImage = editableCourse?.links?.[0]?.url || '';

  return (
    <>
      <div className="course-preview-page">
        <div className="row mb-1">
          <div className="col-12">
            <button className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 mb-2" onClick={() => navigate('/account')}>
              <i className="bi bi-arrow-left"></i> {t('coursePage.backToAccount')}
            </button>
          </div>
        </div>

        <div className="course-preview-container">
          <div className="content-wrapper">
            <div className="course-info-section">
              <div className="mobile-thumbnail">
                {editMode ? (
                  <div className="thumbnail-upload">
                    <input type="file" accept="image/*" onChange={handleThumbnailChange} id="mobile-thumbnail-upload" style={{ display: 'none' }} />
                    <label htmlFor="mobile-thumbnail-upload" className="thumbnail-upload-label">
                      <AuthImage src={courseImage} alt="thumbnail" fallback={<div className="bg-secondary text-white d-flex align-items-center justify-content-center p-5"><i className="bi bi-image fs-1"></i></div>} />
                      <div className="thumbnail-overlay"><i className="bi bi-camera"></i><span>{t('coursePage.changePhoto')}</span></div>
                    </label>
                  </div>
                ) : (
                  <AuthImage src={courseImage} alt="thumbnail" fallback={<div className="bg-secondary text-white d-flex align-items-center justify-content-center p-5"><i className="bi bi-image fs-1"></i></div>} />
                )}
              </div>

              <div className="title-price-row">
                {editMode ? (
                  <input type="text" className="form-control course-title-input" value={editableCourse.trans[0].title} onChange={(e) => handleCourseFieldChange('title', e.target.value)} />
                ) : (
                  <h1 className="course-title">{course.trans[0].title}</h1>
                )}
                <div className="mobile-price">
                  {editMode ? (
                    <input type="number" className="form-control price-input" value={editableCourse.price || editableCourse.trans?.[0]?.price || 0} onChange={(e) => handleCourseFieldChange('price', parseFloat(e.target.value))} step="0.01" min="0" />
                  ) : (course.price || course.trans?.[0]?.price || 0) > 0 ? '$' + (course.price || course.trans?.[0]?.price) : 'Free'}
                </div>
              </div>

              <div className="badges-row">
                {editMode ? (
                  <>
                    <select className="form-select badge-input" value={editableCourse.direction} onChange={(e) => handleCourseFieldChange('direction', e.target.value)}>
                      <option value="">{t('coursePage.selectDirection')}</option>
                      {directions.map((dir) => <option key={dir._id} value={dir.directionName}>{dir.directionName}</option>)}
                    </select>
                    <select className="form-select badge-input" value={editableCourse.level} onChange={(e) => handleCourseFieldChange('level', e.target.value)}>
                      <option value="">{t('coursePage.selectLevel')}</option>
                      {levels.filter(l => l.directionName === editableCourse.direction).map((l) => <option key={l._id} value={l.levelName}>{l.levelName}</option>)}
                    </select>
                  </>
                ) : (
                  <>
                    <span className="badge badge-direction">{course.direction}</span>
                    <span className="badge badge-level">{course.level}</span>
                  </>
                )}
              </div>

              <div className="description-box">
                {editMode ? (
                  <textarea className="form-control" value={editableCourse.description} onChange={(e) => handleCourseFieldChange('description', e.target.value)} rows="3" />
                ) : (
                  <p>{course.trans[0].description}</p>
                )}
              </div>

              <div className="mobile-skills">
                <h4 className="section-title">{t('coursePage.whatYouLearn')}</h4>
                <div className="skills-grid">
                  {editMode ? (
                    <>
                      {editableCourse.skills?.map((skill, idx) => (
                        <div className="skill-item-edit" key={idx}>
                          <input type="text" className="form-control skill-input" value={skill} onChange={(e) => handleSkillChange(idx, e.target.value)} />
                          <button className="btn btn-sm btn-danger" onClick={() => removeSkill(idx)}><i className="bi bi-x"></i></button>
                        </div>
                      ))}
                      <button className="btn btn-sm btn-primary" onClick={addSkill}><i className="bi bi-plus"></i> {t('coursePage.addSkill')}</button>
                    </>
                  ) : (
                    course.trans[0].skills?.map((item, idx) => (
                      <div className="skill-item" key={idx}><i className="bi bi-check-circle-fill text-success"></i><span>{item}</span></div>
                    ))
                  )}
                </div>
              </div>

              <div className="ratings-section">
                <span className="rating-number">{course.ratings || '0.0'}</span>
                <div className="stars">{renderStars(course.ratings)}</div>
                <span className="students-count">({course.ratingsCount || 0} students)</span>
              </div>

              <div className="course-meta">
                <span className="meta-item">{t('coursePage.createdBy')} <strong>{displayAuthorName}</strong></span>
                <span className="meta-divider">•</span>
                <span className="meta-item"> {t('coursePage.updated')} {formatDate(course.updatedAt)}</span>
              </div>

              <div className="mobile-buttons">
                {(userHasAccess || isAdmin) ? (
                  <>
                    <button className="btn btn-success btn-lg w-100 mb-2" onClick={() => navigate(`/view-course/${id}`)}>
                      <i className="bi bi-play-circle me-2"></i>{t('coursePage.viewCourse')}
                    </button>
                    <p className="guarantee-text">{t('coursePage.guaranteeText')}</p>
                  </>
                ) : (
                  <>
                    <button className="btn btn-primary btn-lg w-100 mb-2" onClick={handleAddToCart}>{t('coursePage.addToCart')}</button>
                    <button className="btn btn-outline-secondary btn-lg w-100" onClick={handleEnroll}>{t('coursePage.enrollNow')}</button>
                    <p className="guarantee-text">{t('coursePage.guaranteeText')}</p>
                  </>
                )}
              </div>

              <div className="desktop-skills section-card">
                <h4 className="section-title">{t('coursePage.whatYouLearn')}</h4>
                <div className="skills-grid">
                  {editMode ? (
                    <>
                      {editableCourse.skills?.map((skill, idx) => (
                        <div className="skill-item-edit" key={idx}>
                          <input type="text" className="form-control skill-input" value={skill} onChange={(e) => handleSkillChange(idx, e.target.value)} />
                          <button className="btn btn-sm btn-danger" onClick={() => removeSkill(idx)}><i className="bi bi-x"></i></button>
                        </div>
                      ))}
                      <button className="btn btn-sm btn-primary mt-2" onClick={addSkill}><i className="bi bi-plus"></i> {t('coursePage.addSkill')}</button>
                    </>
                  ) : (
                    course.skills?.map((item, idx) => (
                      <div className="skill-item" key={idx}><i className="bi bi-check-circle-fill text-success"></i><span>{item}</span></div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="purchase-card-column">
              <div className="purchase-card">
                <div className="course-thumbnail">
                  {editMode ? (
                    <div className="thumbnail-upload">
                      <input type="file" accept="image/*" onChange={handleThumbnailChange} id="desktop-thumbnail-upload" style={{ display: 'none' }} />
                      <label htmlFor="desktop-thumbnail-upload" className="thumbnail-upload-label">
                        <AuthImage src={courseImage} alt="thumbnail" fallback={<div className="bg-secondary text-white d-flex align-items-center justify-content-center h-100"><i className="bi bi-image fs-1"></i></div>} />
                        <div className="thumbnail-overlay"><i className="bi bi-camera"></i><span>{t('coursePage.changePhoto')}</span></div>
                      </label>
                    </div>
                  ) : (
                    <AuthImage src={courseImage} alt="thumbnail" fallback={<div className="bg-secondary text-white d-flex align-items-center justify-content-center h-100"><i className="bi bi-image fs-1"></i></div>} />
                  )}
                </div>
                <div className="purchase-card-body">
                  <div className="price-section">
                    <h2 className="price">
                      {editMode ? (
                        <input type="number" className="form-control price-input-desktop" value={editableCourse.price || editableCourse.trans?.[0]?.price || 0} onChange={(e) => handleCourseFieldChange('price', parseFloat(e.target.value))} step="0.01" min="0" />
                      ) : (course.price || course.trans?.[0]?.price || 0) > 0 ? '$' + (course.price || course.trans?.[0]?.price) : 'Free'}
                    </h2>
                  </div>
                  <div className="purchase-buttons">
                    {(userHasAccess || isAdmin) ? (
                      <>
                        <button className="btn btn-success btn-lg w-100 mb-2" onClick={() => navigate(`/view-course/${id}`)}>
                          <i className="bi bi-play-circle me-2"></i>{t('coursePage.viewCourse')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-primary btn-lg w-100 mb-2" onClick={handleAddToCart}>{t('coursePage.addToCart')}</button>
                        <button className="btn btn-outline-secondary btn-lg w-100" onClick={handleEnroll}>{t('coursePage.enrollNow')}</button>
                      </>
                    )}
                  </div>
                  <p className="guarantee-text">{t('coursePage.guaranteeText')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="course-content-section">
            {isAdmin && (
              <div className="admin-controls">
                <button className={`btn ${editMode ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => setEditMode(!editMode)}>
                  <i className="bi bi-pencil-square me-1"></i>
                  {editMode ? t('coursePage.exitEditMode') : t('coursePage.editCourse')}
                </button>
                {hasChanges && (
                  <button className="btn btn-success ms-2" onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving ? <><span className="spinner-border spinner-border-sm me-1" role="status"></span>{t('coursePage.saving')}…</> : <><i className="bi bi-save me-1"></i>{t('coursePage.saveChanges')}</>}
                  </button>
                )}
              </div>
            )}

            <div className="section-card">
              <div className="section-header">
                <h4 className="section-title">{t('coursePage.courseContent')}</h4>
                {editMode && hasContent && (
                  <button className="btn btn-sm btn-primary" onClick={addVolume}><i className="bi bi-folder-plus me-1"></i>{t('coursePage.addVolume')}</button>
                )}
              </div>

              {!hasContent ? (
                <div className="no-content">
                  <i className="bi bi-inbox"></i><p>{t('coursePage.noContent')}</p>
                  {editMode && <button className="btn btn-primary" onClick={addVolume}><i className="bi bi-folder-plus me-1"></i>{t('coursePage.addFirstVolume')}</button>}
                </div>
              ) : (
                <div className={`volumes-list`}>
                  {volumes.map((volume, volumeIndex) => (
                    <div key={volume.vid} className={`volume-item ${editMode ? 'draggable' : ''}`} draggable={editMode} onDragStart={(e) => handleVolumeDragStart(e, volumeIndex)} onDragOver={handleDragOver} onDrop={(e) => handleVolumeDrop(e, volumeIndex)}>
                      <div className="volume-header" onClick={() => !editMode && toggleVolume(volume.vid)}>
                        {editMode ? <i className="bi bi-grip-vertical drag-handle me-2"></i> : <i className={`bi bi-chevron-${expandedVolumes[volume.vid] ? 'down' : 'right'} me-2`}></i>}
                        {editMode && editingTitle?.type === 'volume' && editingTitle?.volumeIndex === volumeIndex ? (
                          <input type="text" className="form-control title-edit-input" value={volume.title} onChange={(e) => updateVolumeTitle(volumeIndex, e.target.value)} onBlur={() => setEditingTitle(null)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                        ) : <span className="volume-title-text">{volume.title}</span>}
                        <span className="volume-count">{volume.chapters.length} {volume.chapters.length === 1 ? t('coursePage.chapter_one') : t('coursePage.chapter_other')}</span>
                        {editMode && (
                          <div className="header-actions" onClick={(e) => e.stopPropagation()}>
                            <button className="btn btn-sm btn-outline-primary" onClick={() => setEditingTitle({ type: 'volume', volumeIndex })}><i className="bi bi-pencil"></i></button>
                            <button className="btn btn-sm btn-outline-danger" onClick={() => deleteVolume(volumeIndex)}><i className="bi bi-trash"></i></button>
                          </div>
                        )}
                      </div>

                      {(expandedVolumes[volume.vid] || editMode) && (
                        <div className="volume-content">
                          {volume.chapters.length === 0 ? (
                            <div className="no-content-small"><p>{t('coursePage.noChapters')}</p>{editMode && <button className="btn btn-sm btn-primary" onClick={() => addChapter(volumeIndex)}><i className="bi bi-plus"></i> {t('coursePage.addChapter')}</button>}</div>
                          ) : (
                            <div className={`chapters-list ${locked ? 'muted blocked' : ''}`}>
                              {volume.chapters.map((chapter, chapterIndex) => (
                                <div key={chapter.cid} className={`chapter-item ${editMode ? 'draggable' : ''}`} draggable={editMode} onDragStart={(e) => handleChapterDragStart(e, volumeIndex, chapterIndex)} onDragOver={handleDragOver} onDrop={(e) => handleChapterDrop(e, volumeIndex, chapterIndex)}>
                                  <div className="chapter-header" onClick={() => !editMode && toggleChapter(chapter.cid)}>
                                    {editMode ? <i className="bi bi-grip-vertical drag-handle me-2"></i> : <i className={`bi bi-chevron-${expandedChapters[chapter.cid] ? 'down' : 'right'} me-2`}></i>}
                                    {editMode && editingTitle?.type === 'chapter' && editingTitle?.volumeIndex === volumeIndex && editingTitle?.chapterIndex === chapterIndex ? (
                                      <input type="text" className="form-control title-edit-input" value={chapter.title} onChange={(e) => updateChapterTitle(volumeIndex, chapterIndex, e.target.value)} onBlur={() => setEditingTitle(null)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(null); }} autoFocus onClick={(e) => e.stopPropagation()} />
                                    ) : <span className="chapter-title-text">{chapter.title}</span>}
                                    <span className="chapter-count">{chapter.items.length} {chapter.items.length === 1 ? t('coursePage.item_one') : t('coursePage.item_other')}</span>
                                    {editMode && (
                                      <div className="header-actions" onClick={(e) => e.stopPropagation()}>
                                        <button className="btn btn-sm btn-outline-primary" onClick={() => setEditingTitle({ type: 'chapter', volumeIndex, chapterIndex })}><i className="bi bi-pencil"></i></button>
                                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteChapter(volumeIndex, chapterIndex)}><i className="bi bi-trash"></i></button>
                                      </div>
                                    )}
                                  </div>

                                  {(expandedChapters[chapter.cid] || editMode) && !locked && (
                                    <div className="chapter-content">
                                      {chapter.items.length === 0 ? (
                                        <div className="no-content-small"><p>{t('coursePage.noContentInChapter')}</p></div>
                                      ) : (
                                        chapter.items.map((item, itemIndex) => (
                                          <div key={item.iid} className={`content-item ${editMode ? 'draggable' : ''}`} draggable={editMode} onDragStart={(e) => handleItemDragStart(e, volumeIndex, chapterIndex, itemIndex)} onDragOver={handleDragOver} onDrop={(e) => handleItemDrop(e, volumeIndex, chapterIndex, itemIndex)}>
                                            {editMode && (
                                              <div className="item-controls">
                                                <i className="bi bi-grip-vertical drag-handle"></i>
                                                {editingTitle?.type === 'item' && editingTitle?.volumeIndex === volumeIndex && editingTitle?.chapterIndex === chapterIndex && editingTitle?.itemIndex === itemIndex ? (
                                                  <input type="text" className="form-control title-edit-input flex-1" value={item.title} onChange={(e) => updateItemTitle(volumeIndex, chapterIndex, itemIndex, e.target.value)} onBlur={() => setEditingTitle(null)} onKeyDown={(e) => { if (e.key === 'Enter') setEditingTitle(null); }} autoFocus />
                                                ) : <span className="item-title flex-1">{item.title}</span>}
                                                <button className="btn btn-sm btn-outline-info" onClick={() => editContentItem(volumeIndex, chapterIndex, itemIndex)}><i className="bi bi-pencil-fill"></i></button>
                                                <button className="btn btn-sm btn-danger" onClick={() => deleteContentItem(volumeIndex, chapterIndex, itemIndex)}><i className="bi bi-trash"></i></button>
                                              </div>
                                            )}

                                            {!editMode && item.title && <h5 className="content-item-title">{item.title}</h5>}

                                            {item.type === 'video' ? <div className="video-item"><video src={item.url} controls className="video-player" /></div> :
                                             item.type === 'image' ? <div className="image-item"><img src={item.url} alt={item.title} className="content-image" /></div> :
                                             item.type === 'audio' ? <div className="audio-item"><audio src={item.url} controls className="audio-player" /></div> :
                                             item.type === 'document' ? <div className="document-item"><a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-info"><i className="bi bi-file-pdf me-1"></i> {t('coursePage.openDocument')}</a></div> :
                                             item.type === 'archive' ? <div className="archive-item"><a href={item.url} download className="btn btn-sm btn-outline-info"><i className="bi bi-file-zip me-1"></i> {t('coursePage.downloadArchive')}</a></div> :
                                             item.type === 'text' ? <TextItemDisplay key={`${item.iid}-${textRefreshKey}`} url={item.url} parseTextSyntax={parseTextSyntax} refreshKey={textRefreshKey} localContent={localTextContent[item.iid]} /> : null}
                                          </div>
                                        ))
                                      )}
                                      {editMode && (
                                        <div className="add-item-buttons">
                                          <button className="btn btn-sm btn-outline-primary" onClick={() => addContentItem(volumeIndex, chapterIndex, 'text')}><i className="bi bi-file-text me-1"></i> {t('coursePage.text')}</button>
                                          <button className="btn btn-sm btn-outline-primary" onClick={() => addContentItem(volumeIndex, chapterIndex, 'video')}><i className="bi bi-camera-video me-1"></i> {t('coursePage.video')}</button>
                                          <button className="btn btn-sm btn-outline-primary" onClick={() => addContentItem(volumeIndex, chapterIndex, 'document')}><i className="bi bi-file-pdf me-1"></i> {t('coursePage.document')}</button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {editMode && <button className="btn btn-sm btn-outline-primary mt-2" onClick={() => addChapter(volumeIndex)}><i className="bi bi-plus"></i> {t('coursePage.addChapter')}</button>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddItemModal && (
        <AddItemModal type={showAddItemModal.type} onSave={(itemData) => saveContentItem(showAddItemModal.volumeIndex, showAddItemModal.chapterIndex, itemData)} onClose={() => setShowAddItemModal(null)} parseTextSyntax={parseTextSyntax} uploadedFiles={uploadedFiles} courseId={id} authHeader={authHeader} />
      )}
      {editingItem && (
        <AddItemModal type={editingItem.item.type} isEditing={true} initialData={editingItem.item} onSave={(itemData) => updateContentItem(editingItem.volumeIndex, editingItem.chapterIndex, editingItem.itemIndex, itemData)} onClose={() => setEditingItem(null)} parseTextSyntax={parseTextSyntax} uploadedFiles={uploadedFiles} courseId={id} authHeader={authHeader} />
      )}
      <UtilityModal
        show={infoModal.show}
        type="info"
        title={infoModal.title}
        message={infoModal.message}
        onClose={() => { setInfoModal({ show: false, title: '', message: '', onClose: null }); infoModal.onClose?.(); }}
      />
    </>
  );
}

function TextItemDisplay({ url, parseTextSyntax, refreshKey, localContent }) {
  const { t } = useContext(SettingsContext);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('token');

  useEffect(() => {
    if (localContent !== undefined) { setContent(localContent); setLoading(false); return; }
    if (!url) { setLoading(false); return; }
    const fetchContent = async () => {
      try {
        const response = await fetch(`${BASE_URL}${url}?_=${refreshKey || Date.now()}`, {
          headers: { 'Authorization': token ? `Bearer ${token}` : '' }
        });
        if (response.ok) setContent(await response.text());
      } catch (err) {} finally { setLoading(false); }
    };
    fetchContent();
  }, [url, refreshKey, localContent]);

  if (loading) return <div className="text-item"><p><em>{t('coursePage.loadingContent')}</em></p></div>;
  return <div className="text-item"><div dangerouslySetInnerHTML={{ __html: parseTextSyntax(content) }} /></div>;
}

function AddItemModal({ type, isEditing, initialData, onSave, onClose, parseTextSyntax, uploadedFiles = [], courseId, authHeader }) {
  const { t } = useContext(SettingsContext);
  const [title, setTitle]               = useState(initialData?.title || '');
  const [content, setContent]           = useState(initialData?.content || '');
  const [url, setUrl]                   = useState(initialData?.url || '');
  const [selectedFileId, setSelectedFileId] = useState('');
  const [uploading, setUploading]       = useState(false);
  const [uploadError, setUploadError]   = useState('');
  const [uploadedName, setUploadedName] = useState('');
  const [titleError, setTitleError]     = useState(false);
  const [urlError, setUrlError]         = useState(false);

  // Определяем accept по типу
  const acceptMap = {
    video:    'video/*',
    image:    'image/*',
    document: 'application/pdf,.doc,.docx',
    archive:  '.zip,.rar,.7z',
    audio:    'audio/*',
  };
  const acceptAttr = acceptMap[type] || '*/*';

  // Загружаем файл сразу на сервер и получаем URL
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    e.target.value = '';

    setUploading(true);
    setUploadError('');
    setUploadedName(selectedFile.name);

    try {
      const fd = new FormData();
      fd.append('file', selectedFile);

      const res = await fetch(`${API_URL}/manage/courses/${courseId}/files`, {
        method: 'POST',
        headers: { 'Authorization': authHeader },
        body: fd,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Upload failed: ${res.status}`);
      }

      const result = await res.json();
      // Сервер возвращает url в разных форматах — пробуем все варианты
      const serverUrl = result.data?.link?.url
        || result.data?.url
        || result.url
        || result.data?.filename && `/api/files/courses/${courseId}/${result.data.filename}`;

      if (!serverUrl) throw new Error('Server did not return a file URL');

      const fullUrl = serverUrl.startsWith('http') ? serverUrl : `${BASE_URL}${serverUrl}`;
      setUrl(fullUrl);
      setSelectedFileId('');
    } catch (err) {
      setUploadError(err.message);
      setUploadedName('');
    } finally {
      setUploading(false);
    }
  };

  const handleExistingFileSelect = (e) => {
    const fileId = e.target.value;
    setSelectedFileId(fileId);
    setUploadError('');
    if (fileId) {
      const selectedFile = uploadedFiles.find(f => f.path === fileId || f.url === fileId);
      if (selectedFile) {
        const fileUrl = (selectedFile.url || selectedFile.path || '').startsWith('http')
          ? (selectedFile.url || selectedFile.path)
          : `${BASE_URL}${selectedFile.url || selectedFile.path}`;
        setUrl(fileUrl);
        setUploadedName(selectedFile.originalName || selectedFile.filename || '');
      }
    } else {
      setUrl('');
      setUploadedName('');
    }
  };

  const handleSave = () => {
    if (!title.trim()) { setTitleError(true); return; }
    if (type === 'text') { onSave({ type, title, content }); return; }
    if (!url) { setUrlError(true); return; }
    onSave({ type, title, url, content: undefined });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h5>{isEditing ? t('coursePage.modalEdit') : t('coursePage.modalAdd')} {type.toUpperCase()}</h5>
          <button className="btn-close" onClick={onClose}></button>
        </div>
        <div className="modal-body">
          {/* Заголовок */}
          <div className="mb-3">
            <label className="form-label">{t('coursePage.title')}</label>
            <input type="text" className="form-control" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {type === 'text' ? (
            <div className="mb-3">
              <label className="form-label">{t('coursePage.content')}</label>
              <textarea className="form-control" value={content} onChange={(e) => setContent(e.target.value)} rows="10" />
            </div>
          ) : (
            <>
              {/* Выбор из уже загруженных */}
              {uploadedFiles.length > 0 && (
                <div className="mb-3">
                  <label className="form-label">{t('coursePage.selectFromUploaded')}</label>
                  <select className="form-select" value={selectedFileId} onChange={handleExistingFileSelect}>
                    <option value="">-- Choose a file --</option>
                    {uploadedFiles.map(f => (
                      <option key={f.url || f.path} value={f.url || f.path}>
                        {f.originalName || f.filename}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Загрузка нового файла */}
              <div className="mb-3">
                <label className="form-label">{t('coursePage.uploadNewFile')}</label>
                <div className="file-upload-area">
                  <input
                    type="file"
                    accept={acceptAttr}
                    onChange={handleFileChange}
                    id="file-input"
                    style={{ display: 'none' }}
                    disabled={uploading}
                  />
                  <label
                    htmlFor="file-input"
                    className="file-upload-label"
                    style={{ cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.7 : 1 }}
                  >
                    {uploading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"/>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-upload fs-1"></i>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                          {acceptAttr.replace(/\*/g, 'any').replace(/,/g, ', ')}
                        </p>
                      </>
                    )}
                  </label>
                </div>

                {/* Статус загруженного файла */}
                {uploadError && (
                  <div className="alert alert-danger py-2 mt-2 small">
                    <i className="bi bi-exclamation-triangle me-1"/>
                    {uploadError}
                  </div>
                )}
                {url && !uploadError && (
                  <div className="d-flex align-items-center gap-2 mt-2 p-2 rounded"
                    style={{ background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.3)' }}>
                    <i className="bi bi-check-circle-fill text-success"/>
                    <span className="small text-truncate" style={{ maxWidth: 300 }}>
                      {uploadedName || url.split('/').pop()}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-link text-danger p-0 ms-auto"
                      onClick={() => { setUrl(''); setUploadedName(''); setSelectedFileId(''); }}
                    >
                      <i className="bi bi-x-lg"/>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>{t('coursePage.cancel')}</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={uploading || (type !== 'text' && !url)}
          >
            {uploading ? <><span className="spinner-border spinner-border-sm me-1"/>Uploading…</> : t('coursePage.save')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CoursePage;
import { useEffect, useState, useCallback, useRef } from 'react';
import AppLayout from '../components/Layout';
import { UtilityModal } from '../components/UtilityModal';

const API = process.env.REACT_APP_API_URL + '';
const ACCESS_LEVELS = ['default','create','tutor','quality','manage','admin','root'];

const PAGE_RULES = [
    { group:'Learning',   path:'/my-courses',        label:'My Learning',     minLevel:'default' },
    { group:'Learning',   path:'/my-grades',          label:'My Grades',       minLevel:'default' },
    { group:'Learning',   path:'/chats',              label:'Messages',        minLevel:'default' },
    { group:'Learning',   path:'/redeem',             label:'Redeem Key',      minLevel:'default' },
    { group:'Management', path:'/',                   label:'Dashboard',       minLevel:'manage'  },
    { group:'Management', path:'/manage/courses',     label:'Courses',         minLevel:'create'  },
    { group:'Management', path:'/manage/directions',  label:'Directions',      minLevel:'manage'  },
    { group:'Management', path:'/manage/levels',      label:'Levels',          minLevel:'manage'  },
    { group:'Management', path:'/manage/users',       label:'Users',           minLevel:'manage'  },
    { group:'Management', path:'/manage/roles',       label:'Roles',           minLevel:'manage'  },
    { group:'Management', path:'/manage/forms',       label:'Review Forms',    minLevel:'quality' },
    { group:'Management', path:'/manage/promos',      label:'Promo Codes',     minLevel:'manage'  },
    { group:'Management', path:'/manage/keys',        label:'Product Keys',    minLevel:'manage'  },
    { group:'Tutor',      path:'/manage/sessions',    label:'Sessions',        minLevel:'tutor'   },
    { group:'System',     path:'/manage/settings',    label:'Settings & Logs', minLevel:'admin'   },
    { group:'System',     path:'/admin/panel',        label:'Admin Panel',     minLevel:'admin'   },
];

const API_RULES = [
    { group:'Users',    method:'GET',    path:'GET:/users',                         label:'List users',          minLevel:'default' },
    { group:'Users',    method:'POST',   path:'POST:/users',                        label:'Create user',         minLevel:'admin'   },
    { group:'Users',    method:'PATCH',  path:'PATCH:/users/:id',                   label:'Update user',         minLevel:'admin'   },
    { group:'Users',    method:'DELETE', path:'DELETE:/users/:id',                  label:'Delete user',         minLevel:'admin'   },
    { group:'Courses',  method:'GET',    path:'GET:/courses',                       label:'List courses',        minLevel:'default' },
    { group:'Courses',  method:'POST',   path:'POST:/courses',                      label:'Create course',       minLevel:'create'  },
    { group:'Courses',  method:'PATCH',  path:'PATCH:/courses/:id',                 label:'Update course',       minLevel:'create'  },
    { group:'Courses',  method:'DELETE', path:'DELETE:/courses/:id',                label:'Delete course',       minLevel:'create'  },
    { group:'Sessions', method:'GET',    path:'GET:/sessions',                      label:'List sessions',       minLevel:'tutor'   },
    { group:'Sessions', method:'POST',   path:'POST:/sessions',                     label:'Create session',      minLevel:'tutor'   },
    { group:'Sessions', method:'PATCH',  path:'PATCH:/sessions/:id',                label:'Update session',      minLevel:'tutor'   },
    { group:'Sessions', method:'DELETE', path:'DELETE:/sessions/:id',               label:'Delete session',      minLevel:'tutor'   },
    { group:'Sessions', method:'PATCH',  path:'PATCH:/sessions/:id/reassign-host',  label:'Reassign host',       minLevel:'manage'  },
    { group:'Groups',   method:'GET',    path:'GET:/groups',                        label:'List groups',         minLevel:'tutor'   },
    { group:'Groups',   method:'POST',   path:'POST:/groups',                       label:'Create group',        minLevel:'tutor'   },
    { group:'Groups',   method:'DELETE', path:'DELETE:/groups/:id',                 label:'Delete group',        minLevel:'tutor'   },
    { group:'Forms',    method:'GET',    path:'GET:/forms',                         label:'List forms',          minLevel:'quality' },
    { group:'Forms',    method:'DELETE', path:'DELETE:/forms/detail/:id',           label:'Delete form',         minLevel:'quality' },
    { group:'Keys',     method:'GET',    path:'GET:/keys',                          label:'List keys',           minLevel:'manage'  },
    { group:'Keys',     method:'POST',   path:'POST:/keys',                         label:'Generate key',        minLevel:'manage'  },
    { group:'Promos',   method:'GET',    path:'GET:/promos',                        label:'List promos',         minLevel:'create'  },
    { group:'Promos',   method:'POST',   path:'POST:/promos',                       label:'Create promo',        minLevel:'create'  },
    { group:'Admin',    method:'GET',    path:'GET:/admin/collections',             label:'View collections',    minLevel:'admin'   },
    { group:'Admin',    method:'PATCH',  path:'PATCH:/admin/collections/:name/:id', label:'Edit document',       minLevel:'admin'   },
    { group:'Admin',    method:'DELETE', path:'DELETE:/admin/collections/:name/:id',label:'Delete document',     minLevel:'root'    },
];

const LEVEL_COLORS = {default:'#868e96',create:'#3b5bdb',tutor:'#7048e8',quality:'#f08c00',manage:'#2f9e44',admin:'#e03131',root:'#c92a2a'};
const METHOD_COLORS = {GET:'#2f9e44',POST:'#3b5bdb',PATCH:'#f08c00',DELETE:'#e03131',PUT:'#7048e8'};

function LevelBadge({ level }) {
    const c = LEVEL_COLORS[level]||'#868e96';
    return <span style={{display:'inline-block',padding:'.12rem .45rem',borderRadius:4,background:c+'22',color:c,fontSize:'.7rem',fontWeight:600}}>{level}</span>;
}
function MethodBadge({ method }) {
    const c = METHOD_COLORS[method]||'#868e96';
    return <span style={{display:'inline-block',padding:'.1rem .4rem',borderRadius:3,background:c+'22',color:c,fontSize:'.65rem',fontWeight:700,fontFamily:'monospace',minWidth:52,textAlign:'center'}}>{method}</span>;
}

function RuleRow({ item, saved, isRoot, saving, onSave, onReset }) {
    const current = saved?.minLevel || item.minLevel;
    const [sel, setSel] = useState(current);
    useEffect(() => setSel(saved?.minLevel || item.minLevel), [saved, item.minLevel]);
    const changed = sel !== current;
    return (
        <tr style={{background: saved ? 'var(--accent-bg)' : undefined}}>
            {item.method && <td style={{padding:'.48rem .6rem'}}><MethodBadge method={item.method}/></td>}
            <td style={{padding:'.48rem .7rem',fontSize:'.82rem',fontWeight:500,color:'var(--text)'}}>
                {item.label}
                {saved && <span className="badge ms-2" style={{background:'var(--accent)',fontSize:'.58rem'}}>overridden</span>}
            </td>
            <td style={{padding:'.48rem .7rem',fontFamily:'monospace',fontSize:'.71rem',color:'var(--text-muted)'}}>{item.path}</td>
            <td style={{padding:'.48rem .5rem'}}><LevelBadge level={item.minLevel}/></td>
            <td style={{padding:'.48rem .4rem'}}>
                <select className="ep-select" style={{fontSize:'.78rem',padding:'.27rem .44rem'}}
                    value={sel} onChange={e=>setSel(e.target.value)}
                    disabled={!isRoot && ['admin','root'].includes(sel)}>
                    {ACCESS_LEVELS.map(lvl=><option key={lvl} value={lvl} disabled={!isRoot&&['admin','root'].includes(lvl)}>{lvl}</option>)}
                </select>
            </td>
            <td style={{padding:'.48rem .4rem'}}>
                <div className="d-flex gap-1">
                    <button className="ep-btn ep-btn-sm ep-btn-primary" disabled={!changed||saving} onClick={()=>onSave(sel)}>
                        {saving?<span className="spinner-border spinner-border-sm"/>:<i className="bi bi-check2"/>}
                    </button>
                    {saved && isRoot && <button className="ep-btn ep-btn-sm ep-btn-danger-ghost" title="Reset" onClick={onReset}><i className="bi bi-arrow-counterclockwise"/></button>}
                </div>
            </td>
        </tr>
    );
}

function GroupedTable({ items, rules, isRoot, savingRule, onSave, onReset, showMethod }) {
    const groups = [...new Set(items.map(i=>i.group))];
    const [collapsed, setCollapsed] = useState({});
    return (
        <div className="ep-table-wrap">
            <table className="ep-table">
                <thead><tr>
                    {showMethod && <th style={{width:70}}>Method</th>}
                    <th>Name</th><th>Path</th><th style={{width:90}}>Default</th><th style={{width:130}}>Override</th><th style={{width:88}}>Save</th>
                </tr></thead>
                <tbody>
                    {groups.map(g => {
                        const gi = items.filter(i=>i.group===g);
                        const ov = gi.filter(i=>rules.find(r=>r.path===i.path)).length;
                        return [
                            <tr key={`hdr-${g}`} onClick={()=>setCollapsed(p=>({...p,[g]:!p[g]}))}
                                style={{cursor:'pointer',background:'var(--surface-3)',userSelect:'none'}}>
                                <td colSpan={showMethod?6:5} style={{padding:'.42rem .9rem',fontWeight:700,fontSize:'.74rem',color:'var(--text-2)',letterSpacing:'.04em',textTransform:'uppercase'}}>
                                    <i className={`bi bi-chevron-${collapsed[g]?'right':'down'} me-2`}/>
                                    {g} <span className="text-muted ms-1" style={{fontWeight:400,fontSize:'.72rem'}}>({gi.length}{ov>0?`, ${ov} overridden`:''})</span>
                                </td>
                            </tr>,
                            !collapsed[g] && gi.map(item=>(
                                <RuleRow key={item.path} item={item}
                                    saved={rules.find(r=>r.path===item.path)}
                                    isRoot={isRoot} saving={savingRule===item.path}
                                    onSave={lvl=>onSave(item,lvl)}
                                    onReset={()=>onReset(rules.find(r=>r.path===item.path),item.path)}
                                />
                            ))
                        ];
                    })}
                </tbody>
            </table>
        </div>
    );
}

function AdminPanel({ data, onLogout }) {
    const token = localStorage.getItem('token');
    const ah = { Authorization: token, 'Content-Type': 'application/json' };
    const isRoot = data?.accessLevel === 'root';
    const isAdmin = ['admin','root'].includes(data?.accessLevel);

    const [tab, setTab] = useState('pages');
    const [modal, setModal] = useState({show:false});
    const closeModal = () => setModal(p=>({...p,show:false}));
    const showInfo = (t,m) => setModal({show:true,type:'info',title:t,message:m,onClose:closeModal});
    const showConfirm = (t,m,fn,d=false) => setModal({show:true,type:'confirm',danger:d,title:t,message:m,onConfirm:fn,onCancel:closeModal});

    // Rules
    const [rules, setRules] = useState([]);
    const [rulesLoading, setRulesLoading] = useState(false);
    const [savingRule, setSavingRule] = useState(null);

    const fetchRules = useCallback(async () => {
        setRulesLoading(true);
        try { const r=await fetch(`${API}/admin/access-rules`,{headers:ah}); if(r.ok){const d=await r.json();setRules(d.data||[]);} } catch {}
        setRulesLoading(false);
    },[]);// eslint-disable-line

    useEffect(()=>{ if(['pages','api'].includes(tab)) fetchRules(); },[tab]);// eslint-disable-line

    const handleSave = async (item, minLevel) => {
        setSavingRule(item.path);
        try {
            const r = await fetch(`${API}/admin/access-rules`,{method:'POST',headers:ah,body:JSON.stringify({path:item.path,label:item.label,group:item.group,type:item.method?'api':'page',method:item.method||null,minLevel})});
            const j = await r.json();
            if(r.ok) await fetchRules(); else showInfo('Error',j.message||'Failed');
        } catch { showInfo('Error','Network error'); }
        setSavingRule(null);
    };

    const handleReset = async (saved, path) => {
        showConfirm('Reset Rule',`Reset "${path}" to default?`,async()=>{
            try { const r=await fetch(`${API}/admin/access-rules/${saved._id}`,{method:'DELETE',headers:ah}); if(r.ok) await fetchRules(); else {const j=await r.json();showInfo('Error',j.message);} } catch{showInfo('Error','Network error');}
        },true);
    };

    // DB
    const [cols, setCols] = useState([]);
    const [colsLoading, setColsLoading] = useState(false);
    const [selCol, setSelCol] = useState('');
    const [docs, setDocs] = useState([]);
    const [meta, setMeta] = useState({total:0,page:1,pages:1});
    const [docsLoading, setDocsLoading] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editJson, setEditJson] = useState('');
    const [editErr, setEditErr] = useState('');
    const [saving, setSaving] = useState(false);

    const fetchCols = useCallback(async()=>{
        setColsLoading(true);
        try{const r=await fetch(`${API}/admin/collections`,{headers:ah});if(r.ok){const d=await r.json();setCols(d.data||[]);}}catch{}
        setColsLoading(false);
    },[]);// eslint-disable-line
    useEffect(()=>{if(tab==='db')fetchCols();},[tab]);// eslint-disable-line

    const fetchDocs = useCallback(async(col,page=1)=>{
        if(!col)return; setDocsLoading(true); setEditId(null);
        try{const r=await fetch(`${API}/admin/collections/${col}?page=${page}&limit=20`,{headers:ah});if(r.ok){const d=await r.json();setDocs(d.data||[]);setMeta({total:d.total||0,page:d.page||1,pages:d.pages||1});}}catch{}
        setDocsLoading(false);
    },[]);// eslint-disable-line

    const saveDoc = async()=>{
        let p; try{p=JSON.parse(editJson);}catch{setEditErr('Invalid JSON');return;}
        setSaving(true);
        try{
            const r=await fetch(`${API}/admin/collections/${selCol}/${editId}`,{method:'PATCH',headers:ah,body:JSON.stringify({update:p})});
            const j=await r.json();
            if(r.ok){setEditId(null);await fetchDocs(selCol,meta.page);}else setEditErr(j.message||'Failed');
        }catch{setEditErr('Network error');}
        setSaving(false);
    };

    // Backup
    const [backupCol, setBackupCol] = useState('');
    const [restoreCol, setRestoreCol] = useState('');
    const [restoreMode, setRestoreMode] = useState('merge');
    const [restoring, setRestoring] = useState(false);
    const [bkCols, setBkCols] = useState([]);
    const [bkColsLoading, setBkColsLoading] = useState(false);
    const fileRef = useRef(null);

    useEffect(()=>{
        if(tab!=='backup')return;
        setBkColsLoading(true);
        fetch(`${API}/admin/collections`,{headers:ah}).then(r=>r.ok?r.json():null).then(d=>{if(d)setBkCols(d.data||[]);}).finally(()=>setBkColsLoading(false));
    },[tab]);// eslint-disable-line

    const downloadBackup = (col) => {
        const url = col ? `${API}/admin/backup/${col}` : `${API}/admin/backup`;
        fetch(url,{headers:ah})
            .then(r=>r.ok?r.blob():r.json().then(j=>{throw new Error(j.message);}))
            .then(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=col?`${col}-backup-${Date.now()}.json`:`full-backup-${Date.now()}.json`;a.click();})
            .catch(e=>showInfo('Error',e.message||'Failed'));
    };

    const handleRestore = async(e)=>{
        const file=e.target.files?.[0]; if(!file)return; e.target.value='';
        if(!restoreCol){showInfo('No Collection','Select a target collection first.');return;}
        let parsed; try{parsed=JSON.parse(await file.text());}catch{showInfo('Invalid JSON','File is not valid JSON.');return;}
        const d=parsed.data||(Array.isArray(parsed)?parsed:null);
        if(!d){showInfo('Invalid Format','Expected {data:[…]} or array.');return;}
        showConfirm(
            restoreMode==='replace'?'⚠ Replace Collection':'Merge into Collection',
            `${restoreMode==='replace'?'DELETE all docs in':'Upsert docs into'} "${restoreCol}" (${d.length} docs). Proceed?`,
            async()=>{
                setRestoring(true);
                try{
                    const r=await fetch(`${API}/admin/restore/${restoreCol}`,{method:'POST',headers:ah,body:JSON.stringify({data:d,mode:restoreMode})});
                    const j=await r.json(); if(r.ok)showInfo('Restored',j.message); else showInfo('Error',j.message||'Failed');
                }catch{showInfo('Error','Network error');}
                setRestoring(false);
            }, restoreMode==='replace'
        );
    };

    if(!isAdmin) return (
        <AppLayout data={data} onLogout={onLogout} title="Admin Panel">
            <div className="flex-grow-1 p-4 text-center pt-5">
                <i className="bi bi-shield-lock" style={{fontSize:'3rem',color:'#dee2e6'}}/>
                <p className="text-muted mt-3">Admin access required.</p>
            </div>
        </AppLayout>
    );

    const TABS=[
        {key:'pages', icon:'bi-window',        label:'Page Access'},
        {key:'api',   icon:'bi-diagram-3',      label:'API Access'},
        {key:'db',    icon:'bi-database',        label:'DB Editor'},
        {key:'backup',icon:'bi-cloud-download',  label:'Backup & Restore'},
    ];

    return (
        <AppLayout data={data} onLogout={onLogout} title="Admin Panel">
        <div className="flex-grow-1 p-3 p-md-4" style={{minWidth:0}}>
            <div className="mb-3">
                <h1 className="page-title">Admin Panel</h1>
                <p className="page-subtitle">Access control, database editor, and backup tools</p>
            </div>
            <div className="d-flex flex-wrap gap-2 mb-4">
                {TABS.map(t=>(
                    <button key={t.key} className={`ep-btn ep-btn-md ${tab===t.key?'ep-btn-primary':'ep-btn-ghost'}`} onClick={()=>setTab(t.key)}>
                        <i className={`bi ${t.icon} me-1`}/>{t.label}
                    </button>
                ))}
            </div>

            {/* PAGE ACCESS */}
            {tab==='pages' && (
                <div className="ep-card">
                    <div className="ep-card-header">
                        <span className="ep-card-title"><i className="bi bi-window me-2"/>Page Access Rules</span>
                        <small className="text-muted ms-2">Minimum access level to visit each frontend route</small>
                    </div>
                    {rulesLoading
                        ? <div className="ep-card-body text-center py-4"><div className="spinner-border spinner-border-sm text-primary"/></div>
                        : <GroupedTable items={PAGE_RULES} rules={rules.filter(r=>r.type==='page'||!r.type)} isRoot={isRoot} savingRule={savingRule} onSave={handleSave} onReset={handleReset} showMethod={false}/>
                    }
                </div>
            )}

            {/* API ACCESS */}
            {tab==='api' && (
                <div className="ep-card">
                    <div className="ep-card-header">
                        <span className="ep-card-title"><i className="bi bi-diagram-3 me-2"/>API Endpoint Access Rules</span>
                        <small className="text-muted ms-2">Override per-endpoint minimum level (use validateDynamic in routes)</small>
                    </div>
                    {rulesLoading
                        ? <div className="ep-card-body text-center py-4"><div className="spinner-border spinner-border-sm text-primary"/></div>
                        : <GroupedTable items={API_RULES} rules={rules.filter(r=>r.type==='api')} isRoot={isRoot} savingRule={savingRule} onSave={handleSave} onReset={handleReset} showMethod={true}/>
                    }
                </div>
            )}

            {/* DB EDITOR */}
            {tab==='db' && (
                <div className="row g-3">
                    <div className="col-12 col-md-3">
                        <div className="ep-card">
                            <div className="ep-card-header"><span className="ep-card-title"><i className="bi bi-collection me-1"/>Collections</span></div>
                            <div className="ep-card-body p-0">
                                {colsLoading
                                    ? <div className="text-center py-3"><div className="spinner-border spinner-border-sm text-primary"/></div>
                                    : cols.map(col=>(
                                        <button key={col} onClick={()=>{setSelCol(col);fetchDocs(col,1);}}
                                            style={{display:'block',width:'100%',textAlign:'left',padding:'.5rem .85rem',border:'none',borderBottom:'1px solid var(--border-light)',background:selCol===col?'var(--accent-bg)':'transparent',color:selCol===col?'var(--accent)':'var(--text)',fontWeight:selCol===col?600:400,fontSize:'.82rem',cursor:'pointer'}}>
                                            <i className="bi bi-table me-2 opacity-50"/>{col}
                                        </button>
                                    ))
                                }
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-9">
                        {!selCol
                            ? <div className="ep-card d-flex align-items-center justify-content-center" style={{minHeight:200}}><div className="text-center text-muted"><i className="bi bi-database" style={{fontSize:'2.5rem',opacity:.3}}/><p className="mt-2 small">Select a collection</p></div></div>
                            : <div className="ep-card">
                                <div className="ep-card-header">
                                    <span className="ep-card-title"><i className="bi bi-table me-1"/>{selCol}</span>
                                    <span className="text-muted small ms-2">{meta.total} documents</span>
                                </div>
                                <div className="ep-card-body p-0">
                                    {docsLoading
                                        ? <div className="text-center py-4"><div className="spinner-border spinner-border-sm text-primary"/></div>
                                        : docs.map(doc=>(
                                            <div key={String(doc._id)} style={{borderBottom:'1px solid var(--border-light)',padding:'.7rem .9rem'}}>
                                                {editId===String(doc._id)
                                                    ? <div>
                                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                                            <small className="text-muted">Editing: <code style={{fontSize:'.7rem'}}>{String(doc._id)}</code></small>
                                                            <div className="d-flex gap-2">
                                                                <button className="ep-btn ep-btn-sm ep-btn-primary" onClick={saveDoc} disabled={saving}>{saving?<span className="spinner-border spinner-border-sm"/>:<><i className="bi bi-check2"/> Save</>}</button>
                                                                <button className="ep-btn ep-btn-sm ep-btn-ghost" onClick={()=>setEditId(null)}>Cancel</button>
                                                            </div>
                                                        </div>
                                                        {editErr&&<div className="alert alert-danger py-1 px-2 small mb-2">{editErr}</div>}
                                                        <textarea className="ep-textarea" style={{fontFamily:'monospace',fontSize:'.74rem',minHeight:160,width:'100%',resize:'vertical'}} value={editJson} onChange={e=>{setEditJson(e.target.value);setEditErr('');}}/>
                                                      </div>
                                                    : <div className="d-flex align-items-start gap-2">
                                                        <div className="flex-grow-1" style={{minWidth:0}}>
                                                            <div style={{fontSize:'.68rem',color:'var(--text-muted)',fontFamily:'monospace',marginBottom:'.15rem'}}>{String(doc._id)}</div>
                                                            <div style={{fontSize:'.78rem',color:'var(--text-2)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                                                {Object.entries(doc).filter(([k])=>!['_id','__v','passwordHash','passwordEnc'].includes(k)).slice(0,6).map(([k,v])=>`${k}: ${typeof v==='object'?'[…]':String(v).slice(0,25)}`).join('  ·  ')}
                                                            </div>
                                                        </div>
                                                        <div className="d-flex gap-1 flex-shrink-0">
                                                            <button className="ep-btn ep-btn-sm ep-btn-ghost" title="Edit" onClick={()=>{const{_id,__v,...e}=doc;setEditId(String(_id));setEditJson(JSON.stringify(e,null,2));setEditErr('');}}><i className="bi bi-pencil"/></button>
                                                            {isRoot&&<button className="ep-btn ep-btn-sm ep-btn-danger-ghost" title="Delete" onClick={()=>showConfirm('Delete Document',`Delete ${String(doc._id).slice(-6)}? Irreversible.`,async()=>{const r=await fetch(`${API}/admin/collections/${selCol}/${doc._id}`,{method:'DELETE',headers:ah});const j=await r.json();if(r.ok)fetchDocs(selCol,meta.page);else showInfo('Error',j.message);},true)}><i className="bi bi-trash"/></button>}
                                                        </div>
                                                      </div>
                                                }
                                            </div>
                                        ))
                                    }
                                    {meta.pages>1&&(
                                        <div className="d-flex align-items-center justify-content-between p-2 border-top">
                                            <button className="ep-btn ep-btn-sm ep-btn-ghost" disabled={meta.page<=1} onClick={()=>fetchDocs(selCol,meta.page-1)}><i className="bi bi-chevron-left"/></button>
                                            <small className="text-muted">Page {meta.page}/{meta.pages} · {meta.total} total</small>
                                            <button className="ep-btn ep-btn-sm ep-btn-ghost" disabled={meta.page>=meta.pages} onClick={()=>fetchDocs(selCol,meta.page+1)}><i className="bi bi-chevron-right"/></button>
                                        </div>
                                    )}
                                </div>
                              </div>
                        }
                    </div>
                </div>
            )}

            {/* BACKUP & RESTORE */}
            {tab==='backup' && (
                <div className="row g-3">
                    <div className="col-12 col-md-6">
                        <div className="ep-card h-100">
                            <div className="ep-card-header"><span className="ep-card-title"><i className="bi bi-cloud-download me-2"/>Download Backup</span></div>
                            <div className="ep-card-body">
                                <p className="text-muted small mb-3">Export as JSON. Full backup requires root.</p>
                                {isRoot&&<button className="ep-btn ep-btn-md ep-btn-primary w-100 mb-3" onClick={()=>downloadBackup('')}><i className="bi bi-database me-2"/>Download Full DB Backup</button>}
                                <div className="d-flex gap-2">
                                    {bkColsLoading
                                        ? <div className="spinner-border spinner-border-sm text-primary"/>
                                        : <>
                                            <select className="ep-select flex-grow-1" value={backupCol} onChange={e=>setBackupCol(e.target.value)}>
                                                <option value="">Select collection…</option>
                                                {bkCols.map(c=><option key={c} value={c}>{c}</option>)}
                                            </select>
                                            <button className="ep-btn ep-btn-md ep-btn-ghost" disabled={!backupCol} onClick={()=>downloadBackup(backupCol)}><i className="bi bi-download me-1"/>Export</button>
                                        </>
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="col-12 col-md-6">
                        <div className="ep-card h-100">
                            <div className="ep-card-header"><span className="ep-card-title"><i className="bi bi-cloud-upload me-2"/>Restore from Backup</span></div>
                            <div className="ep-card-body">
                                {!isRoot
                                    ? <p className="text-muted small">Root access required to restore.</p>
                                    : <>
                                        <p className="text-muted small mb-3">Upload a JSON backup file to restore.</p>
                                        <div className="mb-3">
                                            <label className="small fw-semibold mb-1 d-block" style={{color:'var(--text-2)'}}>Target Collection</label>
                                            <select className="ep-select w-100" value={restoreCol} onChange={e=>setRestoreCol(e.target.value)}>
                                                <option value="">Select collection…</option>
                                                {bkCols.map(c=><option key={c} value={c}>{c}</option>)}
                                            </select>
                                        </div>
                                        <div className="mb-3">
                                            <label className="small fw-semibold mb-1 d-block" style={{color:'var(--text-2)'}}>Restore Mode</label>
                                            <div className="d-flex gap-2">
                                                {[['merge','Merge (upsert)'],['replace','Replace (delete all)']].map(([k,l])=>(
                                                    <button key={k} className={`ep-btn ep-btn-sm ${restoreMode===k?'ep-btn-primary':'ep-btn-ghost'}`} onClick={()=>setRestoreMode(k)}>{l}</button>
                                                ))}
                                            </div>
                                        </div>
                                        <input ref={fileRef} type="file" accept=".json" style={{display:'none'}} onChange={handleRestore}/>
                                        <button className={`ep-btn ep-btn-md w-100 ${restoreMode==='replace'?'ep-btn-danger':'ep-btn-primary'}`}
                                            disabled={!restoreCol||restoring} onClick={()=>fileRef.current?.click()}>
                                            {restoring?<><span className="spinner-border spinner-border-sm me-2"/>Restoring…</>:<><i className="bi bi-upload me-2"/>Choose File & Restore</>}
                                        </button>
                                    </>
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <UtilityModal show={modal.show} type={modal.type} title={modal.title} message={modal.message}
            danger={modal.danger}
            onConfirm={()=>{modal.onConfirm?.();closeModal();}}
            onCancel={modal.onCancel||closeModal} onClose={modal.onClose||closeModal}/>
        </AppLayout>
    );
}

export default AdminPanel;
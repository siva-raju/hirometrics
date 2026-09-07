import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerApi } from '../../services/api';

// ── CollapsibleDesc ────────────────────────────────────────────────────────
function CollapsibleDesc({ label, children, defaultOpen }: {
  label: string; children: React.ReactNode; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-1.5 hover:text-blue-600 transition-colors w-full text-left">
        <span className="inline-block transition-transform duration-150"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}>▶</span>
        {label}
        <span className="text-gray-400 font-normal ml-1">
          {open ? '— click to collapse' : '— click to expand'}
        </span>
      </button>
      {open && children}
    </div>
  );
}

// ── RichTextEditor ─────────────────────────────────────────────────────────
let _rteStyleInjected = false;
function injectRteStyles() {
  if (_rteStyleInjected || typeof document === 'undefined') return;
  _rteStyleInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    .rte-body[data-placeholder]:empty:before {
      content: attr(data-placeholder); color: #9ca3af; pointer-events: none;
    }
    .rte-body ul { list-style: disc;    padding-left: 1.5rem; margin: 0.4rem 0; }
    .rte-body ol { list-style: decimal; padding-left: 1.5rem; margin: 0.4rem 0; }
    .rte-body li { margin: 0.2rem 0; }
    .rte-body h3 { font-size: 1rem; font-weight: 700; margin: 0.4rem 0; }
    .rte-body p  { margin: 0.2rem 0; min-height: 1em; }
    .rte-body strong { font-weight: 700; }
    .rte-body em { font-style: italic; }
    .rte-body u  { text-decoration: underline; }
  `;
  document.head.appendChild(s);
}

function RichTextEditor({ value, onChange, placeholder }: {
  value: string; onChange: (html: string) => void; placeholder?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);
  useEffect(() => { injectRteStyles(); }, []);
  useEffect(() => {
    const el = editorRef.current;
    if (!el || isSyncing.current) return;
    if (el.innerHTML !== value) { el.innerHTML = value ?? ''; }
  }, [value]);
  const execCmd = useCallback((cmd: string, arg?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => {
      document.execCommand(cmd, false, arg ?? '');
      isSyncing.current = true;
      onChange(el.innerHTML);
      isSyncing.current = false;
    });
  }, [onChange]);
  const handleInput = useCallback(() => {
    if (!isSyncing.current && editorRef.current) {
      isSyncing.current = true;
      onChange(editorRef.current.innerHTML);
      isSyncing.current = false;
    }
  }, [onChange]);
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    let insert: string;
    if (html) {
      insert = html
        .replace(/ class="[^"]*"/g, '').replace(/ style="[^"]*"/g, '')
        .replace(/<span[^>]*>/g, '').replace(/<\/span>/g, '')
        .replace(/<div>/g, '<p>').replace(/<\/div>/g, '</p>');
    } else {
      insert = text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .split('\n\n').map((b: string) => `<p>${b.replace(/\n/g, '<br>')}</p>`).join('');
    }
    document.execCommand('insertHTML', false, insert);
    if (editorRef.current) {
      isSyncing.current = true;
      onChange(editorRef.current.innerHTML);
      isSyncing.current = false;
    }
  }, [onChange]);
  const Btn = ({ cmd, arg, label, title }: {
    cmd: string; arg?: string; label: string; title: string;
  }) => (
    <button type="button" title={title}
      onMouseDown={e => { e.preventDefault(); execCmd(cmd, arg); }}
      className="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors select-none">
      {label}
    </button>
  );
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #d1d5db' }}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <Btn cmd="bold"                label="B"          title="Bold" />
        <Btn cmd="italic"              label="I"          title="Italic" />
        <Btn cmd="underline"           label="U"          title="Underline" />
        <span className="w-px h-4 bg-gray-300 mx-1" />
        <Btn cmd="insertUnorderedList" label="• Bullets"  title="Bullet list" />
        <Btn cmd="insertOrderedList"   label="1. Numbers" title="Numbered list" />
        <span className="w-px h-4 bg-gray-300 mx-1" />
        <Btn cmd="formatBlock" arg="h3" label="Heading"  title="Heading" />
        <Btn cmd="formatBlock" arg="p"  label="Normal"   title="Normal text" />
        <span className="w-px h-4 bg-gray-300 mx-1" />
        <Btn cmd="removeFormat"        label="✕ Clear"   title="Remove formatting" />
      </div>
      <div ref={editorRef} contentEditable suppressContentEditableWarning
        data-placeholder={placeholder}
        className="rte-body min-h-24 p-3 text-sm text-gray-800 focus:outline-none overflow-y-auto"
        style={{ lineHeight: 1.6, maxHeight: 320 }}
        onInput={handleInput} onPaste={handlePaste}
        onKeyDown={e => {
          if (e.key === 'Tab') {
            e.preventDefault();
            document.execCommand('insertHTML', false, '\u00a0\u00a0\u00a0\u00a0');
          }
        }}
      />
    </div>
  );
}


export default function EmployerFolders() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingFolder, setEditingFolder] = useState<any>(null);
  const [jobLinkFolder, setJobLinkFolder] = useState<any>(null);
  const [jobLinkName, setJobLinkName] = useState('');
  const [editForm, setEditForm] = useState<any>({});
  const [showEditAdditional, setShowEditAdditional] = useState(false);
  const [showAdditional, setShowAdditional] = useState(false);
  const [form, setForm] = useState({
    name: '', position_title: '', description: '',
    skill_set: '', location: '', work_mode: '',
    duration: '', job_start_date: '', work_auth_required: '',
  });

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders'],
    queryFn: () => employerApi.getFolders(false).then(r => r.data)
  });

  const createFolder = useMutation({
    mutationFn: (d: any) => employerApi.createFolder(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folders'] }); setCreating(false); setForm({ name:'', position_title:'', description:'', skill_set:'', location:'', work_mode:'', duration:'', job_start_date:'', work_auth_required:'' }); setShowAdditional(false); }
  });

  const createLink = useMutation({
    mutationFn: (folderId: string) => employerApi.createAppLink(folderId, { label: 'Job advertisement' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-links'] })
  });

  const updateFolder = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => employerApi.updateFolder(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['folders'] }); setEditingFolder(null); setShowEditAdditional(false); }
  });

  const archiveFolder = useMutation({
    mutationFn: (id: string) => employerApi.archiveFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folders'] })
  });

  const activeFolders = folders.filter((f: any) => f.status !== 'archived');
  const f = (k: string) => (e: any) => setForm(p => ({ ...p, [k]: e.target.value }));
  const ef = (k: string) => (e: any) => setEditForm((p: any) => ({ ...p, [k]: e.target.value }));
  const startEdit = (folder: any) => {
    setEditingFolder(folder.id);
    setEditForm({ name: folder.name, position_title: folder.position_title, description: folder.description || '',
      skill_set: folder.skill_set || '', location: folder.location || '', work_mode: folder.work_mode || '',
      duration: folder.duration || '', job_start_date: folder.job_start_date || '', work_auth_required: folder.work_auth_required || '' });
    setShowEditAdditional(!!(folder.skill_set || folder.location || folder.work_mode || folder.duration || folder.job_start_date || folder.work_auth_required));
  };

  return (
    <div className="fade-in">
      {/* Job Link modal */}
      {jobLinkFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Job Link — {jobLinkFolder.name}</h3>
              <button onClick={() => { setJobLinkFolder(null); setJobLinkName(''); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Link Name</label>
                <input value={jobLinkName}
                  onChange={e => setJobLinkName(e.target.value)}
                  placeholder=''
                  className="input" autoFocus/>
                <p className="text-[11px] text-gray-400 mt-1">Defaults to Position Code. Override if needed.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={async () => {
                  const name = jobLinkName || jobLinkFolder.name;
                  try {
                    // Always create a real ApplicationLink so the token is tracked in the DB
                    const res = await employerApi.createAppLink(jobLinkFolder.id, { label: name });
                    const token = res.data.token;
                    const link = `${window.location.origin}/apply/${token}`;
                    const html = `<a href="${link}">${name}</a>`;
                    const plain = `${name}: ${link}`;
                    try {
                      await navigator.clipboard.write([
                        new ClipboardItem({
                          'text/html': new Blob([html], { type: 'text/html' }),
                          'text/plain': new Blob([plain], { type: 'text/plain' }),
                        })
                      ]);
                    } catch {
                      await navigator.clipboard.writeText(plain);
                    }
                  } catch (e: any) {
                    alert(e?.response?.data?.detail || 'Failed to generate link');
                  }
                  setJobLinkFolder(null); setJobLinkName('');
                }} className="btn-primary flex-1 text-xs">Copy Link</button>
                <button onClick={() => { setJobLinkFolder(null); setJobLinkName(''); }}
                  className="btn-secondary text-xs">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="page-title">Job Folders</h1>
          <p className="page-subtitle">Manage open positions and candidate submissions</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary text-sm">+ Create folder</button>
      </div>

      {/* Create folder panel */}
      {creating && (
        <div className="card mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-4">New Job Folder</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="label">Position Code <span className="text-red-400">*</span></label>
              <input value={form.name} onChange={f('name')} placeholder="JAVA-SR-DEV-042026" className="input font-mono"/>
              <p className="text-[11px] text-gray-400 mt-0.5">Unique internal tracking code</p>
            </div>
            <div>
              <label className="label">Position Title <span className="text-red-400">*</span></label>
              <input value={form.position_title} onChange={f('position_title')} placeholder="Senior Java Developer" className="input"/>
            </div>
          </div>
          <div className="mb-3">
            <CollapsibleDesc label="Job Description" defaultOpen={true}>
              <RichTextEditor
                value={form.description}
                onChange={html => setForm(p => ({ ...p, description: html }))}
                placeholder="Describe the role and requirements..."
              />
            </CollapsibleDesc>
          </div>

          {/* Additional Information — collapsed by default */}
          <div className="mb-4">
            <button onClick={() => setShowAdditional(a => !a)}
              className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-800">
              <span className="transition-transform" style={{ transform: showAdditional ? 'rotate(90deg)' : 'none' }}>▶</span>
              Additional Information <span className="text-gray-400 font-normal">(optional)</span>
            </button>
            {showAdditional && (
              <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div>
                  <label className="label">Skill Set</label>
                  <textarea value={form.skill_set} onChange={f('skill_set')} rows={2}
                    placeholder="Java, Spring Boot, React, PostgreSQL..."
                    className="input resize-y"
                    onInput={e => { const t = e.currentTarget; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Location</label>
                    <input value={form.location} onChange={f('location')} placeholder="Chicago, IL / Remote" className="input"/>
                  </div>
                  <div>
                    <label className="label">Work Mode</label>
                    <select value={form.work_mode} onChange={f('work_mode')} className="input">
                      <option value="">Select...</option>
                      <option value="Onsite">Onsite</option>
                      <option value="Remote">Remote</option>
                      <option value="Hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Duration</label>
                    <input value={form.duration} onChange={f('duration')} placeholder="6 months / Permanent" className="input"/>
                  </div>
                  <div>
                    <label className="label">Start Date</label>
                    <input value={form.job_start_date} onChange={f('job_start_date')} placeholder="ASAP / MM/YYYY" className="input"/>
                  </div>
                  <div>
                    <label className="label">Work Authorization</label>
                    <input value={form.work_auth_required} onChange={f('work_auth_required')} placeholder="US Citizen / GC / Any" className="input"/>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <button onClick={() => createFolder.mutate(form)} disabled={!form.name || !form.position_title || createFolder.isPending}
              className="btn-primary text-sm disabled:opacity-50">
              {createFolder.isPending ? 'Creating...' : 'Create folder'}
            </button>
            <button onClick={() => { setCreating(false); setShowAdditional(false); }} className="btn-secondary text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Folders list */}
      {isLoading ? (
        <div className="text-gray-400 text-sm p-8">Loading...</div>
      ) : activeFolders.length === 0 ? (
        <div className="card empty-state py-12">
          <div className="empty-state-icon text-3xl">📁</div>
          <p className="text-sm font-semibold text-gray-500">No job folders yet</p>
          <p className="text-xs text-gray-400 mt-1">Create a folder to start managing candidates for a position</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeFolders.map((folder: any) => (
            <div key={folder.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <Link to={`/employer/folders/${folder.id}`}
                      className="font-mono text-sm font-bold hover:text-blue-600 transition-colors"
                      style={{ color: 'var(--hm-blue)' }}>
                      {folder.name}
                    </Link>
                    <span className="badge badge-green text-[11px]">{folder.status}</span>
                    {folder.work_mode && (
                      <span className="badge badge-gray text-[11px]">{folder.work_mode}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 mb-0.5">
                    {folder.position_title}
                  </div>
                  {folder.description && (
                    <div className="text-xs text-gray-500 line-clamp-2 max-w-2xl rte-body"
                      dangerouslySetInnerHTML={{ __html: folder.description }} />
                  )}
                  {folder.location && (
                    <div className="text-xs text-gray-400 mt-1">📍 {folder.location}</div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  <Link to={`/employer/folders/${folder.id}`}
                    className="btn-secondary text-xs">Open</Link>
                  <button onClick={() => { setJobLinkFolder(folder); setJobLinkName(folder.name || ''); }}
                    className="btn-secondary text-xs">🔗 Job Link</button>
                  <button onClick={() => startEdit(folder)}
                    title="Edit folder details"
                    className="btn-secondary text-xs">Job Details</button>
                  <button onClick={() => { if (confirm('Archive this folder?')) archiveFolder.mutate(folder.id); }}
                    className="text-xs px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg hover:bg-gray-50">
                    Archive
                  </button>
                </div>
              </div>

              {/* Inline edit panel */}
              {editingFolder === folder.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Edit Folder</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="label">Position Code</label>
                      <input value={editForm.name||''} onChange={ef('name')} className="input font-mono"/>
                    </div>
                    <div>
                      <label className="label">Position Title</label>
                      <input value={editForm.position_title||''} onChange={ef('position_title')} className="input"/>
                    </div>
                  </div>
                  <div className="mb-3">
                    <CollapsibleDesc label="Job Description" defaultOpen={true}>
                      <RichTextEditor
                        value={editForm.description || ''}
                        onChange={html => setEditForm((p:any) => ({ ...p, description: html }))}
                        placeholder="Describe the role and requirements..."
                      />
                    </CollapsibleDesc>
                  </div>
                  <div className="mb-3">
                    <button onClick={() => setShowEditAdditional((a:boolean) => !a)}
                      className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                      <span style={{ display:'inline-block', transform: showEditAdditional?'rotate(90deg)':'none' }}>▶</span>
                      Additional Information
                    </button>
                    {showEditAdditional && (
                      <div className="mt-3 p-4 rounded-xl space-y-3" style={{ background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                        <div><label className="label">Skill Set</label><textarea value={editForm.skill_set||''} onChange={ef('skill_set')} rows={2}
                          className="input resize-y"
                          onInput={e => { const t = e.currentTarget; t.style.height='auto'; t.style.height=t.scrollHeight+'px'; }}
                        /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div><label className="label">Location</label><input value={editForm.location||''} onChange={ef('location')} className="input"/></div>
                          <div><label className="label">Work Mode</label>
                            <select value={editForm.work_mode||''} onChange={ef('work_mode')} className="input">
                              <option value="">Select...</option><option>Onsite</option><option>Remote</option><option>Hybrid</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div><label className="label">Duration</label><input value={editForm.duration||''} onChange={ef('duration')} className="input"/></div>
                          <div><label className="label">Start Date</label><input value={editForm.job_start_date||''} onChange={ef('job_start_date')} className="input"/></div>
                          <div><label className="label">Work Authorization</label><input value={editForm.work_auth_required||''} onChange={ef('work_auth_required')} className="input"/></div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => updateFolder.mutate({ id: folder.id, data: editForm })}
                      disabled={updateFolder.isPending}
                      className="btn-primary text-xs">{updateFolder.isPending ? 'Saving...' : 'Save changes'}</button>
                    <button onClick={() => { setEditingFolder(null); setShowEditAdditional(false); }}
                      className="btn-secondary text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

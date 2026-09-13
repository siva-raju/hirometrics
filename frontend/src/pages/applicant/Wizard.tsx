import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { applicantApi } from '../../services/api';
import { US_STATES, COUNTRIES, VISA_TYPES } from '../../data/geo';

// ── Steps ─────────────────────────────────────────────────────────────────────
const STEPS = [
  { id:0, label:'Personal Info',    icon:'👤' },
  { id:1, label:'Education',        icon:'🎓' },
  { id:2, label:'Experience',       icon:'💼' },
  { id:3, label:'References',       icon:'🤝' },
  { id:4, label:'Certifications',   icon:'📜' },
];

const GENDER_OPTIONS = [
  'Male','Female','Non-binary','Genderqueer','Agender',
  'Prefer to self-describe','Prefer not to say',
];
const EMPLOYMENT_TYPES = ['Full-time Employee','Self-Employed / Independent'];
const ENGAGEMENT_TYPES = ['On-site','Remote','Hybrid'];

// ── US State autocomplete ────────────────────────────────────────────────────
function StateAutocomplete({ value, onChange, disabled, country }: { value:string; onChange:(v:string)=>void; disabled?:boolean; country?:string }) {
  const [query, setQuery] = useState(value||'');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const isUS = !country || country==='United States';
  const matches = isUS && query.length>0
    ? US_STATES.filter(s=>s.toLowerCase().startsWith(query.toLowerCase())).slice(0,8)
    : [];

  useEffect(()=>{ setQuery(value||''); },[value]);
  useEffect(()=>{ setActiveIdx(-1); },[matches.length]);

  const select = (s:string) => { setQuery(s); onChange(s); setOpen(false); setActiveIdx(-1); };

  const handleKeyDown = (e:React.KeyboardEvent) => {
    if (!open || matches.length===0) return;
    if (e.key==='ArrowDown') { e.preventDefault(); setActiveIdx(i=>Math.min(i+1,matches.length-1)); }
    else if (e.key==='ArrowUp') { e.preventDefault(); setActiveIdx(i=>Math.max(i-1,0)); }
    else if (e.key==='Enter' && activeIdx>=0) { e.preventDefault(); select(matches[activeIdx]); }
    else if (e.key==='Escape') { setOpen(false); setActiveIdx(-1); }
  };

  if (!isUS) {
    return <input value={query} onChange={e=>{setQuery(e.target.value);onChange(e.target.value);}} disabled={disabled} className="input" placeholder="State / Province"/>;
  }
  return (
    <div className="relative">
      <input value={query} disabled={disabled} className="input"
        placeholder="Type to search..."
        onChange={e=>{setQuery(e.target.value);onChange(e.target.value);setOpen(true);setActiveIdx(-1);}}
        onFocus={()=>setOpen(true)}
        onBlur={()=>setTimeout(()=>setOpen(false),150)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox" aria-expanded={open} aria-autocomplete="list"
      />
      {open && matches.length>0 && (
        <div ref={listRef} className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-0.5 max-h-48 overflow-y-auto" role="listbox">
          {matches.map((s,i)=>(
            <div key={s} role="option" aria-selected={i===activeIdx}
              className="px-3 py-2 text-sm cursor-pointer text-gray-800"
              style={{ background: i===activeIdx ? '#eff6ff' : undefined }}
              onMouseDown={e=>{e.preventDefault();select(s);}}>
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── MM/YYYY validator ─────────────────────────────────────────────────────────
function DateInput({ value, onChange, placeholder, required }: { value:string; onChange:(v:string)=>void; placeholder?:string; required?:boolean }) {
  const [error, setError] = useState('');
  const validate = (v:string) => {
    if (!v) { setError(required?'Required':''); return; }
    if (v.toLowerCase()==='present') { setError(''); return; }
    if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(v.trim())) setError('Use MM/YYYY format');
    else setError('');
  };
  return (
    <div>
      <input value={value} className="input" placeholder={placeholder||'MM/YYYY'}
        onChange={e=>onChange(e.target.value)}
        onBlur={e=>validate(e.target.value)}
      />
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }: { label:React.ReactNode; required?:boolean; hint?:string; children:React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-1 italic">{hint}</p>}
    </div>
  );
}
const Inp = ({ locked, ...p }: any) => <input {...p} disabled={p.disabled||locked} className="input" />;
const Sel = ({ opts, locked, ...p }: any) => (
  <select {...p} disabled={p.disabled||locked} className="input">
    {opts.map((o:string|{v:string;l:string}) =>
      typeof o==='string' ? <option key={o} value={o}>{o}</option>
      : <option key={o.v} value={o.v}>{o.l}</option>
    )}
  </select>
);

function SectionHead({ title, badge }: { title:string; badge?:string }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg mb-3"
      style={{ background:'#f0f4f8', border:'0.5px solid #e2e8f0' }}>
      <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{title}</span>
      {badge && <span className="badge badge-blue">{badge}</span>}
    </div>
  );
}

// Validate MM/YYYY format (or "Present")
function validateDate(v: string): boolean {
  if (!v) return true;
  if (v.trim().toLowerCase() === 'present') return true;
  return /^(0[1-9]|1[0-2])\/\d{4}$/.test(v.trim());
}

// ── Collapsible entry card ────────────────────────────────────────────────────
function EntryCard({ title, subtitle, dates, locked, onEdit, onRemove, children, expanded, onToggle }: {
  title:string; subtitle?:string; dates?:string; locked:boolean;
  onEdit?:()=>void; onRemove?:()=>void;
  children?:React.ReactNode; expanded?:boolean; onToggle?:()=>void;
}) {
  return (
    <div className="mb-2 rounded-xl overflow-hidden"
      style={{ border:`1px solid ${locked?'#e2e8f0':'#d1e8f5'}` }}>
      <div className={`flex items-start justify-between gap-3 p-3 cursor-pointer hover:bg-gray-50 ${locked?'opacity-60':''}`}
        onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-900">
            {title}
            {dates && <span className="text-gray-400 font-normal ml-2 text-xs">({dates})</span>}
          </div>
          {subtitle && <div className="text-xs text-gray-500 mt-0.5 truncate">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {locked ? <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">🔒</span>
            : <>
              {onRemove && <button onClick={e=>{e.stopPropagation();onRemove();}} className="text-red-400 hover:text-red-600 text-xs border border-gray-200 rounded-md px-2 py-0.5">Remove</button>}
            </>
          }
          <span className="text-gray-400 text-xs">{expanded?'▲':'▼'}</span>
        </div>
      </div>
      {expanded && children && (
        <div className="border-t border-gray-100 p-4 bg-white">{children}</div>
      )}
    </div>
  );
}

// ── Add form wrapper ──────────────────────────────────────────────────────────
function AddSection({ label, children, onSave, onCancel, saving, canSave, saveRef }: {
  label:string; children:React.ReactNode;
  onSave:()=>void; onCancel:()=>void; saving:boolean; canSave:boolean;
  saveRef?: { current: ((()=>Promise<void>)|null) };
}) {
  const [open, setOpen] = useState(false);

  // Expose save-and-close to parent for "Save & continue later"
  useEffect(() => {
    if (saveRef) {
      saveRef.current = (open && canSave)
        ? async () => { onSave(); setOpen(false); }
        : null;
    }
    return () => { if (saveRef) saveRef.current = null; };
  }, [open, canSave, onSave, saveRef]);

  if (!open) return (
    <button onClick={()=>setOpen(true)}
      className="w-full flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-semibold text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-all mt-3">
      + Add {label}
    </button>
  );
  return (
    <div className="border-2 border-blue-200 rounded-xl p-4 bg-blue-50/20 mt-3">
      <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3">New {label}</div>
      {children}
      <div className="flex gap-2 mt-3">
        <button onClick={()=>{if(!canSave)return;onSave();setOpen(false);}} disabled={saving||!canSave}
          className="btn-primary text-xs disabled:opacity-50 cursor-pointer"
          title={!canSave?'Please fill in all required fields (marked with *)':undefined}>
          {saving?'Saving...':'Save '+label}
        </button>
        {!canSave && <p className="text-[11px] text-red-500 mt-1">* Required fields must be completed before saving.</p>}
        <button onClick={()=>{setOpen(false);onCancel();}} className="btn-secondary text-xs">Cancel</button>
      </div>
    </div>
  );
}

// ── Dialogs ───────────────────────────────────────────────────────────────────
function SubmitDialog({ onConfirm, onCancel }: { onConfirm:()=>void; onCancel:()=>void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg scale-in">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ background:'#fef3ea' }}>🔒</div>
            <h2 className="text-base font-bold text-gray-900">Lock and submit your profile</h2>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-700 mb-3">By clicking <strong>Submit Profile</strong>, you acknowledge and agree that:</p>
          <ul className="space-y-2 text-sm text-gray-600">
            {[
              "The information entered in your profile will be <strong>frozen and locked</strong>.",
              "Any corrections require a formal request to HiroMetrics with supporting evidence.",
              "HiroMetrics <strong>may charge a fee</strong> to review corrections.",
              "You may continue to <strong>add new entries</strong> at any time.",
              "Your current <strong>identity photo will be frozen</strong> for this submission. This image will potentially be used for interview and onboarding verification.",
              "Your profile will be marked as <strong>verified and ready</strong> for submission to hiring entities.",
            ].map((t,i) => <li key={i} className="flex gap-2"><span className="text-blue-500 flex-shrink-0 mt-0.5">•</span><span dangerouslySetInnerHTML={{ __html:t }}/></li>)}
          </ul>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onConfirm} className="btn-primary flex-1">✓ I understand — Submit Profile</button>
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function FinishDialog({ hasResume, onPark, onSubmit, onClose }: { hasResume:boolean; onPark:()=>void; onSubmit:()=>void; onClose:()=>void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900">What would you like to do?</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-6 space-y-3">
          <button onClick={onPark} className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left">
            <span className="text-2xl mt-0.5">💾</span>
            <div><div className="font-bold text-gray-900">Save (Park)</div><div className="text-xs text-gray-500 mt-0.5">Save progress, continue editing later.</div></div>
          </button>
          <button onClick={onSubmit} disabled={!hasResume}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all text-left ${hasResume?'border-green-200 hover:border-green-400 hover:bg-green-50':'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'}`}>
            <span className="text-2xl mt-0.5">🔒</span>
            <div>
              <div className={`font-bold ${hasResume?'text-gray-900':'text-gray-400'}`}>Submit &amp; Lock Profile</div>
              <div className="text-xs text-gray-500 mt-0.5">{hasResume?'Lock and make available to hiring entities.':'⚠ Upload a resume first.'}</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Wizard ───────────────────────────────────────────────────────────────
export default function ApplicantWizard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const stepRestored = useRef(false);

  const { data, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => applicantApi.getProfile().then(r => r.data),
  });

  const [step, setStep] = useState(0);
  const [showFinish, setShowFinish] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string|null>(null);
  const [msg, setMsg] = useState<{text:string;type:'success'|'error'}|null>(null);

  // Expanded state — separate for each section to avoid collapsing parent when editing children
  const [expandedEntry, setExpandedEntry] = useState<string|null>(null);  // edu/ref/cert
  const [expandedWorkId, setExpandedWorkId] = useState<string|null>(null); // which work entry is open
  const [expandedCeKey, setExpandedCeKey] = useState<string|null>(null);   // which client engagement is open
  const [showEditClientForm, setShowEditClientForm] = useState(false);       // add CE form in edit mode
  const eduSaveRef  = useRef<(()=>Promise<void>)|null>(null);
  const workSaveRef = useRef<(()=>Promise<void>)|null>(null);
  const refSaveRef  = useRef<(()=>Promise<void>)|null>(null);
  const certSaveRef = useRef<(()=>Promise<void>)|null>(null);

  // Demographics form
  const [demo, setDemo] = useState<any>({});
  useEffect(() => {
    if (data?.profile && Object.keys(demo).length===0) {
      setDemo({
        first_name: data.user?.first_name||'',
        last_name: data.user?.last_name||'',
        middle_name: data.profile.middle_name||'',
        nick_name: data.profile.nick_name||'',
        gender: data.profile.gender||'',
        primary_phone: data.profile.primary_phone||'',
        secondary_phone: data.profile.secondary_phone||'',
        current_city: data.profile.current_city||'',
        current_state: data.profile.current_state||'',
        legal_status: data.profile.legal_status||'',
        immigration_category: data.profile.immigration_category||'',
        work_auth_notes: data.profile.work_auth_notes||'',
      });
    }
  }, [data?.profile?.id]);

  useEffect(() => {
    if (!stepRestored.current && data?.profile?.wizard_step !== undefined) {
      setStep(data.profile.wizard_step);
      stepRestored.current = true;
    }
  }, [data?.profile?.wizard_step]);

  const invalidate = useCallback(() => qc.invalidateQueries({ queryKey:['my-profile'] }), [qc]);
  const toast = (text:string, type:'success'|'error'='success') => {
    setMsg({text,type}); setTimeout(()=>setMsg(null),4000);
  };

  // Sub-forms
  const [eduForm, setEduForm] = useState<any>({ education_level:'bachelors', institution_name:'', institution_country:'United States', institution_state:'', institution_city:'', start_date:'' });
  const [refForm, setRefForm] = useState<any>({ referee_first_name:'', referee_last_name:'', referee_email:'' });
  const [certForm, setCertForm] = useState<any>({ cert_name:'' });

  // Experience state
  const [workForm, setWorkForm] = useState<any>({
    employment_type:'Full-time Employee', employer_name:'', title:'',
    employer_country:'United States', employer_state:'', employer_city:'',
    start_date:'', end_date:'Present', work_arrangement:'direct',
    client_engagements:[],
  });
  const [clientForm, setClientForm] = useState<any>({
    client_name:'', client_country:'United States', client_state:'', client_city:'',
    role_at_client:'', start_date:'', end_date:'Present', engagement_type:'On-site',
  });
  const [showClientForm, setShowClientForm] = useState(false);
  const [dateErrors, setDateErrors] = useState<any>({});

  // Edit state for existing entries
  const [editingWork, setEditingWork] = useState<any>(null);
  const [editingEdu, setEditingEdu] = useState<any>(null);
  const [editingRef, setEditingRef] = useState<any>(null);
  const [editingCert, setEditingCert] = useState<any>(null);

  const isLocked = data?.profile?.baseline_locked;
  const hasResume = !!data?.current_resume;
  const photoUrl = photoPreview || data?.user?.profile_photo_url;
  const lockedDate = data?.profile?.baseline_locked_at
    ? new Date(data.profile.baseline_locked_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})
    : null;

  const d = (k:string) => (e:any) => setDemo((p:any) => ({...p,[k]:e.target.value}));
  const visaDisabled = ['us_citizen','permanent_resident','other',''].includes(demo.legal_status||'');
  const otherSelected = demo.legal_status==='other' || demo.immigration_category==='Other';

  const validateWorkDates = () => {
    const errs: any = {};
    if (!validateDate(workForm.start_date)) errs.work_start = 'Use MM/YYYY format';
    if (!validateDate(workForm.end_date)) errs.work_end = 'Use MM/YYYY or "Present"';
    setDateErrors(errs);
    return Object.keys(errs).length===0;
  };

  const validateStep0 = () => {
    const missing = [];
    if (!demo.first_name) missing.push('First name');
    if (!demo.last_name) missing.push('Last name');
    if (!demo.primary_phone) missing.push('Primary phone');
    if (!demo.current_city) missing.push('Current city');
    if (!demo.legal_status) missing.push('Authorization status');
    if (otherSelected && !demo.work_auth_notes) missing.push('Additional information (Other explanation)');
    return missing;
  };

  const goNext = async () => {
    if (step===0) {
      const missing = validateStep0();
      if (missing.length > 0) {
        toast('Required fields must be completed: ' + missing.join(', '), 'error');
        return;
      }
      setSaving(true);
      try { const {first_name,last_name,...p}=demo; await applicantApi.updateDemographics(p); await invalidate(); }
      catch(e:any){ toast(e.response?.data?.detail||'Save failed','error'); setSaving(false); return; }
      setSaving(false);
    }
    const next = Math.min(step+1, STEPS.length-1);
    try { await applicantApi.updateWizardStep(next); } catch {}
    setStep(next); window.scrollTo(0,0);
  };

  const saveDemographics = async () => {
    setSaving(true);
    try {
      const {first_name,last_name,...p}=demo;
      await applicantApi.updateDemographics(p);
      await invalidate(); toast('Personal information saved');
    } catch(e:any){ toast(e.response?.data?.detail||'Save failed','error'); }
    finally { setSaving(false); }
  };

  const addEdu = async () => {
    const missing = [];
    if (!eduForm.education_level) missing.push('Level');
    if (!eduForm.institution_name) missing.push('Institution name');
    if (!eduForm.institution_country) missing.push('Country');
    if (!eduForm.institution_state) missing.push('State/Province');
    if (!eduForm.institution_city) missing.push('City');
    if (!eduForm.start_date) missing.push('Start date');
    if (missing.length>0) return toast('Required fields: ' + missing.join(', '), 'error');
    setSaving(true);
    try { await applicantApi.addEducation(eduForm); await invalidate(); setEduForm({education_level:'bachelors',institution_name:'',institution_country:'United States',institution_state:'',institution_city:'',start_date:''}); toast('Education saved'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const saveEditEdu = async () => {
    setSaving(true);
    try { await applicantApi.updateEducation(editingEdu.id, editingEdu); await invalidate(); setEditingEdu(null); setExpandedEntry(null); toast('Education updated'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const addWork = async () => {
    if (!validateWorkDates()) return;
    const wMissing = [];
    if (!workForm.employment_type) wMissing.push('Employment type');
    if (!workForm.employer_name) wMissing.push('Company name');
    if (!workForm.title) wMissing.push('Role/title');
    if (!workForm.start_date) wMissing.push('Start date');
    if (!workForm.end_date) wMissing.push('End date');
    if (!workForm.employer_country) wMissing.push('Country');
    if (!workForm.employer_state) wMissing.push('State/Province');
    if (!workForm.employer_city) wMissing.push('City');
    if (workForm.work_arrangement?.toLowerCase()==='consulting' && (workForm.client_engagements||[]).length===0) wMissing.push('At least one client engagement');
    if (wMissing.length>0) return toast('Required fields: ' + wMissing.join(', '), 'error');
    setSaving(true);
    try { await applicantApi.addWorkHistory(workForm); await invalidate(); setWorkForm({employment_type:'Full-time Employee',employer_name:'',title:'',employer_country:'United States',employer_state:'',employer_city:'',start_date:'',end_date:'Present',work_arrangement:'direct',client_engagements:[],_open:false}); setDateErrors({}); toast('Work history saved'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const saveEditWork = async () => {
    setSaving(true);
    try {
      // Strip internal _new/_id flags from client engagements before sending
      const cleanCes = (editingWork.client_engagements || []).map(({ _new, ...ce }: any) => ce);
      await applicantApi.updateWorkHistory(editingWork.id, {...editingWork, client_engagements: cleanCes});
      await invalidate(); setEditingWork(null); setExpandedEntry(null); toast('Work history updated');
    }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const addRef = async () => {
    const rMissing = [];
    if (!refForm.referee_first_name) rMissing.push('First name');
    if (!refForm.referee_last_name) rMissing.push('Last name');
    if (!refForm.referee_email) rMissing.push('Email');
    if (rMissing.length>0) return toast('Required fields: ' + rMissing.join(', '), 'error');
    setSaving(true);
    try { await applicantApi.addReference(refForm); await invalidate(); setRefForm({referee_first_name:'',referee_last_name:'',referee_email:''}); toast('Reference saved'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const saveEditRef = async () => {
    setSaving(true);
    try { await applicantApi.updateReference(editingRef.id, editingRef); await invalidate(); setEditingRef(null); setExpandedEntry(null); toast('Reference updated'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const addCert = async () => {
    if (!certForm.cert_name) return toast('Certification name required','error');
    setSaving(true);
    try { await applicantApi.addCertification(certForm); await invalidate(); setCertForm({cert_name:''}); toast('Certification saved'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const saveEditCert = async () => {
    setSaving(true);
    try { await applicantApi.updateCertification(editingCert.id, editingCert); await invalidate(); setEditingCert(null); setExpandedEntry(null); toast('Certification updated'); }
    catch(e:any){ toast(e.response?.data?.detail||'Error','error'); }
    finally { setSaving(false); }
  };

  const handlePhotoUpload = async (file:File) => {
    setPhotoUploading(true);
    try { const r = await applicantApi.uploadPhoto(file); setPhotoPreview(r.data.photo_url+'?t='+Date.now()); qc.invalidateQueries({queryKey:['my-profile-photo']}); await invalidate(); toast('Identity photo uploaded'); }
    catch(e:any){ toast(e.response?.data?.detail||'Photo upload failed','error'); }
    finally { setPhotoUploading(false); }
  };

  const handleResumeUpload = async (file:File) => {
    setUploading(true);
    try { await applicantApi.uploadResume(file); await invalidate(); toast('Resume uploaded'); }
    catch(e:any){ toast(e.response?.data?.detail||'Upload failed','error'); }
    finally { setUploading(false); }
  };

  const handlePark = async () => {
    setShowFinish(false);
    // Flush any open AddSection form before parking
    if (workForm._open && workForm.title && workForm.employer_name && workForm.start_date) {
      try { await addWork(); } catch(_){}
    }
    for (const ref of [eduSaveRef, workSaveRef, refSaveRef, certSaveRef]) {
      if (ref.current) { try { await ref.current(); } catch(_){} }
    }
    try { await applicantApi.updateWizardStep(step); await applicantApi.profileAction('park',step); await invalidate(); toast('Profile saved.'); setTimeout(()=>navigate('/applicant/dashboard'),1500); }
    catch(e:any){ toast('Save failed','error'); }
  };

  const handleSubmit = async () => {
    setShowSubmitConfirm(false); setShowFinish(false);
    try { await applicantApi.profileAction('submit',5); await invalidate(); toast('Profile locked! 🎉'); setTimeout(()=>navigate('/applicant/dashboard'),2000); }
    catch(e:any){ toast(e.response?.data?.detail||'Failed','error'); }
  };

  const addClientEngagement = () => {
    if (!clientForm.client_name || !clientForm.role_at_client || !clientForm.start_date) return toast('Client name, role and start date required','error');
    setWorkForm((p:any) => ({...p, client_engagements:[...(p.client_engagements||[]), {...clientForm, id: Date.now().toString()}]}));
    setClientForm({client_name:'',client_country:'United States',client_state:'',client_city:'',role_at_client:'',start_date:'',end_date:'Present',engagement_type:'On-site'});
    setShowClientForm(false);
  };

  if (isLoading) return <div className="text-gray-400 p-8">Loading...</div>;

  return (
    <div className="max-w-3xl fade-in">
      {showFinish && <FinishDialog hasResume={hasResume} onPark={handlePark} onSubmit={()=>{setShowFinish(false);setShowSubmitConfirm(true);}} onClose={()=>setShowFinish(false)}/>}
      {showSubmitConfirm && <SubmitDialog onConfirm={handleSubmit} onCancel={()=>setShowSubmitConfirm(false)}/>}

      <div className="mb-5">
        <h1 className="page-title">Profile Wizard</h1>
        <p className="page-subtitle">Save at any time and pick up where you left off</p>
      </div>

      {isLocked && (
        <div className="mb-5 px-4 py-3 rounded-xl text-sm" style={{ background:'#fef9e7', border:'1px solid #f0b400', color:'#7a5900' }}>
          🔒 Profile locked on <strong>{lockedDate}</strong>. Existing entries cannot be edited — you can add new entries below.
        </div>
      )}
      {!isLocked && <div className="alert-warn mb-5 text-xs">⚠ Please enter accurate details. Information may be used for credential verification.</div>}

      {/* Step tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {STEPS.map(s => {
          const done = (data?.profile?.wizard_step||0) > s.id;
          const active = step===s.id;
          return (
            <button key={s.id} onClick={()=>setStep(s.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
              style={{ background:active?'var(--hm-blue)':done?'#eef6db':'#f8fafc', color:active?'white':done?'#3a5a0d':'#64748b', border:active?'none':done?'1px solid #c3e88d':'1px solid #e2e8f0' }}>
              {done&&!active?'✓':s.icon} {s.label}
            </button>
          );
        })}
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex justify-between ${msg.type==='success'?'bg-green-50 text-green-800 border border-green-200':'bg-red-50 text-red-700 border border-red-200'}`}>
          <span>{msg.type==='success'?'✓':'⚠'} {msg.text}</span>
          <button onClick={()=>setMsg(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      <div className="card">
        {/* ════════════════ STEP 0: PERSONAL INFO ════════════════ */}
        {step===0 && (
          <div className="space-y-5">
            {/* Personal Info */}
            <div>
              <SectionHead title="Personal Information"/>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Legal first name" required><Inp value={demo.first_name||''} onChange={d('first_name')} placeholder="Jane" locked={isLocked}/></Field>
                <Field label="Middle name"><Inp value={demo.middle_name||''} onChange={d('middle_name')} placeholder="Optional" locked={isLocked}/></Field>
                <Field label="Legal last name" required><Inp value={demo.last_name||''} onChange={d('last_name')} placeholder="Smith" locked={isLocked}/></Field>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Field label="Preferred name"><Inp value={demo.nick_name||''} onChange={d('nick_name')} placeholder="Optional" locked={isLocked}/></Field>
                <Field label="Gender identity"><Sel opts={['Select...',...GENDER_OPTIONS]} value={demo.gender||''} onChange={d('gender')} locked={isLocked}/></Field>
              </div>
            </div>

            <div className="divider"/>

            {/* Identity Photo */}
            <div>
              <SectionHead title="Identity Photo"/>
              <p className="text-xs text-gray-500 mb-3">
                A clear, professional photo. Accepted: <strong>JPG, JPEG, PNG, WEBP, HEIC, BMP</strong> · Max 5MB.
                This section remains editable even after profile lock.
              </p>
              <div className="flex items-center gap-5">
                <div onClick={()=>photoRef.current?.click()}
                  className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer transition-all hover:opacity-80"
                  style={{ border:photoUrl?'2px solid #c3e88d':'2px dashed #cbd5e0', background:'#f8fafc' }}>
                  {photoUrl ? <img src={photoUrl} alt="ID" className="w-full h-full object-cover"/> : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                      <span className="text-2xl">📷</span>
                      <span className="text-[10px] mt-1 text-center px-1">Click to upload</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={()=>photoRef.current?.click()} disabled={photoUploading} className="btn-primary text-xs">
                    {photoUploading?'Uploading...':photoUrl?'🔄 Replace photo':'📷 Upload photo'}
                  </button>
                  <label className="btn-secondary text-xs text-center cursor-pointer">📸 Use camera
                    <input type="file" accept="image/*" capture="user" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handlePhotoUpload(f);}}/>
                  </label>
                  <input ref={photoRef} type="file" accept=".jpg,.jpeg,.png,.webp,.heic,.bmp,image/*" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handlePhotoUpload(f);}}/>
                  <p className="text-[11px]" style={{ color:photoUrl?'#3b6d11':'#b47d00' }}>{photoUrl?'✓ Photo on file':'⚠ Photo required'}</p>
                </div>
              </div>
            </div>

            <div className="divider"/>

            {/* Contact */}
            <div>
              <SectionHead title="Contact Information"/>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Primary phone" required><Inp type="tel" value={demo.primary_phone||''} onChange={d('primary_phone')} placeholder="+1 (555) 000-0000" locked={isLocked}/></Field>
                <Field label="Secondary phone"><Inp type="tel" value={demo.secondary_phone||''} onChange={d('secondary_phone')} placeholder="Optional" locked={isLocked}/></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Current city" required><Inp value={demo.current_city||''} onChange={d('current_city')} placeholder="e.g. Chicago" locked={isLocked}/></Field>
                <Field label="Current state">
                  <StateAutocomplete value={demo.current_state||''} country="United States" onChange={v=>setDemo((p:any)=>({...p,current_state:v}))} disabled={isLocked}/>
                </Field>
              </div>
            </div>

            <div className="divider"/>

            {/* Work Authorization */}
            <div>
              <SectionHead title="Work Authorization"/>
              <p className="text-xs text-gray-400 mb-3 italic">Information provided must be accurate and may be verified during hiring or upon hire.</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Authorization status" required>
                  <select value={demo.legal_status||''} onChange={d('legal_status')} disabled={isLocked} className="input">
                    <option value="">Select...</option>
                    <option value="us_citizen">US Citizen</option>
                    <option value="permanent_resident">Permanent Resident (Green Card)</option>
                    <option value="visa_holder">Visa Holder</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Visa / immigration category">
                  {visaDisabled ? (
                    <select disabled className="input" style={{ background:'#f8fafc', color:'#94a3b8' }}>
                      <option>Not applicable</option>
                    </select>
                  ) : (
                    <select value={demo.immigration_category||''} onChange={d('immigration_category')} className="input">
                      <option value="">Select...</option>
                      {VISA_TYPES.map(v=><option key={v} value={v}>{v}</option>)}
                    </select>
                  )}
                </Field>
              </div>
              <div className="mt-3">
                <Field label={otherSelected ? 'Additional information required — please explain the "Other" selection above' : ['H-1B','F-1 OPT','F-1 STEM OPT'].includes(demo.immigration_category||'') ? <span>SPONSORING EMPLOYER <span style={{color:'#9ca3af', fontWeight:'normal', fontSize:'0.875em'}}>(applicable to visa holders only)</span></span> : 'Additional information'} required={otherSelected}>
                  <textarea className="input resize-none" rows={2} value={demo.work_auth_notes||''} onChange={d('work_auth_notes')} placeholder="Any additional details about your work authorization..." disabled={isLocked}/>
                </Field>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════ STEP 1: EDUCATION ════════════════ */}
        {step===1 && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Education History</h2>
            <p className="text-xs text-gray-500 mb-4">Add your education history starting with the earliest.</p>

            {(data?.education||[]).map((e:any) => (
              <EntryCard key={e.id}
                title={e.degree_name||({'high_school':'High School','diploma':'Diploma / Certificate','bachelors':'Under Graduate','pg_degree':'Post Graduate','doctorate':'Doctorate','research':'Research','other':'Other'} as Record<string,string>)[e.education_level])||'Education'}
                subtitle={e.institution_name}
                dates={[e.start_date,e.end_date].filter(Boolean).join(' – ')}
                locked={isLocked}
                onRemove={()=>applicantApi.deleteEducation(e.id).then(invalidate)}
                expanded={expandedEntry===e.id}
                onToggle={()=>{
                  if (expandedEntry===e.id){setExpandedEntry(null);setEditingEdu(null);}
                  else{setExpandedEntry(e.id);setEditingEdu({...e});}
                }}>
                {editingEdu?.id===e.id && !isLocked && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Level" required>
                        <select value={editingEdu.education_level||''} onChange={ev=>setEditingEdu((p:any)=>({...p,education_level:ev.target.value}))} className="input">
                          <option value="high_school">High School</option>
                          <option value="diploma">Diploma / Certificate</option>
                          <option value="bachelors">Under Graduate</option>
                          <option value="pg_degree">Post Graduate</option>
                          <option value="doctorate">Doctorate</option>
                          <option value="research">Research</option>
                        </select>
                      </Field>
                      <Field label="Degree / diploma"><Inp value={editingEdu.degree_name||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,degree_name:ev.target.value}))} placeholder="B.Sc. Computer Science"/></Field>
                    </div>
                    <Field label="Specialization: Major/Minor">
                      <Inp value={editingEdu.specialization||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,specialization:ev.target.value}))}/>
                    </Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Institution name" required><Inp value={editingEdu.institution_name||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,institution_name:ev.target.value}))}/></Field>
                      <Field label="Country" required>
                        <select value={editingEdu.institution_country||'United States'} onChange={ev=>setEditingEdu((p:any)=>({...p,institution_country:ev.target.value}))} className="input">
                          {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                      </Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="State / Province" required><StateAutocomplete value={editingEdu.institution_state||''} country={editingEdu.institution_country||'United States'} onChange={v=>setEditingEdu((p:any)=>({...p,institution_state:v}))}/></Field>
                      <Field label="City" required><Inp value={editingEdu.institution_city||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,institution_city:ev.target.value}))}/></Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Start (MM/YYYY)" required><Inp value={editingEdu.start_date||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,start_date:ev.target.value}))} placeholder="09/2015"/></Field>
                      <Field label="End (MM/YYYY)"><Inp value={editingEdu.end_date||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,end_date:ev.target.value}))} placeholder="05/2019"/></Field>
                      <Field label="Graduated"><Inp value={editingEdu.graduation_date||''} onChange={(ev:any)=>setEditingEdu((p:any)=>({...p,graduation_date:ev.target.value}))} placeholder="05/2019"/></Field>
                    </div>
                    <button onClick={saveEditEdu} disabled={saving} className="btn-primary text-xs">{saving?'Saving...':'Save changes'}</button>
                  </div>
                )}
              </EntryCard>
            ))}

            <AddSection label="Education" onSave={addEdu} onCancel={()=>{}} saving={saving} saveRef={eduSaveRef} canSave={!!eduForm.institution_name&&!!eduForm.education_level&&!!eduForm.start_date&&!!eduForm.institution_country&&!!eduForm.institution_city&&!!eduForm.institution_state}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Level" required>
                  <select value={eduForm.education_level} onChange={e=>setEduForm((p:any)=>({...p,education_level:e.target.value}))} className="input">
                    <option value="high_school">High School</option>
                    <option value="diploma">Diploma / Certificate</option>
                    <option value="bachelors">Under Graduate</option>
                    <option value="pg_degree">Post Graduate</option>
                    <option value="doctorate">Doctorate</option>
                    <option value="research">Research</option>
                  </select>
                </Field>
                <Field label="Degree / diploma name"><Inp value={eduForm.degree_name||''} onChange={(e:any)=>setEduForm((p:any)=>({...p,degree_name:e.target.value}))} placeholder="B.Sc. Computer Science"/></Field>
              </div>
              <div className="mt-3">
                <Field label="Specialization: Major/Minor"><Inp value={eduForm.specialization||''} onChange={(e:any)=>setEduForm((p:any)=>({...p,specialization:e.target.value}))}/></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Institution name" required><Inp value={eduForm.institution_name} onChange={(e:any)=>setEduForm((p:any)=>({...p,institution_name:e.target.value}))}/></Field>
                <Field label="Country" required>
                  <select value={eduForm.institution_country||'United States'} onChange={e=>setEduForm((p:any)=>({...p,institution_country:e.target.value}))} className="input">
                    {COUNTRIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="State / Province" required><StateAutocomplete value={eduForm.institution_state||''} country={eduForm.institution_country} onChange={v=>setEduForm((p:any)=>({...p,institution_state:v}))}/></Field>
                <Field label="City" required><Inp value={eduForm.institution_city||''} onChange={(e:any)=>setEduForm((p:any)=>({...p,institution_city:e.target.value}))}/></Field>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <Field label="Start (MM/YYYY)" required>
                  <DateInput value={eduForm.start_date||''} onChange={v=>setEduForm((p:any)=>({...p,start_date:v}))} required/>
                </Field>
                <Field label="End (MM/YYYY)"><DateInput value={eduForm.end_date||''} onChange={v=>setEduForm((p:any)=>({...p,end_date:v}))} placeholder="05/2019"/></Field>
                <Field label="Graduated"><DateInput value={eduForm.graduation_date||''} onChange={v=>setEduForm((p:any)=>({...p,graduation_date:v}))} placeholder="05/2019"/></Field>
              </div>
            </AddSection>
          </div>
        )}

        {/* ════════════════ STEP 2: EXPERIENCE ════════════════ */}
        {step===2 && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Work Experience</h2>
            <p className="text-xs text-gray-500 mb-4">Add your work history starting with the earliest.</p>

            {(data?.work_history||[]).map((w:any) => (
              <EntryCard key={w.id}
                title={`${w.title} — ${w.employer_name}`}
                subtitle={`${w.employment_type||''}${w.work_arrangement?.toLowerCase()==='consulting'?' · Consulting/Contracting':''}`}
                dates={[w.start_date,w.end_date||'Present'].filter(Boolean).join(' – ')}
                locked={isLocked}
                onRemove={()=>applicantApi.deleteWorkHistory(w.id).then(invalidate)}
                expanded={expandedWorkId===w.id}
                onToggle={()=>{
                  if(expandedWorkId===w.id){setExpandedWorkId(null);setEditingWork(null);setExpandedCeKey(null);setShowEditClientForm(false);}
                  else{setExpandedWorkId(w.id);setEditingWork({...w,client_engagements:w.client_engagements||[]});}
                }}>
                {editingWork?.id===w.id && !isLocked && (
                  <div className="space-y-4">
                    <SectionHead title="Primary Employer" badge="Required"/>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Employment type" required>
                        <select value={editingWork.employment_type||''} onChange={ev=>setEditingWork((p:any)=>({...p,employment_type:ev.target.value,employer_name:ev.target.value==='Self-Employed / Independent'?'Self-Employed':p.employer_name}))} className="input">
                          {EMPLOYMENT_TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Company name" required><Inp value={editingWork.employer_name||''} onChange={(ev:any)=>setEditingWork((p:any)=>({...p,employer_name:ev.target.value}))}/></Field>
                    </div>
                    <Field label="Role / title" required><Inp value={editingWork.title||''} onChange={(ev:any)=>setEditingWork((p:any)=>({...p,title:ev.target.value}))}/></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="From (MM/YYYY)" required><DateInput value={editingWork.start_date||''} onChange={v=>setEditingWork((p:any)=>({...p,start_date:v}))} required/></Field>
                      <Field label="To (MM/YYYY or Present)" required><DateInput value={editingWork.end_date||'Present'} onChange={v=>setEditingWork((p:any)=>({...p,end_date:v}))} placeholder="Present"/></Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Country" required>
                        <select value={editingWork.employer_country||'United States'} onChange={ev=>setEditingWork((p:any)=>({...p,employer_country:ev.target.value}))} className="input">
                          {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="State / Province" required><StateAutocomplete value={editingWork.employer_state||''} country={editingWork.employer_country} onChange={v=>setEditingWork((p:any)=>({...p,employer_state:v}))}/></Field>
                      <Field label="City" required><Inp value={editingWork.employer_city||''} onChange={(ev:any)=>setEditingWork((p:any)=>({...p,employer_city:ev.target.value}))}/></Field>
                    </div>
                    {/* Nature of Work */}
                    <div className="pt-2">
                      <div className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Nature of Work</div>
                      <Field label="Work arrangement" required hint="Select whether work was performed directly for this employer or for external client organizations.">
                        <select value={editingWork.work_arrangement||'direct'} onChange={ev=>setEditingWork((p:any)=>({...p,work_arrangement:ev.target.value,client_engagements:ev.target.value==='direct'?[]:p.client_engagements||[]}))} className="input">
                          <option value="direct">Worked directly for this employer (no clients)</option>
                          <option value="consulting">Worked for third-party clients via this employer (consulting/contracting)</option>
                        </select>
                      </Field>
                    </div>

                    {/* Client Engagements in edit mode */}
                    {(editingWork.work_arrangement||'direct').toLowerCase()==='consulting' && (
                      <div className="ml-4 pl-3 border-l-2 border-blue-200">
                        <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                          <span>↳</span> Client Engagements
                          <span className="text-[10px] font-normal text-gray-400">(under this employer)</span>
                        </div>
                        {(editingWork.client_engagements||[]).map((c:any,i:number)=>{
                          const ceKey='edit_ce_'+i;
                          const isExp=expandedCeKey===ceKey;
                          return (
                            <div key={i} className="mb-2 rounded-lg overflow-hidden" style={{ background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                              <div className="flex items-start justify-between p-2.5 cursor-pointer hover:bg-gray-50"
                                onClick={()=>setExpandedCeKey(isExp?null:ceKey)}>
                                <div>
                                  <div className="text-sm font-semibold">{c.client_name} <span className="text-gray-400 font-normal text-xs">({c.start_date} – {c.end_date})</span></div>
                                  <div className="text-xs text-gray-500">{c.role_at_client} · {c.engagement_type}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <button onClick={e=>{e.stopPropagation();setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.filter((_:any,j:number)=>j!==i)}));}} className="text-red-400 text-xs border border-gray-200 rounded px-2 py-0.5">Remove</button>
                                  <span className="text-gray-400 text-xs">{isExp?'▲':'▼'}</span>
                                </div>
                              </div>
                              {isExp && (
                                <div className="border-t border-gray-100 p-3 space-y-3">
                                  <div className="grid grid-cols-2 gap-2">
                                    <Field label="Client company" required><Inp value={c.client_name||''} onChange={(e:any)=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,client_name:e.target.value}:x)}))}/></Field>
                                    <Field label="Role at client" required><Inp value={c.role_at_client||''} onChange={(e:any)=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,role_at_client:e.target.value}:x)}))}/></Field>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Field label="Country">
                                      <select value={c.client_country||'United States'} onChange={e=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,client_country:e.target.value}:x)}))} className="input">
                                        {COUNTRIES.map(co=><option key={co}>{co}</option>)}
                                      </select>
                                    </Field>
                                    <Field label="State / Province">
                                      <StateAutocomplete value={c.client_state||''} country={c.client_country||'United States'} onChange={v=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,client_state:v}:x)}))}/>
                                    </Field>
                                    <Field label="City">
                                      <Inp value={c.client_city||''} onChange={(e:any)=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,client_city:e.target.value}:x)}))}/>
                                    </Field>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2">
                                    <Field label="From"><DateInput value={c.start_date||''} onChange={v=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,start_date:v}:x)}))} required/></Field>
                                    <Field label="To"><DateInput value={c.end_date||'Present'} onChange={v=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,end_date:v}:x)}))} placeholder="Present"/></Field>
                                    <Field label="Type"><Sel opts={ENGAGEMENT_TYPES} value={c.engagement_type||'On-site'} onChange={(e:any)=>setEditingWork((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,engagement_type:e.target.value}:x)}))}/></Field>
                                  </div>
                                  <button onClick={()=>setExpandedCeKey(null)} className="btn-secondary text-xs">Done</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {!showEditClientForm && (
                          <button onClick={()=>setShowEditClientForm(true)} className="btn-secondary text-xs mt-1">+ Add client engagement</button>
                        )}
                        {showEditClientForm && (
                          <div className="border border-blue-200 rounded-xl p-3 bg-blue-50/20 mt-2">
                            <div className="text-xs font-bold text-blue-700 mb-2">New client engagement</div>
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Client company" required><Inp value={clientForm.client_name} onChange={(e:any)=>setClientForm((p:any)=>({...p,client_name:e.target.value}))}/></Field>
                              <Field label="Role at client" required><Inp value={clientForm.role_at_client} onChange={(e:any)=>setClientForm((p:any)=>({...p,role_at_client:e.target.value}))}/></Field>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              <Field label="Country">
                                <select value={clientForm.client_country} onChange={e=>setClientForm((p:any)=>({...p,client_country:e.target.value}))} className="input">
                                  {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                                </select>
                              </Field>
                              <Field label="State / Province">
                                <StateAutocomplete value={clientForm.client_state} country={clientForm.client_country} onChange={v=>setClientForm((p:any)=>({...p,client_state:v}))}/>
                              </Field>
                              <Field label="City"><Inp value={clientForm.client_city} onChange={(e:any)=>setClientForm((p:any)=>({...p,client_city:e.target.value}))}/></Field>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mt-2">
                              <Field label="From"><DateInput value={clientForm.start_date} onChange={v=>setClientForm((p:any)=>({...p,start_date:v}))} required/></Field>
                              <Field label="To"><DateInput value={clientForm.end_date} onChange={v=>setClientForm((p:any)=>({...p,end_date:v}))} placeholder="Present"/></Field>
                              <Field label="Type"><Sel opts={ENGAGEMENT_TYPES} value={clientForm.engagement_type} onChange={(e:any)=>setClientForm((p:any)=>({...p,engagement_type:e.target.value}))}/></Field>
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button onClick={()=>{
                                if(!clientForm.client_name||!clientForm.role_at_client||!clientForm.start_date) return toast('Client name, role and start date required','error');
                                setEditingWork((p:any)=>({...p,client_engagements:[...(p.client_engagements||[]),{...clientForm,id:Date.now().toString(),_new:true}]}));
                                setClientForm({client_name:'',client_country:'United States',client_state:'',client_city:'',role_at_client:'',start_date:'',end_date:'Present',engagement_type:'On-site'});
                                setShowEditClientForm(false);
                              }} className="btn-primary text-xs">Save client engagement</button>
                              <button onClick={()=>setShowEditClientForm(false)} className="btn-secondary text-xs">Cancel</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={saveEditWork} disabled={saving} className="btn-primary text-xs">{saving?'Saving...':'Save changes'}</button>
                  </div>
                )}
              </EntryCard>
            ))}

            {/* New work history form */}
            <div className="border-2 border-dashed border-gray-200 rounded-xl mt-3">
              <button onClick={()=>setWorkForm((p:any)=>({...p,'_open':!p._open}))}
                className="w-full flex items-center gap-2 p-3 text-sm font-semibold text-gray-500 hover:text-blue-600 hover:border-blue-300 transition-all">
                + Add work history entry
              </button>
              {workForm._open && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                  {/* Section 1 */}
                  <div className="pt-4">
                    <SectionHead title="Primary Employer" badge="Required"/>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Employment type" required>
                        <select value={workForm.employment_type} onChange={e=>setWorkForm((p:any)=>({...p,employment_type:e.target.value,employer_name:e.target.value==='Self-Employed / Independent'?'Self-Employed':p.employer_name}))} className="input">
                          {EMPLOYMENT_TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </Field>
                      <Field label="Company name" required hint={workForm.employment_type==='Self-Employed / Independent'?'Auto-filled: Self-Employed':''}>
                        <Inp value={workForm.employer_name} onChange={(e:any)=>setWorkForm((p:any)=>({...p,employer_name:e.target.value}))} placeholder="Acme Corp"/>
                      </Field>
                    </div>
                    <div className="mt-3">
                      <Field label="Role / title" required><Inp value={workForm.title} onChange={(e:any)=>setWorkForm((p:any)=>({...p,title:e.target.value}))} placeholder="Senior Developer"/></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <Field label="From (MM/YYYY)" required>
                        <Inp value={workForm.start_date} onChange={(e:any)=>{setWorkForm((p:any)=>({...p,start_date:e.target.value}));setDateErrors((p:any)=>({...p,work_start:''}))} } placeholder="01/2020"/>
                        {dateErrors.work_start && <p className="text-[11px] text-red-500 mt-1">{dateErrors.work_start}</p>}
                      </Field>
                      <Field label="To (MM/YYYY or Present)" required hint='Default: "Present" — type MM/YYYY to override'>
                        <Inp value={workForm.end_date} onChange={(e:any)=>{setWorkForm((p:any)=>({...p,end_date:e.target.value}));setDateErrors((p:any)=>({...p,work_end:''}))} } placeholder="Present"/>
                        {dateErrors.work_end && <p className="text-[11px] text-red-500 mt-1">{dateErrors.work_end}</p>}
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <Field label="Country" required>
                        <select value={workForm.employer_country} onChange={e=>setWorkForm((p:any)=>({...p,employer_country:e.target.value}))} className="input">
                          {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                        </select>
                      </Field>
                      <Field label="State / Province" required>
                        <StateAutocomplete value={workForm.employer_state} country={workForm.employer_country} onChange={v=>setWorkForm((p:any)=>({...p,employer_state:v}))}/>
                      </Field>
                      <Field label="City" required><Inp value={workForm.employer_city} onChange={(e:any)=>setWorkForm((p:any)=>({...p,employer_city:e.target.value}))}/></Field>
                    </div>
                  </div>

                  {/* Section 2 */}
                  <div>
                    <Field label="Nature of work" required hint="Select whether your work was performed directly for this employer or for external client organizations.">
                      <select value={workForm.work_arrangement} onChange={e=>setWorkForm((p:any)=>({...p,work_arrangement:e.target.value,client_engagements:e.target.value==='direct'?[]:p.client_engagements}))} className="input">
                        <option value="direct">Worked directly for this employer (no clients)</option>
                        <option value="consulting">Worked for third-party clients via this employer (consulting/contracting)</option>
                      </select>
                    </Field>
                  </div>

                  {/* only if consulting */}
                  {workForm.work_arrangement?.toLowerCase()==='consulting' && (
                    <div className="ml-4 pl-3 border-l-2 border-blue-200">
                      <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2 flex items-center gap-2">
                        <span>↳</span> Client Engagements
                        <span className="text-[10px] font-normal text-gray-400">(under this employer)</span>
                      </div>

                      {/* Existing client engagements with edit */}
                      {(workForm.client_engagements||[]).map((c:any,i:number) => {
                        const isExpanded = expandedCeKey===('ce_'+i);
                        return (
                          <div key={c.id||i} className="mb-2 rounded-lg overflow-hidden"
                            style={{ background:'#f8fafc', border:'1px solid #e2e8f0' }}>
                            <div className="flex items-start justify-between p-2.5 cursor-pointer hover:bg-gray-50"
                              onClick={()=>setExpandedCeKey(isExpanded?null:('ce_'+i))}>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{c.client_name} <span className="text-gray-400 font-normal text-xs">({c.start_date} – {c.end_date})</span></div>
                                <div className="text-xs text-gray-500">{c.role_at_client} · {c.engagement_type}</div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={e=>{e.stopPropagation();setWorkForm((p:any)=>({...p,client_engagements:p.client_engagements.filter((_:any,j:number)=>j!==i)}));}} className="text-red-400 text-xs border border-gray-200 rounded px-2 py-0.5">Remove</button>
                                <span className="text-gray-400 text-xs">{isExpanded?'▲':'▼'}</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-gray-100 p-3 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <Field label="Client company" required>
                                    <Inp value={c.client_name} onChange={(e:any)=>setWorkForm((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,client_name:e.target.value}:x)}))}/>
                                  </Field>
                                  <Field label="Role at client" required>
                                    <Inp value={c.role_at_client} onChange={(e:any)=>setWorkForm((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,role_at_client:e.target.value}:x)}))}/>
                                  </Field>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <Field label="From"><DateInput value={c.start_date} onChange={v=>setWorkForm((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,start_date:v}:x)}))} required/></Field>
                                  <Field label="To"><DateInput value={c.end_date} onChange={v=>setWorkForm((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,end_date:v}:x)}))} placeholder="Present"/></Field>
                                  <Field label="Type"><Sel opts={ENGAGEMENT_TYPES} value={c.engagement_type} onChange={(e:any)=>setWorkForm((p:any)=>({...p,client_engagements:p.client_engagements.map((x:any,j:number)=>j===i?{...x,engagement_type:e.target.value}:x)}))}/></Field>
                                </div>
                                <button onClick={()=>setExpandedCeKey(null)} className="btn-secondary text-xs">Done editing</button>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {showClientForm ? (
                        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50/20">
                          <div className="text-xs font-bold text-blue-700 mb-3">New client engagement <span className="text-gray-400 font-normal">(dates must fall within employer dates)</span></div>
                          <div className="grid grid-cols-2 gap-3">
                            <Field label="Client company name" required><Inp value={clientForm.client_name} onChange={(e:any)=>setClientForm((p:any)=>({...p,client_name:e.target.value}))}/></Field>
                            <Field label="Role / title at client" required><Inp value={clientForm.role_at_client} onChange={(e:any)=>setClientForm((p:any)=>({...p,role_at_client:e.target.value}))}/></Field>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <Field label="Country" required>
                              <select value={clientForm.client_country} onChange={e=>setClientForm((p:any)=>({...p,client_country:e.target.value}))} className="input">
                                {COUNTRIES.map(c=><option key={c}>{c}</option>)}
                              </select>
                            </Field>
                            <Field label="State / Province" required><StateAutocomplete value={clientForm.client_state} country={clientForm.client_country} onChange={v=>setClientForm((p:any)=>({...p,client_state:v}))}/></Field>
                            <Field label="City" required><Inp value={clientForm.client_city} onChange={(e:any)=>setClientForm((p:any)=>({...p,client_city:e.target.value}))}/></Field>
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-3">
                            <Field label="From (MM/YYYY)" required><Inp value={clientForm.start_date} onChange={(e:any)=>setClientForm((p:any)=>({...p,start_date:e.target.value}))} placeholder="01/2021"/></Field>
                            <Field label="To (MM/YYYY or Present)" required><Inp value={clientForm.end_date} onChange={(e:any)=>setClientForm((p:any)=>({...p,end_date:e.target.value}))} placeholder="Present"/></Field>
                            <Field label="Engagement type" required>
                              <Sel opts={ENGAGEMENT_TYPES} value={clientForm.engagement_type} onChange={(e:any)=>setClientForm((p:any)=>({...p,engagement_type:e.target.value}))}/>
                            </Field>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <button onClick={addClientEngagement} className="btn-primary text-xs">Save client engagement</button>
                            <button onClick={()=>setShowClientForm(false)} className="btn-secondary text-xs">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button onClick={()=>setShowClientForm(true)} className="btn-secondary text-xs mt-2">+ Add client engagement</button>
                      )}
                      {workForm.work_arrangement?.toLowerCase()==='consulting' && (workForm.client_engagements||[]).length===0 && (
                        <p className="text-[11px] text-amber-600 mt-2">⚠ At least one client engagement is required when consulting/contracting is selected.</p>
                      )}
                    </div>
                  )}

                  {(!workForm.title||!workForm.employer_name||!workForm.start_date||!workForm.employer_state||!workForm.employer_city) && (
                    <p className="text-[11px] text-red-500">* Required fields must be completed: Company, Role, Start date, State, City</p>
                  )}
                  <div className="flex gap-2 pt-2">
                    <button onClick={addWork} disabled={saving||!workForm.title||!workForm.employer_name||!workForm.start_date} className="btn-primary text-xs disabled:opacity-50">{saving?'Saving...':'Save work history entry'}</button>
                    <button onClick={()=>setWorkForm((p:any)=>({...p,_open:false}))} className="btn-secondary text-xs">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ STEP 3: REFERENCES ════════════════ */}
        {step===3 && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">Professional References</h2>
            <p className="text-xs text-gray-500 mb-4">Add professional references who can vouch for your work history.</p>
            {(data?.references||[]).map((r:any) => (
              <EntryCard key={r.id}
                title={`${r.referee_first_name} ${r.referee_last_name}`}
                subtitle={[r.referee_title,r.referee_company].filter(Boolean).join(' · ')}
                locked={isLocked}
                onRemove={()=>applicantApi.deleteReference(r.id).then(invalidate)}
                expanded={expandedEntry===r.id}
                onToggle={()=>{
                  if(expandedEntry===r.id){setExpandedEntry(null);setEditingRef(null);}
                  else{setExpandedEntry(r.id);setEditingRef({...r});}
                }}>
                {editingRef?.id===r.id && !isLocked && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="First name" required><Inp value={editingRef.referee_first_name||''} onChange={(e:any)=>setEditingRef((p:any)=>({...p,referee_first_name:e.target.value}))}/></Field>
                      <Field label="Last name"><Inp value={editingRef.referee_last_name||''} onChange={(e:any)=>setEditingRef((p:any)=>({...p,referee_last_name:e.target.value}))}/></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Work email" required><Inp type="email" value={editingRef.referee_email||''} onChange={(e:any)=>setEditingRef((p:any)=>({...p,referee_email:e.target.value}))}/></Field>
                      <Field label="Title"><Inp value={editingRef.referee_title||''} onChange={(e:any)=>setEditingRef((p:any)=>({...p,referee_title:e.target.value}))}/></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Company"><Inp value={editingRef.referee_company||''} onChange={(e:any)=>setEditingRef((p:any)=>({...p,referee_company:e.target.value}))}/></Field>
                      <Field label="Relationship">
                        <Sel opts={['','Manager','Peer','Direct Report','Client','Mentor','Other']} value={editingRef.relationship_type||''} onChange={(e:any)=>setEditingRef((p:any)=>({...p,relationship_type:e.target.value}))}/>
                      </Field>
                    </div>
                    <button onClick={saveEditRef} disabled={saving} className="btn-primary text-xs">{saving?'Saving...':'Save changes'}</button>
                  </div>
                )}
              </EntryCard>
            ))}
            <AddSection label="Reference" onSave={addRef} saveRef={refSaveRef} onCancel={()=>setRefForm({referee_first_name:'',referee_last_name:'',referee_email:''})} saving={saving} canSave={!!refForm.referee_first_name&&!!refForm.referee_last_name&&!!refForm.referee_email}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" required><Inp value={refForm.referee_first_name} onChange={(e:any)=>setRefForm((p:any)=>({...p,referee_first_name:e.target.value}))}/></Field>
                <Field label="Last name"><Inp value={refForm.referee_last_name} onChange={(e:any)=>setRefForm((p:any)=>({...p,referee_last_name:e.target.value}))}/></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Work email" required><Inp type="email" value={refForm.referee_email} onChange={(e:any)=>setRefForm((p:any)=>({...p,referee_email:e.target.value}))}/></Field>
                <Field label="Title"><Inp value={refForm.referee_title||''} onChange={(e:any)=>setRefForm((p:any)=>({...p,referee_title:e.target.value}))}/></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Company"><Inp value={refForm.referee_company||''} onChange={(e:any)=>setRefForm((p:any)=>({...p,referee_company:e.target.value}))}/></Field>
                <Field label="Relationship"><Sel opts={['','Manager','Peer','Direct Report','Client','Mentor','Other']} value={refForm.relationship_type||''} onChange={(e:any)=>setRefForm((p:any)=>({...p,relationship_type:e.target.value}))}/></Field>
              </div>
            </AddSection>
          </div>
        )}

        {/* ════════════════ STEP 4: CERTIFICATIONS ════════════════ */}
        {step===4 && (
          <div>
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Certifications</h2>
            {(data?.certifications||[]).map((c:any) => (
              <EntryCard key={c.id}
                title={c.cert_name}
                subtitle={c.authority_name}
                dates={c.issued_date}
                locked={isLocked}
                onRemove={()=>applicantApi.deleteCertification(c.id).then(invalidate)}
                expanded={expandedEntry===c.id}
                onToggle={()=>{
                  if(expandedEntry===c.id){setExpandedEntry(null);setEditingCert(null);}
                  else{setExpandedEntry(c.id);setEditingCert({...c});}
                }}>
                {editingCert?.id===c.id && !isLocked && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Type"><Sel opts={['','Technical','Leadership','Process','Functional','Social','Other']} value={editingCert.cert_type||''} onChange={(e:any)=>setEditingCert((p:any)=>({...p,cert_type:e.target.value}))}/></Field>
                      <Field label="Certifying authority"><Inp value={editingCert.authority_name||''} onChange={(e:any)=>setEditingCert((p:any)=>({...p,authority_name:e.target.value}))}/></Field>
                    </div>
                    <Field label="Certification name" required><Inp value={editingCert.cert_name||''} onChange={(e:any)=>setEditingCert((p:any)=>({...p,cert_name:e.target.value}))}/></Field>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Certificate number"><Inp value={editingCert.cert_number||''} onChange={(e:any)=>setEditingCert((p:any)=>({...p,cert_number:e.target.value}))}/></Field>
                      <Field label="Issued date"><Inp type="date" value={editingCert.issued_date||''} onChange={(e:any)=>setEditingCert((p:any)=>({...p,issued_date:e.target.value}))}/></Field>
                    </div>
                    <button onClick={saveEditCert} disabled={saving} className="btn-primary text-xs">{saving?'Saving...':'Save changes'}</button>
                  </div>
                )}
              </EntryCard>
            ))}
            <AddSection label="Certification" onSave={addCert} saveRef={certSaveRef} onCancel={()=>setCertForm({cert_name:''})} saving={saving} canSave={!!certForm.cert_name}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type"><Sel opts={['','Technical','Leadership','Process','Functional','Social','Other']} value={certForm.cert_type||''} onChange={(e:any)=>setCertForm((p:any)=>({...p,cert_type:e.target.value}))}/></Field>
                <Field label="Certifying authority"><Inp value={certForm.authority_name||''} onChange={(e:any)=>setCertForm((p:any)=>({...p,authority_name:e.target.value}))} placeholder="AWS, Google, PMI..."/></Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Certification name" required><Inp value={certForm.cert_name} onChange={(e:any)=>setCertForm((p:any)=>({...p,cert_name:e.target.value}))}/></Field>
                <Field label="Certificate number"><Inp value={certForm.cert_number||''} onChange={(e:any)=>setCertForm((p:any)=>({...p,cert_number:e.target.value}))}/></Field>
              </div>
              <div className="mt-3"><Field label="Issued date"><Inp type="date" value={certForm.issued_date||''} onChange={(e:any)=>setCertForm((p:any)=>({...p,issued_date:e.target.value}))}/></Field></div>
            </AddSection>
          </div>
        )}


      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-5">
        <button onClick={()=>{setStep(p=>Math.max(0,p-1));window.scrollTo(0,0);}} disabled={step===0} className="btn-secondary disabled:opacity-30">← Back</button>
        <div className="flex gap-3">
          <button onClick={handlePark} className="btn-ghost text-xs text-gray-500">💾 Save &amp; continue later</button>
          {step<STEPS.length-1 && <button onClick={goNext} disabled={saving} className="btn-primary">{saving?'Saving...':'Next: '+STEPS[step+1].label+' →'}</button>}
          {step===STEPS.length-1 && <button onClick={()=>setShowFinish(true)} className="btn-primary" style={{ background:'#78b41e' }}>Finish ✓</button>}
        </div>
      </div>
    </div>
  );
}

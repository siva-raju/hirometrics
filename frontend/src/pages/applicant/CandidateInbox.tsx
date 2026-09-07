import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface InboxItem {
  id: string;
  type: 'Invite' | 'Link';
  source: string;
  job_title: string;
  job_id: string;
  company: string;
  date: string;
  status: string;
  job_description?: string;
  location?: string;
  message?: string;
  folder_id?: string;
  expires_at?: string;
}

interface ResumeVersion {
  id: string;
  version_number: number;
  description: string | null;
  original_filename: string;
  is_current: boolean;
}

// ── Incomplete Profile Modal ──────────────────────────────────────────────────
function IncompleteProfileModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <h3 className="font-bold text-gray-900">Submission Failed</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            Submission failed. Profile should be complete and an active uploaded resume
            should be present. Please update and resubmit.
          </p>
        </div>
        <div className="p-6 pt-0">
          <button onClick={onClose} className="btn-primary w-full">OK</button>
        </div>
      </div>
    </div>
  );
}

// ── Resume picker modal ───────────────────────────────────────────────────────
function ResumePickerModal({ resumes, onSelect, onClose }: {
  resumes: ResumeVersion[];
  onSelect: (r: ResumeVersion) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Select Resume</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
          {resumes.map(r => (
            <button key={r.id} onClick={() => onSelect(r)}
              className="w-full text-left px-5 py-3 hover:bg-blue-50 transition-colors flex items-center gap-3">
              <span className="font-mono text-sm font-bold" style={{ color: 'var(--hm-blue)', minWidth: 28 }}>
                v{r.version_number}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">{r.original_filename}</div>
                {r.description && (
                  <div className="text-xs text-gray-400 truncate">{r.description}</div>
                )}
              </div>
              {r.is_current && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: '#eef6db', color: '#3a6609' }}>Active</span>
              )}
            </button>
          ))}
        </div>
        <div className="p-5 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary w-full text-sm">OK</button>
        </div>
      </div>
    </div>
  );
}

// ── Job Detail Slide-over ─────────────────────────────────────────────────────
function JobDetailPanel({ item, resumes, profileReady, savedResume, onSaveResume, onSubmit, onClose }: {
  item: InboxItem;
  resumes: ResumeVersion[];
  profileReady: boolean;
  savedResume: ResumeVersion | null;
  onSaveResume: (r: ResumeVersion) => void;
  onSubmit: (resumeId: string, coverMsg: string) => Promise<void>;
  onClose: () => void;
}) {
  const [coverMsg, setCoverMsg] = useState('');
  const [selectedResume, setSelectedResume] = useState<ResumeVersion | null>(
    savedResume ?? resumes.find(r => r.is_current) ?? null
  );
  const [showPicker, setShowPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleViewResume = async () => {
    if (!selectedResume) return;
    try {
      const token = JSON.parse(localStorage.getItem('hirometrics-auth') || '{}')?.state?.accessToken;
      const res = await fetch(`/api/v1/applicants/me/resume-file/${selectedResume.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      window.open(URL.createObjectURL(blob), '_blank');
    } catch { /* silent */ }
  };

  const [applyError, setApplyError] = useState('');

  const handleApply = async () => {
    setSubmitting(true);
    setApplyError('');
    try {
      await onSubmit(selectedResume?.id ?? '', coverMsg);
    } catch (e: any) {
      setApplyError(e?.response?.data?.detail || 'Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Strip [Linked from: ...] prefix just in case backend didn't
  const cleanDescription = (item.job_description || '').replace(/^\[Linked from:[^\]]*\]\s*/i, '').trim();

  return (
    <>
      {showPicker && (
        <ResumePickerModal
          resumes={resumes}
          onSelect={r => { setSelectedResume(r); onSaveResume(r); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full z-50 flex flex-col bg-white shadow-2xl"
        style={{ width: 480 }}>

        {/* Header */}
        <div className="p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest mb-1"
                style={{ color: item.type === 'Invite' ? '#0078d2' : '#78b41e' }}>
                {item.type === 'Invite' ? '📨 Invitation' : '🔗 Job Link'}
              </div>
              <h2 className="text-base font-bold text-gray-900 leading-tight">{item.job_title}</h2>
              {item.job_id && item.job_id !== '—' && (
                <div className="font-mono text-xs text-gray-400 mt-0.5">{item.job_id}</div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-3">✕</button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Company & Location */}
          <div className="grid grid-cols-2 gap-4">
            {item.company && item.company !== '—' && (
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Company</div>
                <div className="text-sm text-gray-800">{item.company}</div>
              </div>
            )}
            {item.location && (
              <div>
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Location</div>
                <div className="text-sm text-gray-800">{item.location}</div>
              </div>
            )}
          </div>

          {/* Resume attach */}
          <div>
            <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">Resume</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowPicker(true)}
                className="btn-secondary text-xs py-1.5">
                Attach Resume
              </button>
              {!selectedResume && (
                <span className="text-xs text-amber-600 font-medium">
                  ⚠ Resume required to apply
                </span>
              )}
              {selectedResume && (
                <button
                  onClick={handleViewResume}
                  className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                  style={{ background: '#f0f7ff', color: '#185fa5', border: '1px solid #bdd7f5' }}>
                  View Resume
                </button>
              )}
            </div>
            {selectedResume && (
              <div className="mt-2 p-3 rounded-xl text-xs"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <span className="font-mono font-bold" style={{ color: 'var(--hm-blue)' }}>
                  v{selectedResume.version_number}
                </span>
                <span className="text-gray-600 ml-2">{selectedResume.original_filename}</span>
                {selectedResume.description && (
                  <div className="text-gray-400 mt-0.5 italic">{selectedResume.description}</div>
                )}
              </div>
            )}
          </div>

          {/* Message from inviter */}
          {item.message && (
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Message</div>
              <div className="p-3 rounded-xl text-sm text-blue-800 italic"
                style={{ background: '#f0f7ff', border: '1px solid #bdd7f5' }}>
                "{item.message}"
              </div>
            </div>
          )}

          {/* Job description */}
          {cleanDescription && (
            <div>
              <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1">Job Description</div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{cleanDescription}</p>
            </div>
          )}

          {/* Cover message */}
          <div>
            <label className="label">
              Cover Message
              <span className="text-gray-400 font-normal normal-case ml-1">(optional)</span>
            </label>
            <textarea
              className="input resize-none" rows={3} value={coverMsg}
              onChange={e => setCoverMsg(e.target.value)}
              placeholder="Add a brief note to the hiring team..."
            />
          </div>

          {/* Consent notice */}
          <div className="p-3 rounded-xl text-xs text-gray-600 leading-relaxed"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            By clicking <strong>Apply</strong>, you consent to share your HiroMetrics profile,
            resume, and credential information with the inviting organization and any subsequent
            propagation. This information may be used for candidate evaluation, reporting, and analytics.
          </div>
        </div>

        {/* Footer */}
        {applyError && (
          <div className="px-5 py-3 flex-shrink-0 text-sm font-medium text-red-700 rounded-none"
            style={{ background: '#fef2f2', borderTop: '1px solid #fecaca' }}>
            ⚠ {applyError}
          </div>
        )}
        <div className="p-5 border-t border-gray-100 flex-shrink-0 flex items-center gap-2">
          <button
            onClick={handleApply}
            disabled={submitting || !profileReady || !selectedResume}
            className="text-sm font-bold py-2 px-5 rounded-xl transition-all"
            title={!selectedResume ? 'Please attach a resume before applying' : ''}
            style={{
              background: (profileReady && selectedResume) ? '#0078d2' : '#e2e8f0',
              color: (profileReady && selectedResume) ? 'white' : '#94a3b8',
              border: 'none',
              cursor: (profileReady && selectedResume) ? 'pointer' : 'not-allowed',
            }}>
            {submitting ? 'Submitting…' : 'Apply'}
          </button>
          <button
            onClick={() => { if (selectedResume) onSaveResume(selectedResume); onClose(); }}
            disabled={submitting}
            className="btn-primary text-sm"
            style={{ background: '#64748b' }}>
            Save &amp; Close
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary text-sm">
            Cancel
          </button>

        </div>
      </div>
    </>
  );
}

// ── Candidate Inbox ───────────────────────────────────────────────────────────
export default function CandidateInbox() {
  const qc = useQueryClient();
  const [openItem, setOpenItem]                   = useState<InboxItem | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<InboxItem | null>(null);
  const [showIncomplete, setShowIncomplete]       = useState(false);
  // Resume attachment per inbox item — populated from API (attached_resume field on job links)
  const [attachedResumes, setAttachedResumes] = useState<Record<string, ResumeVersion>>({});
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Profile check
  const { data: profileData } = useQuery({
    queryKey: ['my-profile-inbox'],
    queryFn: () => applicantApi.getProfile().then(r => r.data),
    staleTime: 30_000,
  });
  const profileReady = !!(profileData?.profile?.baseline_locked && profileData?.current_resume);

  // Resume list
  const { data: resumes = [] } = useQuery({
    queryKey: ['my-resumes'],
    queryFn: () => applicantApi.getMyResumes().then(r => r.data),
  });

  // Inbox data
  const { data: invitations = [] } = useQuery({
    queryKey: ['my-invitations'],
    queryFn: () => applicantApi.getMyInvitations().then(r => r.data),
  });
  const { data: jobLinks = [] } = useQuery({
    queryKey: ['my-job-links'],
    queryFn: () => applicantApi.getMyJobLinks?.()?.then((r: any) => r.data) ?? Promise.resolve([]),
  });

  // Restore attached resume selections from DB when job links load (onSuccess removed in TanStack v5)
  useEffect(() => {
    if (!jobLinks || (jobLinks as any[]).length === 0) return;
    const map: Record<string, ResumeVersion> = {};
    (jobLinks as any[]).forEach((l: any) => { if (l.attached_resume) map[l.id] = l.attached_resume; });
    if (Object.keys(map).length > 0) setAttachedResumes(prev => ({ ...prev, ...map }));
  }, [jobLinks]);

  // Mutations
  const respondMutation = useMutation({
    mutationFn: ({ id, message, resume_id }: { id: string; message: string; resume_id?: string }) =>
      applicantApi.respondToInvitation(id, { response: 'accepted', message, resume_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invitations'] });
      qc.invalidateQueries({ queryKey: ['my-sent'] });
      setOpenItem(null);
      showToast('Application submitted — under HiroMetrics review ✓');
    },
    onError: () => {},  // Error handled inside panel
  });

  const linkApplyMutation = useMutation({
    mutationFn: ({ id, message, resume_id }: { id: string; message: string; resume_id?: string }) =>
      applicantApi.applyViaJobLinkInbox(id, { message, resume_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-job-links'] });
      qc.invalidateQueries({ queryKey: ['my-sent'] });
      setOpenItem(null);
      showToast('Application submitted — under HiroMetrics review ✓');
    },
    onError: () => {},  // Error handled inside panel
  });

  const removeLinkMutation = useMutation({
    mutationFn: (id: string) => applicantApi.removeJobLink?.(id) ?? Promise.resolve(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-job-links'] });
      setDeleteConfirmItem(null);
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => applicantApi.respondToInvitation(id, { response: 'rejected' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-invitations'] }),
  });

  const handleOpenClick = (item: InboxItem) => {
    setOpenItem(item);
  };

  const handleSubmit = async (resumeId: string, coverMsg: string) => {
    if (!openItem) return;
    // Fall back to the active resume if none explicitly selected
    const effectiveResumeId = resumeId ||
      (resumes as any[]).find((r: any) => r.is_current)?.id || '';
    if (openItem.type === 'Link') {
      await linkApplyMutation.mutateAsync({ id: openItem.id, message: coverMsg, resume_id: effectiveResumeId });
    } else {
      await respondMutation.mutateAsync({ id: openItem.id, message: coverMsg, resume_id: effectiveResumeId });
    }
  };

  // Merge inbox items
  const inboxItems: InboxItem[] = [
    ...invitations
      .filter((i: any) => i.status === 'pending')
      .map((i: any): InboxItem => ({
        id: i.id, type: 'Invite', source: 'Invitation',
        job_title: i.position_title || 'Position',
        job_id: i.position_code || '—',
        company: i.org_name || '—',
        date: i.sent_at?.slice(0, 10) || '',
        status: i.status,
        job_description: i.job_description,
        message: i.message,
        folder_id: i.folder_id,
        expires_at: i.expires_at,
      })),
    ...jobLinks.map((l: any): InboxItem => ({
      id: l.id, type: 'Link', source: 'Link',
      job_title: l.position_title || 'Job Opportunity',
      job_id: l.position_code || '—',
      company: l.org_name || '—',
      date: l.added_at?.slice(0, 10) || '',
      status: 'pending',
      job_description: l.description,
      location: l.location,
      folder_id: l.folder_id,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const SOURCE_CFG = {
    Invitation: { bg: '#e6f1fb', color: '#0c447c' },
    Link:       { bg: '#eef6db', color: '#3a5a0d' },
  };

  const fmtDate = (d: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' }) : '—';

  return (
    <div className="max-w-6xl fade-in">
      {/* Modals */}
      {showIncomplete && <IncompleteProfileModal onClose={() => setShowIncomplete(false)} />}

      {openItem && (
        <JobDetailPanel
          item={openItem}
          resumes={resumes as ResumeVersion[]}
          profileReady={profileReady}
          savedResume={attachedResumes[openItem.id] ?? null}
          onSaveResume={(r) => {
            setAttachedResumes(prev => ({ ...prev, [openItem.id]: r }));
            applicantApi.attachResumeToJobLink?.(openItem.id, r.id).catch(() => {});
          }}
          onSubmit={handleSubmit}
          onClose={() => setOpenItem(null)}
        />
      )}

      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm scale-in">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Delete job link?</h3>
              <p className="text-sm text-gray-500 mt-1">
                This will remove <strong>{deleteConfirmItem.job_title}</strong> from your inbox.
                You can re-add it by clicking the original link again.
              </p>
            </div>
            <div className="p-6 flex gap-3">
              <button onClick={() => removeLinkMutation.mutate(deleteConfirmItem.id)}
                className="btn-primary flex-1 text-sm" style={{ background: '#dc2626' }}>
                Yes, delete
              </button>
              <button onClick={() => setDeleteConfirmItem(null)} className="btn-secondary flex-1 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Job opportunities — invitations and links</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex justify-between ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '⚠'} {toast.text}</span>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Table */}
      {inboxItems.length === 0 ? (
        <div className="card empty-state py-16">
          <div className="empty-state-icon text-4xl">📭</div>
          <p className="text-sm font-semibold text-gray-500 mt-3">Your inbox is empty</p>
          <p className="text-xs text-gray-400 mt-1">Invitations from hiring entities will appear here</p>
        </div>
      ) : (
        <>
          <div className="card p-0 overflow-hidden">
            <table className="hm-table">
              <thead>
                <tr>
                  <th className="w-28">Source</th>
                  <th>Job Title</th>
                  <th className="w-36">Job ID</th>
                  <th>Company</th>
                  <th className="w-24">Date</th>
                  <th className="w-44">Actions</th>
                </tr>
              </thead>
              <tbody>
                {inboxItems.map(item => {
                  const sc = SOURCE_CFG[item.source as keyof typeof SOURCE_CFG] || SOURCE_CFG.Link;
                  return (
                    <tr key={item.id}>
                      <td>
                        <span className="badge text-[11px] font-bold"
                          style={{ background: sc.bg, color: sc.color }}>
                          {item.source === 'Invitation' ? '📨' : '🔗'} {item.source}
                        </span>
                      </td>
                      <td>
                        <div className="font-semibold text-sm text-gray-900">{item.job_title}</div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleOpenClick(item)}
                          className="font-mono text-sm font-semibold text-left hover:underline transition-colors"
                          style={{ color: 'var(--hm-blue)' }}>
                          {item.job_id}
                        </button>
                      </td>
                      <td>
                        <div className="text-sm text-gray-700">{item.company}</div>
                      </td>
                      <td className="text-xs text-gray-500 whitespace-nowrap">
                        {fmtDate(item.date)}
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {/* Open — replaces Apply */}
                          <button
                            onClick={() => handleOpenClick(item)}
                            className="btn-primary text-xs py-1.5 px-3">
                            Open
                          </button>
                          {/* Decline — Invite only */}
                          {item.type === 'Invite' && (
                            <button
                              onClick={() => declineMutation.mutate(item.id)}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                              style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                              Decline
                            </button>
                          )}
                          {/* Delete — Link only */}
                          {item.type === 'Link' && (
                            <button
                              onClick={() => setDeleteConfirmItem(item)}
                              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                              style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 px-4 py-2.5 rounded-xl text-xs text-gray-400 italic"
            style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <strong className="text-gray-500 not-italic">Invitation</strong> = sent by hiring manager ·{' '}
            <strong className="text-gray-500 not-italic">Link</strong> = you clicked a job link and it appeared here
          </div>
        </>
      )}
    </div>
  );
}

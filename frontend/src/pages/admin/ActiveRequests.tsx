import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

const STATUS_OPTS = [
  { value: 'awaiting_review',   label: 'Awaiting review',    bg: '#FAEEDA', color: '#633806' },
  { value: 'review_in_progress',label: 'Review in progress', bg: '#E6F1FB', color: '#0C447C' },
  { value: 'pending_qa',        label: 'Pending QA review',  bg: '#EAF3DE', color: '#27500A' },
  { value: 'on_hold',           label: 'On hold',             bg: '#FCEBEB', color: '#791F1F' },
  { value: 'ready_to_send',     label: 'Ready to send',       bg: '#E6F1FB', color: '#185FA5' },
];
const FLAG_OPTS = [
  { value: 'green',  label: '🟢  No inconsistencies noted' },
  { value: 'yellow', label: '🟡  Minor inconsistencies' },
  { value: 'red',    label: '🔴  Inconsistencies — follow up recommended' },
];

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_OPTS.find(o => o.value === status) || STATUS_OPTS[0];
  return (
    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}>{s.label}</span>
  );
}

function SlideOver({ rev, onClose }: { rev: any; onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState(rev.status);
  const [flag, setFlag] = useState(rev.disposition_flag || '');
  const [comments, setComments] = useState(rev.comments || '');
  const [uploading, setUploading] = useState(false);
  const [reportFile, setReportFile] = useState<string | null>(rev.discrepancy_report_filename);
  const [reportUrl,  setReportUrl]  = useState<string | null>(rev.discrepancy_report_url || null);
  const [toast, setToast] = useState('');

  const canSend = status === 'ready_to_send' && !!reportFile && !!flag;

  const updateStatus = useMutation({
    mutationFn: (s: string) => adminApi.updateReviewStatus(rev.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-requests'] })
  });
  const updateDisposition = useMutation({
    mutationFn: () => adminApi.updateReviewDisposition(rev.id, { disposition_flag: flag, comments }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['active-requests'] }); setToast('Saved'); setTimeout(() => setToast(''), 2000); }
  });
  const send = useMutation({
    mutationFn: async () => {
      // Always persist disposition + comments before sending so the DB is up to date
      if (flag) {
        await adminApi.updateReviewDisposition(rev.id, { disposition_flag: flag, comments });
      }
      return adminApi.sendToRecipient(rev.id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['active-requests'] }); onClose(); },
    onError: (e: any) => {
      const detail = e?.response?.data?.detail || 'Send failed. Please check all required fields.';
      setToast(detail);
      setTimeout(() => setToast(''), 4000);
    }
  });

  const handleUpload = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) { setToast('PDF files only'); setTimeout(() => setToast(''), 3000); return; }
    setUploading(true);
    try {
      const upRes = await adminApi.uploadDiscrepancyReport(rev.id, file);
      setReportFile(file.name);
      if (upRes?.data?.url) setReportUrl(upRes.data.url);
      qc.invalidateQueries({ queryKey: ['active-requests'] });
      setToast('Report uploaded ✓');
    } catch { setToast('Upload failed'); }
    finally { setUploading(false); setTimeout(() => setToast(''), 3000); }
  };

  const handleStatusChange = (s: string) => {
    setStatus(s);
    updateStatus.mutate(s);
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.25)' }} onClick={onClose} />
      {/* Drawer */}
      <div className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{ width: '440px', background: 'white', borderLeft: '0.5px solid #e2e8f0', boxShadow: '-8px 0 32px rgba(0,0,0,0.1)' }}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <div className="font-bold text-gray-900">{rev.candidate_name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{rev.candidate_email}</div>
            <div className="font-mono text-xs mt-1" style={{ color: '#0078d2' }}>{rev.job_id}{rev.job_title ? ` — ${rev.job_title}` : ''}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-3">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {toast && (
            <div className="px-3 py-2 rounded-lg text-xs font-semibold" style={{ background: '#eef6db', color: '#27500a' }}>
              {toast}
            </div>
          )}

          {/* Status */}
          <div>
            <label className="label mb-1">Status</label>
            <select value={status} onChange={e => handleStatusChange(e.target.value)} className="input text-sm">
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Downloads */}
          <div>
            <label className="label mb-1">Profile & Resume</label>
            <div className="flex gap-2">
              <a href={`/api/v1/applicants/me`} target="_blank" rel="noreferrer"
                className="btn-secondary text-xs flex-1 text-center">⬇ Download Profile</a>
              <a href={`/api/v1/applications/${rev.application_id}/resume`} target="_blank" rel="noreferrer"
                className="btn-secondary text-xs flex-1 text-center">⬇ Download Resume</a>
            </div>
          </div>

          {/* Report upload */}
          <div>
            <label className="label mb-1">Discrepancy Report <span className="text-red-400">*</span></label>
            <div onClick={() => !reportFile && fileRef.current?.click()}
              className="border-2 border-dashed rounded-xl p-4 text-center transition-all hover:border-blue-400 hover:bg-blue-50"
              style={{ cursor: reportFile ? 'default' : 'pointer', borderColor: reportFile ? '#78b41e' : '#e2e8f0' }}>
              {reportFile ? (
                <div onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-2 justify-center">
                    {reportUrl ? (
                      <button
                        className="text-sm font-semibold text-green-700 hover:underline cursor-pointer"
                        onClick={async e => {
                          e.stopPropagation();
                          try {
                            const token = (JSON.parse(localStorage.getItem('hirometrics-auth')||'{}'))?.state?.accessToken;
                            const res = await fetch(reportUrl, {headers:{Authorization:'Bearer '+token}});
                            if (!res.ok) throw new Error('Failed to load PDF');
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          } catch { alert('Could not open PDF. Please try again.'); }
                        }}>
                        📄 {reportFile}
                      </button>
                    ) : (
                      <span className="text-sm font-semibold text-green-700">✓ {reportFile}</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 cursor-pointer hover:text-blue-500"
                    onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
                    Click here to replace
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-500">{uploading ? 'Uploading...' : 'Drop PDF or click to upload'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">PDF only · Max 10MB</div>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".pdf" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          </div>

          {/* Disposition flag */}
          <div>
            <label className="label mb-1">Disposition Flag <span className="text-red-400">*</span></label>
            <select value={flag} onChange={e => setFlag(e.target.value)} className="input text-sm">
              <option value="">Select...</option>
              {FLAG_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Comments */}
          <div>
            <label className="label mb-1">Comments <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea className="input resize-none text-sm" rows={4} value={comments}
              onChange={e => setComments(e.target.value)}
              placeholder="Add reviewer notes..." />
          </div>

          <button onClick={() => updateDisposition.mutate()}
            disabled={updateDisposition.isPending}
            className="btn-secondary text-xs w-full">
            {updateDisposition.isPending ? 'Saving...' : '💾 Save disposition & comments'}
          </button>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Close</button>
          <button
            onClick={() => send.mutate()}
            disabled={!canSend || send.isPending}
            className="flex-1 text-sm font-bold py-2.5 rounded-xl transition-all"
            style={{
              background: canSend ? '#0078d2' : '#f1f5f9',
              color: canSend ? 'white' : '#94a3b8',
              cursor: canSend ? 'pointer' : 'not-allowed',
              border: 'none',
            }}
            title={!canSend ? 'Status must be Ready to send, report uploaded, and flag set' : ''}>
            {send.isPending ? 'Sending...' : '📤 Send to recipient'}
          </button>
        </div>

        {!canSend && (
          <div className="px-5 pb-3 text-[11px] text-gray-400 text-center">
            Requires: Status = Ready to send · Report uploaded · Flag set
          </div>
        )}
      </div>
    </>
  );
}

export default function ActiveRequests() {
  const [openRev, setOpenRev] = useState<any | null>(null);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['active-requests'],
    queryFn: () => adminApi.getActiveRequests().then(r => r.data),
  });

  return (
    <div className="fade-in">
      {openRev && <SlideOver rev={openRev} onClose={() => setOpenRev(null)} />}

      <div className="mb-6">
        <h1 className="page-title">Active Requests</h1>
        <p className="page-subtitle">Candidate submissions pending internal review before delivery to hiring managers</p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm p-8">Loading...</div>
      ) : reviews.length === 0 ? (
        <div className="card empty-state py-12">
          <div className="empty-state-icon text-3xl">📋</div>
          <p className="text-sm font-semibold text-gray-500">No active requests</p>
          <p className="text-xs text-gray-400 mt-1">Candidate submissions will appear here for review</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job ID</th>
                <th>Date Submitted</th>
                <th>Status</th>
                <th className="w-24">Review</th>
                <th className="w-36">Transmission</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((rev: any) => {
                const canSend = rev.status === 'ready_to_send' && !!rev.discrepancy_report_url && !!rev.disposition_flag;
                return (
                  <tr key={rev.id} onClick={() => setOpenRev(rev)} className="cursor-pointer">
                    <td>
                      <div className="font-semibold text-sm text-gray-900">{rev.candidate_name}</div>
                      <div className="text-xs text-gray-400">{rev.candidate_email}</div>
                    </td>
                    <td>
                      <span className="font-mono text-xs" style={{ color: '#0078d2' }}>{rev.job_id}</span>
                      {rev.job_title && <div className="text-xs text-gray-400 mt-0.5">{rev.job_title}</div>}
                    </td>
                    <td className="text-xs text-gray-500">
                      {rev.date_submitted ? new Date(rev.date_submitted).toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'2-digit' }) : '—'}
                    </td>
                    <td><StatusBadge status={rev.status} /></td>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => setOpenRev(rev)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: '#e6f1fb', color: '#185fa5', border: '1px solid #bdd7f5' }}>
                        Open ▶
                      </button>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setOpenRev(rev)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap"
                        style={{ background: canSend ? '#e6f3de' : '#f1f5f9', color: canSend ? '#3a6609' : '#94a3b8', border: 'none' }}
                        title="Open review panel to send">
                        {canSend ? '✓ Ready' : '⋯ Review'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

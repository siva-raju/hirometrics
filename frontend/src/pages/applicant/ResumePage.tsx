import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';

interface ResumeVersion {
  id: string;
  version_number: number;
  original_filename: string;
  description: string | null;
  is_current: boolean;
  is_submitted: boolean;
  file_size_bytes: number | null;
  uploaded_at: string | null;
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }) : '—';

const fmtSize = (bytes: number | null) => {
  if (!bytes) return '—';
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

// ── Upload confirm modal ──────────────────────────────────────────────────────
function UploadConfirmModal({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <h3 className="font-bold text-gray-900">Upload New Resume</h3>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-700 leading-relaxed">
            The uploaded resume will overwrite the currently active resume, if present.
            Previous versions will still be accessible in your resume history.
          </p>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button onClick={onConfirm} className="btn-primary flex-1">OK — Continue</button>
          <button onClick={onCancel} className="btn-secondary flex-1">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Resume Page ───────────────────────────────────────────────────────────────
export default function ResumePage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showUploadConfirm, setShowUploadConfirm] = useState(false);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: resumes = [], isLoading } = useQuery({
    queryKey: ['my-resumes'],
    queryFn: () => applicantApi.getMyResumes().then(r => r.data),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => applicantApi.activateResume(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-resumes'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      showToast('Active resume updated ✓');
    },
    onError: () => showToast('Failed to update active resume', 'error'),
  });

  const doUpload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (description.trim()) fd.append('description', description.trim().slice(0, 120));
      await applicantApi.uploadResume(fd);
      qc.invalidateQueries({ queryKey: ['my-resumes'] });
      qc.invalidateQueries({ queryKey: ['my-profile'] });
      setDescription('');
      if (fileRef.current) fileRef.current.value = '';
      showToast('New resume version uploaded ✓');
    } catch (e: any) {
      showToast(e.response?.data?.detail || 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadClick = () => {
    setShowUploadConfirm(true);
  };

  const handleConfirmUpload = () => {
    setShowUploadConfirm(false);
    fileRef.current?.click();
  };

  const handleDownload = async (resume: ResumeVersion) => {
    try {
      const token = JSON.parse(localStorage.getItem('hirometrics-auth') || '{}')?.state?.accessToken;
      const res = await fetch(`/api/v1/applicants/me/resume-file/${resume.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { showToast('Download failed', 'error'); return; }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = resume.original_filename || `resume_v${resume.version_number}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showToast('Download failed', 'error');
    }
  };

  const getStatus = (r: ResumeVersion) => {
    if (r.is_current) return { label: '✓ Active', bg: '#eef6db', color: '#3a6609' };
    return { label: 'Submitted', bg: '#e6f1fb', color: '#0c447c' };
  };

  return (
    <div className="max-w-5xl fade-in">
      {/* Upload confirm modal */}
      {showUploadConfirm && (
        <UploadConfirmModal
          onConfirm={handleConfirmUpload}
          onCancel={() => setShowUploadConfirm(false)}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }}
      />

      <div className="mb-6">
        <h1 className="page-title">Resume</h1>
        <p className="page-subtitle">Manage your resume versions</p>
      </div>

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

      {/* ── Upload section ── */}
      <div className="card mb-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
          Upload New Version
        </h2>
        <div className="space-y-3">
          <div>
            <label className="label">
              Description
              <span className="text-gray-400 font-normal normal-case ml-1">(optional, max 120 chars)</span>
            </label>
            <input
              className="input"
              maxLength={120}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Updated work experience — April 2026"
            />
            <div className="text-[11px] text-gray-400 mt-1 flex justify-between">
              <span className="italic">
                For internal reference and resume version tracking only.
                Will not be included in external profile submissions.
              </span>
              <span className={description.length > 100 ? 'text-amber-500' : ''}>
                {description.length}/120
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleUploadClick}
              disabled={uploading}
              className="btn-primary text-sm">
              {uploading ? 'Uploading…' : 'Upload Resume'}
            </button>
            <span className="text-xs text-gray-400">PDF, DOC, DOCX · Max 10MB</span>
          </div>
        </div>
      </div>

      {/* ── Version list ── */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Resume Versions
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-sm text-gray-400 text-center">Loading…</div>
        ) : resumes.length === 0 ? (
          <div className="empty-state py-12">
            <div className="empty-state-icon text-3xl">📄</div>
            <p className="text-sm text-gray-500 mt-3">No resumes uploaded yet</p>
          </div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th className="w-20">Version</th>
                <th>File Name</th>
                <th>Description</th>
                <th className="w-36">Upload Date</th>
                <th className="w-20 text-center">Size</th>
                <th className="w-32 text-center">Status</th>
                <th className="w-28 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {(resumes as ResumeVersion[]).map(r => {
                const status = getStatus(r);
                return (
                  <tr key={r.id} className={r.is_current ? 'bg-blue-50/30' : ''}>
                    <td>
                      <span className="font-mono text-sm font-bold" style={{ color: 'var(--hm-blue)' }}>
                        v{r.version_number}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-800 truncate max-w-[180px] block" title={r.original_filename}>
                        {r.original_filename}
                      </span>
                    </td>
                    <td>
                      <span className="text-sm text-gray-600 max-w-[240px] truncate block" title={r.description || ''}>
                        {r.description || <span className="text-gray-300 italic">—</span>}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {fmtDate(r.uploaded_at)}
                    </td>
                    <td className="text-xs text-gray-500 text-center">
                      {fmtSize(r.file_size_bytes)}
                    </td>
                    <td className="text-center">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => handleDownload(r)}
                        className="text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors"
                        style={{ background: '#f0f7ff', color: '#185fa5', border: '1px solid #bdd7f5' }}>
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

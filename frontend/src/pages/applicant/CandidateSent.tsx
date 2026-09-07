import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';

interface SentItem {
  id: string;
  job_title: string;
  submitted_to: string;
  date: string;
  invitation_id?: string;
  share_token?: string;
  cover_message?: string;
  position_code?: string;
  resume_version?: number | null;
}

function ViewSubmissionModal({ item, onClose }: { item: SentItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg scale-in">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-gray-900">Submission Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">{item.job_title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Job</div>
              <div className="text-sm font-semibold text-gray-900">{item.job_title}</div>
              {item.position_code && <div className="text-xs font-mono text-gray-400">{item.position_code}</div>}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Submitted to</div>
              <div className="text-sm text-gray-800">{item.submitted_to}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Date submitted</div>
              <div className="text-sm text-gray-800">{item.date}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Resume version</div>
              <div className="text-sm font-mono font-bold" style={{ color: item.resume_version != null ? 'var(--hm-blue)' : undefined }}>
                {item.resume_version != null ? `v${item.resume_version}` : <span className="text-gray-300 italic font-normal">—</span>}
              </div>
            </div>
          </div>
          {item.cover_message && (
            <div className="p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Your cover message</div>
              <p className="text-sm text-gray-700 italic">"{item.cover_message}"</p>
            </div>
          )}
          {item.share_token && (
            <div className="flex gap-2 pt-2">
              <a href={`/verified/${item.share_token}`} target="_blank" rel="noreferrer"
                className="btn-secondary text-xs">👤 View profile submitted</a>
            </div>
          )}
        </div>
        <div className="p-6 pt-0">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

export default function CandidateSent() {
  const [viewItem, setViewItem] = useState<SentItem | null>(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['my-sent'],
    queryFn: () => applicantApi.getMyResponses().then(r => r.data),
  });

  // Map all submitted applications to sent items
  const sentItems: SentItem[] = responses
    .map((r: any): SentItem => ({
      id: r.id,
      job_title: r.position_title || 'Position',
      submitted_to: r.org_name || 'Organization',
      date: r.submitted_at
        ? new Date(r.submitted_at).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
        : '—',
      share_token: r.share_token,
      cover_message: r.cover_message,
      position_code: r.position_code,
      resume_version: r.resume_version ?? null,
    }));

  return (
    <div className="max-w-5xl fade-in">
      {viewItem && <ViewSubmissionModal item={viewItem} onClose={() => setViewItem(null)} />}

      <div className="mb-6">
        <h1 className="page-title">Sent</h1>
        <p className="page-subtitle">Your submitted applications</p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm p-8">Loading...</div>
      ) : sentItems.length === 0 ? (
        <div className="card empty-state py-16">
          <div className="empty-state-icon text-4xl">📤</div>
          <p className="text-sm font-semibold text-gray-500 mt-3">No submissions yet</p>
          <p className="text-xs text-gray-400 mt-1">Accepted applications will appear here</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Job Title</th>
                <th>Submitted To</th>
                <th className="w-28">Date</th>
                <th className="w-36">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sentItems.map(item => (
                <tr key={item.id}>
                  <td>
                    <div className="font-semibold text-sm text-gray-900">{item.job_title}</div>
                    {item.position_code && (
                      <div className="text-xs font-mono text-gray-400">{item.position_code}</div>
                    )}
                  </td>
                  <td>
                    <div className="text-sm text-gray-700">{item.submitted_to}</div>
                  </td>
                  <td className="text-xs text-gray-500">{item.date}</td>
                  <td>
                    <button onClick={() => setViewItem(item)}
                      className="text-xs px-4 py-1.5 rounded-lg font-semibold whitespace-nowrap"
                      style={{ background: '#f0f7ff', color: '#185fa5', border: '1px solid #bdd7f5' }}>
                      View Submission
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

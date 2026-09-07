import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';

export default function CandidateResponses() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['my-responses'],
    queryFn: () => applicantApi.getMyResponses().then(r => r.data),
  });

  if (isLoading) return <div className="text-gray-400 text-sm p-8">Loading...</div>;

  return (
    <div className="max-w-3xl fade-in">
      <div className="mb-6">
        <h1 className="page-title">Responses</h1>
        <p className="page-subtitle">History of your invitation responses</p>
      </div>

      {responses.length === 0 ? (
        <div className="card empty-state py-12">
          <div className="empty-state-icon text-3xl">📋</div>
          <p className="text-sm font-semibold text-gray-500">No responses yet</p>
          <p className="text-xs text-gray-400 mt-1">Your accepted and declined invitations will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {responses.map((resp: any) => (
            <div key={resp.id} className="card p-0 overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === resp.id ? null : resp.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  resp.status === 'accepted' ? 'text-green-700' : 'text-red-500'
                }`} style={{ background: resp.status === 'accepted' ? '#eef6db' : '#fef2f2' }}>
                  {resp.status === 'accepted' ? '✓' : '✕'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{resp.org_name}</div>
                  <div className="text-xs text-gray-500">{resp.position_title || 'Position not specified'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`badge ${resp.status === 'accepted' ? 'badge-green' : 'badge-red'}`}>
                    {resp.status === 'accepted' ? 'Accepted' : 'Declined'}
                  </span>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(resp.responded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
                <span className="text-gray-400 ml-2">{expanded === resp.id ? '▲' : '▼'}</span>
              </button>

              {expanded === resp.id && resp.status === 'accepted' && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="pt-4 grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Organization</div>
                      <div className="text-sm text-gray-900 font-semibold">{resp.org_name}</div>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Position</div>
                      <div className="text-sm text-gray-900 font-semibold">{resp.position_title || '—'}</div>
                    </div>
                  </div>
                  {resp.cover_message && (
                    <div className="mb-4 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Your cover message</div>
                      <p className="text-sm text-gray-700 italic">"{resp.cover_message}"</p>
                    </div>
                  )}
                  <div className="flex gap-3 mt-3">
                    {resp.profile_snapshot_id && (
                      <a href={`/api/v1/share/${resp.share_token}`} target="_blank" rel="noreferrer"
                        className="btn-secondary text-xs">👤 View profile submitted</a>
                    )}
                    {resp.resume_filename && (
                      <a href={`/api/v1/resumes/${resp.resume_filename}`} target="_blank" rel="noreferrer"
                        className="btn-secondary text-xs">📄 View resume submitted</a>
                    )}
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

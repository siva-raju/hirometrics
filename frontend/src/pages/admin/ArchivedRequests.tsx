import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

const FLAG_ICONS: Record<string, string> = { green: '🟢', yellow: '🟡', red: '🔴' };

export default function ArchivedRequests() {
  const qc = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['archived-requests'],
    queryFn: () => adminApi.getArchivedRequests().then(r => r.data),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => adminApi.reactivateRequest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['archived-requests'] });
      qc.invalidateQueries({ queryKey: ['active-requests'] });
    }
  });

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="page-title">Archived Requests</h1>
        <p className="page-subtitle">Submissions sent to hiring managers — view only</p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm p-8">Loading...</div>
      ) : reviews.length === 0 ? (
        <div className="card empty-state py-12">
          <div className="empty-state-icon text-3xl">🗄️</div>
          <p className="text-sm font-semibold text-gray-500">No archived requests</p>
          <p className="text-xs text-gray-400 mt-1">Sent submissions will be archived here</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Job ID</th>
                <th>Submitted</th>
                <th>Sent</th>
                <th>Disposition</th>
                <th className="w-20">Details</th>
                <th className="w-36">Action</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((rev: any) => (
                <>
                  <tr key={rev.id}
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === rev.id ? null : rev.id)}>
                    <td>
                      <div className="font-semibold text-sm text-gray-900">{rev.candidate_name}</div>
                      <div className="text-xs text-gray-400">{rev.candidate_email}</div>
                    </td>
                    <td><span className="font-mono text-xs" style={{ color: '#0078d2' }}>{rev.job_id}</span></td>
                    <td className="text-xs text-gray-500">
                      {rev.date_submitted ? new Date(rev.date_submitted).toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'2-digit' }) : '—'}
                    </td>
                    <td className="text-xs text-gray-500">
                      {rev.sent_at ? new Date(rev.sent_at).toLocaleDateString('en-US', { month:'2-digit', day:'2-digit', year:'2-digit' }) : '—'}
                    </td>
                    <td className="text-lg">{FLAG_ICONS[rev.disposition_flag] || '—'}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <button onClick={() => setExpandedId(expandedId === rev.id ? null : rev.id)}
                        className="text-blue-500 hover:text-blue-700 text-sm font-bold">
                        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expandedId === rev.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </button>
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => reactivate.mutate(rev.id)}
                        disabled={reactivate.isPending}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap"
                        style={{ background: '#faeeda', color: '#633806', border: '1px solid #f0b400' }}>
                        ↩ Move to Active
                      </button>
                    </td>
                  </tr>
                  {expandedId === rev.id && (
                    <tr key={rev.id + '_exp'}>
                      <td colSpan={7} className="p-0">
                        <div className="px-6 py-4 border-t border-blue-100" style={{ background: '#f8fafc' }}>
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Report</div>
                              {rev.discrepancy_report_filename ? (
                                <div className="space-y-1.5">
                                  <div className="text-xs text-gray-600">{rev.discrepancy_report_filename}</div>
                                  <a href={`/api/v1/hm/requests/${rev.id}/report`} target="_blank" rel="noreferrer"
                                    className="btn-secondary text-xs block text-center">👁 View report</a>
                                  <a href={`/api/v1/hm/requests/${rev.id}/report?download=true`} target="_blank" rel="noreferrer"
                                    className="btn-secondary text-xs block text-center">⬇ Download report</a>
                                </div>
                              ) : <span className="text-xs text-gray-400">No report</span>}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Disposition</div>
                              <div className="text-sm">{FLAG_ICONS[rev.disposition_flag]} {rev.disposition_flag || '—'}</div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Comments</div>
                              <p className="text-xs text-gray-600 leading-relaxed">{rev.comments || <span className="italic text-gray-400">No comments</span>}</p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

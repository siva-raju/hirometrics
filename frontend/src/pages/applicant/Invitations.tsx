import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';

export default function CandidateInvitations() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [coverMsg, setCoverMsg] = useState('');
  const [confirmDialogId, setConfirmDialogId] = useState<string | null>(null);

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ['my-invitations'],
    queryFn: () => applicantApi.getMyInvitations().then(r => r.data),
  });

  const respondMutation = useMutation({
    mutationFn: ({ id, response, message }: { id: string; response: string; message?: string }) =>
      applicantApi.respondToInvitation(id, { response, message }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-invitations'] });
      qc.invalidateQueries({ queryKey: ['my-responses'] });
      setConfirmDialogId(null);
      setAccepting(null);
      setCoverMsg('');
    },
  });

  const pendingInvitations = invitations.filter((i: any) => i.status === 'pending');

  if (isLoading) return <div className="text-gray-400 text-sm p-8">Loading...</div>;

  return (
    <div className="max-w-3xl fade-in">
      {/* Accept confirm dialog */}
      {confirmDialogId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
            <div className="p-6 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Confirm submission of credentials</h3>
              <p className="text-xs text-gray-500 mt-1">Please review before proceeding</p>
            </div>
            <div className="p-6">
              <div className="p-4 rounded-xl mb-4 text-xs text-gray-600 leading-relaxed"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                By clicking <strong>OK</strong>, you confirm that you consent to share your HiroMetrics profile, resume, and associated credential information with the inviting organization. This information may be used for candidate evaluation, reporting, and analytics. Your profile was verified at the time of submission and represents an accurate account of your professional history.
              </div>
              <label className="label">Cover message <span className="text-gray-400 font-normal normal-case">(optional)</span></label>
              <textarea className="input resize-none" rows={3} value={coverMsg}
                onChange={e => setCoverMsg(e.target.value)}
                placeholder="Add a brief note to the hiring team..." />
            </div>
            <div className="p-6 pt-0 flex gap-3">
              <button className="btn-primary flex-1"
                disabled={respondMutation.isPending}
                onClick={() => respondMutation.mutate({ id: confirmDialogId, response: 'accepted', message: coverMsg })}>
                {respondMutation.isPending ? 'Submitting...' : 'OK — Submit credentials'}
              </button>
              <button className="btn-secondary" onClick={() => { setConfirmDialogId(null); setCoverMsg(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h1 className="page-title">Invitations</h1>
        <p className="page-subtitle">Hiring entities that have invited you to apply for positions</p>
      </div>

      {pendingInvitations.length === 0 ? (
        <div className="card empty-state py-12">
          <div className="empty-state-icon text-3xl">✉️</div>
          <p className="text-sm font-semibold text-gray-500">No pending invitations</p>
          <p className="text-xs text-gray-400 mt-1">When a hiring entity invites you to apply, it will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingInvitations.map((inv: any) => (
            <div key={inv.id} className="card p-0 overflow-hidden">
              {/* Collapsed row */}
              <button
                onClick={() => setExpanded(expanded === inv.id ? null : inv.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'var(--hm-blue-light)', color: 'var(--hm-blue)' }}>
                  {inv.org_name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-gray-900 text-sm">{inv.org_name || 'Unknown Organization'}</div>
                  <div className="text-xs text-gray-500">{inv.position_title || 'Position not specified'}</div>
                </div>
                <div className="text-xs text-gray-400 flex-shrink-0">
                  {new Date(inv.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
                <span className="text-gray-400 ml-2">{expanded === inv.id ? '▲' : '▼'}</span>
              </button>

              {/* Expanded detail */}
              {expanded === inv.id && (
                <div className="px-5 pb-5 border-t border-gray-100">
                  <div className="pt-4 grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Invited by</div>
                      <div className="text-sm font-semibold text-gray-900">{inv.org_name}</div>
                      {inv.invited_by && <div className="text-xs text-gray-500">{inv.invited_by}</div>}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Position</div>
                      <div className="text-sm font-semibold text-gray-900">{inv.position_title || '—'}</div>
                      {inv.position_code && <div className="text-xs text-gray-500 font-mono">{inv.position_code}</div>}
                    </div>
                  </div>
                  {inv.job_description && (
                    <div className="mb-4">
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Job Description</div>
                      <p className="text-sm text-gray-600 leading-relaxed">{inv.job_description}</p>
                    </div>
                  )}
                  {inv.message && (
                    <div className="mb-4 p-3 rounded-xl" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Message from {inv.org_name}</div>
                      <p className="text-sm text-gray-700 italic">"{inv.message}"</p>
                    </div>
                  )}
                  {inv.expires_at && (
                    <div className="text-xs text-amber-600 mb-4">
                      ⏳ Invitation expires: {new Date(inv.expires_at).toLocaleDateString()}
                    </div>
                  )}
                  <div className="flex gap-3">
                    <button
                      onClick={() => setConfirmDialogId(inv.id)}
                      className="btn-primary text-sm">
                      ✓ Accept invitation
                    </button>
                    <button
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate({ id: inv.id, response: 'rejected' })}
                      className="btn-secondary text-sm text-red-500 hover:bg-red-50 hover:border-red-200">
                      ✕ Decline
                    </button>
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

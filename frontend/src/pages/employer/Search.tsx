import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerApi } from '../../services/api';

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-amber', accepted: 'badge-green', rejected: 'badge-red', expired: 'badge-gray',
};

export default function InviteCandidate() {
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ folder_id: '', position_title: '', message: '' });
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => employerApi.getFolders().then(r => r.data),
  });

  const { data: sentInvitations = [], refetch } = useQuery({
    queryKey: ['sent-invitations'],
    queryFn: () => employerApi.listSentInvitations().then(r => r.data),
  });

  const inviteMutation = useMutation({
    mutationFn: () => employerApi.inviteCandidate({
      candidate_email: email,
      folder_id: form.folder_id || undefined,
      position_title: form.position_title || undefined,
      message: form.message || undefined,
    }),
    onSuccess: (r) => {
      setResult(r.data);
      setError('');
      refetch();
    },
    onError: (e: any) => {
      setError(e.response?.data?.detail || 'Failed to send invitation');
      setResult(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return setError('Please enter a valid email address');
    setError(''); setResult(null);
    inviteMutation.mutate();
  };

  const reset = () => {
    setEmail(''); setForm({ folder_id: '', position_title: '', message: '' });
    setResult(null); setError('');
  };

  return (
    <div className="max-w-4xl fade-in">
      <div className="mb-6">
        <h1 className="page-title">Invite Candidate</h1>
        <p className="page-subtitle">Invite a candidate to apply by email address</p>
      </div>

      {/* Invite form */}
      <div className="card mb-5">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Send invitation</h2>
        <p className="text-xs text-gray-500 mb-5">
          Enter the candidate's email. If they have a HiroMetrics account, the invite goes straight to their inbox.
          If not, they'll receive an email with a link to register — and your invitation will be waiting for them.
        </p>

        {result ? (
          /* Success state */
          <div className={`p-5 rounded-xl scale-in ${result.candidate_found ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'}`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{result.candidate_found ? '✅' : '📧'}</span>
              <div className="flex-1">
                <div className={`text-sm font-bold mb-1 ${result.candidate_found ? 'text-green-800' : 'text-blue-800'}`}>
                  {result.candidate_found ? 'Invitation delivered to inbox!' : 'Registration invite sent!'}
                </div>
                <p className={`text-xs ${result.candidate_found ? 'text-green-700' : 'text-blue-700'}`}>
                  {result.message}
                </p>
                {!result.candidate_found && result.register_link && (
                  <div className="mt-3">
                    <div className="text-xs font-semibold text-blue-700 mb-1">You can also share this link directly:</div>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border border-blue-200 px-3 py-2 rounded-lg truncate font-mono">
                        {result.register_link}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(result.register_link)}
                        className="btn-secondary text-xs py-2 px-3 flex-shrink-0">
                        Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button onClick={reset} className="btn-secondary text-xs mt-4">
              Send another invitation
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="alert-error mb-4">{error}</div>}
            <div className="mb-4">
              <label className="label">Candidate email address *</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="candidate@email.com"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Position title <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <input className="input" value={form.position_title}
                  onChange={e => setForm(f => ({ ...f, position_title: e.target.value }))}
                  placeholder="e.g. Senior Java Developer" />
              </div>
              <div>
                <label className="label">Link to job folder <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
                <select className="input" value={form.folder_id}
                  onChange={e => setForm(f => ({ ...f, folder_id: e.target.value }))}>
                  <option value="">No folder — goes to Inbox</option>
                  {folders.map((f: any) => (
                    <option key={f.id} value={f.id}>{f.name}{f.position_title ? ` — ${f.position_title}` : ''}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-5">
              <label className="label">Personal message <span className="text-gray-400 normal-case font-normal">(optional)</span></label>
              <textarea className="input resize-none" rows={2} value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                placeholder="Add a personal note to the candidate..." />
            </div>
            <button type="submit" className="btn-primary" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? 'Sending...' : '✉ Send invitation'}
            </button>
          </form>
        )}
      </div>

      {/* How it works */}
      <div className="card mb-5" style={{ background: '#f8fafc' }}>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-3">How it works</h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            { step: '1', icon: '✉', title: 'Send invite', desc: 'Enter the candidate email and optional position details' },
            { step: '2', icon: '🔔', title: 'Candidate notified', desc: 'If they have an HM account, invite appears in their inbox immediately. If not, they get a registration email.' },
            { step: '3', icon: '📋', title: 'Profile received', desc: 'When they accept, their verified profile appears in your inbox and can be moved to a job folder.' },
          ].map(s => (
            <div key={s.step} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white" style={{ background: 'var(--hm-blue)' }}>{s.step}</div>
              <div>
                <div className="text-sm font-bold text-gray-800">{s.icon} {s.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sent invitations history */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #edf2f7' }}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Invitation History</h2>
          <span className="text-xs font-semibold text-gray-400">{sentInvitations.length} sent</span>
        </div>
        {sentInvitations.length === 0 ? (
          <div className="empty-state p-8">
            <div className="empty-state-icon text-2xl">✉️</div>
            <p className="text-sm font-semibold text-gray-500">No invitations sent yet</p>
          </div>
        ) : (
          <table className="hm-table">
            <thead><tr><th>Candidate</th><th>Position</th><th>Account</th><th>Status</th><th>Sent</th></tr></thead>
            <tbody>
              {sentInvitations.map((inv: any) => (
                <tr key={inv.id}>
                  <td>
                    <div className="font-semibold text-gray-900 text-sm">{inv.candidate_display}</div>
                    <div className="text-xs text-gray-400">{inv.candidate_email}</div>
                  </td>
                  <td className="text-xs text-gray-500">{inv.position_title || '—'}</td>
                  <td>
                    <span className={`badge ${inv.candidate_has_account ? 'badge-green' : 'badge-gray'}`}>
                      {inv.candidate_has_account ? '✓ HM account' : 'Awaiting signup'}
                    </span>
                  </td>
                  <td><span className={`badge ${STATUS_BADGE[inv.status] || 'badge-gray'}`}>{inv.status}</span></td>
                  <td className="text-xs text-gray-400">{new Date(inv.sent_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

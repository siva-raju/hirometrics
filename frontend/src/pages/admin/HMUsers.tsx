import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const Icon = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const HM_ROLES = [
  { value: 'hm_analyst',    label: 'HM Analyst' },
  { value: 'hm_qa',         label: 'HM QA' },
  { value: 'hm_supervisor', label: 'HM Supervisor' },
  { value: 'hm_manager',    label: 'HM Manager' },
  { value: 'hm_admin',      label: 'HM Admin' },
];

const ROLE_STYLES: Record<string, { bg: string; color: string }> = {
  hm_super_admin: { bg: '#fef3ea', color: '#7c3c0e' },
  hm_admin:       { bg: '#e6f3fb', color: '#004d8a' },
  hm_manager:     { bg: '#eef6db', color: '#3a5a0d' },
  hm_supervisor:  { bg: '#fef9e7', color: '#7a5900' },
  hm_analyst:     { bg: '#f3f4f6', color: '#374151' },
  hm_qa:          { bg: '#fdf4ff', color: '#6b21a8' },
};

const roleLabel = (role: string) => role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const roleStyle = (role: string) => ROLE_STYLES[role] || ROLE_STYLES.hm_analyst;

function PasswordBox({ password, email, onClose }: { password: string; email: string; onClose?: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="p-4 rounded-xl mt-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-green-700">✓ New temp password generated</span>
        {onClose && <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs">✕ Dismiss</button>}
      </div>
      <div className="text-xs text-gray-600 mb-2">For: <strong>{email}</strong></div>
      <div className="flex items-center gap-2">
        <code className="flex-1 px-3 py-2 rounded-lg text-sm font-mono font-bold bg-white border border-green-200">{password}</code>
        <button onClick={copy} className="btn-secondary text-xs py-2 px-3 flex-shrink-0">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">⚠ Share securely. User must change password on next login.</p>
    </div>
  );
}

type HMUser = { id: string; email: string; first_name: string; last_name: string; role: string; status: string; created_at: string; };

export default function HMUsers() {
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ first_name: '', last_name: '', email: '', role: 'hm_analyst' });
  const [createError, setCreateError] = useState('');
  const [createResult, setCreateResult] = useState<{ password: string; email: string } | null>(null);
  const [resetResults, setResetResults] = useState<Record<string, { password: string; email: string }>>({});

  const { data: hmUsers = [], isLoading } = useQuery({
    queryKey: ['hm-users-list'],
    queryFn: () => adminApi.listHMUsers().then(r => r.data),
  });

  const selfResetMutation = useMutation({
    mutationFn: () => adminApi.resetUserPassword(currentUser!.id),
    onSuccess: (r) => setResetResults(prev => ({ ...prev, [currentUser!.id]: { password: r.data.temp_password, email: r.data.email } })),
  });

  const resetPwdMutation = useMutation({
    mutationFn: (userId: string) => adminApi.resetUserPassword(userId),
    onSuccess: (r, userId) => setResetResults(prev => ({ ...prev, [userId]: { password: r.data.temp_password, email: r.data.email } })),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => adminApi.createHMUser(data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['hm-users-list'] });
      setCreateResult({ password: r.data.temp_password_preview, email: createForm.email });
      setCreateForm({ first_name: '', last_name: '', email: '', role: 'hm_analyst' });
      setCreateError('');
    },
    onError: (e: any) => setCreateError(e.response?.data?.detail || 'Failed to create user'),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreateResult(null);
    if (!createForm.first_name || !createForm.last_name || !createForm.email)
      return setCreateError('Please fill all required fields');
    createMutation.mutate(createForm);
  };

  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCreateForm(f => ({ ...f, [k]: e.target.value }));

  const dismissReset = (userId: string) =>
    setResetResults(prev => { const n = { ...prev }; delete n[userId]; return n; });

  return (
    <div className="max-w-5xl fade-in">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">HM User Management</h1>
          <p className="page-subtitle">Manage HiroMetrics staff accounts and passwords</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setCreateResult(null); setCreateError(''); }}
          className="btn-primary">
          {showCreate ? '✕ Cancel' : '+ Add HM user'}
        </button>
      </div>

      {/* My Account card */}
      <div className="card mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold"
              style={{ background: 'var(--hm-blue-light)', color: 'var(--hm-blue)' }}>
              {(currentUser?.firstName?.[0] || 'H')}{(currentUser?.lastName?.[0] || 'M')}
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">{currentUser?.firstName} {currentUser?.lastName} <span className="text-gray-400 font-normal">(You)</span></div>
              <div className="text-xs text-gray-500">{currentUser?.email}</div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold mt-1"
                style={roleStyle(currentUser?.role || '')}>
                {roleLabel(currentUser?.role || '')}
              </span>
            </div>
          </div>
          <button onClick={() => selfResetMutation.mutate()} disabled={selfResetMutation.isPending}
            className="btn-secondary text-xs flex items-center gap-2">
            <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            {selfResetMutation.isPending ? 'Resetting...' : 'Reset my password'}
          </button>
        </div>
        {resetResults[currentUser?.id || ''] && (
          <PasswordBox
            password={resetResults[currentUser?.id || ''].password}
            email={resetResults[currentUser?.id || ''].email}
            onClose={() => dismissReset(currentUser?.id || '')}
          />
        )}
      </div>

      {/* Create HM User form */}
      {showCreate && (
        <div className="card mb-5 scale-in">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Add HM Staff User</h2>
          <p className="text-xs text-gray-500 mb-4">HM staff must use a <strong>@hirometrics.com</strong> email address.</p>
          {createError && <div className="alert-error mb-4">{createError}</div>}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">First name *</label>
                <input className="input" value={createForm.first_name} onChange={setF('first_name')} placeholder="Jane" />
              </div>
              <div>
                <label className="label">Last name *</label>
                <input className="input" value={createForm.last_name} onChange={setF('last_name')} placeholder="Smith" />
              </div>
              <div>
                <label className="label">Email * <span className="text-gray-400 normal-case font-normal">(@hirometrics.com)</span></label>
                <input className="input" type="email" value={createForm.email} onChange={setF('email')} placeholder="jane@hirometrics.com" />
              </div>
              <div>
                <label className="label">Role *</label>
                <select className="input" value={createForm.role} onChange={setF('role')}>
                  {HM_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create HM user'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
          {createResult && <PasswordBox password={createResult.password} email={createResult.email} />}
        </div>
      )}

      {/* HM Users table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #edf2f7' }}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">HM Staff Accounts</h2>
          <span className="text-xs font-semibold text-gray-400">{hmUsers.length} users</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400 text-sm">Loading...</div>
        ) : hmUsers.length === 0 ? (
          <div className="p-6">
            <div className="empty-state">
              <div className="empty-state-icon text-2xl">👥</div>
              <p className="text-sm font-semibold text-gray-500">No HM staff users yet</p>
              <p className="text-xs text-gray-400 mt-1">Only the Super Admin account exists. Add HM staff above.</p>
            </div>
          </div>
        ) : (
          <table className="hm-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hmUsers.map((u: HMUser) => (
                <>
                  <tr key={u.id}>
                    <td className="font-semibold text-gray-900">
                      {u.first_name} {u.last_name}
                      {u.id === currentUser?.id && <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">YOU</span>}
                    </td>
                    <td className="text-xs text-gray-500">{u.email}</td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={roleStyle(u.role)}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-gray'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <button onClick={() => resetPwdMutation.mutate(u.id)}
                        disabled={resetPwdMutation.isPending}
                        title="Reset password"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                        <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </button>
                    </td>
                  </tr>
                  {resetResults[u.id] && (
                    <tr key={`${u.id}-reset`}>
                      <td colSpan={6} className="bg-green-50 px-4 py-2">
                        <PasswordBox
                          password={resetResults[u.id].password}
                          email={resetResults[u.id].email}
                          onClose={() => dismissReset(u.id)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const Icon = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const ROLE_GROUPS = [
  { label: 'All users', value: '' },
  { label: 'Candidates', value: 'applicant' },
  { label: 'Customer Admins', value: 'customer_admin' },
  { label: 'Customer Managers', value: 'customer_manager' },
  { label: 'HM Staff', value: 'hm' },
];

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  applicant:        { bg: '#eef6db', color: '#3a5a0d' },
  customer_admin:   { bg: '#e6f3fb', color: '#004d8a' },
  customer_manager: { bg: '#eff8ff', color: '#1a5fa8' },
  hm_super_admin:   { bg: '#fef3ea', color: '#7c3c0e' },
  hm_admin:         { bg: '#fef3ea', color: '#7c3c0e' },
  hm_manager:       { bg: '#eef6db', color: '#3a5a0d' },
  hm_supervisor:    { bg: '#fef9e7', color: '#7a5900' },
  hm_analyst:       { bg: '#f3f4f6', color: '#374151' },
  hm_qa:            { bg: '#fdf4ff', color: '#6b21a8' },
};

const STATUS_STYLE: Record<string, string> = {
  active: 'badge-green', pending: 'badge-amber',
  suspended: 'badge-amber', deactivated: 'badge-red',
};

const roleLabel = (r: string) => r.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase());

function PasswordBox({ password, email, onClose }: { password: string; email: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 scale-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Password Reset</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">New temp password for <strong>{email}</strong>:</p>
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 px-3 py-2.5 rounded-lg text-sm font-mono font-bold bg-gray-50 border">{password}</code>
          <button onClick={() => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="btn-secondary text-xs py-2.5 px-3 flex-shrink-0">
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400">⚠ Share securely. User must change password on next login.</p>
        <button onClick={onClose} className="btn-primary w-full mt-4 text-xs">Done</button>
      </div>
    </div>
  );
}

type User = { id: string; email: string; first_name: string; last_name: string; role: string; status: string; org_id?: string; org_name?: string; created_at: string; must_change_password?: boolean };

export default function UserManagement() {
  const { user: currentUser } = useAuthStore();
  const qc = useQueryClient();
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [passwordResult, setPasswordResult] = useState<{ password: string; email: string } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['all-users', roleFilter, search],
    queryFn: () => {
      const params: any = {};
      if (search) params.search = search;
      if (roleFilter === 'hm') {
        params.role_filter = 'hm_super_admin'; // we'll handle this client-side
      } else if (roleFilter) {
        params.role_filter = roleFilter;
      }
      return adminApi.listAllUsers(params).then(r => r.data);
    },
  });

  const filteredUsers = roleFilter === 'hm'
    ? users.filter((u: User) => u.role.startsWith('hm_'))
    : users;

  const resetPwdMutation = useMutation({
    mutationFn: (userId: string) => adminApi.resetUserPassword(userId),
    onSuccess: (r) => setPasswordResult({ password: r.data.temp_password, email: r.data.email }),
  });

  const statusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: string }) =>
      adminApi.updateUserStatus(userId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-users'] }),
  });

  const [unlockTarget, setUnlockTarget] = useState<{ id: string; name: string } | null>(null);
  const [unlockReason, setUnlockReason] = useState('');
  const unlockMutation = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApi.unlockProfile(userId, reason),
    onSuccess: () => { setUnlockTarget(null); setUnlockReason(''); qc.invalidateQueries({ queryKey: ['all-users'] }); },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const counts = {
    total: users.length,
    active: users.filter((u: User) => u.status === 'active').length,
    pending: users.filter((u: User) => u.status === 'pending').length,
    candidates: users.filter((u: User) => u.role === 'applicant').length,
    customers: users.filter((u: User) => ['customer_admin','customer_manager'].includes(u.role)).length,
    hm: users.filter((u: User) => u.role.startsWith('hm_')).length,
  };

  return (
    <div className="max-w-6xl fade-in">
      {/* Unlock profile dialog */}
      {unlockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 scale-in">
            <h3 className="font-bold text-gray-900 mb-1">Unlock Profile</h3>
            <p className="text-xs text-gray-500 mb-4">Unlocking <strong>{unlockTarget.name}</strong>'s submitted profile. They will be notified and can make edits.</p>
            <label className="label">Reason for unlock *</label>
            <textarea className="input resize-none mb-4" rows={3} value={unlockReason}
              onChange={e => setUnlockReason(e.target.value)}
              placeholder="e.g. Employer reported incorrect employment dates..." />
            <div className="flex gap-3">
              <button className="btn-primary flex-1" disabled={!unlockReason.trim() || unlockMutation.isPending}
                onClick={() => unlockMutation.mutate({ userId: unlockTarget.id, reason: unlockReason })}>
                {unlockMutation.isPending ? 'Unlocking...' : 'Unlock profile'}
              </button>
              <button className="btn-secondary" onClick={() => { setUnlockTarget(null); setUnlockReason(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {passwordResult && (
        <PasswordBox password={passwordResult.password} email={passwordResult.email}
          onClose={() => setPasswordResult(null)} />
      )}

      <div className="mb-6">
        <h1 className="page-title">User Management</h1>
        <p className="page-subtitle">Manage all platform accounts — candidates, customers, and HM staff</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Total', value: counts.total, color: '#0078d2' },
          { label: 'Active', value: counts.active, color: '#78b41e' },
          { label: 'Pending', value: counts.pending, color: '#f0b400' },
          { label: 'Candidates', value: counts.candidates, color: '#0078d2' },
          { label: 'Customers', value: counts.customers, color: '#f0963c' },
          { label: 'HM Staff', value: counts.hm, color: '#7c3c0e' },
        ].map(s => (
          <div key={s.label} className="card p-4 text-center">
            <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-5">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Role filter tabs */}
          <div className="flex gap-1.5 flex-wrap flex-1">
            {ROLE_GROUPS.map(g => (
              <button key={g.value}
                onClick={() => { setRoleFilter(g.value); setSearch(''); setSearchInput(''); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  roleFilter === g.value
                    ? 'text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={roleFilter === g.value ? { background: 'var(--hm-blue)' } : {}}>
                {g.label}
              </button>
            ))}
          </div>
          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <input className="input text-sm py-1.5 w-52" value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search name or email..." />
            <button type="submit" className="btn-secondary text-xs py-1.5 px-3">Search</button>
            {search && <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }}
              className="btn-ghost text-xs py-1.5">Clear</button>}
          </form>
        </div>
      </div>

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #edf2f7' }}>
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            {roleFilter ? ROLE_GROUPS.find(g => g.value === roleFilter)?.label : 'All Users'}
          </h2>
          <span className="text-xs font-semibold text-gray-400">{filteredUsers.length} users</span>
        </div>
        {isLoading ? (
          <div className="p-6 text-gray-400 text-sm">Loading...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state p-10">
            <div className="empty-state-icon text-2xl">👥</div>
            <p className="text-sm font-semibold text-gray-500">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u: User) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-semibold text-gray-900 text-sm">
                        {u.first_name} {u.last_name}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-[10px] font-bold text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">YOU</span>
                        )}
                      </div>
                      {u.must_change_password && (
                        <div className="text-[10px] text-amber-600 font-medium">⚠ Must change password</div>
                      )}
                    </td>
                    <td className="text-xs text-gray-500">{u.email}</td>
                    <td>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={ROLE_STYLE[u.role] || { bg: '#f3f4f6', color: '#374151' }}>
                        {roleLabel(u.role)}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500">{u.org_name || '—'}</td>
                    <td>
                      <span className={`badge ${STATUS_STYLE[u.status] || 'badge-gray'}`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="text-xs text-gray-400">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {/* Reset password */}
                        <button onClick={() => resetPwdMutation.mutate(u.id)}
                          disabled={resetPwdMutation.isPending}
                          title="Reset password"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                          <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </button>
                        {/* Activate */}
                        {u.status === 'pending' && (
                          <button onClick={() => statusMutation.mutate({ userId: u.id, status: 'active' })}
                            title="Activate account"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                            <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </button>
                        )}
                        {/* Suspend */}
                        {u.status === 'active' && u.id !== currentUser?.id && (
                          <button onClick={() => statusMutation.mutate({ userId: u.id, status: 'suspended' })}
                            title="Suspend account"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                            <Icon d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </button>
                        )}
                        {/* Reactivate */}
                        {(u.status === 'suspended' || u.status === 'deactivated') && (
                          <button onClick={() => statusMutation.mutate({ userId: u.id, status: 'active' })}
                            title="Reactivate account"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                            <Icon d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </button>
                        )}
                        {/* Unlock profile — for candidates only */}
                        {u.role === 'applicant' && (
                          <button onClick={() => setUnlockTarget({ id: u.id, name: `${u.first_name} ${u.last_name}` })}
                            title="Unlock submitted profile"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors">
                            <Icon d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

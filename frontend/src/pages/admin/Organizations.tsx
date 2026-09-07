import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../../services/api';

const Icon = ({ d, size = 15 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const INDUSTRIES = [
  'Information Technology', 'Healthcare', 'Finance & Banking', 'Education',
  'Manufacturing', 'Retail', 'Government', 'Legal', 'Engineering', 'Other',
];

const STATUS_STYLES: Record<string, { bg: string; color: string; dot: string }> = {
  active:      { bg: '#eef6db', color: '#3a5a0d', dot: '#78b41e' },
  suspended:   { bg: '#fef9e7', color: '#7a5900', dot: '#f0b400' },
  deactivated: { bg: '#fff5f5', color: '#9b2c2c', dot: '#e53e3e' },
};

function PasswordBox({ password, email }: { password: string; email: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(password); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="mt-3 p-4 rounded-xl" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-green-600 font-bold text-sm">✓ Password generated</span>
      </div>
      <div className="text-xs text-gray-600 mb-1">Send to: <strong>{email}</strong></div>
      <div className="flex items-center gap-2 mt-2">
        <code className="flex-1 px-3 py-2 rounded-lg text-sm font-mono font-bold bg-white border border-green-200">{password}</code>
        <button onClick={copy} className="btn-secondary text-xs py-2 px-3">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <p className="text-[11px] text-gray-500 mt-2">⚠ Share this password securely. The user must change it on first login.</p>
    </div>
  );
}

type Org = {
  id: string; name: string; org_code: string; org_domain: string;
  industry_type: string; status: string; created_at: string;
  user_count: number; admin_email: string; website_url?: string;
  formal_agreement_ref?: string;
};

export default function AdminOrganizations() {
  const qc = useQueryClient();

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    org_name: '', org_code: '', admin_first_name: '', admin_last_name: '',
    admin_email: '', industry_type: '', website_url: '', formal_agreement_ref: '',
  });
  const [createPassword, setCreatePassword] = useState('');
  const [createAdminEmail, setCreateAdminEmail] = useState('');
  const [createError, setCreateError] = useState('');

  // Edit state
  const [editingOrg, setEditingOrg] = useState<Org | null>(null);
  const [editForm, setEditForm] = useState({ org_name: '', industry_type: '', website_url: '', formal_agreement_ref: '' });
  const [editError, setEditError] = useState('');

  // Reset password state
  const [resetResult, setResetResult] = useState<{ password: string; email: string; orgId: string } | null>(null);

  // Confirm deactivate
  const [confirmDeactivate, setConfirmDeactivate] = useState<Org | null>(null);

  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: () => adminApi.listOrgs().then(r => r.data),
  });

  const detectedDomain = createForm.admin_email.includes('@')
    ? createForm.admin_email.toLowerCase().split('@')[1] || '' : '';

  const setCreate = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCreateForm(f => ({ ...f, [k]: e.target.value }));

  const createMutation = useMutation({
    mutationFn: (data: typeof createForm) => adminApi.createOrg(data),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['admin-orgs'] });
      setCreatePassword(r.data.temp_password_preview);
      setCreateAdminEmail(createForm.admin_email);
      setCreateForm({ org_name: '', org_code: '', admin_first_name: '', admin_last_name: '', admin_email: '', industry_type: '', website_url: '', formal_agreement_ref: '' });
      setCreateError('');
    },
    onError: (e: any) => setCreateError(e.response?.data?.detail || 'Failed to create organization'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateOrg(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orgs'] }); setEditingOrg(null); setEditError(''); },
    onError: (e: any) => setEditError(e.response?.data?.detail || 'Failed to update'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateOrg(id, { status: 'deactivated' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-orgs'] }); setConfirmDeactivate(null); },
  });

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => adminApi.updateOrg(id, { status: 'active' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-orgs'] }),
  });

  const resetPwdMutation = useMutation({
    mutationFn: (orgId: string) => adminApi.resetAdminPassword(orgId),
    onSuccess: (r, orgId) => setResetResult({ password: r.data.temp_password, email: r.data.admin_email, orgId }),
  });

  const openEdit = (org: Org) => {
    setEditingOrg(org);
    setEditForm({ org_name: org.name, industry_type: org.industry_type || '', website_url: org.website_url || '', formal_agreement_ref: org.formal_agreement_ref || '' });
    setEditError('');
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreatePassword('');
    if (!createForm.org_name || !createForm.org_code || !createForm.admin_email || !createForm.admin_first_name || !createForm.admin_last_name)
      return setCreateError('Please fill all required fields');
    if (!createForm.admin_email.includes('@'))
      return setCreateError('Please enter a valid admin email address');
    createMutation.mutate(createForm);
  };

  const activeCount = orgs.filter((o: Org) => o.status === 'active').length;

  return (
    <div className="max-w-6xl fade-in">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="page-title">Customer Organizations</h1>
          <p className="page-subtitle">{activeCount} active organization{activeCount !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => { setShowCreate(!showCreate); setCreatePassword(''); setCreateError(''); }}
          className="btn-primary">
          {showCreate ? '✕ Cancel' : '+ Onboard new customer'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card mb-6 scale-in">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-1">Onboard new customer organization</h2>
          <p className="text-xs text-gray-500 mb-5">
            This creates the first Customer Admin account for a new organization. All org users must register using the{' '}
            <strong>@[company domain]</strong> email.
          </p>
          {createError && <div className="alert-error mb-4">{createError}</div>}
          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Organization name *</label>
                <input className="input" value={createForm.org_name} onChange={setCreate('org_name')} placeholder="Acme Corporation" />
              </div>
              <div>
                <label className="label">Organization code *</label>
                <input className="input uppercase" value={createForm.org_code} onChange={setCreate('org_code')} placeholder="ACME" maxLength={10} />
              </div>
              <div>
                <label className="label">Admin first name *</label>
                <input className="input" value={createForm.admin_first_name} onChange={setCreate('admin_first_name')} placeholder="John" />
              </div>
              <div>
                <label className="label">Admin last name *</label>
                <input className="input" value={createForm.admin_last_name} onChange={setCreate('admin_last_name')} placeholder="Smith" />
              </div>
              <div>
                <label className="label">Admin email * <span className="text-gray-400 normal-case font-normal">(sets org domain)</span></label>
                <input className="input" type="email" value={createForm.admin_email} onChange={setCreate('admin_email')} placeholder="admin@company.com" />
                {detectedDomain && (
                  <p className="text-xs font-semibold mt-1.5 px-2 py-1 rounded" style={{ background: '#eef6db', color: '#3a5a0d' }}>
                    ✓ Org domain will be: <strong>@{detectedDomain}</strong>
                  </p>
                )}
              </div>
              <div>
                <label className="label">Formal agreement reference</label>
                <input className="input" value={createForm.formal_agreement_ref} onChange={setCreate('formal_agreement_ref')} placeholder="CONTRACT-2024-001" />
              </div>
              <div>
                <label className="label">Industry type</label>
                <select className="input" value={createForm.industry_type} onChange={setCreate('industry_type')}>
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Website URL</label>
                <input className="input" value={createForm.website_url} onChange={setCreate('website_url')} placeholder="https://acmecorp.com" />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create organization + send credentials'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </form>
          {createPassword && <PasswordBox password={createPassword} email={createAdminEmail} />}
        </div>
      )}

      {/* Edit modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900">Edit Organization</h2>
                <p className="text-xs text-gray-500 mt-0.5">{editingOrg.org_code} · @{editingOrg.org_domain}</p>
              </div>
              <button onClick={() => setEditingOrg(null)} className="btn-ghost w-8 h-8 p-0 text-gray-400">✕</button>
            </div>
            <div className="p-6 space-y-4">
              {editError && <div className="alert-error">{editError}</div>}
              <div>
                <label className="label">Organization name</label>
                <input className="input" value={editForm.org_name}
                  onChange={e => setEditForm(f => ({ ...f, org_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Industry type</label>
                <select className="input" value={editForm.industry_type}
                  onChange={e => setEditForm(f => ({ ...f, industry_type: e.target.value }))}>
                  <option value="">Select industry...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Website URL</label>
                <input className="input" value={editForm.website_url}
                  onChange={e => setEditForm(f => ({ ...f, website_url: e.target.value }))}
                  placeholder="https://..." />
              </div>
              <div>
                <label className="label">Formal agreement reference</label>
                <input className="input" value={editForm.formal_agreement_ref}
                  onChange={e => setEditForm(f => ({ ...f, formal_agreement_ref: e.target.value }))}
                  placeholder="CONTRACT-2024-001" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button className="btn-primary flex-1" disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate({ id: editingOrg.id, data: editForm })}>
                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
              </button>
              <button className="btn-secondary" onClick={() => setEditingOrg(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm deactivate modal */}
      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md scale-in p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-red-600 text-lg">⚠</div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Deactivate Organization</h2>
                <p className="text-xs text-gray-500">This will also deactivate all users in this org</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 mb-5">
              Are you sure you want to deactivate <strong>{confirmDeactivate.name}</strong>? All {confirmDeactivate.user_count} user(s) will lose access immediately.
            </p>
            <div className="flex gap-3">
              <button className="btn-danger flex-1" disabled={deactivateMutation.isPending}
                onClick={() => deactivateMutation.mutate(confirmDeactivate.id)}>
                {deactivateMutation.isPending ? 'Deactivating...' : 'Yes, deactivate'}
              </button>
              <button className="btn-secondary" onClick={() => setConfirmDeactivate(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Orgs table */}
      {isLoading ? (
        <div className="card"><p className="text-gray-400 text-sm">Loading organizations...</p></div>
      ) : orgs.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon text-2xl">🏢</div>
            <p className="text-sm font-semibold text-gray-500">No organizations yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Onboard new customer" to get started</p>
          </div>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Organization</th>
                <th>Code</th>
                <th>Domain</th>
                <th>Admin email</th>
                <th>Industry</th>
                <th>Users</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map((org: Org) => {
                const s = STATUS_STYLES[org.status] || STATUS_STYLES.active;
                const isReset = resetResult?.orgId === org.id;
                return (
                  <>
                    <tr key={org.id}>
                      <td>
                        <div className="font-semibold text-gray-900">{org.name}</div>
                        <div className="text-[11px] text-gray-400">{new Date(org.created_at).toLocaleDateString()}</div>
                      </td>
                      <td><span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{org.org_code}</span></td>
                      <td className="text-gray-500 text-xs">@{org.org_domain}</td>
                      <td className="text-xs text-gray-500">{org.admin_email || '—'}</td>
                      <td className="text-xs text-gray-500">{org.industry_type || '—'}</td>
                      <td className="text-center font-semibold">{org.user_count}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{ background: s.bg, color: s.color }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />
                          {org.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {/* Edit */}
                          <button onClick={() => openEdit(org)} title="Edit organization"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <Icon d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </button>
                          {/* Reset password */}
                          <button onClick={() => resetPwdMutation.mutate(org.id)} title="Reset admin password"
                            disabled={resetPwdMutation.isPending}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                            <Icon d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </button>
                          {/* Deactivate / Reactivate */}
                          {org.status !== 'deactivated' ? (
                            <button onClick={() => setConfirmDeactivate(org)} title="Deactivate organization"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Icon d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </button>
                          ) : (
                            <button onClick={() => reactivateMutation.mutate(org.id)} title="Reactivate organization"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                              <Icon d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isReset && (
                      <tr key={`${org.id}-reset`}>
                        <td colSpan={8} className="bg-amber-50 px-4 py-3">
                          <PasswordBox password={resetResult!.password} email={resetResult!.email} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

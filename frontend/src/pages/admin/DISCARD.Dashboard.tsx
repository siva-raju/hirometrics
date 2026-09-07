import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api';

const Icon = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

function StatCard({ value, label, icon, accent, bg }: { value: any; label: string; icon: string; accent: string; bg: string }) {
  return (
    <div className="stat-card" style={{ '--accent': accent, '--accent-bg': bg } as any}>
      <div className="stat-icon" style={{ background: bg }}>
        <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div className="stat-value mt-7">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: orgs = [] } = useQuery({
    queryKey: ['admin-orgs'],
    queryFn: () => adminApi.listOrgs().then(r => r.data)
  });

  const activeOrgs = orgs.filter((o: any) => o.status === 'active' || o.status === 'ACTIVE').length;

  return (
    <div className="max-w-6xl fade-in">
      {/* Header */}
      <div className="mb-7">
        <h1 className="page-title">HM Admin Dashboard</h1>
        <p className="page-subtitle">HiroMetrics platform overview and administration</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard value={orgs.length} label="Customer Orgs" icon="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" accent="#0078d2" bg="#e6f3fb" />
        <StatCard value={activeOrgs} label="Active Orgs" icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" accent="#78b41e" bg="#eef6db" />
        <StatCard value="—" label="Total Candidates" icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" accent="#f0963c" bg="#fef3ea" />
        <StatCard value="—" label="Pending Verifications" icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" accent="#f0b400" bg="#fef9e7" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Quick Actions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Quick Actions</h2>
          </div>
          <div className="space-y-2">
            <Link to="/admin/organizations" className="qa-card">
              <span className="qa-icon">🏢</span>
              <div>
                <div className="text-[13px] font-semibold">Onboard Customer</div>
                <div className="text-[11px] text-gray-400 font-normal mt-0.5">Create new organization account</div>
              </div>
              <svg className="ml-auto text-gray-300" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
            <Link to="/admin/notifications" className="qa-card">
              <span className="qa-icon">📢</span>
              <div>
                <div className="text-[13px] font-semibold">Send Notification</div>
                <div className="text-[11px] text-gray-400 font-normal mt-0.5">Broadcast to platform users</div>
              </div>
              <svg className="ml-auto text-gray-300" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
            </Link>
          </div>
        </div>

        {/* Recent Organizations */}
        <div className="card col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Recent Organizations</h2>
            <Link to="/admin/organizations" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all →</Link>
          </div>
          {orgs.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon text-2xl">🏢</div>
              <p className="text-sm font-semibold text-gray-500">No organizations yet</p>
              <p className="text-xs text-gray-400 mt-1">Onboard your first customer to get started</p>
              <Link to="/admin/organizations" className="btn-primary mt-4 text-xs">+ Onboard Customer</Link>
            </div>
          ) : (
            <table className="hm-table">
              <thead>
                <tr>
                  <th>Organization</th>
                  <th>Domain</th>
                  <th>Code</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {orgs.slice(0, 6).map((org: any) => (
                  <tr key={org.id}>
                    <td className="font-semibold text-gray-900">{org.name}</td>
                    <td className="text-gray-500">@{org.org_domain}</td>
                    <td><span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{org.org_code}</span></td>
                    <td>
                      <span className={`badge ${org.status === 'active' || org.status === 'ACTIVE' ? 'badge-green' : 'badge-gray'}`}>
                        {org.status?.toLowerCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

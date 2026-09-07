import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { employerApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

function StatCard({ value, label, accent, bg, icon }: { value: any; label: string; accent: string; bg: string; icon: string }) {
  return (
    <div className="stat-card" style={{ '--accent': accent, '--accent-bg': bg } as any}>
      <div className="stat-icon" style={{ background: bg }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </div>
      <div className="stat-value mt-7">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  received: '#64748b', reviewing: '#0078d2', shortlisted: '#f0b400',
  submitted: '#78b41e', not_proceeding: '#e53e3e',
};

export default function EmployerDashboard() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({
    queryKey: ['employer-dashboard'],
    queryFn: () => employerApi.getDashboard().then(r => r.data)
  });
  if (isLoading) return <div className="text-gray-400 text-sm p-8">Loading...</div>;
  const d = data || {};

  return (
    <div className="max-w-6xl fade-in">
      <div className="mb-7">
        <h1 className="page-title">Welcome back{user?.firstName ? `, ${user.firstName}` : ''}</h1>
        <p className="page-subtitle">Your hiring activity at a glance</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard value={d.total_folders ?? 0} label="Active Folders" accent="#0078d2" bg="#e6f3fb" icon="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        <StatCard value={d.total_applications ?? 0} label="Applications" accent="#f0963c" bg="#fef3ea" icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        <StatCard value={d.shortlisted ?? 0} label="Shortlisted" accent="#f0b400" bg="#fef9e7" icon="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        <StatCard value={d.submitted_up ?? 0} label="Submitted Up" accent="#78b41e" bg="#eef6db" icon="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </div>

      <div className="grid grid-cols-3 gap-5">
        <div className="card">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { to: '/employer/inbox', icon: '📨', label: 'View Inbox', desc: 'Review incoming applications' },
              { to: '/employer/folders', icon: '📁', label: 'Job Folders', desc: 'Manage candidate pools' },
              { to: '/employer/search', icon: '🔍', label: 'Find Candidates', desc: 'Search verified profiles' },
            ].map(a => (
              <Link key={a.to} to={a.to} className="qa-card">
                <span className="qa-icon">{a.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold">{a.label}</div>
                  <div className="text-[11px] text-gray-400 font-normal mt-0.5">{a.desc}</div>
                </div>
                <svg className="ml-auto text-gray-300" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6" /></svg>
              </Link>
            ))}
          </div>
        </div>

        <div className="card col-span-2">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Application Pipeline</h2>
          {d.status_breakdown && Object.keys(d.status_breakdown).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(d.status_breakdown).map(([status, count]) => {
                const color = STATUS_COLORS[status] || '#94a3b8';
                const max = Math.max(...Object.values(d.status_breakdown as Record<string, number>));
                const pct = max > 0 ? ((count as number) / max) * 100 : 0;
                return (
                  <div key={status}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-gray-600 capitalize">{status.replace(/_/g,' ')}</span>
                      <span className="font-bold text-gray-900">{count as number}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon text-2xl">📊</div>
              <p className="text-sm font-semibold text-gray-500">No applications yet</p>
              <p className="text-xs text-gray-400 mt-1">Invite candidates or share a job link to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

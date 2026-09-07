import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { employerApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

function StatCard({ value, label, sub, accent, bg, icon }: {
  value: any; label: string; sub?: string; accent: string; bg: string; icon: string;
}) {
  return (
    <div className="stat-card" style={{ '--accent': accent, '--accent-bg': bg } as any}>
      <div className="stat-icon" style={{ background: bg }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={accent}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div className="stat-value mt-7">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: accent + '99' }}>{sub}</div>}
    </div>
  );
}

// ── Mock bar chart ────────────────────────────────────────────────────────────
function FolderStatusChart() {
  const bars = [
    { label: 'Week 1', open: 4, closed: 1 },
    { label: 'Week 2', open: 6, closed: 2 },
    { label: 'Week 3', open: 5, closed: 3 },
    { label: 'Week 4', open: 8, closed: 2 },
  ];
  const max = 10;
  return (
    <div>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Open vs Closed Positions — Last 30 Days
      </div>
      <div className="flex items-end gap-3 h-24">
        {bars.map(b => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full flex gap-0.5 items-end" style={{ height: 72 }}>
              <div className="flex-1 rounded-t transition-all"
                style={{ height: `${(b.open / max) * 100}%`, background: '#0078d2' }} />
              <div className="flex-1 rounded-t transition-all"
                style={{ height: `${(b.closed / max) * 100}%`, background: '#e2e8f0' }} />
            </div>
            <div className="text-[10px] text-gray-400">{b.label}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#0078d2' }} />
          <span className="text-[10px] text-gray-500">Open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#e2e8f0' }} />
          <span className="text-[10px] text-gray-500">Closed/Archived</span>
        </div>
        <span className="text-[10px] text-gray-300 ml-auto italic">Mock data — real data coming soon</span>
      </div>
    </div>
  );
}

// ── Mock aging chart ──────────────────────────────────────────────────────────
function FolderAgingChart() {
  const segments = [
    { label: '< 7 days',   count: 3, color: '#78b41e' },
    { label: '7–14 days',  count: 4, color: '#f0b400' },
    { label: '15–30 days', count: 2, color: '#f0963c' },
    { label: '> 30 days',  count: 1, color: '#e53e3e' },
  ];
  const total = segments.reduce((a, b) => a + b.count, 0);
  return (
    <div>
      <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
        Open Positions Aging
      </div>
      <div className="flex rounded-lg overflow-hidden h-6 mb-3">
        {segments.map(s => (
          <div key={s.label} title={`${s.label}: ${s.count}`}
            style={{ width: `${(s.count / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {segments.map(s => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-[10px] text-gray-500">{s.label}</span>
            <span className="text-[10px] font-bold text-gray-700 ml-auto">{s.count}</span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-gray-300 mt-2 text-right italic">Mock data — real data coming soon</div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
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

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-7">
        <StatCard
          value={d.total_folders ?? 0}
          label="Active Folders"
          sub="open job folders"
          accent="#0078d2" bg="#e6f3fb"
          icon="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
        />
        <StatCard
          value={d.new_applications ?? 0}
          label="New / Unread Applications"
          sub="received, not yet reviewed"
          accent="#f0963c" bg="#fef3ea"
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
        <StatCard
          value={d.unread_notifications ?? 0}
          label="Unread Notifications"
          sub="messages requiring attention"
          accent="#f0b400" bg="#fef9e7"
          icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
        <StatCard
          value={d.unread_inbox ?? 0}
          label="Unread — Inbox"
          sub="pending job links in inbox"
          accent="#78b41e" bg="#eef6db"
          icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { to: '/employer/inbox',   icon: '📨', label: 'View Inbox',      desc: 'Review incoming job link notifications' },
              { to: '/employer/folders', icon: '📁', label: 'Job Folders',     desc: 'Manage your candidate pools' },
              { to: '/employer/search',  icon: '👤', label: 'Invite Candidates', desc: 'Send invitations to candidates' },
              { to: '/employer/manage-users', icon: '⚙️', label: 'Manage Users', desc: 'Manage internal hiring managers' },
            ].map(a => (
              <Link key={a.to} to={a.to} className="qa-card">
                <span className="qa-icon">{a.icon}</span>
                <div>
                  <div className="text-[13px] font-semibold">{a.label}</div>
                  <div className="text-[11px] text-gray-400 font-normal mt-0.5">{a.desc}</div>
                </div>
                <svg className="ml-auto text-gray-300" width={14} height={14} viewBox="0 0 24 24"
                  fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        {/* Performance Charts */}
        <div className="card col-span-2">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-5">Performance Chart</h2>
          <div className="grid grid-cols-2 gap-6 divide-x divide-gray-100">
            <FolderStatusChart />
            <div className="pl-6">
              <FolderAgingChart />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

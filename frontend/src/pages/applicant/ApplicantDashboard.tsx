import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { applicantApi, notifApi } from '../../services/api';

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  value, label, sub, accent, bg, icon, onClick,
}: {
  value: any; label: string; sub?: string;
  accent: string; bg: string; icon: string;
  onClick?: () => void;
}) {
  const inner = (
    <div
      className="stat-card"
      style={{ '--accent': accent, '--accent-bg': bg, cursor: onClick ? 'pointer' : 'default' } as any}
      onClick={onClick}>
      <div className="stat-icon" style={{ background: bg }}>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none"
          stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d={icon} />
        </svg>
      </div>
      <div className="stat-value mt-7">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: accent + '99' }}>{sub}</div>}
    </div>
  );
  return inner;
}

// ── Section check row ─────────────────────────────────────────────────────────
function CheckRow({ label, done, missing }: { label: string; done: boolean; missing?: boolean }) {
  const color = done ? '#78b41e' : missing ? '#f0b400' : '#94a3b8';
  const status = done ? 'Complete' : missing ? 'Incomplete' : 'Not started';
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
      <span className="text-xs text-gray-600 flex-1">{label}</span>
      <span className="text-[11px] font-medium" style={{ color }}>{status}</span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function ApplicantDashboard() {
  const navigate = useNavigate();

  const { data: profileData, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => applicantApi.getProfile().then(r => r.data),
  });

  const { data: invitationsData = [] } = useQuery({
    queryKey: ['my-invitations'],
    queryFn: () => applicantApi.getMyInvitations().then(r => r.data),
  });

  const { data: jobLinksData = [] } = useQuery({
    queryKey: ['my-job-links'],
    queryFn: () => applicantApi.getMyJobLinks?.()?.then((r: any) => r.data) ?? Promise.resolve([]),
  });

  const { data: hmData } = useQuery({
    queryKey: ['hm-processing-count'],
    queryFn: () => applicantApi.getHmProcessingCount?.()?.then((r: any) => r.data) ?? Promise.resolve({ count: 0 }),
  });

  const { data: notifData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notifApi.unreadCount().then(r => r.data),
  });

  if (isLoading) return <div className="text-gray-400 text-sm p-8">Loading...</div>;

  const profile     = profileData?.profile;
  const user        = profileData?.user;
  const firstName   = user?.first_name || '';
  const completeness = profile?.profile_completeness ?? 0;
  const isLocked    = !!profile?.baseline_locked;
  const lockedAt    = profile?.baseline_locked_at;
  const wizardStep  = profile?.wizard_step ?? 0;

  // Profile status logic:
  // COMPLETE  = baseline_locked is true AND wizard_step hasn't advanced past lock (no in-progress edits)
  // IN PROGRESS = not yet locked, or locked but candidate has saved new entries since
  // We use: if locked and profile_completeness < 100 after lock → in progress (new data added but not re-submitted)
  // Simplest reliable signal: baseline_locked = true → COMPLETE, unless wizard_step reset recently



  // Inbox open items = pending invitations + pending job links
  const pendingInvitations = (invitationsData as any[]).filter((i: any) => i.status === 'pending').length;
  const pendingJobLinks    = (jobLinksData as any[]).filter((i: any) => i.status === 'pending').length;
  const totalInboxItems    = pendingInvitations + pendingJobLinks;
  const hmProcessingCount  = hmData?.count ?? 0;
  const unreadNotifs       = notifData?.unread_count ?? 0;

  // Section completeness checks
  const hasBasicInfo  = !!(profile?.primary_phone || profile?.current_city);
  const hasWork       = (profileData?.work_history?.length ?? 0) > 0;
  const hasEducation  = (profileData?.education?.length ?? 0) > 0;
  const hasReferences = (profileData?.references?.length ?? 0) > 0;
  const hasResume     = !!profileData?.current_resume;
  const hasCerts      = (profileData?.certifications?.length ?? 0) > 0;

  // Active = all 5 core sections complete regardless of Resume
  const allCoreComplete = hasBasicInfo && hasWork && hasEducation && hasReferences && hasCerts;
  const profileStatus: 'complete' | 'in_progress' = (isLocked || allCoreComplete) ? 'complete' : 'in_progress';

  // Last completion date = baseline_locked_at formatted
  const lastCompletionDate = lockedAt
    ? new Date(lockedAt).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : allCoreComplete
    ? new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    : null;

  // Progress bar color
  const barColor = completeness >= 80
    ? 'linear-gradient(90deg,#78b41e,#9fd93c)'
    : completeness >= 50
    ? 'linear-gradient(90deg,#f0b400,#f5c842)'
    : 'linear-gradient(90deg,#0078d2,#1a8fe0)';

  const barTextColor = completeness >= 80 ? '#78b41e' : completeness >= 50 ? '#f0b400' : '#0078d2';

  return (
    <div className="max-w-5xl fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Welcome back{firstName ? `, ${firstName}` : ''}!</h1>
        <p className="page-subtitle">Here's your summary at a glance</p>
      </div>

      {/* Inbox alert banner */}
      {totalInboxItems > 0 && (
        <div className="alert-warn flex items-center justify-between mb-5">
          <span>
            📨 You have <strong>{totalInboxItems}</strong> open item(s) in Inbox
          </span>
          <Link to="/applicant/inbox" className="btn-primary text-xs py-1.5 px-3">
            View now
          </Link>
        </div>
      )}

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          value={pendingJobLinks || '—'}
          label="Open Job Links"
          sub="from external links"
          accent="#f0963c" bg="#fef3ea"
          icon="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
          onClick={() => navigate('/applicant/inbox')}
        />
        <StatCard
          value={pendingInvitations || '—'}
          label="Open Invites"
          sub="awaiting your action"
          accent="#f0b400" bg="#fef9e7"
          icon="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          onClick={() => navigate('/applicant/inbox')}
        />
        <StatCard
          value={hmProcessingCount || '—'}
          label="Under HM Processing"
          sub="not yet sent to employer"
          accent="#0078d2" bg="#e6f1fb"
          icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <StatCard
          value={unreadNotifs || '—'}
          label="Notifications"
          sub="unread"
          accent="#78b41e" bg="#eef6db"
          icon="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          onClick={() => navigate('/applicant/notifications')}
        />
      </div>

      {/* ── Profile Completion Status card ── */}
      <div className="card">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-4">
          Profile Completion Status
        </h2>

        <div className="grid grid-cols-2 gap-6">

          {/* Left — status fields + button */}
          <div className="space-y-0 divide-y divide-gray-100">

            {/* Profile Status */}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Profile Status
              </span>
              {profileStatus === 'complete' ? (
                <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: '#eef6db', color: '#3a6609' }}>
                  Active
                </span>
              ) : (
                <span className="text-xs font-bold px-3 py-1 rounded-full"
                  style={{ background: '#fef9e7', color: '#7a5000' }}>
                  In Progress
                </span>
              )}
            </div>

            {/* Last Completion Date */}
            <div className="flex items-center justify-between py-2.5">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Last Completion Date
              </span>
              <span className="text-xs font-medium text-gray-700">
                {lastCompletionDate ?? <span className="text-gray-300 italic">—</span>}
              </span>
            </div>

            {/* Completeness bar */}
            <div className="py-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Completeness
                </span>
                <span className="text-sm font-bold" style={{ color: barTextColor }}>
                  {completeness}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${completeness}%`, background: barColor }} />
              </div>
            </div>

            {/* Wizard / Update button */}
            <div className="pt-4">
              <Link
                to="/applicant/wizard"
                className="btn-primary w-full text-center text-sm block">
                'View/Update Profile →'
              </Link>
            </div>
          </div>

          {/* Right — section checklist */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Section Checklist
            </div>
            <CheckRow label="Personal Info"  done={hasBasicInfo} missing={!hasBasicInfo && wizardStep >= 1} />
            <CheckRow label="Work History"   done={hasWork}      missing={!hasWork && wizardStep >= 3} />
            <CheckRow label="Education"      done={hasEducation} missing={!hasEducation && wizardStep >= 2} />
            <CheckRow label="References"     done={hasReferences} missing={!hasReferences && wizardStep >= 4} />
            <CheckRow label="Certifications" done={hasCerts} />
          </div>

        </div>
      </div>
    </div>
  );
}

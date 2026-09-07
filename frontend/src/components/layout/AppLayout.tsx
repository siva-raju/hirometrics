import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useState, useEffect } from 'react';
import { notifApi, applicantApi } from '../../services/api';
import { useQuery } from '@tanstack/react-query';

const Icon = ({ d, size = 17 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS: Record<string, string> = {
  dashboard: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6zM4 14a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1v-5z',
  wizard:    'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4z',
  profile:   'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  links:     'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
  sent:      'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  resume:    'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  inbox:     'M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zm16 2l-8 7-8-7',
  folders:   'M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z',
  search:    'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  users:     'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  bell:      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  orgs:      'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  broadcast: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z',
  logout:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  shield:    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  chevronR:  'M9 18l6-6-6-6',
};

function NavItem({ to, iconKey, label, badge }: { to: string; iconKey: string; label: string; badge?: number }) {
  return (
    <NavLink to={to} className={({ isActive }) =>
      `group flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 mb-0.5 relative ${
        isActive
          ? 'text-white'
          : 'text-white/50 hover:text-white/85 hover:bg-white/5'
      }`
    }>
      {({ isActive }) => (
        <>
          {isActive && (
            <span className="absolute inset-0 rounded-lg" style={{ background: 'rgba(0,120,210,0.25)', border: '1px solid rgba(0,120,210,0.3)' }} />
          )}
          <span className={`relative flex-shrink-0 transition-colors ${isActive ? 'text-blue-300' : 'text-white/35 group-hover:text-white/60'}`}>
            <Icon d={ICONS[iconKey]} size={15} />
          </span>
          <span className="relative flex-1 truncate">{label}</span>
          {badge != null && badge > 0 && (
            <span className="relative flex-shrink-0 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {badge > 99 ? '99+' : badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard', wizard: 'Profile Wizard', profile: 'My Profile',
  inbox: 'Inbox', sent: 'Sent', folders: 'Job Folders', archive: 'Archive', 'active-requests': 'Active Requests', 'archived-requests': 'Archived Requests',
  search: 'User Management', organizations: 'Customer Organizations',
  notifications: 'Notifications',
};

export default function AppLayout() {
  const { user, clearAuth, isApplicant, isEmployer, isHM } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetch = () => notifApi.unreadCount().then(r => setUnreadCount(r.data.unread_count)).catch(() => {});
    fetch();
    const iv = setInterval(fetch, 30000);
    return () => clearInterval(iv);
  }, []);

  const handleLogout = () => { clearAuth(); navigate('/login'); };

  const initials = user ? `${(user.firstName||'H')[0]}${(user.lastName||'M')[0]}`.toUpperCase() : 'HM';
  const fullName = user ? `${user.firstName} ${user.lastName}`.trim() : '';
  const roleName = user?.role ? user.role.replace(/_/g,' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
  const notifPath = isApplicant() ? '/applicant/notifications' : isEmployer() ? '/employer/notifications' : '/admin/notifications';

  const pageTitle = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const last = segments[segments.length - 1] || 'dashboard';
    return PAGE_TITLES[last] || 'HiroMetrics';
  })();

  const portalLabel = isHM() ? 'HM Admin Portal' : isEmployer() ? 'Employer Portal' : 'Candidate Portal';
  const [photoUploading, setPhotoUploading] = useState(false);
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);

  const handlePhotoUpload = async (file: File) => {
    setPhotoUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const stored = JSON.parse(localStorage.getItem('hirometrics-auth') || '{}');
      const token = stored?.state?.accessToken || '';
      const r = await fetch('/api/v1/applicants/me/photo', {
        method: 'POST', body: fd,
        headers: { Authorization: `Bearer ${token}` }
      });
      if (r.ok) {
        const d = await r.json();
        const url = d.photo_url + '?t=' + Date.now();
        setLocalPhotoUrl(url);
      }
    } catch {}
    finally { setPhotoUploading(false); }
  };

  // Fetch profile photo from API for applicants (auth store doesn't store it)
  const { data: profileData } = useQuery({
    queryKey: ['my-profile-photo'],
    queryFn: () => applicantApi.getProfile().then(r => r.data),
    enabled: isApplicant(),
    staleTime: 30000,
  });
  const photoUrl = localPhotoUrl || profileData?.user?.profile_photo_url || (user as any)?.profile_photo_url;
  const portalColor = isHM() ? '#0078d2' : isEmployer() ? '#78b41e' : '#f0963c';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>

      {/* ── Sidebar ── */}
      <aside className="flex flex-col flex-shrink-0" style={{
        width: 'var(--sidebar-w)',
        background: 'var(--hm-navy)',
        borderRight: '1px solid rgba(255,255,255,0.05)',
      }}>

        {/* Logo area */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden"
            style={{ background: 'rgba(0,120,210,0.2)', border: '1px solid rgba(0,120,210,0.35)', boxShadow: '0 0 12px rgba(0,120,210,0.2)' }}>
            <img src="/brand/hm-logo-64.png" alt="" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="text-white font-bold text-[15px] tracking-tight leading-none">
              Hiro<span style={{ color: '#60aee8' }}>Metrics</span>
            </div>
            <div className="text-[10px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
              Credential Integrity Platform
            </div>
          </div>
        </div>

        {/* Portal badge / Candidate DP */}
        {isApplicant() ? (
          <div className="px-4 pt-4 pb-2 flex flex-col items-center">
            {/* Profile photo — static display, updated via Personal Info wizard */}
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0"
              style={{ border: '2px solid rgba(255,255,255,0.15)', background: 'rgba(0,120,210,0.2)' }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ color: '#93c5fd' }}>{initials}</div>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 pt-3">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: `${portalColor}18`, border: `1px solid ${portalColor}30` }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: portalColor, boxShadow: `0 0 6px ${portalColor}` }} />
              <div className="min-w-0">
                {isEmployer() && user ? (
                  <>
                    <div className="text-[11px] font-bold truncate" style={{ color: portalColor }}>
                      {user.firstName} {user.lastName}
                    </div>
                    {user.orgName && (
                      <div className="text-[10px] font-medium truncate" style={{ color: `${portalColor}bb` }}>
                        {user.orgName}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-[11px] font-bold" style={{ color: portalColor }}>{portalLabel}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {isApplicant() && (<>
            <div className="section-header mt-1">Main Menu</div>
            <NavItem to="/applicant/dashboard" iconKey="dashboard" label="Dashboard" />
            <NavItem to="/applicant/wizard" iconKey="wizard" label="Profile Wizard" />
            <NavItem to="/applicant/profile" iconKey="profile" label="My Profile" />
            <NavItem to="/applicant/inbox" iconKey="inbox" label="Inbox" />
            <NavItem to="/applicant/sent" iconKey="sent" label="Sent" />
            <NavItem to="/applicant/resume" iconKey="resume" label="Resume" />
          </>)}

          {isEmployer() && (<>
            <div className="section-header mt-1">Administrator</div>
            <NavItem to="/employer/dashboard" iconKey="dashboard" label="Dashboard" />
            <NavItem to="/employer/inbox" iconKey="inbox" label="Inbox" />
            <NavItem to="/employer/folders" iconKey="folders" label="Job Folders" />
            <NavItem to="/employer/archive" iconKey="folders" label="Archive" />
            <NavItem to="/employer/search" iconKey="search" label="Invites" />
            <NavItem to="/employer/manage-users" iconKey="users" label="Manage Users" />
          </>)}

          {isHM() && (<>
            <div className="section-header mt-1">Administration</div>
            <NavItem to="/admin/dashboard" iconKey="dashboard" label="Dashboard" />
            <NavItem to="/admin/active-requests" iconKey="inbox" label="Active Requests" />
            <NavItem to="/admin/archived-requests" iconKey="folders" label="Archived Requests" />
            <NavItem to="/admin/organizations" iconKey="orgs" label="Organizations" />
            <NavItem to="/admin/notifications" iconKey="broadcast" label="Notifications" />
            <NavItem to="/admin/users" iconKey="profile" label="User Management" />
            <NavItem to="/admin/hm-users" iconKey="shield" label="HM Staff" />
          </>)}

          <div className="h-px mx-1 my-3" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <NavItem to={notifPath} iconKey="bell" label="Notifications" badge={unreadCount} />
        </nav>

        {/* User footer */}
        <div className="px-3 pb-3 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
              style={{ background: 'rgba(0,120,210,0.25)', color: '#93c5fd', border: '1px solid rgba(0,120,210,0.3)', letterSpacing: '0.05em' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold text-white truncate leading-tight">{fullName}</div>
              <div className="text-[11px] truncate font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>{roleName}</div>
            </div>
            <NavLink to="/change-password"
              className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors w-full">
              🔑 Change password
            </NavLink>
            <button onClick={handleLogout} title="Sign out"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 group"
              style={{ color: 'rgba(255,255,255,0.3)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.cssText += 'color:#f87171;background:rgba(248,113,113,0.12)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <Icon d={ICONS.logout} size={14} />
            </button>
          </div>
          <div className="mt-2 px-2">
            <div className="text-[10px] font-medium truncate" style={{ color: 'rgba(255,255,255,0.2)' }}>{user?.email}</div>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Topbar */}
        <header className="flex-shrink-0 flex items-center justify-between px-6 bg-white"
          style={{ height: 'var(--topbar-h)', borderBottom: '1px solid #e8edf3', boxShadow: '0 1px 0 #f1f5f9' }}>
          <div className="flex items-center gap-3">
            <div className="w-1 h-5 rounded-full" style={{ background: 'var(--hm-blue)' }} />
            <h1 className="text-[15px] font-bold text-gray-900">{pageTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <NavLink to={notifPath}
              className="relative p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <Icon d={ICONS.bell} size={17} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              )}
            </NavLink>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold cursor-pointer select-none"
              style={{ background: 'var(--hm-blue-light)', color: 'var(--hm-blue)', border: '1px solid rgba(0,120,210,0.15)' }}
              title={fullName}>
              {initials}
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-150"
              title="Sign out">
              <Icon d={ICONS.logout} size={13} />
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

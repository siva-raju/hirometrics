import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth } = useAuthStore();

  // Honour ?redirect= param so job links return the candidate to the apply page after login
  const redirectTo = new URLSearchParams(location.search).get('redirect');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await axios.post('/api/v1/auth/login',
        new URLSearchParams({ username: email, password }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const d = res.data;
      const meRes = await axios.get('/api/v1/users/me', {
        headers: { Authorization: `Bearer ${d.access_token}` }
      });
      const me = meRes.data;
      setAuth(
        { id: me.id, email: me.email, firstName: me.first_name, lastName: me.last_name, role: me.role, orgId: me.org_id, orgName: me.org_name ?? null },
        d.access_token, d.refresh_token, d.must_change_password
      );
      if (d.must_change_password) { navigate('/change-password'); return; }
      // If we came from a job link, go back there after login
      if (redirectTo) { navigate(redirectTo); return; }
      if (me.role === 'applicant') navigate('/applicant/dashboard');
      else if (['customer_admin','customer_manager'].includes(me.role)) navigate('/employer/dashboard');
      else navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0d1526 0%, #162035 50%, #0d1526 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 p-10"
        style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,120,210,0.2)', border: '1px solid rgba(0,120,210,0.35)' }}>
              <img src="/brand/hm-logo-64.png" alt="" className="w-7 h-7 object-contain" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-none">
                Hiro<span style={{ color: '#60aee8' }}>Metrics</span>
              </div>
              <div className="text-[11px] font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Credential Platform</div>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-white leading-tight mb-3">
              Trusted credential<br/>verification
            </h2>
            <p className="text-sm font-medium leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
              A single source of truth for professional identity — immutable, transparent, and verifiable.
            </p>
          </div>

          <div className="space-y-4">
            {[
              { icon: '🔒', title: 'Immutable Baseline', desc: 'Credentials are locked once authenticated' },
              { icon: '🔗', title: 'Chain Transparency', desc: 'Full genealogy of every submission' },
              { icon: '📸', title: 'Snapshot Integrity', desc: 'Frozen profile at time of sharing' },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{f.icon}</span>
                <div>
                  <div className="text-sm font-bold text-white">{f.title}</div>
                  <div className="text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
          © 2024 HiroMetrics · Trusted Credential Verification
        </div>
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(0,120,210,0.2)', border: '1px solid rgba(0,120,210,0.35)' }}>
              <img src="/brand/hm-logo-64.png" alt="" className="w-6 h-6 object-contain" />
            </div>
            <div className="text-white font-bold text-base">
              Hiro<span style={{ color: '#60aee8' }}>Metrics</span>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-white mb-1">Sign in</h1>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Enter your credentials to continue
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
              style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)', color: '#fc8181' }}>
              <span>⚠</span> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Email address
              </label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                className="block w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 transition-all duration-150 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,120,210,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                placeholder="you@company.com" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Password
              </label>
              <input type="password" required value={password} onChange={e => setPassword(e.target.value)}
                className="block w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 transition-all duration-150 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,120,210,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-150 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0078d2, #005fa3)', boxShadow: '0 4px 15px rgba(0,120,210,0.4)' }}>
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign in →'}
            </button>
          </form>

          <div className="mt-8 pt-6 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-xs font-medium text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              New candidate?{' '}
              <Link to="/register/applicant" className="font-bold hover:text-blue-300 transition-colors" style={{ color: '#60aee8' }}>
                Create account
              </Link>
            </p>
            <p className="text-xs font-medium text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Employer?{' '}
              <Link to="/register/employer" className="font-bold hover:text-blue-300 transition-colors" style={{ color: '#60aee8' }}>
                Register organization
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

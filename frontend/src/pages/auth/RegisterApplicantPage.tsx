import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/api';

export default function RegisterApplicantPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  const prefillEmail = searchParams.get('email') || '';

  const [form, setForm] = useState({
    first_name: '', last_name: '',
    email: prefillEmail,
    password: '', confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    setLoading(true);
    try {
      await authApi.registerApplicant({
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        invite_token: inviteToken || undefined,
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d1526 0%, #162035 50%, #0d1526 100%)' }}>
      <div className="w-full max-w-md text-center">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-2xl font-bold text-white mb-2">Account created!</h1>
        <p className="text-sm font-medium mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Check your email for an activation link, or activate your account below.
        </p>
        <div className="p-4 rounded-xl mb-6" style={{ background: 'rgba(120,180,30,0.15)', border: '1px solid rgba(120,180,30,0.3)' }}>
          <p className="text-xs font-semibold" style={{ color: '#a8d44e' }}>
            📧 Since email is in development mode, click below to activate immediately:
          </p>
        </div>
        <button onClick={async () => {
          try {
            const r = await fetch('/api/v1/auth/activate-by-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: form.email })
            });
            if (r.ok) navigate('/login');
            else navigate('/login');
          } catch { navigate('/login'); }
        }} className="w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #0078d2, #005fa3)' }}>
          Activate and go to login →
        </button>
        <p className="text-xs mt-4" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Already activated? <span className="cursor-pointer underline" onClick={() => navigate('/login')} style={{ color: '#60aee8' }}>Sign in</span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d1526 0%, #162035 50%, #0d1526 100%)' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,120,210,0.2)', border: '1px solid rgba(0,120,210,0.35)' }}>
            <img src="/brand/hm-logo-64.png" alt="" className="w-6 h-6 object-contain" />
          </div>
          <div className="text-white font-bold text-base">
            Hiro<span style={{ color: '#60aee8' }}>Metrics</span>
          </div>
        </div>

        {inviteToken && (
          <div className="mb-5 px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2"
            style={{ background: 'rgba(120,180,30,0.15)', border: '1px solid rgba(120,180,30,0.3)', color: '#a8d44e' }}>
            🎉 You've been invited to apply! Create your account to view the invitation.
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Create candidate account</h1>
          <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Join HiroMetrics and take control of your professional identity
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)', color: '#fc8181' }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {['first_name', 'last_name'].map((k) => (
              <div key={k}>
                <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {k === 'first_name' ? 'First name' : 'Last name'} *
                </label>
                <input type="text" required value={form[k as keyof typeof form]} onChange={set(k)}
                  className="block w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,120,210,0.15)'; }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
                  placeholder={k === 'first_name' ? 'Jane' : 'Smith'} />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Email address *
            </label>
            <input type="email" required value={form.email} onChange={set('email')}
              readOnly={!!prefillEmail}
              className="block w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              style={{ background: prefillEmail ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => { if (!prefillEmail) { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,120,210,0.15)'; }}}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
              placeholder="you@email.com" />
            {prefillEmail && <p className="text-xs mt-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Email pre-filled from your invitation</p>}
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Password *</label>
            <input type="password" required value={form.password} onChange={set('password')} minLength={8}
              className="block w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,120,210,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
              placeholder="Min. 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1.5" style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Confirm password *</label>
            <input type="password" required value={form.confirm} onChange={set('confirm')}
              className="block w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
              onFocus={e => { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,120,210,0.15)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; e.target.style.boxShadow = 'none'; }}
              placeholder="Repeat password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-150 disabled:opacity-50 mt-2"
            style={{ background: 'linear-gradient(135deg, #0078d2, #005fa3)', boxShadow: '0 4px 15px rgba(0,120,210,0.4)' }}>
            {loading ? 'Creating account...' : 'Create account →'}
          </button>
        </form>

        <div className="mt-6 pt-5 text-center" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Already have an account?{' '}
            <Link to="/login" className="font-bold hover:text-blue-300 transition-colors" style={{ color: '#60aee8' }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

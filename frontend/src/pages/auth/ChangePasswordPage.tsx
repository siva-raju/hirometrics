import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../services/api';

export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.new_password.length < 8) return setError('Password must be at least 8 characters');
    if (form.new_password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      await authApi.changePassword({
        current_password: form.current_password,
        new_password: form.new_password,
      });
      // Redirect based on role
      const role = user?.role || '';
      if (role === 'applicant') navigate('/applicant/dashboard');
      else if (role.startsWith('customer')) navigate('/employer/dashboard');
      else navigate('/admin/dashboard');
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Password change failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #0d1526 0%, #162035 50%, #0d1526 100%)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(0,120,210,0.2)', border: '1px solid rgba(0,120,210,0.35)' }}>
            <span className="text-white text-xs font-bold">HM</span>
          </div>
          <div className="text-white font-bold">Hiro<span style={{ color: '#60aee8' }}>Metrics</span></div>
        </div>

        <div className="mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Change your password</h1>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Your account requires a password change before continuing.
          </p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)', color: '#fc8181' }}>
            ⚠ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {[
            { key: 'current_password', label: 'Current / temporary password' },
            { key: 'new_password', label: 'New password' },
            { key: 'confirm', label: 'Confirm new password' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide"
                style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</label>
              <input type="password" required
                value={form[key as keyof typeof form]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="block w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                onFocus={e => { e.target.style.borderColor = 'rgba(0,120,210,0.6)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                placeholder={key === 'current_password' ? 'Your temporary password' : 'Min. 8 characters'} />
            </div>
          ))}
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-bold text-white mt-2 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0078d2, #005fa3)' }}>
            {loading ? 'Updating...' : 'Set new password →'}
          </button>
        </form>
      </div>
    </div>
  );
}

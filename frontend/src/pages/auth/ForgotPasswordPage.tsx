import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await authApi.forgotPassword(email);
      setSubmitted(true);
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Request failed');
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

        {submitted ? (
          <div className="text-center">
            <div className="text-5xl mb-4">📧</div>
            <h1 className="text-xl font-bold text-white mb-2">Check your email</h1>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
              If an account exists for <strong className="text-white">{email}</strong>, you'll receive a password reset link shortly.
            </p>
            <Link to="/login" className="text-sm font-bold" style={{ color: '#60aee8' }}>← Back to login</Link>
          </div>
        ) : (
          <div>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-white mb-1">Reset your password</h1>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Enter your email and we'll send you a reset link.
              </p>
            </div>
            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(229,62,62,0.12)', border: '1px solid rgba(229,62,62,0.3)', color: '#fc8181' }}>
                ⚠ {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide"
                  style={{ color: 'rgba(255,255,255,0.45)' }}>Email address</label>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                  className="block w-full rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}
                  onFocus={e => e.target.style.borderColor = 'rgba(0,120,210,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  placeholder="you@email.com" autoFocus />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #0078d2, #005fa3)' }}>
                {loading ? 'Sending...' : 'Send reset link →'}
              </button>
              <div className="text-center">
                <Link to="/login" className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  ← Back to login
                </Link>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

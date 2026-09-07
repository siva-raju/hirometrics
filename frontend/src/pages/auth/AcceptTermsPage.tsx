import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

export default function AcceptTermsPage() {
  const [tc, setTc] = useState<any>(null);
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    authApi.getCurrentTerms().then(r => setTc(r.data));
  }, []);

  const handleAccept = async () => {
    if (!tc) return;
    setLoading(true);
    try {
      await authApi.acceptTerms(tc.id);
      navigate(user?.role === 'applicant' ? '/applicant/dashboard' : '/employer/dashboard');
    } catch {
      alert('Failed to accept terms. Try again.');
    } finally { setLoading(false); }
  };

  const content = user?.role === 'applicant' ? tc?.content_candidate : tc?.content_employer;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-2xl">
        <div className="px-8 py-6 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Terms and Conditions</h1>
          <p className="text-sm text-gray-500 mt-1">Please read and accept to continue</p>
        </div>
        <div className="px-8 py-4 h-96 overflow-y-auto bg-gray-50 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-b border-gray-100"
          onScroll={e => {
            const t = e.currentTarget;
            if (t.scrollHeight - t.scrollTop - t.clientHeight < 30) setScrolled(true);
          }}>
          {content || 'Loading terms...'}
        </div>
        {!scrolled && (
          <div className="px-8 py-2 bg-amber-50 text-amber-700 text-xs">
            ↓ Please scroll to the bottom to accept
          </div>
        )}
        <div className="px-8 py-5">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1" checked={accepted}
              onChange={e => setAccepted(e.target.checked)} disabled={!scrolled} />
            <span className="text-sm text-gray-700">I have read and agree to the HiroMetrics Terms and Conditions</span>
          </label>
          <button onClick={handleAccept} disabled={!accepted || loading}
            className="mt-4 w-full py-2.5 rounded-lg text-white text-sm font-medium disabled:opacity-40"
            style={{ background: '#0078d2' }}>
            {loading ? 'Accepting...' : 'Accept and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}

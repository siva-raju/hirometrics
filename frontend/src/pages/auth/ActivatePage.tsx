import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { authApi } from '../../services/api';

export default function ActivatePage() {
  const { code } = useParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    if (!code) { setStatus('error'); return; }
    authApi.activate(code).then(() => setStatus('success')).catch(() => setStatus('error'));
  }, [code]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center max-w-md">
        {status === 'loading' && <p className="text-gray-600">Activating your account...</p>}
        {status === 'success' && (<>
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account activated!</h2>
          <p className="text-gray-600 mb-4">Your account is now active. You can log in.</p>
          <Link to="/login" className="px-6 py-2 text-white rounded-lg text-sm" style={{ background: '#0078d2' }}>Go to login</Link>
        </>)}
        {status === 'error' && (<>
          <div className="text-5xl mb-4">❌</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invalid link</h2>
          <p className="text-gray-600">This activation link is invalid or has already been used.</p>
        </>)}
      </div>
    </div>
  );
}

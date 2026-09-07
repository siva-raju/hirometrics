import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { applicantApi } from '../../services/api';

export default function ApplyViaLinkPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleOK = async () => {
    if (!user) {
      navigate(`/login?redirect=/apply/${token}`);
      return;
    }
    setLoading(true); setError('');
    try {
      const r = await applicantApi.claimJobLink(token!);
      const roleType = r.data.role_type;
      if (roleType === 'employer') {
        navigate('/employer/inbox');
      } else {
        navigate('/applicant/inbox');
      }
    } catch (e: any) {
      const detail = e.response?.data?.detail || '';
      if (detail.includes('Already')) {
        const role = user?.role;
        navigate(role === 'customer_admin' || role === 'customer_manager'
          ? '/employer/inbox' : '/applicant/inbox');
        return;
      }
      setError(detail || 'Could not add to inbox. Please try again.');
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f0f4f8, #e6f3fb)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#0078d2' }}>
            <span className="text-white text-sm font-bold">HM</span>
          </div>
          <div className="font-bold text-gray-900">HiroMetrics</div>
        </div>

        <div className="card">
          {/* Not logged in */}
          {!user ? (
            <div>
              <p className="text-sm text-gray-700 mb-5">
                Please log in to your HiroMetrics account to continue.
              </p>
              <div className="flex gap-3">
                <button onClick={handleCancel} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={() => navigate(`/login?redirect=/apply/${token}`)}
                  className="btn-primary flex-1">
                  Log in
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Simple confirmation message */}
              <p className="text-sm text-gray-700 mb-6">
                The job you have selected via the job link will be added to your inbox.
              </p>

              {error && <div className="alert-error mb-4 text-sm">{error}</div>}

              <div className="flex gap-3">
                <button onClick={handleCancel} disabled={loading}
                  className="btn-secondary flex-1">
                  Cancel
                </button>
                <button onClick={handleOK} disabled={loading}
                  className="btn-primary flex-1">
                  {loading ? 'Adding...' : 'OK'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../services/api';

export default function RegisterEmployerPage() {
  const [form, setForm] = useState({ first_name:'', last_name:'', email:'', password:'', org_name:'', org_code:'', industry_type:'' });
  const [step, setStep] = useState<'form'|'verify'>('form');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await authApi.registerEmployer(form);
      setStep('verify');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally { setLoading(false); }
  };

  if (step === 'verify') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center max-w-md">
        <div className="text-5xl mb-4">📧</div>
        <h2 className="text-xl font-bold mb-2">Verify your email</h2>
        <p className="text-gray-600 text-sm">Check <strong>{form.email}</strong> and click the verification link.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          <img src="/brand/hm-logo-64.png" alt="HiroMetrics" className="h-12 w-12 mb-3" />
          <h1 className="text-xl font-bold">Register as Employer</h1>
        </div>
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>}
        <div className="bg-blue-50 text-blue-700 text-xs px-4 py-3 rounded-lg mb-5">
          All users in your organization must register with <strong>@{form.email.split('@')[1] || 'yourcompany.com'}</strong> email addresses.
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">First name *</label>
              <input required value={form.first_name} onChange={e => setForm(p=>({...p,first_name:e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Last name *</label>
              <input required value={form.last_name} onChange={e => setForm(p=>({...p,last_name:e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Work email * <span className="text-gray-400 font-normal">(sets org domain)</span></label>
            <input type="email" required value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
            <input type="password" required minLength={8} value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Organization name *</label>
              <input required value={form.org_name} onChange={e => setForm(p=>({...p,org_name:e.target.value}))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Org code *</label>
              <input required value={form.org_code} onChange={e => setForm(p=>({...p,org_code:e.target.value.toUpperCase()}))}
                placeholder="ACME" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-medium"
            style={{ background: '#0078d2' }}>
            {loading ? 'Creating...' : 'Create organization'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already registered? <Link to="/login" className="text-blue-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

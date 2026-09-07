import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { notifApi } from '../../services/api';

const TARGET_OPTIONS = [
  { value: '', label: 'All users' },
  { value: 'applicant', label: 'Candidates only' },
  { value: 'customer_manager', label: 'Customer managers only' },
  { value: 'customer_admin', label: 'Customer admins only' },
  { value: 'hm_analyst', label: 'HM Analysts only' },
];

const TYPE_OPTIONS = [
  { value: 'system_alert', label: 'System alert', icon: '⚠️', desc: 'Outages, downtime, urgent notices' },
  { value: 'platform_update', label: 'Platform update', icon: '🚀', desc: 'New features, releases' },
  { value: 'informational', label: 'Informational', icon: 'ℹ️', desc: 'General information' },
  { value: 'action_required', label: 'Action required', icon: '📋', desc: 'User must take action' },
];

export default function AdminNotifications() {
  const [form, setForm] = useState({ title: '', body: '', notification_type: 'informational', target_role: '' });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const sendMutation = useMutation({
    mutationFn: (data: typeof form) => notifApi.create({ ...data, target_role: data.target_role || null }),
    onSuccess: () => { setSent(true); setForm({ title: '', body: '', notification_type: 'informational', target_role: '' }); setError(''); },
    onError: (e: any) => setError(e.response?.data?.detail || e.message || 'Failed to send notification'),
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSent(false);
    if (!form.title.trim() || !form.body.trim()) return setError('Title and message are required');
    sendMutation.mutate(form);
  };

  const selectedType = TYPE_OPTIONS.find(t => t.value === form.notification_type);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium text-gray-900">Send Notification</h1>
        <p className="text-sm text-gray-500 mt-1">Broadcast a message to platform users</p>
      </div>

      {sent && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#eaf3de', color: '#27500a' }}>
          ✓ Notification sent successfully.
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Form */}
        <div className="col-span-2">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 p-6">
            <div className="text-sm font-medium text-gray-700 mb-4">Compose notification</div>

            {/* Type picker */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2">Notification type</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map(t => (
                  <button key={t.value} type="button" onClick={() => setForm(f => ({ ...f, notification_type: t.value }))}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      form.notification_type === t.value
                        ? 'border-blue-400 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className="text-sm">{t.icon} <span className="font-medium">{t.label}</span></div>
                    <div className="text-xs text-gray-400 mt-0.5">{t.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Target audience</label>
              <select value={form.target_role} onChange={set('target_role')}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400">
                {TARGET_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={form.title} onChange={set('title')} placeholder="e.g. Scheduled maintenance — Sunday 2am–4am EST"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400" />
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
              <textarea value={form.body} onChange={set('body')} rows={5}
                placeholder="Write the notification message here..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none" />
            </div>

            {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: '#fcebeb', color: '#791f1f' }}>{error}</div>}

            <button type="submit" disabled={sendMutation.isPending}
              className="px-5 py-2 rounded-lg text-sm text-white font-medium disabled:opacity-50"
              style={{ background: '#0078d2' }}>
              {sendMutation.isPending ? 'Sending...' : '📢 Send notification'}
            </button>
          </form>
        </div>

        {/* Preview */}
        <div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">Preview</div>
            {form.title || form.body ? (
              <div className="rounded-lg border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                    style={{ background: '#e6f3fb' }}>
                    {selectedType?.icon}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{form.title || 'Notification title'}</div>
                    <div className="text-xs text-gray-500 mt-1 leading-relaxed">{form.body || 'Message body...'}</div>
                    <div className="mt-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {selectedType?.label}
                      </span>
                      <span className="text-xs text-gray-400 ml-2">
                        → {TARGET_OPTIONS.find(o => o.value === form.target_role)?.label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 text-center py-6">
                Fill in the form to see a preview
              </div>
            )}
          </div>

          <div className="mt-4 bg-white rounded-xl border border-gray-100 p-5">
            <div className="text-sm font-medium text-gray-700 mb-3">Notification rules</div>
            <ul className="text-xs text-gray-500 space-y-1.5">
              <li>• Notifications appear in each user's bell menu</li>
              <li>• Users can mark as read or delete</li>
              <li>• Deletions are soft — HM retains audit records</li>
              <li>• System notifications are generated automatically by platform events</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

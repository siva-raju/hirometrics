import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifApi } from '../../services/api';

const TYPE_CFG: Record<string, { bg: string; icon: string }> = {
  system_alert:   { bg: '#fcebeb', icon: '⚠' },
  platform_update:{ bg: '#faeeda', icon: '📢' },
  action_required:{ bg: '#e6f1fb', icon: '📨' },
  informational:  { bg: '#eaf3de', icon: 'ℹ' },
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: () => notifApi.list({ unread_only: unreadOnly }).then(r => Array.isArray(r.data) ? r.data : [])
  });

  const markRead = useMutation({ mutationFn: (id: string) => notifApi.markRead(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const markAll = useMutation({ mutationFn: () => notifApi.markAllRead(), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
  const deleteN = useMutation({ mutationFn: (id: string) => notifApi.delete(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-medium">Notifications</h1>
        <div className="flex gap-3">
          <button onClick={() => setUnreadOnly(p => !p)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${unreadOnly ? 'text-white border-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
            style={unreadOnly ? { background: '#0078d2' } : {}}>
            Unread only
          </button>
          <button onClick={() => markAll.mutate()}
            className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
            Mark all read
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading && <div className="p-5 text-sm text-gray-400">Loading...</div>}
        {!isLoading && notifications?.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <p className="text-sm text-gray-500">{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</p>
          </div>
        )}
        {notifications?.map((n: any) => {
          const cfg = TYPE_CFG[n.notification_type] || TYPE_CFG.informational;
          return (
            <div key={n.id} className={`flex gap-4 p-4 border-b border-gray-50 last:border-b-0 ${n.is_read ? 'opacity-65' : ''}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0" style={{ background: cfg.bg }}>
                {cfg.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className={`text-sm ${n.is_read ? '' : 'font-medium'}`}>{n.title}</div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-400">{n.created_at?.slice(0,10)}</span>
                    {!n.is_read && (
                      <button onClick={() => markRead.mutate(n.id)} className="text-xs text-blue-500 hover:underline">Mark read</button>
                    )}
                    <button onClick={() => deleteN.mutate(n.id)} className="text-xs text-gray-400 hover:text-red-400">✕</button>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">{n.body}</div>
                <span className="text-xs mt-1 inline-block px-2 py-0.5 rounded bg-gray-100 text-gray-500">{n.notification_type?.replace(/_/g,' ')}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

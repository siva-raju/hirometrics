import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { employerApi } from '../../services/api';

export default function EmployerInbox() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [movingId, setMovingId] = useState<string|null>(null);
  const { data: inbox, isLoading } = useQuery({
    queryKey: ['inbox'],
    queryFn: () => employerApi.getFolderApps('', undefined).catch(() => ({ data: [] })).then(r => r.data || [])
  });
  const { data: folders } = useQuery({ queryKey: ['folders'], queryFn: () => employerApi.getFolders().then(r => r.data) });

  const moveApp = useMutation({
    mutationFn: ({ appId, folderId }: any) => employerApi.moveToFolder(appId, folderId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['inbox'] }); setMovingId(null); }
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium">Inbox</h1>
          <p className="text-sm text-gray-500 mt-1">Incoming candidate profiles</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading && <div className="p-5 text-sm text-gray-400">Loading...</div>}
        {!isLoading && inbox?.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm text-gray-500">Your inbox is empty</p>
            <p className="text-xs text-gray-400 mt-1">Candidates will appear here when they share their profile or accept your invitation</p>
          </div>
        )}
        {inbox?.map((app: any) => (
          <div key={app.id} className="p-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0"
                   style={{ background: '#e6f3fb', color: '#0078d2' }}>
                {app.candidate?.first_name?.[0]}{app.candidate?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{app.candidate?.first_name} {app.candidate?.last_name}</div>
                <div className="text-xs text-gray-500">{app.candidate?.email} · via {app.flow_type?.replace(/_/g,' ')}</div>
                <div className="text-xs text-gray-400 mt-0.5">Received {app.received_at?.slice(0,10)}</div>
              </div>
              <div className="flex gap-2">
                <a href={`/verified/${app.share_token_id}`} target="_blank" rel="noreferrer"
                   className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  View profile
                </a>
                {movingId === app.id ? (
                  <select className="text-xs px-2 py-1.5 border border-blue-200 rounded-lg bg-white"
                    onChange={e => moveApp.mutate({ appId: app.id, folderId: e.target.value })}>
                    <option>Select folder...</option>
                    {folders?.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                ) : (
                  <button onClick={() => setMovingId(app.id)}
                    className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: '#0078d2' }}>
                    Move to folder
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { employerApi } from '../../services/api';

export default function EmployerArchive() {
  const qc = useQueryClient();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders-archived'],
    queryFn: () => employerApi.getFolders(true).then(r =>
      r.data.filter((f: any) => f.status === 'archived' || f.is_archived)
    )
  });

  const restoreFolder = useMutation({
    mutationFn: (id: string) => employerApi.restoreFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders-archived'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
    }
  });

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="page-title">Archive</h1>
        <p className="page-subtitle">Archived job folders — activate to move back to Job Folders</p>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm p-8">Loading...</div>
      ) : folders.length === 0 ? (
        <div className="card empty-state py-12">
          <div className="empty-state-icon text-3xl">🗄️</div>
          <p className="text-sm font-semibold text-gray-500">No archived folders</p>
          <p className="text-xs text-gray-400 mt-1">Folders you archive from Job Folders will appear here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder: any) => (
            <div key={folder.id} className="card" style={{ opacity: 0.8 }}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm font-bold text-gray-500">{folder.name}</span>
                    <span className="badge text-[11px]" style={{ background: '#fcebeb', color: '#791f1f' }}>Archived</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-700 mb-0.5">{folder.position_title}</div>
                  {folder.description && (
                    <p className="text-xs text-gray-400 line-clamp-1 max-w-2xl">{folder.description}</p>
                  )}
                  {folder.archived_at && (
                    <div className="text-xs text-gray-400 mt-1">
                      Archived: {new Date(folder.archived_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => restoreFolder.mutate(folder.id)}
                  disabled={restoreFolder.isPending}
                  className="btn-primary text-xs flex-shrink-0 ml-4"
                  style={{ background: '#78b41e' }}>
                  ↩ Activate
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

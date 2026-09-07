import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerApi } from '../../services/api';

const STATUS_CFG: Record<string, { bg: string; color: string }> = {
  received:       { bg: '#f5f5f5',  color: '#5f5e5a' },
  under_review:   { bg: '#e6f1fb',  color: '#0c447c' },
  shortlisted:    { bg: '#faeeda',  color: '#633806' },
  not_proceeding: { bg: '#fcebeb',  color: '#791f1f' },
  submitted_up:   { bg: '#e1f5ee',  color: '#085041' },
  selected:       { bg: '#eaf3de',  color: '#27500a' },
};

function ArchivedFolderDetail({ folder, onBack }: { folder: any; onBack: () => void }) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [chainAppId, setChainAppId] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['folder-apps-archived', folder.id],
    queryFn: () => employerApi.getFolderApps(folder.id).then(r => r.data),
  });

  const handleViewProfile = (app: any) => {
    if (app.share_token) {
      window.open(`/verified/${app.share_token}`, '_blank');
    } else {
      alert('No profile snapshot available for this application.');
    }
  };

  const handleResume = async (app: any, download: boolean) => {
    try {
      const token = JSON.parse(localStorage.getItem('hirometrics-auth') || '{}')?.state?.accessToken;
      const res = await fetch(`/api/v1/applications/${app.id}/resume`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert('Resume not available'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      if (download) {
        const cd = res.headers.get('content-disposition') || '';
        const match = cd.match(/filename[^;=\n]*=(['"]?)([^'"\n]*)\\1/);
        a.download = match?.[2] || 'resume.pdf';
      } else {
        a.target = '_blank';
      }
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Failed to load resume'); }
  };

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
            ← Back to Archive
          </button>
          <div className="flex items-center gap-2 mb-1">
            <div className="font-mono text-xs font-bold tracking-widest" style={{ color: 'var(--hm-blue)' }}>
              {folder.position_code || folder.name}
            </div>
            <span className="badge badge-gray text-xs">Archived</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">{folder.position_title || folder.name}</h1>
          {folder.description && (
            <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">{folder.description}</p>
          )}
        </div>
        <div className="p-3 rounded-xl text-xs text-amber-700 font-medium"
          style={{ background: '#fef9e7', border: '1px solid #f0b400' }}>
          🔒 View only — folder is archived
        </div>
      </div>

      {/* Folder details card */}
      {(folder.skill_set || folder.location || folder.work_mode || folder.duration || folder.job_start_date || folder.work_auth_required) && (
        <div className="card mb-5 grid grid-cols-2 gap-4 text-sm">
          {folder.skill_set && (
            <div><div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Skill Set</div>
              <div className="text-gray-700">{folder.skill_set}</div></div>
          )}
          {folder.location && (
            <div><div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Location</div>
              <div className="text-gray-700">{folder.location}</div></div>
          )}
          {folder.work_mode && (
            <div><div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Work Mode</div>
              <div className="text-gray-700">{folder.work_mode}</div></div>
          )}
          {folder.duration && (
            <div><div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Duration</div>
              <div className="text-gray-700">{folder.duration}</div></div>
          )}
          {folder.job_start_date && (
            <div><div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Start Date</div>
              <div className="text-gray-700">{folder.job_start_date}</div></div>
          )}
          {folder.work_auth_required && (
            <div><div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Work Auth Required</div>
              <div className="text-gray-700">{folder.work_auth_required}</div></div>
          )}
        </div>
      )}

      {/* Applications table — read-only */}
      <div className="card p-0 overflow-visible">
        <div className="overflow-x-auto">
          <table className="hm-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Submitted By</th>
                <th>Organization</th>
                <th>Received</th>
                <th>Status</th>
                <th className="text-center w-28">Consistency</th>
                <th>Actions</th>
                <th className="w-12 text-center">More</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-gray-400 text-sm text-center">Loading...</td></tr>
              )}
              {!isLoading && apps.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No applications were received for this folder.
                </td></tr>
              )}
              {apps.map((app: any) => {
                const cfg = STATUS_CFG[app.status] || STATUS_CFG.received;
                const score = app.consistency_score || 'green';
                const icon = score === 'red' ? '🔴' : score === 'yellow' ? '🟡' : '🟢';
                return (
                  <>
                  <tr key={app.id}>
                    <td>
                      <div className="font-semibold text-sm text-gray-900">
                        {app.candidate?.first_name} {app.candidate?.last_name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{app.candidate?.email}</div>
                    </td>
                    <td>
                      <div className="text-sm font-medium text-gray-800">{app.submitted_by?.name || '—'}</div>
                    </td>
                    <td>
                      <span className={`badge ${app.submitted_by_org === 'Candidate' ? 'badge-blue' : 'badge-amber'}`}>
                        {app.submitted_by_org || 'Candidate'}
                      </span>
                    </td>
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {app.received_at?.slice(0, 10)}
                    </td>
                    {/* Status — read-only badge, no dropdown */}
                    <td>
                      <span className="text-xs px-3 py-1 rounded-full font-semibold"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {app.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="text-center">
                      <span className="text-lg leading-none" title={score}>{icon}</span>
                    </td>
                    {/* Actions — view profile + resume only */}
                    <td>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleViewProfile(app)}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                          title="View profile">
                          👤 Profile
                        </button>
                        <button
                          onClick={() => handleResume(app, false)}
                          className="text-xs px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
                          title="View resume">
                          📄 Resume
                        </button>
                      </div>
                    </td>
                    {/* Expand toggle */}
                    <td className="text-center">
                      <button
                        onClick={() => setExpandedRow(expandedRow === app.id ? null : app.id)}
                        className="text-blue-500 hover:text-blue-700 text-sm w-6 h-6 flex items-center justify-center rounded transition-all"
                        title="View details">
                        <span style={{ display: 'inline-block', transition: 'transform 0.2s', transform: expandedRow === app.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </button>
                    </td>
                  </tr>
                  {/* Expanded detail row — read-only */}
                  {expandedRow === app.id && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div className="px-6 py-4 border-t border-blue-100" style={{ background: '#f8fafc' }}>
                          <div className="grid grid-cols-3 gap-6">
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Contact</div>
                              <div className="space-y-1">
                                <div>
                                  <span className="text-xs text-gray-400">Email: </span>
                                  <span className="text-xs text-gray-700">{app.submitted_by?.email || '—'}</span>
                                </div>
                                <div>
                                  <span className="text-xs text-gray-400">Phone: </span>
                                  <span className="text-xs text-gray-700">{app.submitted_by?.phone || '—'}</span>
                                </div>
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Message / Cover Letter</div>
                              <div className="text-xs text-gray-700 leading-relaxed min-h-[40px] px-2 py-1.5 rounded-lg"
                                style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                                {app.cover_message || <span className="text-gray-300 italic">No message provided</span>}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Internal Notes</div>
                              <div className="text-xs text-gray-700 leading-relaxed min-h-[40px] px-2 py-1.5 rounded-lg"
                                style={{ background: 'white', border: '1px solid #e2e8f0' }}>
                                {app.internal_notes || <span className="text-gray-300 italic">No notes</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function EmployerArchive() {
  const qc = useQueryClient();
  const [viewingFolder, setViewingFolder] = useState<any | null>(null);

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ['folders-archived'],
    queryFn: () => employerApi.getFolders(true).then(r =>
      r.data.filter((f: any) => f.status === 'archived' || f.is_archived)
    ),
  });

  const restoreFolder = useMutation({
    mutationFn: (id: string) => employerApi.restoreFolder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['folders-archived'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      setViewingFolder(null);
    },
  });

  // If a folder is selected, show its read-only detail view
  if (viewingFolder) {
    return (
      <ArchivedFolderDetail
        folder={viewingFolder}
        onBack={() => setViewingFolder(null)}
      />
    );
  }

  if (isLoading) return null;

  return (
    <div className="fade-in">
      <div className="mb-6">
        <h1 className="page-title">Archive</h1>
        <p className="page-subtitle">Archived job folders — view only</p>
      </div>

      {folders.length === 0 ? (
        <div className="card empty-state py-12">
          <p className="text-sm text-gray-500">No archived folders</p>
        </div>
      ) : (
        <div className="space-y-3">
          {folders.map((folder: any) => (
            <div key={folder.id} className="card">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-bold text-gray-500">{folder.name}</div>
                  <div className="text-sm font-semibold text-gray-700 mt-0.5">{folder.position_title}</div>
                  {folder.description && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1 max-w-xl">{folder.description}</p>
                  )}
                  {folder.archived_at && (
                    <div className="text-xs text-gray-400 mt-1">
                      Archived {new Date(folder.archived_at).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4 flex-shrink-0">
                  <button
                    onClick={() => setViewingFolder(folder)}
                    className="btn-secondary text-xs">
                    👁 View
                  </button>
                  <button
                    onClick={() => restoreFolder.mutate(folder.id)}
                    disabled={restoreFolder.isPending}
                    className="btn-primary text-xs"
                    style={{ background: '#78b41e' }}>
                    ↩ Activate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

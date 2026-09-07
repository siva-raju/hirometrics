import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { applicantApi } from '../../services/api';

interface LinkItem {
  id: string;
  folder_id: string;
  position_title: string;
  position_code: string | null;
  description: string | null;
  location: string | null;
  work_mode: string | null;
  status: string;
  added_at: string;
}

// ── View Modal ────────────────────────────────────────────────────────────────
function ViewModal({ item, onClose }: { item: LinkItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg scale-in">
        <div className="p-6 border-b border-gray-100 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#78b41e' }}>
              🔗 Job Link
            </div>
            <h2 className="text-lg font-bold text-gray-900">{item.position_title}</h2>
            {item.position_code && (
              <div className="font-mono text-xs text-gray-400 mt-0.5">{item.position_code}</div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl ml-4">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {item.location && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Location</div>
              <div className="text-sm text-gray-800">📍 {item.location}</div>
            </div>
          )}
          {item.work_mode && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Work Mode</div>
              <div className="text-sm text-gray-800">{item.work_mode}</div>
            </div>
          )}
          {item.description && (
            <div>
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Job Description</div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{item.description}</p>
            </div>
          )}
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Added</div>
            <div className="text-sm text-gray-600">{new Date(item.added_at).toLocaleDateString()}</div>
          </div>
        </div>
        <div className="p-6 pt-0">
          <button onClick={onClose} className="btn-secondary w-full">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Create Folder Modal ───────────────────────────────────────────────────────
function CreateFolderModal({
  item, onConfirm, onClose
}: {
  item: LinkItem;
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [folderName, setFolderName] = useState(item.position_code || '');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Create Job Folder</h3>
          <p className="text-xs text-gray-500 mt-1">
            Creates a new folder in your organization linked to{' '}
            <strong>{item.position_title}</strong>.
          </p>
        </div>
        <div className="p-6">
          <label className="label">
            Position Code / Folder Name <span className="text-red-400">*</span>
          </label>
          <input
            className="input font-mono"
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            placeholder="e.g. SAP-SD-SR-042026"
            autoFocus
          />
          <p className="text-[11px] text-gray-400 mt-1">
            This becomes your internal tracking code. Must be unique within your organization.
          </p>
        </div>
        <div className="p-6 pt-0 flex gap-3">
          <button
            className="btn-primary flex-1"
            disabled={!folderName.trim() || submitting}
            onClick={async () => {
              setSubmitting(true);
              await onConfirm(folderName.trim());
            }}>
            {submitting ? 'Creating...' : 'OK — Create Folder'}
          </button>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirmModal({ item, onConfirm, onClose }: {
  item: LinkItem;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm scale-in">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Delete job link?</h3>
          <p className="text-sm text-gray-500 mt-1">
            This will remove <strong>{item.position_title}</strong> from your inbox.
            You can re-add it by clicking the original link again.
          </p>
        </div>
        <div className="p-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="btn-primary flex-1 text-sm"
            style={{ background: '#dc2626' }}>
            Yes, delete
          </button>
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Employer Inbox ────────────────────────────────────────────────────────────
export default function EmployerInbox() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [viewItem, setViewItem] = useState<LinkItem | null>(null);
  const [createFolderItem, setCreateFolderItem] = useState<LinkItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<LinkItem | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['employer-job-links'],
    queryFn: () => applicantApi.getMyJobLinks().then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => applicantApi.removeJobLink(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employer-job-links'] });
      setDeleteItem(null);
      showToast('Job link removed from inbox');
    },
    onError: () => showToast('Failed to remove', 'error'),
  });

  const createFolderMutation = useMutation({
    mutationFn: ({ itemId, name }: { itemId: string; name: string }) =>
      applicantApi.createFolderFromLink(itemId, name),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['employer-job-links'] });
      qc.invalidateQueries({ queryKey: ['folders'] });
      setCreateFolderItem(null);
      showToast(`Folder "${r.data.folder_name}" created successfully ✓`);
      setTimeout(() => navigate('/employer/folders'), 1500);
    },
    onError: (e: any) => showToast(e.response?.data?.detail || 'Failed to create folder', 'error'),
  });

  const pendingItems = items.filter((i: LinkItem) => i.status === 'pending');

  return (
    <div className="max-w-5xl fade-in">
      {/* Modals */}
      {viewItem && <ViewModal item={viewItem} onClose={() => setViewItem(null)} />}
      {createFolderItem && (
        <CreateFolderModal
          item={createFolderItem}
          onConfirm={name => createFolderMutation.mutateAsync({ itemId: createFolderItem.id, name })}
          onClose={() => setCreateFolderItem(null)}
        />
      )}
      {deleteItem && (
        <DeleteConfirmModal
          item={deleteItem}
          onConfirm={() => deleteMutation.mutate(deleteItem.id)}
          onClose={() => setDeleteItem(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="page-title">Inbox</h1>
        <p className="page-subtitle">Job links shared with you</p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-semibold flex justify-between ${
          toast.type === 'success'
            ? 'bg-green-50 text-green-800 border border-green-200'
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          <span>{toast.type === 'success' ? '✓' : '⚠'} {toast.text}</span>
          <button onClick={() => setToast(null)} className="opacity-50 hover:opacity-100">✕</button>
        </div>
      )}

      {isLoading ? null : pendingItems.length === 0 ? (
        <div className="card empty-state py-16">
          <div className="empty-state-icon text-4xl">📭</div>
          <p className="text-sm font-semibold text-gray-500 mt-3">Your inbox is empty</p>
          <p className="text-xs text-gray-400 mt-1">
            Job links shared with you will appear here. Click a job link URL to add it.
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="hm-table">
            <thead>
              <tr>
                <th className="w-20">Type</th>
                <th>Job Title</th>
                <th>Location</th>
                <th className="w-28">Date Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pendingItems.map((item: LinkItem) => (
                <tr key={item.id}>
                  {/* Type badge */}
                  <td>
                    <span className="badge text-[11px] font-bold"
                      style={{ background: '#eef6db', color: '#3a5a0d' }}>
                      🔗 Link
                    </span>
                  </td>

                  {/* Job Title */}
                  <td>
                    <div className="font-semibold text-sm text-gray-900">{item.position_title}</div>
                    {item.position_code && (
                      <div className="text-xs font-mono text-gray-400">{item.position_code}</div>
                    )}
                  </td>

                  {/* Location */}
                  <td className="text-sm text-gray-600">
                    {item.location || <span className="text-gray-300">—</span>}
                    {item.work_mode && (
                      <span className="ml-1 text-xs text-gray-400">· {item.work_mode}</span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(item.added_at).toLocaleDateString('en-US', {
                      month: '2-digit', day: '2-digit', year: '2-digit'
                    })}
                  </td>

                  {/* Actions */}
                  <td>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* View */}
                      <button
                        onClick={() => setViewItem(item)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                        style={{ background: '#f0f7ff', color: '#185fa5', border: '1px solid #bdd7f5' }}>
                        View
                      </button>

                      {/* Create Folder */}
                      <button
                        onClick={() => setCreateFolderItem(item)}
                        className="btn-primary text-xs py-1.5">
                        Create Folder
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteItem(item)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
                        style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 px-4 py-3 rounded-xl text-xs text-gray-400 italic"
        style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <strong className="text-gray-500">Link</strong> = a job link URL was shared with you ·{' '}
        Click <strong className="text-gray-500">Create Folder</strong> to open a job folder in your organization for this position
      </div>
    </div>
  );
}

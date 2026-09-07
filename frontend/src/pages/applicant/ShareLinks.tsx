import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { applicantApi } from '../../services/api';

export default function ApplicantShareLinks() {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [expiresDays, setExpiresDays] = useState(90);
  const [success, setSuccess] = useState('');

  const { data: links, isLoading } = useQuery({
    queryKey: ['my-links'],
    queryFn: () => applicantApi.getShareLinks().then(r => r.data)
  });

  const generate = useMutation({
    mutationFn: () => applicantApi.generateShareLink({ label, expires_days: expiresDays }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['my-links'] });
      setLabel(''); setSuccess(`Link generated! Share: ${window.location.origin}${res.data.share_url}`);
    }
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => applicantApi.deactivateLink(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-links'] })
  });

  const copy = (url: string) => { navigator.clipboard.writeText(`${window.location.origin}${url}`); };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-medium">Share links</h1>
        <p className="text-sm text-gray-500 mt-1">Generate secure links to your verified profile</p>
      </div>

      {/* How it works */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800">
        <div className="font-medium mb-2">How share links work</div>
        <ul className="space-y-1 text-xs">
          <li>• Your profile is <strong>frozen at time of sharing</strong> — employers always see the version you submitted</li>
          <li>• Employers can view the link without logging in</li>
          <li>• You control how long each link stays active</li>
          <li>• Deactivate any link at any time</li>
        </ul>
      </div>

      {/* Generate */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
        <div className="text-sm font-medium text-gray-700 mb-4">Generate new share link</div>
        {success && <div className="bg-green-50 text-green-700 text-xs px-4 py-3 rounded-lg mb-4 border border-green-100">{success}</div>}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Label (optional)</label>
            <input value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Sent to Acme Corp"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Expires in</label>
            <select value={expiresDays} onChange={e => setExpiresDays(+e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:border-blue-400">
              <option value={90}>3 months</option>
              <option value={180}>6 months</option>
              <option value={270}>9 months</option>
            </select>
          </div>
          <div className="flex items-end">
            <button onClick={() => generate.mutate()} disabled={generate.isPending}
              className="px-4 py-2 rounded-lg text-white text-sm disabled:opacity-50"
              style={{ background: '#0078d2' }}>
              🔗 Generate
            </button>
          </div>
        </div>
      </div>

      {/* Links list */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        {isLoading && <div className="p-5 text-sm text-gray-400">Loading...</div>}
        {!isLoading && (!links || links.length === 0) && (
          <div className="p-8 text-center text-sm text-gray-400">
            No share links yet. Generate your first one above.
          </div>
        )}
        {links?.map((link: any) => (
          <div key={link.id} className="p-4 border-b border-gray-50 last:border-b-0">
            <div className="flex items-start gap-3">
              <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${link.is_active ? 'bg-green-400' : 'bg-gray-300'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{link.label || 'Untitled link'}</span>
                  {!link.is_active && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">Inactive</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {window.location.origin}{link.share_url}
                </div>
                <div className="text-xs text-gray-400 mt-1 flex gap-4">
                  <span>👁 {link.view_count} views</span>
                  {link.expires_at && <span>Expires {link.expires_at.slice(0,10)}</span>}
                  <span>Created {link.created_at.slice(0,10)}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => copy(link.share_url)}
                  className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50">
                  Copy
                </button>
                {link.is_active && (
                  <button onClick={() => deactivate.mutate(link.id)}
                    className="text-xs px-3 py-1.5 border border-red-100 text-red-500 rounded-lg hover:bg-red-50">
                    Deactivate
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

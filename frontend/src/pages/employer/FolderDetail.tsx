import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employerApi } from '../../services/api';

const STATUS_OPTS = ['received','under_review','shortlisted','not_proceeding','selected'];
const STATUS_CFG: Record<string, { bg: string; color: string }> = {
  received:       { bg: '#f5f5f5',  color: '#5f5e5a' },
  under_review:   { bg: '#e6f1fb',  color: '#0c447c' },
  shortlisted:    { bg: '#faeeda',  color: '#633806' },
  not_proceeding: { bg: '#fcebeb',  color: '#791f1f' },
  submitted_up:   { bg: '#e1f5ee',  color: '#085041' },
  selected:       { bg: '#eaf3de',  color: '#27500a' },
};

function ChainModal({ appId, candidateName, currentOrgName, appStatus, onClose }: {
  appId: string; candidateName?: string; currentOrgName?: string; appStatus?: string; onClose: () => void;
}) {
  const { data: chain = [], isLoading } = useQuery({
    queryKey: ['genealogy', appId],
    queryFn: () => employerApi.getGenealogy(appId).then(r => r.data),
  });

  // ── Build breadcrumb nodes ────────────────────────────────────────────────
  // Chain from API: each entry has { chain_depth, org_name, next_org_name, status }
  //   org_name     = the org that SUBMITTED at this depth
  //   next_org_name = the org that RECEIVED the submission (set when status=submitted_up)
  //
  // Display rules:
  //   Northbridge (submitted to Global Staffing):
  //     Sees: Jimmer → Northbridge → Global Staffing      (stops at destination)
  //
  //   Global Staffing (submitted to MFGCo):
  //     Sees: Jimmer → Northbridge → Global Staffing → MFGCo
  //
  //   MFGCo (end client, received only — did NOT submit up):
  //     Sees: Jimmer → Northbridge → Global Staffing      (does NOT see themselves)

  const sorted = [...chain].sort((a: any, b: any) => a.chain_depth - b.chain_depth);

  // Find my tier = the depth where I am the submitting org
  // currentOrgName = the org that owns the current folder
  // resolvedOrgName = who we are:
  // - If currentOrgName provided (folder_org_name) → use it directly
  // - If not provided but submitted_by_org passed → already filtered in parent (not "Candidate")
  // - If undefined (Northbridge case: submitted_by_org="Candidate") → depth-0 org_name
  const resolvedOrgName = currentOrgName ?? sorted[0]?.org_name;
  const myTier = sorted.find((t: any) => t.org_name === resolvedOrgName);
  // End client if: app status is 'received' (they never submitted up)
  // OR no matching tier found in genealogy
  const iAmEndClient = appStatus === 'received' || !myTier || myTier.status !== 'submitted_up';

  // Collect orgs in order, stopping at the right point:
  // - Submitter: collect up to and including MY tier, then add my destination (next_org_name)
  // - End client: collect all tiers EXCEPT myself (I don't appear in my own chain)
  const breadcrumbOrgs: { label: string; isEnd: boolean }[] = [];

  if (iAmEndClient) {
    // End client (MFGCo): show the chain of submitters but NOT themselves
    // org_name = folder owner at each tier, submitted_by = who sent it
    // Breadcrumb = each tier's submitted_by org in order
    sorted.filter((t: any) => t.status === 'submitted_up').forEach((t: any) => {
      const label = t.submitted_by || t.org_name;
      if (label && !breadcrumbOrgs.find(o => o.label === label)) {
        breadcrumbOrgs.push({ label, isEnd: false });
      }
    });
    // Add the last submitted_up tier's receiving org (= the last submitter's folder owner)
    // This is the last intermediary, already in the list — mark them as not-end since
    // we are the true end but don't show ourselves
  } else {
    // Submitter: show submitted_by orgs up to my depth, then add myself, then destination
    sorted.filter((t: any) => t.chain_depth < (myTier?.chain_depth ?? 0)).forEach((t: any) => {
      const label = t.submitted_by || t.org_name;
      if (label && !breadcrumbOrgs.find(o => o.label === label)) {
        breadcrumbOrgs.push({ label, isEnd: false });
      }
    });
    // Add myself (I am the current submitter)
    if (resolvedOrgName && !breadcrumbOrgs.find(o => o.label === resolvedOrgName)) {
      breadcrumbOrgs.push({ label: resolvedOrgName, isEnd: false });
    }
    // Add my destination as the end marker
    if (myTier?.next_org_name) {
      breadcrumbOrgs.push({ label: myTier.next_org_name, isEnd: true });
    }
  }

  // ── Detail row ─────────────────────────────────────────────────────────────
  // Only show if I submitted up (not end client)
  // Shows: "Submitted to: [destination] on [date]"
  const myDetailRow = iAmEndClient ? null : myTier;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl scale-in">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Submission Chain</h3>
            <p className="text-xs text-gray-400 mt-0.5">End-to-end submission path for this candidate</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="p-6">
          {isLoading ? (
            <div className="text-gray-400 text-sm">Loading chain...</div>
          ) : sorted.length === 0 ? (
            <p className="text-gray-400 text-sm">No chain data available</p>
          ) : (
            <>
              {/* Breadcrumb trail */}
              <div className="flex flex-wrap items-center gap-1 mb-6">
                {/* Candidate pill */}
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: '#1F4E79', color: '#fff' }}>
                  👤 {candidateName || sorted[0]?.candidate_name || 'Candidate'}
                </span>

                {breadcrumbOrgs.map((org, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className="text-gray-400 font-bold text-base">→</span>
                    <span className="px-3 py-1.5 rounded-full text-sm font-semibold"
                      style={org.isEnd
                        ? { background: '#166534', color: '#fff' }
                        : { background: '#0078d2', color: '#fff' }}>
                      {org.isEnd ? '🏢 ' : '🔄 '}{org.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Detail row — only for submitters */}
              {myDetailRow && (
                <div className="flex items-center gap-3 p-3 rounded-xl text-sm"
                  style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--hm-blue)' }}>↑</div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">
                      Submitted to: {myDetailRow.next_org_name || '—'}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      submitted {myDetailRow.received_at?.slice(0, 10)}
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: STATUS_CFG['submitted_up']?.bg, color: STATUS_CFG['submitted_up']?.color }}>
                    submitted up
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


function SubmitUpModal({ app, folderId, onClose, onDone }: {
  app: any;
  folderId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [targetFolderId, setTargetFolderId] = useState('');
  const [manualEmail, setManualEmail]       = useState('');
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]                   = useState('');

  const { data: targets = [] } = useQuery({
    queryKey: ['submit-up-targets', folderId],
    queryFn:  () => employerApi.getSubmitUpTargets(folderId).then(r => r.data),
  });

  const allFolders = targets.flatMap((t: any) => t.folders.map((f: any) => ({
    ...f, orgName: t.org_name,
  })));

  const handleSubmit = async () => {
    if (!targetFolderId && !manualEmail) {
      setError('Select a target folder or enter a recipient email.'); return;
    }
    setSubmitting(true); setError('');
    try {
      const token = JSON.parse(localStorage.getItem('hirometrics-auth') || '{}')?.state?.accessToken;
      const res = await fetch(`/api/v1/applications/${app.id}/submit-up`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_folder_id: targetFolderId || null,
          next_manager_email: manualEmail || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); setError(e.detail || 'Submission failed.'); setSubmitting(false); return; }
      const result = await res.json();
      alert(`✓ Submitted successfully.
Placed in: ${result.placed_in_folder || 'upstream folder'}`);
      onDone();
    } catch { setError('Network error. Please try again.'); setSubmitting(false); }
  };

  const candidate = `${app.candidate?.first_name || ''} ${app.candidate?.last_name || ''}`.trim() || 'this candidate';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md scale-in">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="font-bold text-gray-900">Submit to Upstream Folder</h3>
            <p className="text-xs text-gray-400 mt-0.5">Forward <strong>{candidate}</strong> to the next tier</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="p-5 space-y-4">
          {allFolders.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Select target folder
              </label>
              <select
                value={targetFolderId}
                onChange={e => setTargetFolderId(e.target.value)}
                className="input w-full text-sm">
                <option value="">— Choose a folder —</option>
                {allFolders.map((f: any) => (
                  <option key={f.id} value={f.id}>
                    {f.orgName} · {f.name}{f.position_title ? ` (${f.position_title})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {allFolders.length > 0 ? 'Or enter recipient email manually' : 'Recipient email (next tier manager)'}
            </label>
            <input
              type="email"
              value={manualEmail}
              onChange={e => setManualEmail(e.target.value)}
              placeholder="manager@upstream-org.com"
              className="input w-full text-sm"
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
            <button onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 text-sm">
              {submitting ? 'Submitting...' : '⬆ Submit Up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ActionMenu using fixed positioning — avoids overflow:hidden clipping from table rows
function ActionMenu({ app, onViewProfile, onChain, onDiscrepancies, onSubmitUp, onOpenPdf }: {
  app: any;
  onViewProfile: () => void;
  onChain: () => void;
  onDiscrepancies: () => void;
  onSubmitUp: () => void;
  onOpenPdf: (url: string, name: string) => void;
}) {
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const openMenu = () => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  };

  const close = () => setPos(null);

  const openWithAuth = async (url: string, filename: string, download: boolean) => {
    try {
      const token = JSON.parse(localStorage.getItem('hirometrics-auth') || '{}')?.state?.accessToken;
      const res = await fetch(`${url}?t=${Date.now()}`, { headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' } });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || 'File not available');
        return;
      }
      const blob = await res.blob();
      if (blob.size === 0) { alert('File appears empty — it may still be locked.'); return; }
      const blobUrl = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename; a.style.display = 'none';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      } else {
        // Show inline PDF viewer — avoids popup blocker entirely
        onOpenPdf(blobUrl, filename);
      }
    } catch (e) { alert('Failed to load file: ' + e); }
  };

  const handleResume = async (download: boolean) => {
    close();
    const name = app.candidate?.last_name ? `${app.candidate.last_name}_resume.pdf` : 'resume.pdf';
    await openWithAuth(`/api/v1/applications/${app.id}/resume`, name, download);
  };

  const handleReport = async (download: boolean) => {
    close();
    if (!app.discrepancy_report_url) { alert('No discrepancy report attached.'); return; }
    await openWithAuth(app.discrepancy_report_url, app.discrepancy_report_filename || 'hm_report.pdf', download);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={openMenu}
        className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold text-base select-none">
        ···
      </button>
      {pos && (
        <>
          {/* Full-screen backdrop */}
          <div className="fixed inset-0 z-[100]" onClick={close} />
          {/* Menu rendered at fixed screen position — never clipped */}
          <div className="fixed z-[101] bg-white rounded-xl shadow-2xl border border-gray-200 py-1 w-48"
            style={{ top: pos.top, right: pos.right }}>
            <button onClick={() => { close(); onViewProfile(); }}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              👤 View Profile
            </button>
            <button onClick={() => handleResume(false)}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              📄 View Resume
            </button>
            <button onClick={() => handleResume(true)}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              ⬇ Download Resume
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={() => { close(); onChain(); }}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
              🔗 View Submission Chain
            </button>
            <button onClick={() => { close(); onSubmitUp(); }}
              className="w-full text-left px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
              ⬆ Submit to Upstream
            </button>
            {app.discrepancy_report_url && (<>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={() => handleReport(false)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                🔍 View HM Report
              </button>
              <button onClick={() => handleReport(true)}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50">
                ⬇ Download HM Report
              </button>
            </>)}
            {(app.consistency_score==='yellow' || app.consistency_score==='red') && (
              <button onClick={() => { close(); onDiscrepancies(); }}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-gray-50"
                style={{ color: app.consistency_score==='red' ? '#991b1b' : '#92400e' }}>
                ⚠ View Discrepancies
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function FolderDetailPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [pdfViewer, setPdfViewer]       = useState<{ url: string; name: string } | null>(null);
  const [chainAppId, setChainAppId]     = useState<string | null>(null);
  const [chainApp, setChainApp]         = useState<any | null>(null);
  const [submitUpApp, setSubmitUpApp]   = useState<any | null>(null);
  const [discrepanciesApp, setDiscrepanciesApp] = useState<any | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showJobLink, setShowJobLink] = useState(false);
  const [jobLinkName, setJobLinkName] = useState('');

  const { data: folder } = useQuery({
    queryKey: ['folder', folderId],
    queryFn: () => employerApi.getFolders().then(r => r.data?.find((f: any) => f.id === folderId))
  });
  const { data: apps = [], isLoading } = useQuery({
    queryKey: ['folder-apps', folderId, statusFilter],
    queryFn: () => employerApi.getFolderApps(folderId!, statusFilter || undefined).then(r => r.data)
  });
  const { data: links = [] } = useQuery({
    queryKey: ['app-links', folderId],
    queryFn: () => employerApi.getAppLinks(folderId!).then(r => r.data)
  });

  const updateNotes = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) =>
      employerApi.updateNotes(id, notes),
    onSuccess: () => { setSavingNotes(null); qc.invalidateQueries({ queryKey: ['folder-apps'] }); }
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: any) => employerApi.updateAppStatus(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folder-apps'] })
  });
  const toggleFlag = useMutation({
    mutationFn: (id: string) => employerApi.toggleFlag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['folder-apps'] })
  });
  const invite = useMutation({
    mutationFn: () => employerApi.inviteCandidate({ candidate_email: inviteEmail, folder_id: folderId }),
    onSuccess: () => { setShowInvite(false); setInviteEmail(''); }
  });
  const createLink = useMutation({
    mutationFn: () => employerApi.createAppLink(folderId!, { label: 'Job advertisement' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['app-links'] })
  });

  const handleViewProfile = (app: any) => {
    if (app.share_token) {
      window.open(`/verified/${app.share_token}`, '_blank');
    } else {
      alert('Profile view not available — this application has no profile snapshot yet.');
    }
  };

  // Status counts for filter buttons
  const statusCounts = STATUS_OPTS.reduce((acc: any, s) => {
    acc[s] = apps.filter((a: any) => a.status === s).length;
    return acc;
  }, {});

  const filteredApps = statusFilter ? apps.filter((a: any) => a.status === statusFilter) : apps;

  return (
    <div className="fade-in">
      {/* Inline PDF Viewer — avoids popup blocker */}
      {pdfViewer && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-4 py-2 bg-gray-900">
            <span className="text-white text-sm font-semibold truncate">{pdfViewer.name}</span>
            <div className="flex items-center gap-3">
              <a href={pdfViewer.url} download={pdfViewer.name}
                className="text-xs text-blue-300 hover:text-blue-100 underline">
                ⬇ Download
              </a>
              <button onClick={() => { URL.revokeObjectURL(pdfViewer.url); setPdfViewer(null); }}
                className="text-white text-xl hover:text-gray-300 ml-2">✕</button>
            </div>
          </div>
          <iframe src={pdfViewer.url} className="flex-1 w-full border-0" title={pdfViewer.name} />
        </div>
      )}

      {chainAppId && chainApp && (
        <ChainModal
          appId={chainAppId}
          candidateName={`${chainApp.candidate?.first_name || ''} ${chainApp.candidate?.last_name || ''}`.trim()}
          currentOrgName={chainApp.folder_org_name || (chainApp.submitted_by_org !== 'Candidate' ? chainApp.submitted_by_org : undefined)}
          appStatus={chainApp.status}
          onClose={() => { setChainAppId(null); setChainApp(null); }}
        />
      )}
      {submitUpApp && (
        <SubmitUpModal
          app={submitUpApp}
          folderId={folderId!}
          onClose={() => setSubmitUpApp(null)}
          onDone={() => { setSubmitUpApp(null); qc.invalidateQueries({ queryKey: ['folder-apps', folderId] }); }}
        />
      )}
      {discrepanciesApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg scale-in">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Consistency Discrepancies</h3>
                <p className="text-xs text-gray-500 mt-0.5">{discrepanciesApp.candidate?.first_name} {discrepanciesApp.candidate?.last_name}</p>
              </div>
              <button onClick={() => setDiscrepanciesApp(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6">
              <div className="p-3 rounded-xl text-xs text-gray-600 leading-relaxed mb-4" style={{ background:'#fef9e7', border:'1px solid #f0b400' }}>
                <strong>Disclaimer:</strong> The discrepancies listed below are generated by an automated comparison of the candidate's submitted resume and profile data. HiroMetrics makes no representation as to the accuracy, completeness, or legal significance of these findings. This information is provided solely as a convenience to assist recipients in their independent review process. Recipients are solely responsible for verifying any discrepancies through their own due diligence. HiroMetrics expressly disclaims any liability for adverse inferences, decisions, or actions taken based on this report.
              </div>
              {(discrepanciesApp.discrepancies || []).length === 0 ? (
                <div className="text-sm text-gray-500 text-center py-4">
                  {discrepanciesApp.consistency_score === 'yellow' ? '🟡 Minor inconsistencies detected — manual review recommended' : '🔴 Significant discrepancies detected — detailed review required'}
                  <p className="text-xs text-gray-400 mt-2">Detailed discrepancy analysis will be available in a future update.</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {discrepanciesApp.discrepancies.map((d: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-500 flex-shrink-0 mt-0.5">•</span>{d}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-6 pt-0">
              <button onClick={() => setDiscrepanciesApp(null)} className="btn-secondary w-full text-xs">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/employer/folders')}
            className="text-xs text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
            ← Back to folders
          </button>
          <div className="font-mono text-xs font-bold tracking-widest mb-0.5"
            style={{ color: 'var(--hm-blue)' }}>
            {folder?.position_code || folder?.name}
          </div>
          <h1 className="text-xl font-bold text-gray-900">{folder?.position_title || folder?.name}</h1>
          {folder?.description && (
            <p className="text-sm text-gray-500 mt-1 max-w-2xl leading-relaxed">{folder.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowJobLink(true); setJobLinkName(folder?.position_code || folder?.name || ''); }} className="btn-secondary text-xs">🔗 Job Link</button>
          <button onClick={() => setShowInvite(true)} className="btn-secondary text-xs">📨 Invite candidate</button>
        </div>
      </div>

      {/* Invite panel */}
      {showInvite && (
        <div className="card mb-5">
          <h3 className="text-sm font-bold text-gray-700 mb-3">Invite candidate by email</h3>
          <div className="flex gap-3">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
              placeholder="candidate@email.com" className="input flex-1" autoFocus />
            <button onClick={() => invite.mutate()} disabled={!inviteEmail || invite.isPending}
              className="btn-primary text-xs">
              {invite.isPending ? 'Sending...' : 'Send invitation'}
            </button>
            <button onClick={() => setShowInvite(false)} className="btn-secondary text-xs">Cancel</button>
          </div>
          {invite.isSuccess && <p className="text-xs text-green-600 mt-2">✓ Invitation sent</p>}
          {invite.isError && <p className="text-xs text-red-500 mt-2">Failed — {(invite.error as any)?.response?.data?.detail}</p>}
        </div>
      )}



      {/* Job Link modal */}
      {showJobLink && (() => {
        const link = links.length > 0
          ? `${window.location.origin}/apply/${links[0].token}`
          : null;
        const displayName = jobLinkName || folder?.position_code || folder?.name || '';
        const hyperlink = link ? `[${displayName}](${link})` : null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,0.5)' }}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md scale-in">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Job Link</h3>
                <button onClick={() => { setShowJobLink(false); setJobLinkName(''); }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
              <div className="p-6 space-y-4">
                {!link ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">No job link generated yet. Click below to generate one.</p>
                    <button onClick={() => createLink.mutate()} disabled={createLink.isPending}
                      className="btn-primary text-xs w-full">
                      {createLink.isPending ? 'Generating...' : 'Generate job link'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="label">Link Name</label>
                      <input value={jobLinkName}
                        onChange={e => setJobLinkName(e.target.value)}
                        placeholder=''
                        className="input" autoFocus/>
                      <p className="text-[11px] text-gray-400 mt-1">Defaults to Position Code. Override if needed.</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        const name = jobLinkName || folder?.position_code || folder?.name || 'Job Link';
                        // Write HTML to clipboard so it pastes as a hyperlink in email/Word/Outlook
                        const html = `<a href="${link}">${name}</a>`;
                        const plain = `${name}: ${link}`;
                        try {
                          await navigator.clipboard.write([
                            new ClipboardItem({
                              'text/html': new Blob([html], { type: 'text/html' }),
                              'text/plain': new Blob([plain], { type: 'text/plain' }),
                            })
                          ]);
                        } catch {
                          // Fallback: copy plain text
                          await navigator.clipboard.writeText(plain);
                        }
                        setShowJobLink(false); setJobLinkName('');
                      }} className="btn-primary flex-1 text-xs">Copy Link</button>
                      <button onClick={() => { setShowJobLink(false); setJobLinkName(''); }}
                        className="btn-secondary text-xs">Cancel</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Status filter */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Filter by status:</span>
        <button onClick={() => setStatusFilter('')}
          className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${!statusFilter ? 'text-white border-transparent' : 'border-gray-200 hover:bg-gray-50'}`}
          style={!statusFilter ? { background: 'var(--hm-blue)' } : {}}>
          All ({apps.length})
        </button>
        {STATUS_OPTS.filter(s => statusCounts[s] > 0).map(s => (
          <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${statusFilter === s ? 'text-white border-transparent' : 'border-gray-200 hover:bg-gray-50'}`}
            style={statusFilter === s ? { background: STATUS_CFG[s].color } : {}}>
            {s.replace(/_/g, ' ')} ({statusCounts[s]})
          </button>
        ))}
      </div>

      {/* Applications table */}
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

                <th className="text-center w-32 relative group cursor-help">
                  <span className="text-[10px] font-bold uppercase tracking-wide">Consistency Check</span>
                  <div className="absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-60 p-3 rounded-xl shadow-xl text-left text-xs font-normal text-gray-700 whitespace-normal" style={{ background:'white', border:'1px solid #e2e8f0' }}>
                    <div className="flex items-start gap-1.5 mb-1.5"><span>🟢</span><span><strong>Green</strong> — Profile and resume are consistent</span></div>
                    <div className="flex items-start gap-1.5 mb-1.5"><span>🟡</span><span><strong>Yellow</strong> — Minor inconsistencies, review recommended</span></div>
                    <div className="flex items-start gap-1.5"><span>🔴</span><span><strong>Red</strong> — Significant discrepancies, detailed review required</span></div>
                  </div>
                </th>
                <th>Actions</th>
                <th className="w-12 text-center">More</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={8} className="px-4 py-8 text-gray-400 text-sm text-center">Loading...</td></tr>
              )}
              {!isLoading && filteredApps.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {statusFilter ? `No applications with status "${statusFilter.replace(/_/g,' ')}"` : 'No applications yet — invite candidates or share the job link.'}
                </td></tr>
              )}
              {filteredApps.map((app: any) => {
                const cfg = STATUS_CFG[app.status] || STATUS_CFG.received;
                return (
                  <>
                  <tr key={app.id}>
                    {/* Candidate */}
                    <td>
                      <div className="font-semibold text-sm text-gray-900">
                        {app.candidate?.first_name} {app.candidate?.last_name}
                      </div>
                      <div className="text-xs text-gray-400 font-mono">{app.candidate?.email}</div>
                    </td>
                    {/* Submitted By */}
                    <td>
                      <div className="text-sm font-medium text-gray-800">
                        {app.submitted_by?.name || '—'}
                      </div>
                    </td>
                    {/* Organization */}
                    <td>
                      <span className={`badge ${app.submitted_by_org === 'Candidate' ? 'badge-blue' : 'badge-amber'}`}>
                        {app.submitted_by_org || 'Candidate'}
                      </span>
                    </td>

                    {/* Received */}
                    <td className="text-xs text-gray-500 whitespace-nowrap">
                      {app.received_at?.slice(0, 10)}
                    </td>
                    {/* Status */}
                    <td>
                      <select value={app.status}
                        onChange={e => updateStatus.mutate({ id: app.id, status: e.target.value })}
                        className="text-xs px-2 py-1 rounded-full border-0 font-semibold focus:outline-none cursor-pointer"
                        style={{ background: cfg.bg, color: cfg.color }}>
                        {STATUS_OPTS.map(s => (
                          <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </td>

                    {/* Consistency */}
                    <td className="text-center">
                      {(() => {
                        const score = app.consistency_score || 'green';
                        const icon = score==='red' ? '🔴' : score==='yellow' ? '🟡' : '🟢';
                        return <span className="text-lg leading-none" title={score}>{icon}</span>;
                      })()}
                    </td>
                    {/* Actions */}
                    <td className="overflow-visible">
                      <ActionMenu
                        app={app}
                        onViewProfile={() => handleViewProfile(app)}
                        onChain={() => { setChainAppId(app.id); setChainApp(app); }}
                        onDiscrepancies={() => setDiscrepanciesApp(app)}
                        onSubmitUp={() => setSubmitUpApp(app)}
                        onOpenPdf={(url, name) => setPdfViewer({ url, name })}
                      />
                    </td>
                    {/* Expand toggle */}
                    <td className="text-center">
                      <button
                        onClick={() => setExpandedRow(expandedRow === app.id ? null : app.id)}
                        className="text-blue-500 hover:text-blue-700 text-sm w-6 h-6 flex items-center justify-center rounded transition-all"
                        title="View details">
                        <span style={{ display:'inline-block', transition:'transform 0.2s', transform: expandedRow===app.id ? 'rotate(180deg)' : 'none' }}>▼</span>
                      </button>
                    </td>
                  </tr>
                  {/* Expanded detail row */}
                  {expandedRow === app.id && (
                    <tr>
                      <td colSpan={8} className="p-0">
                        <div className="px-6 py-4 border-t border-blue-100" style={{ background:'#f8fafc' }}>
                          <div className="grid grid-cols-3 gap-6">
                            {/* Contact Info */}
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
                            {/* Cover Message */}
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Message / Cover Letter</div>
                              <div className="text-xs text-gray-700 leading-relaxed min-h-[40px] px-2 py-1.5 rounded-lg"
                                style={{ background:'white', border:'1px solid #e2e8f0' }}>
                                {app.cover_message || <span className="text-gray-300 italic">No message provided</span>}
                              </div>
                            </div>
                            {/* Internal Notes */}
                            <div>
                              <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Internal Notes / Comments</div>
                              <textarea
                                className="input resize-none text-xs w-full"
                                rows={3}
                                value={notesMap[app.id] ?? (app.internal_notes || '')}
                                onChange={e => setNotesMap(p => ({ ...p, [app.id]: e.target.value }))}
                                placeholder="Add your notes here..."
                              />
                              <button
                                onClick={async () => {
                                  setSavingNotes(app.id);
                                  await updateNotes.mutateAsync({ id: app.id, notes: notesMap[app.id] ?? (app.internal_notes || '') });
                                }}
                                disabled={savingNotes === app.id}
                                className="btn-primary text-xs mt-1.5 py-1">
                                {savingNotes === app.id ? 'Saving...' : 'Save'}
                              </button>
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

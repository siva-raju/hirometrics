import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { shareApi } from '../../services/api';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
      <div className="text-sm font-medium text-gray-700 mb-3 pb-3 border-b border-gray-50">{title}</div>
      {children}
    </div>
  );
}

export default function VerifiedProfileView() {
  const { token } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ['share', token],
    queryFn: () => shareApi.view(token!).then(r => r.data)
  });

  if (isLoading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-gray-400">Loading profile...</div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center max-w-md">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold mb-2">Link unavailable</h2>
        <p className="text-gray-600 text-sm">This profile link may have expired or been deactivated.</p>
      </div>
    </div>
  );

  const s = data?.snapshot;
  if (!s) return null;
  const { user, profile, work_history, education, certifications, references, awards } = s;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 text-sm">
            <img src="/brand/hm-logo-32.png" alt="HiroMetrics" className="h-6 w-6" />
            <span className="font-medium" style={{ color: '#0078d2' }}>HiroMetrics</span>
            <span className="text-gray-400">·</span>
            <span className="text-xs text-gray-500">Verified Profile</span>
          </div>
          <div className="text-xs text-gray-400">Snapshot from {data?.snapshotted_at?.slice(0,10)}</div>
        </div>

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-100 p-6 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-medium flex-shrink-0"
                 style={{ background: '#e6f3fb', color: '#0078d2' }}>
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-medium text-gray-900">{user?.first_name} {user?.last_name}</h1>
              <p className="text-gray-600 mt-1">{profile?.headline}</p>
              {profile?.linkedin_url && (
                <a href={profile.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-1 block">
                  LinkedIn
                </a>
              )}
            </div>
            <div className="text-right">
              {profile?.identity_verified && (
                <div className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full font-medium" style={{ background: '#eaf3de', color: '#27500a' }}>
                  ✓ Identity verified
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">{profile?.profile_completeness}% complete</div>
            </div>
          </div>
          {profile?.summary && <p className="text-sm text-gray-600 mt-4 leading-relaxed">{profile.summary}</p>}
        </div>

        {/* Work history */}
        {work_history?.length > 0 && (
          <Section title="Work history">
            {work_history.map((w: any, i: number) => (
              <div key={i} className="py-3 border-b border-gray-50 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{w.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{w.employer_name} · {w.employer_city}{w.employer_country ? `, ${w.employer_country}` : ''}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{w.start_date} — {w.is_current ? 'Present' : w.end_date}</div>
                  </div>
                  {w.verification_status === 'verified' && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eaf3de', color: '#27500a' }}>✓ Verified</span>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Education */}
        {education?.length > 0 && (
          <Section title="Education">
            {education.map((e: any, i: number) => (
              <div key={i} className="py-3 border-b border-gray-50 last:border-b-0">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium">{e.degree_name || e.education_level?.replace(/_/g,' ')}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{e.institution_name} · {e.institution_country}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{e.start_date} — {e.end_date}</div>
                  </div>
                  {e.verification_status === 'verified' && (
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eaf3de', color: '#27500a' }}>✓ Verified</span>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}

        {/* Certifications */}
        {certifications?.length > 0 && (
          <Section title="Certifications">
            {certifications.map((c: any, i: number) => (
              <div key={i} className="py-2 border-b border-gray-50 last:border-b-0 flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium">{c.cert_name}</div>
                  <div className="text-xs text-gray-500">{c.authority_name} · {c.issued_date}</div>
                </div>
                {c.verification_status === 'verified' && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#eaf3de', color: '#27500a' }}>✓</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 mt-6">
          <p>This profile was verified and authenticated by HiroMetrics.</p>
          <p className="mt-1">Snapshot created {data?.snapshotted_at?.slice(0,16)?.replace('T',' ')} UTC</p>
          {data?.expires_at && <p className="mt-1">This link expires {data.expires_at.slice(0,10)}</p>}
        </div>
      </div>
    </div>
  );
}

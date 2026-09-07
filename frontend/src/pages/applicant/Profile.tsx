import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { applicantApi } from '../../services/api';

const GENDER_DISPLAY: Record<string, string> = {
  man: 'Male', male: 'Male', woman: 'Female', female: 'Female', 'non-binary': 'Non-binary',
  genderqueer: 'Genderqueer', agender: 'Agender',
  'prefer to self-describe': 'Prefer to self-describe',
  'prefer not to say': 'Prefer not to say',
};

function Section({ title, icon, children, empty }: { title: string; icon: string; children: React.ReactNode; empty?: string }) {
  return (
    <div className="card mb-4">
      <div className="flex items-center gap-2 mb-4 pb-3" style={{ borderBottom: '1px solid #edf2f7' }}>
        <span className="text-lg">{icon}</span>
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">{title}</h2>
      </div>
      {children}
      {empty && <p className="text-sm text-gray-400 italic">{empty}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="text-gray-400 w-36 flex-shrink-0 font-medium text-xs uppercase tracking-wide">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}


export default function ApplicantProfile() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => applicantApi.getProfile().then(r => r.data),
  });

  if (isLoading) return <div className="text-gray-400 text-sm p-8">Loading profile...</div>;
  if (error || !data) return <div className="alert-error">Failed to load profile. Please refresh.</div>;

  const { user, profile } = data;
  const lockedDate = profile?.baseline_locked_at
    ? new Date(profile.baseline_locked_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const legalStatusMap: Record<string, string> = {
    us_citizen: 'US Citizen', permanent_resident: 'Permanent Resident (Green Card)',
    visa_holder: 'Visa Holder', other: 'Other',
  };

  return (
    <div className="max-w-3xl fade-in">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">Your verified professional profile</p>
        </div>
        <div className="flex gap-2">
          <Link to="/applicant/wizard" className="btn-secondary text-xs">Edit in Wizard</Link>
          <Link to="/applicant/share-links" className="btn-primary text-xs">Share Profile</Link>
        </div>
      </div>

      {/* Profile header card */}
      <div className="card mb-4 flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: 'var(--hm-blue-light)', color: 'var(--hm-blue)' }}>
          {user.first_name?.[0]}{user.last_name?.[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{user.first_name} {user.last_name}</h2>
            {profile?.identity_verified && (
              <span className="badge badge-green">✓ Identity Verified</span>
            )}
            {profile?.baseline_locked ? (
              <span className="badge badge-blue">🔒 Locked {lockedDate}</span>
            ) : (
              <span className="badge badge-gray">Draft</span>
            )}
          </div>
          {profile?.headline && <p className="text-sm text-gray-600 mt-1">{profile.headline}</p>}
          <p className="text-xs text-gray-400 mt-1">{user.email}</p>
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-500">Profile {profile?.profile_completeness || 0}% complete</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-48">
              <div className="h-full rounded-full transition-all" style={{ width: `${profile?.profile_completeness || 0}%`, background: 'var(--hm-blue)' }} />
            </div>
          </div>
        </div>
        {data.current_resume && (
          <div className="text-right flex-shrink-0">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Current Resume</div>
            <div className="text-xs text-gray-600">{data.current_resume.original_filename}</div>
            <div className="text-xs text-gray-400">v{data.current_resume.version_number}</div>
          </div>
        )}
      </div>

      {/* Summary */}
      {profile?.summary && (
        <Section title="Summary" icon="📝">
          <p className="text-sm text-gray-700 leading-relaxed">{profile.summary}</p>
        </Section>
      )}

      {/* Personal Information */}
      <Section title="Personal Information" icon="👤">
        <div className="grid grid-cols-2 gap-x-8">
          <div>
            <InfoRow label="Full name" value={[user.first_name, profile?.middle_name, user.last_name].filter(Boolean).join(' ')} />
            <InfoRow label="Preferred name" value={profile?.nick_name} />
            <InfoRow label="Gender identity" value={GENDER_DISPLAY[profile?.gender?.toLowerCase()] || profile?.gender} />
          </div>
          <div>
            <InfoRow label="Primary phone" value={profile?.primary_phone} />
            <InfoRow label="Secondary phone" value={profile?.secondary_phone} />
            <InfoRow label="Work authorization" value={legalStatusMap[profile?.legal_status] || profile?.legal_status} />
            <InfoRow label="Visa category" value={profile?.immigration_category} />
          </div>
        </div>
      </Section>

      {/* Work Experience */}
      <Section title="Work Experience" icon="💼"
        empty={(data.work_history || []).length === 0 ? 'No work history added yet' : undefined}>
        {(data.work_history || []).map((w: any, i: number) => (
          <div key={w.id} className={`py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-gray-900">{w.title}</div>
                <div className="text-sm text-gray-600 mt-0.5">
                  {w.employer_name}
                  {w.area_of_industry && <span className="text-gray-400"> · {w.area_of_industry}</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {w.employment_type?.replace(/_/g,' ')} · {w.start_date} – {w.is_current ? 'Present' : (w.end_date || '—')}
                </div>
                {w.description && <p className="text-xs text-gray-500 mt-1.5">{w.description}</p>}
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* Education */}
      <Section title="Education" icon="🎓"
        empty={(data.education || []).length === 0 ? 'No education added yet' : undefined}>
        {(data.education || []).map((e: any, i: number) => (
          <div key={e.id} className={`py-4 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-gray-900">{e.degree_name || e.education_level?.replace(/_/g,' ')}</div>
                {e.specialization && <div className="text-sm text-blue-600 mt-0.5">{e.specialization}</div>}
                <div className="text-sm text-gray-600 mt-0.5">{e.institution_name}</div>
                {(e.institution_city || e.institution_country) && (
                  <div className="text-xs text-gray-400">{[e.institution_city, e.institution_country].filter(Boolean).join(', ')}</div>
                )}
                <div className="text-xs text-gray-400 mt-0.5">
                  {e.start_date}{e.end_date ? ` – ${e.end_date}` : ''}
                  {e.graduation_date ? ` · Graduated ${e.graduation_date}` : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* Certifications */}
      <Section title="Certifications" icon="📜"
        empty={(data.certifications || []).length === 0 ? 'No certifications added yet' : undefined}>
        {(data.certifications || []).map((c: any, i: number) => (
          <div key={c.id} className={`py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-gray-900">{c.cert_name}</div>
                {c.authority_name && <div className="text-sm text-gray-600">{c.authority_name}</div>}
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.cert_type && <span>{c.cert_type} · </span>}
                  {c.issued_date && <span>Issued {c.issued_date}</span>}
                  {c.expiry_date && <span> · Expires {c.expiry_date}</span>}
                </div>
              </div>
            </div>
          </div>
        ))}
      </Section>

      {/* References */}
      <Section title="Professional References" icon="🤝"
        empty={(data.references || []).length === 0 ? 'No references added yet' : undefined}>
        {(data.references || []).map((r: any, i: number) => (
          <div key={r.id} className={`py-3 ${i > 0 ? 'border-t border-gray-100' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-semibold text-gray-900">{r.referee_first_name} {r.referee_last_name}</div>
                <div className="text-sm text-gray-600">{r.referee_title}{r.referee_company ? ` · ${r.referee_company}` : ''}</div>
                <div className="text-xs text-gray-400">{r.referee_email}</div>
                {r.relationship_type && <div className="text-xs text-gray-400 mt-0.5">Relationship: {r.relationship_type}</div>}
              </div>
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

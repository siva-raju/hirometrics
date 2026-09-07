"""
Auto-migration on startup — ensures DB columns match SQLAlchemy models.
Runs every time the backend starts. Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
"""
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

MIGRATIONS = [
    # invitations
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS message TEXT",
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS position_title VARCHAR(255)",
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS folder_id UUID",
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS candidate_id UUID",
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP",
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
    "ALTER TABLE invitations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",

    # applicant_profiles
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS salutation VARCHAR(20)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS nick_name VARCHAR(100)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS middle_name VARCHAR(100)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS gender VARCHAR(30)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS ssn_encrypted VARCHAR(500)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS country_of_birth VARCHAR(100)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS secondary_phone VARCHAR(30)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS linkedin_url VARCHAR(500)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS immigration_category VARCHAR(100)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS trust_score FLOAT",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS baseline_locked_at TIMESTAMP",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE applicant_profiles ALTER COLUMN date_of_birth TYPE VARCHAR(20) USING date_of_birth::text",

    # users
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url VARCHAR(500)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_code VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS temp_password VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tc_version_id UUID",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS invited_by UUID",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS tc_accepted_at TIMESTAMP",

    # organizations
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS entity_type VARCHAR(100)",
    "ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)",

    # folders
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS created_by UUID",

    # work_history
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS employer_street VARCHAR(255)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS employer_city VARCHAR(100)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS employer_state VARCHAR(100)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS employer_country VARCHAR(100)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS area_of_industry VARCHAR(100)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'not_started'",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",

    # education
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS institution_street VARCHAR(255)",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS institution_city VARCHAR(100)",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS institution_state VARCHAR(100)",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS institution_country VARCHAR(100)",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS marks_percentage FLOAT",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS grade_obtained VARCHAR(50)",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'not_started'",
    "ALTER TABLE education ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",

    # certifications
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS cert_type VARCHAR(30)",
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS cert_version VARCHAR(50)",
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS expiry_date VARCHAR(20)",
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS credential_url VARCHAR(500)",
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'not_started'",
    "ALTER TABLE certifications ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",

    # references
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS ref_type VARCHAR(30)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_first_name VARCHAR(100)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_last_name VARCHAR(100)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_title VARCHAR(255)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_company VARCHAR(255)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_email VARCHAR(255)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_phone VARCHAR(30)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_country VARCHAR(100)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_state VARCHAR(100)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS referee_city VARCHAR(100)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS relationship_type VARCHAR(30)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255)",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'not_started'",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS notes TEXT",
    "ALTER TABLE \"references\" ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()",

    # awards
    "ALTER TABLE awards ADD COLUMN IF NOT EXISTS award_type VARCHAR(50)",
    "ALTER TABLE awards ADD COLUMN IF NOT EXISTS description TEXT",
    "ALTER TABLE awards ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
    "ALTER TABLE awards ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'not_started'",

    # addresses
    "ALTER TABLE addresses ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",

    # identity_documents
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS doc_number VARCHAR(100)",
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS issued_state VARCHAR(100)",
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS date_of_entry VARCHAR(20)",
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS visa_type VARCHAR(100)",
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS document_url VARCHAR(500)",
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS verification_status VARCHAR(30) DEFAULT 'not_started'",
    "ALTER TABLE identity_documents ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP",

    # resumes
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT FALSE",
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS file_size_bytes INTEGER",

    # applications
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS chain_depth INTEGER DEFAULT 0",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN DEFAULT FALSE",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS comments TEXT",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP DEFAULT NOW()",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",

    # profile_snapshots
    "ALTER TABLE profile_snapshots ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50)",

    # correction_requests
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS requested_by UUID",
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS old_value TEXT",
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS justification TEXT",
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS evidence_url VARCHAR(500)",
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS reviewed_by UUID",
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS reviewer_notes TEXT",
    "ALTER TABLE correction_requests ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP",

    # share_tokens
    "ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0",
    "ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMP",
    "ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS label VARCHAR(255)",
    "ALTER TABLE share_tokens ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",

    # notifications
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_user_id UUID",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS created_by UUID",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN DEFAULT FALSE",
    "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS trigger_event VARCHAR(255)",

    # user_notifications
    "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE",
    "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP",
    "ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",

    # folders — position code and job description
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS position_code VARCHAR(100)",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS job_description TEXT",

    # applicant_profiles — new location and work auth fields
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS current_city VARCHAR(100)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS current_state VARCHAR(100)",
    "ALTER TABLE applicant_profiles ADD COLUMN IF NOT EXISTS work_auth_notes TEXT",

    # work_history — work arrangement and client engagement storage
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS work_arrangement VARCHAR(50)",
    "ALTER TABLE work_history ADD COLUMN IF NOT EXISTS client_engagements JSONB",

    # folders — additional info fields (Phase 2)
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS skill_set TEXT",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS location VARCHAR(200)",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS work_mode VARCHAR(20)",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS duration VARCHAR(100)",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS job_start_date VARCHAR(50)",
    "ALTER TABLE folders ADD COLUMN IF NOT EXISTS work_auth_required VARCHAR(100)",

    # applications — cover message and internal notes
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS cover_message TEXT",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS resume_id UUID REFERENCES resumes(id)",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS internal_notes TEXT",

    # applications — consistency score (Phase 2)
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS consistency_score VARCHAR(10) DEFAULT 'green'",
    "ALTER TABLE applications ADD COLUMN IF NOT EXISTS discrepancies JSONB",

    # submission_reviews — HM internal review lifecycle (Phase 3)
    "CREATE TABLE IF NOT EXISTS submission_reviews (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), application_id UUID REFERENCES applications(id), candidate_id UUID REFERENCES users(id) NOT NULL, folder_id UUID REFERENCES folders(id), status VARCHAR(30) NOT NULL DEFAULT 'awaiting_review', discrepancy_report_url TEXT, discrepancy_report_filename VARCHAR(255), disposition_flag VARCHAR(10), comments TEXT, sent_at TIMESTAMP, sent_by UUID REFERENCES users(id), archived BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())",
    "ALTER TABLE submission_reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",

    # candidate_job_links — job link inbox items for candidates (Phase 3)
    "CREATE TABLE IF NOT EXISTS candidate_job_links (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), candidate_id UUID NOT NULL REFERENCES users(id), application_link_id UUID NOT NULL REFERENCES application_links(id), folder_id UUID REFERENCES folders(id), status VARCHAR(20) DEFAULT 'pending', added_at TIMESTAMP DEFAULT NOW(), UNIQUE(candidate_id, application_link_id))",
    "ALTER TABLE candidate_job_links ADD COLUMN IF NOT EXISTS attached_resume_id UUID REFERENCES resumes(id)",

    # resumes — description for version tracking
    "ALTER TABLE resumes ADD COLUMN IF NOT EXISTS description VARCHAR(120)",

    # application_links
    "ALTER TABLE application_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
    "ALTER TABLE application_links ADD COLUMN IF NOT EXISTS application_count INTEGER DEFAULT 0",
    "ALTER TABLE application_links ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()",
]


async def ensure_schema(engine):
    """Run all migrations safely on startup. Each statement runs in its own
    transaction so a failure on one does not abort the rest."""
    ok = 0
    errors = []
    for sql in MIGRATIONS:
        try:
            async with engine.begin() as conn:   # fresh transaction per statement
                await conn.execute(text(sql))
            ok += 1
        except Exception as e:
            err = str(e)
            # Ignore "already exists" — column/table was already created
            if "already exists" in err or "already exist" in err:
                ok += 1
            else:
                errors.append(f"{sql[:80]}... → {err[:100]}")
    if errors:
        for e in errors:
            print(f"[ensure_schema] WARNING: {e}", flush=True)
    print(f"[ensure_schema] Done — {ok}/{len(MIGRATIONS)} migrations applied", flush=True)

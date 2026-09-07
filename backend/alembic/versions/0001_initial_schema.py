"""Initial schema — all HiroMetrics tables

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # organizations
    op.create_table('organizations',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('org_code', sa.String(50), unique=True, nullable=False),
        sa.Column('org_domain', sa.String(100), nullable=False),
        sa.Column('website_url', sa.String(500)),
        sa.Column('industry_type', sa.String(100)),
        sa.Column('entity_type', sa.String(100)),
        sa.Column('logo_url', sa.String(500)),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('onboarded_by', UUID(as_uuid=False)),
        sa.Column('onboarded_at', sa.DateTime),
        sa.Column('formal_agreement_ref', sa.String(200)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # terms_versions
    op.create_table('terms_versions',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('version_number', sa.Integer, nullable=False),
        sa.Column('content_candidate', sa.Text),
        sa.Column('content_employer', sa.Text),
        sa.Column('effective_date', sa.Date),
        sa.Column('is_current', sa.Boolean, server_default='false'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # users
    op.create_table('users',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('email_domain', sa.String(100), index=True),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('middle_name', sa.String(100)),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('nick_name', sa.String(100)),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('temp_password', sa.String(255)),
        sa.Column('must_change_password', sa.Boolean, server_default='false'),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id', ondelete='SET NULL')),
        sa.Column('manager_id', UUID(as_uuid=False)),
        sa.Column('profile_photo_url', sa.String(500)),
        sa.Column('activation_code', sa.String(100)),
        sa.Column('last_login', sa.DateTime),
        sa.Column('tc_accepted', sa.Boolean, server_default='false'),
        sa.Column('tc_version_id', UUID(as_uuid=False), sa.ForeignKey('terms_versions.id', ondelete='SET NULL')),
        sa.Column('tc_accepted_at', sa.DateTime),
        sa.Column('invited_by', UUID(as_uuid=False)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    op.create_index('ix_users_email', 'users', ['email'])

    # terms_acceptances
    op.create_table('terms_acceptances',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tc_version_id', UUID(as_uuid=False), sa.ForeignKey('terms_versions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('accepted_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('ip_address', sa.String(50)),
    )

    # enrollment_invitations
    op.create_table('enrollment_invitations',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('invited_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('invitee_name', sa.String(200)),
        sa.Column('invitee_email', sa.String(255), nullable=False),
        sa.Column('token', sa.String(200), unique=True, nullable=False),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('sent_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('registered_at', sa.DateTime),
        sa.Column('expires_at', sa.DateTime),
    )

    # subscription_plans
    op.create_table('subscription_plans',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('price_monthly', sa.Float),
        sa.Column('verification_credits', sa.Integer, server_default='0'),
        sa.Column('is_free_tier', sa.Boolean, server_default='false'),
        sa.Column('features', JSONB),
        sa.Column('is_active', sa.Boolean, server_default='true'),
    )

    # subscriptions
    op.create_table('subscriptions',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('plan_id', UUID(as_uuid=False), sa.ForeignKey('subscription_plans.id')),
        sa.Column('credits_remaining', sa.Integer, server_default='0'),
        sa.Column('status', sa.String(50), server_default='active'),
        sa.Column('payment_id', sa.String(200)),
        sa.Column('payment_date', sa.DateTime),
        sa.Column('expires_at', sa.DateTime),
        sa.Column('trigger_type', sa.String(50)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # applicant_profiles
    op.create_table('applicant_profiles',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), unique=True, nullable=False),
        sa.Column('salutation', sa.String(20)),
        sa.Column('gender', sa.String(30)),
        sa.Column('ssn_encrypted', sa.String(500)),
        sa.Column('date_of_birth', sa.Date),
        sa.Column('country_of_birth', sa.String(100)),
        sa.Column('primary_phone', sa.String(30)),
        sa.Column('secondary_phone', sa.String(30)),
        sa.Column('headline', sa.String(200)),
        sa.Column('summary', sa.Text),
        sa.Column('linkedin_url', sa.String(500)),
        sa.Column('legal_status', sa.String(50)),
        sa.Column('immigration_category', sa.String(100)),
        sa.Column('trust_score', sa.Float, server_default='0'),
        sa.Column('identity_verified', sa.Boolean, server_default='false'),
        sa.Column('profile_completeness', sa.Integer, server_default='0'),
        sa.Column('baseline_locked', sa.Boolean, server_default='false'),
        sa.Column('baseline_locked_at', sa.DateTime),
        sa.Column('wizard_step', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now()),
    )

    # addresses
    op.create_table('addresses',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('address_type', sa.String(50), server_default='current'),
        sa.Column('street', sa.String(300)),
        sa.Column('city', sa.String(100)),
        sa.Column('state', sa.String(100)),
        sa.Column('country', sa.String(100)),
        sa.Column('document_url', sa.String(500)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # identity_documents
    op.create_table('identity_documents',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('doc_type', sa.String(50), nullable=False),
        sa.Column('doc_number', sa.String(100)),
        sa.Column('issued_country', sa.String(100)),
        sa.Column('issued_state', sa.String(100)),
        sa.Column('issued_date', sa.Date),
        sa.Column('expiry_date', sa.Date),
        sa.Column('date_of_entry', sa.Date),
        sa.Column('visa_type', sa.String(100)),
        sa.Column('document_url', sa.String(500)),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # work_history
    op.create_table('work_history',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('employment_type', sa.String(50)),
        sa.Column('title', sa.String(200)),
        sa.Column('employer_name', sa.String(200)),
        sa.Column('employer_street', sa.String(300)),
        sa.Column('employer_city', sa.String(100)),
        sa.Column('employer_state', sa.String(100)),
        sa.Column('employer_country', sa.String(100)),
        sa.Column('area_of_industry', sa.String(100)),
        sa.Column('start_date', sa.String(20)),
        sa.Column('end_date', sa.String(20)),
        sa.Column('is_current', sa.Boolean, server_default='false'),
        sa.Column('description', sa.Text),
        sa.Column('document_url', sa.String(500)),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # employment_references
    op.create_table('employment_references',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('work_history_id', UUID(as_uuid=False), sa.ForeignKey('work_history.id', ondelete='CASCADE'), nullable=False),
        sa.Column('referee_full_name', sa.String(200)),
        sa.Column('referee_designation', sa.String(200)),
        sa.Column('referee_email', sa.String(255)),
        sa.Column('referee_phone', sa.String(50)),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # education
    op.create_table('education',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('education_level', sa.String(50)),
        sa.Column('degree_name', sa.String(200)),
        sa.Column('specialization', sa.String(200)),
        sa.Column('start_date', sa.String(20)),
        sa.Column('end_date', sa.String(20)),
        sa.Column('graduation_date', sa.String(20)),
        sa.Column('marks_percentage', sa.Float),
        sa.Column('grade_obtained', sa.String(50)),
        sa.Column('institution_name', sa.String(300)),
        sa.Column('institution_country', sa.String(100)),
        sa.Column('institution_state', sa.String(100)),
        sa.Column('institution_city', sa.String(100)),
        sa.Column('document_url', sa.String(500)),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # certifications
    op.create_table('certifications',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('cert_type', sa.String(50)),
        sa.Column('authority_name', sa.String(200)),
        sa.Column('cert_name', sa.String(200)),
        sa.Column('cert_number', sa.String(100)),
        sa.Column('cert_version', sa.String(50)),
        sa.Column('issued_date', sa.Date),
        sa.Column('expiry_date', sa.Date),
        sa.Column('credential_url', sa.String(500)),
        sa.Column('document_url', sa.String(500)),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # references
    op.create_table('references',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('ref_type', sa.String(50), server_default='professional'),
        sa.Column('referee_name', sa.String(200)),
        sa.Column('referee_title', sa.String(200)),
        sa.Column('referee_company', sa.String(200)),
        sa.Column('referee_email', sa.String(255)),
        sa.Column('referee_phone', sa.String(50)),
        sa.Column('relationship_type', sa.String(50)),
        sa.Column('country', sa.String(100)),
        sa.Column('state', sa.String(100)),
        sa.Column('city', sa.String(100)),
        sa.Column('token', sa.String(200), unique=True),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # awards
    op.create_table('awards',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('award_type', sa.String(50)),
        sa.Column('award_name', sa.String(200)),
        sa.Column('awarding_body', sa.String(200)),
        sa.Column('description', sa.Text),
        sa.Column('award_date', sa.Date),
        sa.Column('document_url', sa.String(500)),
        sa.Column('verification_status', sa.String(50), server_default='not_started'),
        sa.Column('verified_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # resumes
    op.create_table('resumes',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('version_number', sa.Integer, nullable=False, server_default='1'),
        sa.Column('file_url', sa.String(500)),
        sa.Column('original_filename', sa.String(300)),
        sa.Column('is_current', sa.Boolean, server_default='true'),
        sa.Column('uploaded_at', sa.DateTime, server_default=sa.func.now()),
    )

    # profile_snapshots
    op.create_table('profile_snapshots',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('profile_version', sa.Integer, server_default='1'),
        sa.Column('snapshot_data', JSONB, nullable=False),
        sa.Column('snapshotted_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('triggered_by', sa.String(50)),
    )

    # correction_requests
    op.create_table('correction_requests',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('profile_id', UUID(as_uuid=False), sa.ForeignKey('applicant_profiles.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('field_name', sa.String(100)),
        sa.Column('section', sa.String(100)),
        sa.Column('old_value', sa.Text),
        sa.Column('requested_value', sa.Text),
        sa.Column('justification', sa.Text),
        sa.Column('evidence_url', sa.String(500)),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('reviewed_by', UUID(as_uuid=False)),
        sa.Column('reviewer_notes', sa.Text),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('resolved_at', sa.DateTime),
    )

    # share_tokens
    op.create_table('share_tokens',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('profile_snapshot_id', UUID(as_uuid=False), sa.ForeignKey('profile_snapshots.id')),
        sa.Column('token', sa.String(500), unique=True, nullable=False),
        sa.Column('label', sa.String(200)),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('view_count', sa.Integer, server_default='0'),
        sa.Column('expires_at', sa.DateTime),
        sa.Column('last_viewed_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # folders
    op.create_table('folders',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('owner_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('created_by', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('position_title', sa.String(200)),
        sa.Column('unique_link_token', sa.String(100), unique=True),
        sa.Column('status', sa.String(50), server_default='open'),
        sa.Column('is_archived', sa.Boolean, server_default='false'),
        sa.Column('archived_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # application_links
    op.create_table('application_links',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('folder_id', UUID(as_uuid=False), sa.ForeignKey('folders.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token', sa.String(200), unique=True, nullable=False),
        sa.Column('label', sa.String(200)),
        sa.Column('is_active', sa.Boolean, server_default='true'),
        sa.Column('application_count', sa.Integer, server_default='0'),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime),
    )

    # applications
    op.create_table('applications',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('folder_id', UUID(as_uuid=False), sa.ForeignKey('folders.id', ondelete='SET NULL')),
        sa.Column('candidate_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('share_token_id', UUID(as_uuid=False), sa.ForeignKey('share_tokens.id')),
        sa.Column('parent_application_id', UUID(as_uuid=False), sa.ForeignKey('applications.id')),
        sa.Column('submitted_by_org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id')),
        sa.Column('submitted_by_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id')),
        sa.Column('flow_type', sa.String(50), nullable=False),
        sa.Column('chain_depth', sa.Integer, server_default='0'),
        sa.Column('status', sa.String(50), server_default='received'),
        sa.Column('is_flagged', sa.Boolean, server_default='false'),
        sa.Column('comments', sa.Text),
        sa.Column('received_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('status_updated_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_applications_parent', 'applications', ['parent_application_id'])
    op.create_index('ix_applications_folder', 'applications', ['folder_id'])
    op.create_index('ix_applications_candidate', 'applications', ['candidate_id'])

    # invitations
    op.create_table('invitations',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id', ondelete='CASCADE'), nullable=False),
        sa.Column('folder_id', UUID(as_uuid=False), sa.ForeignKey('folders.id', ondelete='SET NULL')),
        sa.Column('invited_by', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('candidate_email', sa.String(255), nullable=False),
        sa.Column('candidate_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('position_title', sa.String(200)),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('token', sa.String(200), unique=True),
        sa.Column('sent_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('responded_at', sa.DateTime),
        sa.Column('expires_at', sa.DateTime),
    )

    # candidate_vendor_requests
    op.create_table('candidate_vendor_requests',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('candidate_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('share_token_id', UUID(as_uuid=False), sa.ForeignKey('share_tokens.id')),
        sa.Column('vendor_email', sa.String(255), nullable=False),
        sa.Column('vendor_org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id')),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('requested_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('responded_at', sa.DateTime),
    )

    # notifications
    op.create_table('notifications',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('body', sa.Text, nullable=False),
        sa.Column('notification_type', sa.String(50), server_default='informational'),
        sa.Column('target_role', sa.String(50)),
        sa.Column('target_user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE')),
        sa.Column('created_by', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='SET NULL')),
        sa.Column('is_system_generated', sa.Boolean, server_default='false'),
        sa.Column('trigger_event', sa.String(100)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # user_notifications
    op.create_table('user_notifications',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('notification_id', UUID(as_uuid=False), sa.ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('is_read', sa.Boolean, server_default='false'),
        sa.Column('is_deleted', sa.Boolean, server_default='false'),
        sa.Column('read_at', sa.DateTime),
        sa.Column('deleted_at', sa.DateTime),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index('ix_user_notifications_user', 'user_notifications', ['user_id'])

    # verification_requests (stub for Full MVP)
    op.create_table('verification_requests',
        sa.Column('id', UUID(as_uuid=False), primary_key=True),
        sa.Column('candidate_id', UUID(as_uuid=False), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('requested_by_org_id', UUID(as_uuid=False), sa.ForeignKey('organizations.id')),
        sa.Column('application_id', UUID(as_uuid=False), sa.ForeignKey('applications.id')),
        sa.Column('status', sa.String(50), server_default='pending'),
        sa.Column('initiated_by', sa.String(50)),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('completed_at', sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table('verification_requests')
    op.drop_table('user_notifications')
    op.drop_table('notifications')
    op.drop_table('candidate_vendor_requests')
    op.drop_table('invitations')
    op.drop_table('applications')
    op.drop_table('application_links')
    op.drop_table('folders')
    op.drop_table('share_tokens')
    op.drop_table('correction_requests')
    op.drop_table('profile_snapshots')
    op.drop_table('resumes')
    op.drop_table('awards')
    op.drop_table('references')
    op.drop_table('certifications')
    op.drop_table('education')
    op.drop_table('employment_references')
    op.drop_table('work_history')
    op.drop_table('identity_documents')
    op.drop_table('addresses')
    op.drop_table('applicant_profiles')
    op.drop_table('subscriptions')
    op.drop_table('subscription_plans')
    op.drop_table('enrollment_invitations')
    op.drop_table('terms_acceptances')
    op.drop_table('users')
    op.drop_table('terms_versions')
    op.drop_table('organizations')

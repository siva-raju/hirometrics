"""Add auth_history to profiles and role_history to work_history

New columns:
- applicant_profiles.auth_history  (JSONB) — previous work authorization records
  Each entry: {legal_status, immigration_category, work_auth_notes, start_date, end_date}
- work_history.role_history        (JSONB) — previous role/title history per employer
  Each entry: {title, start_date, end_date}

Revision ID: 0005
Revises: 0004
Create Date: 2026-09-05 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('applicant_profiles',
        sa.Column('auth_history', JSONB(), nullable=True)
    )
    op.add_column('work_history',
        sa.Column('role_history', JSONB(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('applicant_profiles', 'auth_history')
    op.drop_column('work_history', 'role_history')

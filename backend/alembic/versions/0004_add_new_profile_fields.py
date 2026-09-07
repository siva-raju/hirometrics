"""Add new profile fields for candidate wizard enhancements

New columns:
- references.relationship_description  (TEXT)       — 'Other' relationship explanation
- references.is_active                 (BOOLEAN)    — Deactivate/Activate toggle
- certifications.renewal_date          (VARCHAR 20) — Latest renewal date
- certifications.renewal_expiry_date   (VARCHAR 20) — Latest renewal expiry
- work_history.additional_roles        (JSONB)      — Extra roles added post-freeze

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-18 00:00:00
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── references ────────────────────────────────────────────────────────────
    op.add_column('references',
        sa.Column('relationship_description', sa.Text(), nullable=True)
    )
    op.add_column('references',
        sa.Column('is_active', sa.Boolean(), nullable=False,
                  server_default=sa.text('true'))
    )

    # ── certifications ────────────────────────────────────────────────────────
    op.add_column('certifications',
        sa.Column('renewal_date', sa.String(20), nullable=True)
    )
    op.add_column('certifications',
        sa.Column('renewal_expiry_date', sa.String(20), nullable=True)
    )

    # ── work_history ──────────────────────────────────────────────────────────
    op.add_column('work_history',
        sa.Column('additional_roles', JSONB(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('references', 'relationship_description')
    op.drop_column('references', 'is_active')
    op.drop_column('certifications', 'renewal_date')
    op.drop_column('certifications', 'renewal_expiry_date')
    op.drop_column('work_history', 'additional_roles')

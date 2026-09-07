"""Seed data — initial T&C version and default subscription plan

Revision ID: 0002
Revises: 0001
Create Date: 2025-01-01 00:01:00
"""
from alembic import op
import sqlalchemy as sa
from datetime import date, datetime
import uuid

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None

TC_CONTENT = """HIROMETRICS PLATFORM — TERMS AND CONDITIONS OF USE
Version 1.0 | Effective Date: 2025-01-01

By registering for a HiroMetrics account, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.

1. ACCEPTANCE OF TERMS
These Terms and Conditions govern your access to and use of the HiroMetrics platform. By creating an account you agree to be bound by these Terms.

2. ACCURACY AND INTEGRITY OF PROFILE INFORMATION
You represent and warrant that all information submitted to your HiroMetrics profile is truthful, accurate, complete, and not misleading. Once authenticated, your core credential data becomes an immutable baseline. Corrections require a formal request with supporting evidence.

3. AUTHORIZATION TO PROCESS
By accepting an invitation to apply, you authorize HiroMetrics to perform a comprehensive assessment of your credentials, contact third parties for verification, and share results with the requesting party via secure link.

4. SHAREABLE PROFILE LINKS
Profile links deliver a frozen snapshot of your credentials at the time of sharing. No copies of your data are transmitted — all access routes through HiroMetrics systems.

5. PRIVACY AND DATA USAGE
HiroMetrics collects and processes personal and professional information for credential verification services as described in our Privacy Policy.

6. LIMITATION OF LIABILITY
HiroMetrics liability is limited to fees paid in the preceding twelve months. HiroMetrics is not liable for indirect or consequential damages.

7. MODIFICATIONS
HiroMetrics may modify these Terms. Material changes will be communicated and your continued use constitutes acceptance.

By registering, you acknowledge you have read, understood, and agree to these Terms and Conditions."""


def upgrade() -> None:
    tc_id = str(uuid.uuid4())
    plan_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    today = date.today().isoformat()

    op.execute(sa.text(f"""
        INSERT INTO terms_versions (id, version_number, content_candidate, content_employer, effective_date, is_current, created_at)
        VALUES (
            '{tc_id}',
            1,
            :content,
            :content,
            '{today}',
            true,
            '{now}'
        )
    """).bindparams(content=TC_CONTENT))

    op.execute(sa.text(f"""
        INSERT INTO subscription_plans (id, name, price_monthly, verification_credits, is_free_tier, is_active)
        VALUES (
            '{plan_id}',
            'Free Tier',
            0,
            5,
            true,
            true
        )
    """))


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM subscription_plans WHERE is_free_tier = true"))
    op.execute(sa.text("DELETE FROM terms_versions WHERE version_number = 1"))

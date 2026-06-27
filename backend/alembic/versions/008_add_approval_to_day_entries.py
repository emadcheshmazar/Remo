"""add approval fields to day_entries

Revision ID: 008
Revises: 007
Create Date: 2026-06-24
"""
from alembic import op
import sqlalchemy as sa

revision = '008_add_approval_to_day_entries'
down_revision = '007_create_day_entries'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('day_entries', sa.Column('approval_status', sa.String(16), nullable=True))
    op.add_column('day_entries', sa.Column('approved_by', sa.UUID(), nullable=True))
    op.add_column('day_entries', sa.Column('approved_minutes', sa.Integer(), nullable=True))
    op.add_column('day_entries', sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('day_entries', 'approved_at')
    op.drop_column('day_entries', 'approved_minutes')
    op.drop_column('day_entries', 'approved_by')
    op.drop_column('day_entries', 'approval_status')

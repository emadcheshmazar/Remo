"""add notes column to day_entries

Revision ID: 009
Revises: 008
Create Date: 2026-06-30
"""
from alembic import op
import sqlalchemy as sa

revision = '009_add_notes_to_day_entries'
down_revision = '008_add_approval_to_day_entries'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('day_entries', sa.Column('notes', sa.Text(), nullable=True))


def downgrade():
    op.drop_column('day_entries', 'notes')

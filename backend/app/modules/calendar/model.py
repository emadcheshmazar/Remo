import uuid
from datetime import date as Date, datetime, timezone
import sqlalchemy as sa
from sqlmodel import SQLModel, Field


class DayEntry(SQLModel, table=True):
    __tablename__ = "day_entries"

    id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        sa_column=sa.Column(sa.UUID(), primary_key=True, default=uuid.uuid4),
    )
    user_id: uuid.UUID = Field(
        sa_column=sa.Column(sa.UUID(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    )
    date: Date = Field(sa_column=sa.Column(sa.Date(), nullable=False))
    day_type: str = Field(sa_column=sa.Column(sa.String(16), nullable=False))
    set_by: uuid.UUID | None = Field(default=None, sa_column=sa.Column(sa.UUID(), nullable=True))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=sa.Column(sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    # Approval fields (set by supervisor/manager)
    approval_status: str | None = Field(default=None, sa_column=sa.Column(sa.String(16), nullable=True))
    approved_by: uuid.UUID | None = Field(default=None, sa_column=sa.Column(sa.UUID(), nullable=True))
    approved_minutes: int | None = Field(default=None, sa_column=sa.Column(sa.Integer(), nullable=True))
    approved_at: datetime | None = Field(default=None, sa_column=sa.Column(sa.DateTime(timezone=True), nullable=True))

    # Supervisor notes — shown on the member's dashboard
    notes: str | None = Field(default=None, sa_column=sa.Column(sa.Text(), nullable=True))

    __table_args__ = (
        sa.UniqueConstraint("user_id", "date", name="uq_day_entries_user_date"),
    )

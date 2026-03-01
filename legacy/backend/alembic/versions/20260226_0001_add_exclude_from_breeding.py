"""Add exclude_from_breeding flag to products

Revision ID: 20260226_0001
Revises: 20260225_0001
Create Date: 2026-02-26

Business:
- Some breeders are retired and should not appear in breeding task views/reminders.
- History/lineage must remain intact.

This adds a boolean flag on products to support filtering in task-oriented endpoints.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260226_0001"
down_revision = "20260225_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "products",
        sa.Column(
            "exclude_from_breeding",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("products", "exclude_from_breeding")

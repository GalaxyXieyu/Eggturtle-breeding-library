"""Drop obsolete shape/material columns

Revision ID: 20260220_0004
Revises: 20260220_0003
Create Date: 2026-02-20

We previously removed shape/material from the SQLAlchemy model and API.
Some existing SQLite DBs still have NOT NULL constraints on these columns,
causing 500 errors on product creation.

This migration drops both columns using batch mode for SQLite.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260220_0004"
down_revision = "20260220_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("shape")
        batch_op.drop_column("material")


def downgrade() -> None:
    # Best-effort downgrade: restore columns as nullable to avoid breaking inserts.
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("shape", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("material", sa.String(), nullable=True))

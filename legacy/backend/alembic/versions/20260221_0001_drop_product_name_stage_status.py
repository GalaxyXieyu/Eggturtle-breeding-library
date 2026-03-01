"""Drop Product name/stage/status columns

Revision ID: 20260221_0001
Revises: 20260220_0004
Create Date: 2026-02-21

Business decision: Product uses code (编号) as the only identifier. The legacy
fields name/stage/status are removed end-to-end and should not exist in DB.

This migration drops all three columns using batch mode for SQLite.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260221_0001"
down_revision = "20260220_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # If the old indexes exist, drop them first; otherwise SQLite batch mode may
    # try to recreate them on a column we are removing.
    op.execute("DROP INDEX IF EXISTS ix_products_name")
    op.execute("DROP INDEX IF EXISTS ix_products_stage")
    op.execute("DROP INDEX IF EXISTS ix_products_status")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("name")
        batch_op.drop_column("stage")
        batch_op.drop_column("status")


def downgrade() -> None:
    # Best-effort downgrade: restore columns as nullable to avoid breaking inserts.
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("name", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("stage", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("status", sa.String(), nullable=True))

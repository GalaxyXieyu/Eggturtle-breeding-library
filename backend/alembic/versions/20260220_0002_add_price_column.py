"""add price column

Revision ID: 20260220_0002
Revises: 20260220_0001
Create Date: 2026-02-20 00:00:01
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260220_0002"
down_revision = "20260220_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add new canonical column. Keep factory_price for backward compatibility.
    op.add_column("products", sa.Column("price", sa.Float(), nullable=True))

    # Backfill from legacy column.
    op.execute("UPDATE products SET price = factory_price WHERE price IS NULL")

    # Enforce non-null after backfill.
    # SQLite requires a table rebuild for ALTER COLUMN; use batch_alter_table.
    with op.batch_alter_table("products") as batch_op:
        batch_op.alter_column("price", existing_type=sa.Float(), nullable=False)


def downgrade() -> None:
    op.drop_column("products", "price")

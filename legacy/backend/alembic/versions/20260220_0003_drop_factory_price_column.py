"""drop factory_price column

Revision ID: 20260220_0003
Revises: 20260220_0002
Create Date: 2026-02-20 00:00:02

This project is new and we are doing a clean break: `products.price` is the
only canonical selling price column.

The migration is written to be robust:
- On a fresh DB it will no-op if `factory_price` was never created.
- On a DB that previously ran 0001/0002 it will drop `factory_price`.
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260220_0003"
down_revision = "20260220_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("products")}

    if "factory_price" in cols:
        with op.batch_alter_table("products") as batch_op:
            batch_op.drop_column("factory_price")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = {c["name"] for c in inspector.get_columns("products")}

    if "factory_price" not in cols:
        with op.batch_alter_table("products") as batch_op:
            batch_op.add_column(sa.Column("factory_price", sa.Float(), nullable=True))

        # Backfill from canonical price.
        op.execute("UPDATE products SET factory_price = price WHERE factory_price IS NULL")

        with op.batch_alter_table("products") as batch_op:
            batch_op.alter_column("factory_price", existing_type=sa.Float(), nullable=False)

"""Add products code sort fields

Revision ID: 20260222_0002
Revises: 20260222_0001
Create Date: 2026-02-22

Fix natural ordering for codes like 白化-1, 白化-2, 白化-10 by storing parsed
components in dedicated columns and indexing them.

We keep products.code unchanged (important for image path stability).
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260222_0002"
down_revision = "20260222_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("code_prefix", sa.String(), nullable=True))
        batch_op.add_column(sa.Column("code_parent_number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("code_child_number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("code_child_letter", sa.String(1), nullable=True))

    op.create_index(
        "ix_products_series_id_code_sort",
        "products",
        [
            "series_id",
            "code_prefix",
            "code_parent_number",
            "code_child_number",
            "code_child_letter",
            "code",
        ],
        unique=False,
    )

    # Backfill existing rows.
    bind = op.get_bind()
    from app.services.code_sort_fields import parse_code_sort_fields  # noqa: E402

    rows = bind.execute(sa.text("SELECT id, code FROM products")).fetchall()
    for product_id, code in rows:
        code_prefix, parent_number, child_number, child_letter = parse_code_sort_fields(code)
        bind.execute(
            sa.text(
                """
                UPDATE products
                SET code_prefix = :code_prefix,
                    code_parent_number = :parent_number,
                    code_child_number = :child_number,
                    code_child_letter = :child_letter
                WHERE id = :product_id
                """
            ),
            {
                "code_prefix": code_prefix,
                "parent_number": parent_number,
                "child_number": child_number,
                "child_letter": child_letter,
                "product_id": product_id,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_products_series_id_code_sort", table_name="products")

    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("code_child_letter")
        batch_op.drop_column("code_child_number")
        batch_op.drop_column("code_parent_number")
        batch_op.drop_column("code_prefix")

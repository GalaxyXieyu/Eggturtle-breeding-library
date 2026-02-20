"""baseline schema

Revision ID: 20260220_0001
Revises:
Create Date: 2026-02-20 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260220_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "series",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_series_code", "series", ["code"], unique=True)
    op.create_index("ix_series_name", "series", ["name"], unique=False)

    op.create_table(
        "products",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("series_id", sa.String(), nullable=True),
        sa.Column("sex", sa.String(), nullable=True),
        sa.Column("offspring_unit_price", sa.Float(), nullable=True),
        sa.Column("sire_code", sa.String(), nullable=True),
        sa.Column("dam_code", sa.String(), nullable=True),
        sa.Column("sire_image_url", sa.String(), nullable=True),
        sa.Column("dam_image_url", sa.String(), nullable=True),
        sa.Column("shape", sa.String(), nullable=False),
        sa.Column("material", sa.String(), nullable=False),
        sa.Column("cost_price", sa.Float(), nullable=True),
        sa.Column("factory_price", sa.Float(), nullable=False),
        sa.Column("has_sample", sa.Boolean(), nullable=True),
        sa.Column(
            "stage",
            sa.String(),
            nullable=False,
            server_default=sa.text("'hatchling'"),
        ),
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default=sa.text("'active'"),
        ),
        sa.Column("in_stock", sa.Boolean(), nullable=True),
        sa.Column("popularity_score", sa.Integer(), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_products_code", "products", ["code"], unique=True)
    op.create_index("ix_products_name", "products", ["name"], unique=False)
    op.create_index("ix_products_series_id", "products", ["series_id"], unique=False)
    op.create_index("ix_products_sex", "products", ["sex"], unique=False)
    op.create_index("ix_products_stage", "products", ["stage"], unique=False)
    op.create_index("ix_products_status", "products", ["status"], unique=False)

    op.create_table(
        "users",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("username", sa.String(), nullable=False),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_username", "users", ["username"], unique=True)

    op.create_table(
        "carousels",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=False),
        sa.Column("link_url", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "featured_products",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "product_images",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("alt", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "mating_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("female_id", sa.String(), nullable=False),
        sa.Column("male_id", sa.String(), nullable=False),
        sa.Column("mated_at", sa.DateTime(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["female_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["male_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_mating_records_female_id",
        "mating_records",
        ["female_id"],
        unique=False,
    )
    op.create_index(
        "ix_mating_records_male_id",
        "mating_records",
        ["male_id"],
        unique=False,
    )
    op.create_index(
        "ix_mating_records_mated_at",
        "mating_records",
        ["mated_at"],
        unique=False,
    )

    op.create_table(
        "egg_records",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("female_id", sa.String(), nullable=False),
        sa.Column("laid_at", sa.DateTime(), nullable=False),
        sa.Column("count", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["female_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_egg_records_female_id", "egg_records", ["female_id"], unique=False)
    op.create_index("ix_egg_records_laid_at", "egg_records", ["laid_at"], unique=False)

    op.create_table(
        "series_product_rel",
        sa.Column("series_id", sa.String(), nullable=False),
        sa.Column("product_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["series_id"], ["series.id"]),
        sa.PrimaryKeyConstraint("series_id", "product_id"),
    )
    op.create_index(
        "ix_series_product_rel_product_id",
        "series_product_rel",
        ["product_id"],
        unique=False,
    )
    op.create_index(
        "ix_series_product_rel_series_id",
        "series_product_rel",
        ["series_id"],
        unique=False,
    )

    op.create_table(
        "settings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("company_name", sa.String(), nullable=True),
        sa.Column("company_logo", sa.String(), nullable=True),
        sa.Column("company_description", sa.Text(), nullable=True),
        sa.Column("contact_phone", sa.String(), nullable=True),
        sa.Column("contact_email", sa.String(), nullable=True),
        sa.Column("contact_address", sa.String(), nullable=True),
        sa.Column("customer_service_qr_code", sa.String(), nullable=True),
        sa.Column("wechat_number", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("settings")

    op.drop_index("ix_series_product_rel_series_id", table_name="series_product_rel")
    op.drop_index("ix_series_product_rel_product_id", table_name="series_product_rel")
    op.drop_table("series_product_rel")

    op.drop_index("ix_egg_records_laid_at", table_name="egg_records")
    op.drop_index("ix_egg_records_female_id", table_name="egg_records")
    op.drop_table("egg_records")

    op.drop_index("ix_mating_records_mated_at", table_name="mating_records")
    op.drop_index("ix_mating_records_male_id", table_name="mating_records")
    op.drop_index("ix_mating_records_female_id", table_name="mating_records")
    op.drop_table("mating_records")

    op.drop_table("product_images")
    op.drop_table("featured_products")
    op.drop_table("carousels")

    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_products_status", table_name="products")
    op.drop_index("ix_products_stage", table_name="products")
    op.drop_index("ix_products_sex", table_name="products")
    op.drop_index("ix_products_series_id", table_name="products")
    op.drop_index("ix_products_name", table_name="products")
    op.drop_index("ix_products_code", table_name="products")
    op.drop_table("products")

    op.drop_index("ix_series_name", table_name="series")
    op.drop_index("ix_series_code", table_name="series")
    op.drop_table("series")

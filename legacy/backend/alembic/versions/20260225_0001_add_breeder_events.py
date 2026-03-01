"""Add breeder events timeline

Revision ID: 20260225_0001
Revises: 20260222_0002
Create Date: 2026-02-25

Introduce breeder_events as a unified timeline for female breeders:
- mating (stores male_code snapshot)
- egg (stores egg_count)
- change_mate (stores old/new mate codes)

We also backfill existing mating_records/egg_records into breeder_events so the
frontend can paginate events from a single source.
"""

from __future__ import annotations

import uuid

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260225_0001"
down_revision = "20260222_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "breeder_events",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("product_id", sa.String(), sa.ForeignKey("products.id"), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("event_date", sa.DateTime(), nullable=False),
        sa.Column("male_code", sa.String(), nullable=True),
        sa.Column("egg_count", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("old_mate_code", sa.String(), nullable=True),
        sa.Column("new_mate_code", sa.String(), nullable=True),
        sa.Column("source_type", sa.String(), nullable=True),
        sa.Column("source_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )

    op.create_index("ix_breeder_events_product_id", "breeder_events", ["product_id"], unique=False)
    op.create_index(
        "ix_breeder_events_product_id_event_date",
        "breeder_events",
        ["product_id", "event_date"],
        unique=False,
    )
    op.create_index(
        "ix_breeder_events_product_id_event_type_event_date",
        "breeder_events",
        ["product_id", "event_type", "event_date"],
        unique=False,
    )
    op.create_index(
        "ix_breeder_events_source",
        "breeder_events",
        ["source_type", "source_id"],
        unique=False,
    )

    bind = op.get_bind()

    # Backfill mating records (join to products for male_code snapshot).
    matings = bind.execute(
        sa.text(
            """
            SELECT
                mr.id AS source_id,
                mr.female_id AS product_id,
                p.code AS male_code,
                mr.mated_at AS event_date,
                mr.notes AS note,
                COALESCE(mr.created_at, mr.mated_at) AS created_at
            FROM mating_records mr
            LEFT JOIN products p ON p.id = mr.male_id
            """
        )
    ).mappings().all()

    for row in matings:
        bind.execute(
            sa.text(
                """
                INSERT INTO breeder_events (
                    id, product_id, event_type, event_date,
                    male_code, egg_count, note,
                    old_mate_code, new_mate_code,
                    source_type, source_id,
                    created_at
                ) VALUES (
                    :id, :product_id, :event_type, :event_date,
                    :male_code, :egg_count, :note,
                    :old_mate_code, :new_mate_code,
                    :source_type, :source_id,
                    :created_at
                )
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "product_id": row["product_id"],
                "event_type": "mating",
                "event_date": row["event_date"],
                "male_code": row["male_code"],
                "egg_count": None,
                "note": row["note"],
                "old_mate_code": None,
                "new_mate_code": None,
                "source_type": "mating_record",
                "source_id": row["source_id"],
                "created_at": row["created_at"],
            },
        )

    # Backfill egg records.
    eggs = bind.execute(
        sa.text(
            """
            SELECT
                er.id AS source_id,
                er.female_id AS product_id,
                er.laid_at AS event_date,
                er.count AS egg_count,
                er.notes AS note,
                COALESCE(er.created_at, er.laid_at) AS created_at
            FROM egg_records er
            """
        )
    ).mappings().all()

    for row in eggs:
        bind.execute(
            sa.text(
                """
                INSERT INTO breeder_events (
                    id, product_id, event_type, event_date,
                    male_code, egg_count, note,
                    old_mate_code, new_mate_code,
                    source_type, source_id,
                    created_at
                ) VALUES (
                    :id, :product_id, :event_type, :event_date,
                    :male_code, :egg_count, :note,
                    :old_mate_code, :new_mate_code,
                    :source_type, :source_id,
                    :created_at
                )
                """
            ),
            {
                "id": str(uuid.uuid4()),
                "product_id": row["product_id"],
                "event_type": "egg",
                "event_date": row["event_date"],
                "male_code": None,
                "egg_count": row["egg_count"],
                "note": row["note"],
                "old_mate_code": None,
                "new_mate_code": None,
                "source_type": "egg_record",
                "source_id": row["source_id"],
                "created_at": row["created_at"],
            },
        )


def downgrade() -> None:
    op.drop_index("ix_breeder_events_source", table_name="breeder_events")
    op.drop_index("ix_breeder_events_product_id_event_type_event_date", table_name="breeder_events")
    op.drop_index("ix_breeder_events_product_id_event_date", table_name="breeder_events")
    op.drop_index("ix_breeder_events_product_id", table_name="breeder_events")
    op.drop_table("breeder_events")

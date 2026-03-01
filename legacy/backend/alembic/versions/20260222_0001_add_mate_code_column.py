"""Add products.mate_code column

Revision ID: 20260222_0001
Revises: 20260221_0001
Create Date: 2026-02-22

The admin UI needs a dedicated field to store a female breeder's current mate
code (配偶编号). This is optional and acts as the preferred source of truth for
"current mate" resolution.

SQLite requires batch mode for ALTER TABLE in some scenarios; we use Alembic's
batch_alter_table for compatibility.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260222_0001"
down_revision = "20260221_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.add_column(sa.Column("mate_code", sa.String(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("products") as batch_op:
        batch_op.drop_column("mate_code")

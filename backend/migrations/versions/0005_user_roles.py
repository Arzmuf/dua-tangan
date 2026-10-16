"""user roles: admins, and deactivated accounts

Existing users become active parents (the server defaults fill the new columns).

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-16 21:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0005'
down_revision: Union[str, Sequence[str], None] = '0004'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('users', sa.Column('is_active', sa.Boolean(), server_default=sa.true(), nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_active')
    op.drop_column('users', 'is_admin')

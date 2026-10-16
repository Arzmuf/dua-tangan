"""programs and bookings, with a few starter programs from Sekala Jiwa

The starter programs are sample content, dated a week or more after the migration runs. Admins can
edit, unpublish or delete them.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-16 21:01:02.762094

"""
from datetime import datetime, time, timedelta, timezone
from typing import Sequence, Union
from zoneinfo import ZoneInfo

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0003'
down_revision: Union[str, Sequence[str], None] = '0002'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JAKARTA = ZoneInfo("Asia/Jakarta")


def starter_programs() -> list[dict]:
    today = datetime.now(JAKARTA).date()
    now = datetime.now(timezone.utc)

    def at(days: int, weekday: int, hour: int, minute: int = 0) -> datetime:
        """The first `weekday` (0 is Monday) at least `days` from today, at hour:minute in Jakarta."""
        day = today + timedelta(days=days)
        day += timedelta(days=(weekday - day.weekday()) % 7)
        return datetime.combine(day, time(hour, minute), JAKARTA)

    amelia = {
        "practitioner_name": "Dr. Amelia Wijaya, Psikolog",
        "practitioner_title": "Co-parenting counsellor, Sekala Jiwa",
        "practitioner_bio": "Amelia has spent twelve years helping separated parents talk calmly about their "
        "children. She trained in family mediation and leads Sekala Jiwa's co-parenting programme.",
    }
    rini = {
        "practitioner_name": "Rini Hartono, M.Psi.",
        "practitioner_title": "Child & family psychologist, Sekala Jiwa",
        "practitioner_bio": "Rini works with children aged 3 to 12 and their parents, helping children feel "
        "secure and heard while their family changes.",
    }
    yusuf = {
        "practitioner_name": "Yusuf Pratama, M.Psi.",
        "practitioner_title": "Individual therapist, Sekala Jiwa",
        "practitioner_bio": "Yusuf supports adults through separation and other big life changes, with a "
        "warm, practical approach grounded in CBT.",
    }
    programs = [
        {
            "title": "Calm Co-Parenting Communication",
            "summary": "Practical scripts for handoffs, schedule changes and money talks, without the arguments.",
            "description": "Most co-parenting conflict starts with a message that lands the wrong way. In this "
            "live webinar you'll learn simple tools to use straight away:\n\n"
            "• The BIFF method: brief, informative, friendly, firm\n"
            "• Proposing a change without it sounding like a demand\n"
            "• What to do when a conversation turns heated\n"
            "• Keeping money talks factual and fair\n\n"
            "There's time for anonymous questions at the end, and everyone who books gets the recording.",
            "topic": "communication",
            "format": "online",
            "location": "Online via Zoom (link sent after booking)",
            "starts_at": at(5, 1, 19, 30),
            "duration_minutes": 90,
            "price": 150_000,
            "capacity": 60,
            **amelia,
        },
        {
            "title": "Helping Your Child Feel at Home in Two Homes",
            "summary": "A hands-on morning on routines, handoff days and what children need to hear.",
            "description": "Moving between two homes is a big change for a child. This small-group workshop "
            "helps you:\n\n"
            "• Build routines that feel familiar in both homes\n"
            "• Make handoff days calmer for your child\n"
            "• Spot signs that your child is struggling, and respond\n"
            "• Explain the separation in words that fit their age\n\n"
            "The group is kept small so everyone gets time for their questions. Worksheets and snacks included.",
            "topic": "child-wellbeing",
            "format": "in-person",
            "location": "Sekala Jiwa, South Jakarta (exact address sent after booking)",
            "starts_at": at(10, 5, 9, 30),
            "duration_minutes": 180,
            "price": 250_000,
            "capacity": 16,
            **rini,
        },
        {
            "title": "Taking Care of Yourself After Separation",
            "summary": "A free, gentle group session on stress, sleep and staying steady for your kids.",
            "description": "You can't pour from an empty cup. This free online session covers:\n\n"
            "• Why separation is so draining, and what helps\n"
            "• Small daily habits for better sleep and less stress\n"
            "• Setting boundaries with your co-parent without guilt\n"
            "• Knowing when to ask for more support\n\n"
            "Cameras are optional: join as you are.",
            "topic": "self-care",
            "format": "online",
            "location": "Online via Google Meet (link sent after booking)",
            "starts_at": at(17, 2, 19),
            "duration_minutes": 75,
            "price": 0,
            "capacity": 100,
            **yusuf,
        },
        {
            "title": "Talking to Kids About Big Changes",
            "summary": "What to say, and what not to, when your child asks about the separation.",
            "description": "Children often have questions they don't know how to ask. In this webinar you'll "
            "practise:\n\n"
            "• Explaining the separation together, without blame\n"
            "• Answering the hard questions honestly and simply\n"
            "• Reassuring your child that both homes are theirs\n\n"
            "Includes a short guide you can keep for later conversations.",
            "topic": "co-parenting",
            "format": "online",
            "location": "Online via Zoom (link sent after booking)",
            "starts_at": at(24, 3, 19, 30),
            "duration_minutes": 90,
            "price": 100_000,
            "capacity": 80,
            **rini,
        },
    ]
    return [{**p, "host": "Sekala Jiwa", "is_published": True, "created_at": now, "updated_at": now} for p in programs]


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    programs = op.create_table('programs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=160), nullable=False),
    sa.Column('summary', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('topic', sa.String(length=24), nullable=False),
    sa.Column('format', sa.String(length=16), nullable=False),
    sa.Column('location', sa.String(length=200), nullable=False),
    sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('duration_minutes', sa.Integer(), nullable=False),
    sa.Column('price', sa.BigInteger(), nullable=False),
    sa.Column('capacity', sa.Integer(), nullable=False),
    sa.Column('host', sa.String(length=120), nullable=False),
    sa.Column('practitioner_name', sa.String(length=120), nullable=False),
    sa.Column('practitioner_title', sa.String(length=160), nullable=False),
    sa.Column('practitioner_bio', sa.String(length=1000), nullable=False),
    sa.Column('is_published', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_programs_starts_at'), 'programs', ['starts_at'], unique=False)
    op.create_table('bookings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('program_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('code', sa.String(length=12), nullable=False),
    sa.Column('tickets', sa.Integer(), nullable=False),
    sa.Column('amount', sa.BigInteger(), nullable=False),
    sa.Column('payment_method', sa.String(length=24), nullable=False),
    sa.Column('payment_ref', sa.String(length=40), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['program_id'], ['programs.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('code')
    )
    op.create_index(op.f('ix_bookings_program_id'), 'bookings', ['program_id'], unique=False)
    op.create_index(op.f('ix_bookings_user_id'), 'bookings', ['user_id'], unique=False)
    # ### end Alembic commands ###
    op.bulk_insert(programs, starter_programs())


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_bookings_user_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_program_id'), table_name='bookings')
    op.drop_table('bookings')
    op.drop_index(op.f('ix_programs_starts_at'), table_name='programs')
    op.drop_table('programs')
    # ### end Alembic commands ###

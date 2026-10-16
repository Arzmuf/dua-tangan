"""Brings the database schema up to date with the Alembic migrations in backend/migrations."""

from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, text

from .db import Base, engine

ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"
# Databases created before migrations existed (by Base.metadata.create_all) match this revision.
BASELINE = "0001"


def migrate() -> None:
    config = Config(str(ALEMBIC_INI))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        tables = inspect(connection).get_table_names()
        if "alembic_version" not in tables and "users" in tables:
            command.stamp(config, BASELINE)
        command.upgrade(config, "head")


def drop_everything() -> None:
    """Deletes all data and tables, including Alembic's bookkeeping, so `migrate` starts fresh."""
    Base.metadata.drop_all(engine)
    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS alembic_version"))

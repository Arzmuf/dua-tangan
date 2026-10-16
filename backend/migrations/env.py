"""Alembic environment: migrates the app's database with the app's own engine and models."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy.engine import Connection

from app import models  # noqa: F401  (registers every table on Base.metadata)
from app.db import Base, engine

config = context.config
target_metadata = Base.metadata


def run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    context.configure(url=engine.url.render_as_string(hide_password=False), target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()
elif (shared := config.attributes.get("connection")) is not None:
    # Startup (app/migrate.py) passes in its own connection and transaction.
    run_migrations(shared)
else:
    if config.config_file_name is not None:
        fileConfig(config.config_file_name, disable_existing_loggers=False)
    with engine.connect() as connection:
        run_migrations(connection)

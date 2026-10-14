from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings

# Every connection works in UTC so timestamps round-trip identically (the record hash chain depends on it).
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    connect_args={"options": "-c timezone=utc"},
)
SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

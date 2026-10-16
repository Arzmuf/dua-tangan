from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+psycopg://duatangan:duatangan@localhost:5432/duatangan"
    jwt_secret: str = "dev-only-secret-change-me-before-deploying"
    jwt_expires_days: int = 30
    cors_origins: list[str] = ["*"]
    # Creates the Nadia & Reza demo family on startup when the database has no users yet.
    seed_demo: bool = True
    # IANA zone for the demo family, e.g. "Asia/Jakarta". Defaults to this machine's zone.
    demo_time_zone: str | None = None
    # The first admin, created (or, given the right password, promoted) on startup. Set both or neither.
    admin_email: str | None = None
    admin_password: str | None = None

    @field_validator("database_url")
    @classmethod
    def use_psycopg(cls, url: str) -> str:
        # Hosts such as Neon hand out postgres:// or postgresql:// URLs; SQLAlchemy needs the psycopg 3 driver named.
        for scheme in ("postgres://", "postgresql://"):
            if url.startswith(scheme):
                return "postgresql+psycopg://" + url.removeprefix(scheme)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

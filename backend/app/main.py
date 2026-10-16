from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import SessionLocal
from .migrate import migrate
from .routers import auth, events, expenses, family, home, info, messages, programs, record, support
from .seed import ensure_counsellors, seed_demo_if_empty


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate()
    with SessionLocal() as db:
        ensure_counsellors(db)
        if settings.seed_demo:
            seed_demo_if_empty(db)
    yield


app = FastAPI(title="Dua Tangan API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

for module in (auth, family, home, events, expenses, messages, info, record, support, programs):
    app.include_router(module.router)


@app.get("/health", tags=["meta"])
def health():
    return {"status": "ok"}

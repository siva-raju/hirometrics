"""HiroMetrics FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all base tables first (safe on existing DBs — skips existing tables)
    from app.db.session import engine
    from app.db.session import Base
    from app.models import models  # noqa: ensure all models are imported
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Then run column-level migrations
    from app.db.ensure_schema import ensure_schema
    await ensure_schema(engine)
    yield


app = FastAPI(
    title="HiroMetrics API",
    description="Trusted credential verification platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-TC-Update-Required"],
)

# Register routers
from app.api.v1.routes import (
    auth, applicants, employers, folders, applications,
    invitations, share, notifications, users, admin, simulate, hm_review
)

app.include_router(auth.router,          prefix="/api/v1/auth",          tags=["Auth"])
app.include_router(users.router,         prefix="/api/v1/users",         tags=["Users"])
app.include_router(applicants.router,    prefix="/api/v1/applicants",    tags=["Applicants"])
app.include_router(employers.router,     prefix="/api/v1/employers",     tags=["Employers"])
app.include_router(folders.router,       prefix="/api/v1/folders",       tags=["Folders"])
app.include_router(applications.router,  prefix="/api/v1/applications",  tags=["Applications"])
app.include_router(invitations.router,   prefix="/api/v1/invitations",   tags=["Invitations"])
app.include_router(share.router,         prefix="/api/v1/share",         tags=["Share"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["Notifications"])
app.include_router(admin.router,         prefix="/api/v1/admin",         tags=["Admin"])
app.include_router(simulate.router,      prefix="/api/v1/simulate",      tags=["Simulate (Dev)"])
app.include_router(hm_review.router,     prefix="/api/v1/hm",             tags=["HM Review"])

@app.get("/health")
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

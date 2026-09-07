# HiroMetrics — Setup Guide

## Prerequisites

- Docker Desktop (Mac/Windows) or Docker + Docker Compose (Linux)
- Git (optional — for version control)

---

## Quick Start (5 steps)

### 1. Copy the environment file

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and set at minimum:

```
SECRET_KEY=any-random-32-char-string-here
```

Everything else works out of the box for local development.

---

### 2. Start the stack

```bash
docker compose up --build
```

First run takes 2–3 minutes (downloading images, installing dependencies).

You will see logs from:
- `hm_postgres` — PostgreSQL 16
- `hm_redis` — Redis 7
- `hm_backend` — FastAPI (Uvicorn)
- `hm_frontend` — React (Vite)

---

### 3. Run database migrations

**In a new terminal** (while the stack is running):

```bash
docker compose exec backend alembic upgrade head
```

This creates all 35 tables and seeds:
- Initial Terms & Conditions version
- Default free subscription plan

---

### 4. Create the first HM Super Admin

```bash
docker compose exec backend python3 -c "
import asyncio
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole, UserStatus
from app.core.security import hash_password
import uuid

async def create_superadmin():
    async with AsyncSessionLocal() as db:
        user = User(
            id=str(uuid.uuid4()),
            email='admin@hirometrics.com',
            email_domain='hirometrics.com',
            first_name='HM',
            last_name='Admin',
            hashed_password=hash_password('Admin1234!'),
            role=UserRole.HM_SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            tc_accepted=True,
        )
        db.add(user)
        await db.commit()
        print(f'Super admin created: admin@hirometrics.com / Admin1234!')

asyncio.run(create_superadmin())
"
```

---

### 5. Open the app

| Service | URL |
|---------|-----|
| Frontend (React) | http://localhost:5173 |
| Backend API docs | http://localhost:8000/docs |
| Backend health check | http://localhost:8000/health |

---

## Test Accounts

After running step 4, log in at http://localhost:5173/login:

| Role | Email | Password |
|------|-------|----------|
| HM Super Admin | admin@hirometrics.com | Admin1234! |

From the Admin portal you can:
1. **Organizations** → Onboard your first customer org (creates Customer Admin)
2. Candidate can self-register at `/register/applicant`
3. Employer self-registers at `/register/employer`

---

## Development Workflow

### Restart after code changes

Backend hot-reloads automatically (Uvicorn `--reload`).  
Frontend hot-reloads automatically (Vite HMR).

### Add a new database column

```bash
# 1. Edit app/models/models.py
# 2. Generate migration
docker compose exec backend alembic revision --autogenerate -m "add_column_name"
# 3. Review the generated file in backend/alembic/versions/
# 4. Apply it
docker compose exec backend alembic upgrade head
```

### Run in background

```bash
docker compose up -d          # start detached
docker compose logs -f        # tail logs
docker compose down           # stop everything
docker compose down -v        # stop + delete database volumes (fresh start)
```

---

## Project Structure

```
hirometrics/
├── backend/
│   ├── app/
│   │   ├── main.py                 FastAPI entry point
│   │   ├── api/v1/routes/          One file per feature area
│   │   ├── core/                   Config, security, dependencies
│   │   ├── db/session.py           Async SQLAlchemy engine
│   │   ├── models/models.py        All 45 SQLAlchemy models
│   │   ├── services/               Business logic (notifications, snapshots)
│   │   └── utils/                  Email templates, legal texts
│   ├── alembic/versions/           Database migrations
│   ├── .env.example                Copy to .env and edit
│   └── requirements.txt
│
├── frontend/
│   └── src/
│       ├── App.tsx                 React Router + protected routes
│       ├── pages/                  One folder per role
│       ├── components/layout/      AppLayout sidebar + topbar
│       ├── services/api.ts         Axios client + all API functions
│       └── store/authStore.ts      Zustand auth state (persisted)
│
├── docker-compose.yml
└── SETUP.md                        ← you are here
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | **Yes** | JWT signing key — change in production |
| `DATABASE_URL` | Yes | Set automatically by docker-compose |
| `REDIS_URL` | Yes | Set automatically by docker-compose |
| `MAIL_ENABLED` | No | Set `true` + fill SMTP details to send real emails |
| `MAIL_FROM` | No | Sender address (default: no-reply@hirometrics.com) |
| `MAIL_CC_MONITOR` | No | CC address for all outbound emails |
| `AWS_ACCESS_KEY_ID` | No | Required for file uploads to S3 |
| `S3_BUCKET_NAME` | No | Required for file uploads to S3 |
| `HM_DOMAIN` | No | Domain for HM staff emails (default: hirometrics.com) |

---

## Production Deployment Notes

1. **Set a strong `SECRET_KEY`** — `openssl rand -hex 32`
2. **Set `APP_ENV=production`** in .env
3. **Use RDS PostgreSQL** — update `DATABASE_URL`
4. **Use ElastiCache Redis** — update `REDIS_URL`
5. **Enable email** — set `MAIL_ENABLED=true` + SMTP credentials
6. **Set up S3 bucket** — set AWS credentials + bucket name
7. **Remove `--reload`** from the uvicorn command in production Dockerfile
8. **Build frontend** — `npm run build` → serve static files from CloudFront/Vercel

---

## Troubleshooting

### Port already in use

```bash
# Check what's using the port
lsof -i :5432    # Postgres
lsof -i :8000    # Backend
lsof -i :5173    # Frontend

# Or change ports in docker-compose.yml
```

### Migration fails

```bash
# Fresh start
docker compose down -v
docker compose up -d postgres
docker compose exec backend alembic upgrade head
```

### Backend import error

```bash
docker compose logs backend | grep "Error\|error\|Import"
```

### Frontend blank page

Open browser console (F12). Common causes:
- API returning 401 → clear localStorage and log in again
- API returning 403 with `X-TC-Update-Required` → T&C acceptance needed

---

## API Documentation

FastAPI auto-generates interactive docs at:  
http://localhost:8000/docs (Swagger UI)  
http://localhost:8000/redoc (ReDoc)

All endpoints require `Authorization: Bearer <token>` except:
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/register/*`
- `POST /api/v1/auth/activate/*`
- `GET /api/v1/share/public/{token}` (public profile view)
- `GET /api/v1/health`

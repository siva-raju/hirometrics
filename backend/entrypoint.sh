#!/bin/bash
set -e

echo ">>> Waiting for database to be ready..."
# Simple wait loop — retries up to 30 times (30 seconds)
for i in $(seq 1 30); do
    python -c "
import asyncio, sys
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
async def check():
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            await conn.execute(__import__('sqlalchemy').text('SELECT 1'))
        await engine.dispose()
        sys.exit(0)
    except Exception:
        sys.exit(1)
asyncio.run(check())
" && break || echo "    DB not ready yet (attempt $i/30)... retrying in 1s" && sleep 1
done

echo ">>> Running Alembic migrations..."
alembic upgrade head
echo ">>> Migrations complete."

echo ">>> Starting HiroMetrics backend server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

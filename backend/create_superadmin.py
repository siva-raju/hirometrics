import asyncio
import uuid
from app.db.session import AsyncSessionLocal
from app.models.models import User, UserRole, UserStatus
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_superadmin():
    async with AsyncSessionLocal() as db:
        hashed = pwd_context.hash("Hm123456")
        user = User(
            id=str(uuid.uuid4()),
            email="admin@hirometrics.com",
            email_domain="hirometrics.com",
            first_name="HM",
            last_name="Admin",
            hashed_password=hashed,
            role=UserRole.HM_SUPER_ADMIN,
            status=UserStatus.ACTIVE,
            tc_accepted=True,
        )
        db.add(user)
        await db.commit()
        print("Success!")
        print("  Email:    admin@hirometrics.com")
        print("  Password: Hm123456")


asyncio.run(create_superadmin())

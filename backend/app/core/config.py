from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    APP_NAME: str = "HiroMetrics"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me-in-production-use-32-char-min"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/hirometrics"
    REDIS_URL: str = "redis://localhost:6379/0"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"
    S3_BUCKET_NAME: str = "hirometrics-documents"
    MAIL_USERNAME: str = ""
    MAIL_PASSWORD: str = ""
    MAIL_FROM: str = "no-reply@hirometrics.com"
    MAIL_CC_MONITOR: str = ""
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_ENABLED: bool = False
    FRONTEND_URL: str = "http://localhost:5173"
    HM_DOMAIN: str = "hirometrics.com"
    SSN_ENCRYPTION_KEY: str = "change-this-to-a-real-32-byte-key"

    model_config = {
        "env_file": ".env",
        "extra": "ignore",  # silently ignore any unknown env vars
    }


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

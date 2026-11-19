from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    CORS_ORIGINS: str = "http://localhost:3000"
    PUBLIC_API_URL: str = "http://localhost:8080"
    PUBLIC_APP_URL: str = "http://localhost:3000"
    JIRA_POLL_MINUTES: int = 5
    JIRA_BASE_URL: str = "https://jirarnd.dariarnd.ir"
    UPLOAD_DIR: str = "uploads"

    model_config = {"env_file": ".env"}


settings = Settings()

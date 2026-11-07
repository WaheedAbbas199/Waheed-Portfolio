from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE = {"", "CHANGE_ME_TO_A_LONG_RANDOM_VALUE", "changeme", "secret"}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: Literal["development", "test", "production"] = "development"
    log_level: str = "INFO"
    log_json: bool = True
    database_url: str = "sqlite:///./data/portfolio.db"

    secret_key: str = "CHANGE_ME_TO_A_LONG_RANDOM_VALUE"
    session_hours: int = 8
    public_origins: str = "http://localhost:8000"
    site_url: str = "http://localhost:8000"
    login_max_attempts: int = 5
    login_window_seconds: int = 600

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    llm_timeout_seconds: int = 30
    llm_max_retries: int = 2
    chat_rate_per_minute: int = 12
    chat_max_message_chars: int = 800

    email_provider: Literal["disabled", "resend", "smtp"] = "disabled"
    resend_api_key: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_starttls: bool = True
    email_from: str = "Portfolio <onboarding@resend.dev>"
    notify_email: str = ""
    contact_rate_per_hour: int = 5

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.public_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def llm_configured(self) -> bool:
        return bool(self.gemini_api_key)

    @property
    def email_configured(self) -> bool:
        if self.email_provider == "resend":
            return bool(self.resend_api_key and self.notify_email)
        if self.email_provider == "smtp":
            return bool(self.smtp_host and self.notify_email)
        return False

    @model_validator(mode="after")
    def _prod(self) -> "Settings":
        if self.is_production:
            if self.secret_key in INSECURE or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY must be random and >= 32 chars in production")
            if "*" in self.origins:
                raise ValueError("PUBLIC_ORIGINS must not contain '*' in production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

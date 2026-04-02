from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str

    # JWT
    jwt_secret: str
    access_token_expire_seconds: int = 900
    refresh_token_expire_days: int = 30

    # App
    app_env: str = "development"
    app_version: str = "0.1.0"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()  # type: ignore[call-arg]

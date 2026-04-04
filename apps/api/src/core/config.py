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

    # CORS — production Vercel origin.
    # Set ALLOWED_WEB_ORIGIN in your Railway environment variables to the exact
    # origin of your deployed web app, e.g.:
    #   ALLOWED_WEB_ORIGIN=https://debugiq.vercel.app
    # The value is re.escape()d before being compiled into the CORS regex.
    # Leave empty in development (localhost is always allowed).
    # NEVER set this to a wildcard or a pattern — exact origin only.
    allowed_web_origin: str = ""

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()  # type: ignore[call-arg]

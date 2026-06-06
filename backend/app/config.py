"""Application settings loaded from environment / .env."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    llm_api_key: str = ""
    llm_base_url: str = "https://api.wavespeed.ai/v1"
    llm_model: str = "qwen3.7-plus"

    database_url: str = "sqlite:///./data/klar.db"

    chroma_path: str = "./data/chroma"
    chroma_collection: str = "klar_knowledge"

    app_env: str = "dev"
    cors_origins: str = "http://localhost:3000,http://localhost:5173"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

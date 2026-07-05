from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "AutoLab"
    DEBUG: bool = True
    
    DATABASE_URL: str
    
    REDIS_URL: str
    
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    RAZORPAY_KEY_ID:       str = ""
    RAZORPAY_KEY_SECRET:   str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    PRO_PLAN_AMOUNT:       int = 49900
    FREE_PLAN_MODEL_LIMIT: int = 3

    OPENAI_API_KEY:    str = ""
    LLM_MODEL_NAME:    str = "gpt-4o-mini"

    
    class Config:
        env_file = ".env"

settings = Settings()
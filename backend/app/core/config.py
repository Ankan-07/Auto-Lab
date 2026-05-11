from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    APP_NAME: str = "AutoLab"
    DEBUG: bool = True
    
    # Database
    DATABASE_URL: str
    
    # Redis
    REDIS_URL: str
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Razorpay
    RAZORPAY_KEY_ID:       str = ""
    RAZORPAY_KEY_SECRET:   str = ""
    RAZORPAY_WEBHOOK_SECRET: str = ""
    PRO_PLAN_AMOUNT:       int = 49900    # in paise (₹499)
    FREE_PLAN_MODEL_LIMIT: int = 3

    
    class Config:
        env_file = ".env"  # reads from your .env file automatically

# Create one instance — import this everywhere
settings = Settings()
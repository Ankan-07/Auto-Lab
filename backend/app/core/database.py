from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Create the engine — this is the actual connection to PostgreSQL
engine = create_engine(settings.DATABASE_URL)

# SessionLocal — a factory that creates database sessions
# Each request gets its own session (like its own connection to the DB)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base — all your database models (tables) will inherit from this
Base = declarative_base()

# Dependency — used in FastAPI routes to get a DB session
# Automatically closes session when request is done
def get_db():
    db = SessionLocal()
    try:
        yield db          # gives the session to the route function
    finally:
        db.close()        # always closes, even if there was an error
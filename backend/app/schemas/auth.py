from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    """What we expect when someone tries to register."""
    email: EmailStr        # pydantic automatically validates email format
    password: str

class UserLogin(BaseModel):
    """What we expect for login."""
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    """What we send back after successful login."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    """Safe user data to send to frontend (NO password)."""
    id: int
    email: str
    is_active: bool
    is_pro: bool
    
    class Config:
        from_attributes = True   # allows converting SQLAlchemy model → this schema
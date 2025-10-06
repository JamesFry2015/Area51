from datetime import datetime, timedelta, timezone
from typing import Optional
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

# We import the database functions and models we've already created.
from . import crud, models, schemas
from .database import get_db

# --- Security Configuration ---

import os

# --- Security Configuration ---

# This is a secret key used to sign the JWTs.
# It's loaded from an environment variable for security.
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("No SECRET_KEY set for JWT signing. Please set the environment variable.")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# This object handles our password hashing. We specify that we want to use
# the "bcrypt" algorithm.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# This FastAPI dependency utility will look for a token in the request's
# "Authorization" header and return it. The tokenUrl tells it which endpoint
# the frontend should use to get the token (we'll create this soon).
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


# --- Password Functions ---

def verify_password(plain_password, hashed_password):
    """Compares a plain-text password with its hashed version."""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    """Generates a secure hash for a plain-text password."""
    return pwd_context.hash(password)


# --- JWT Token Functions ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Creates a new JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# --- User Dependency ---

async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
):
    """
    This is a dependency that our API endpoints will use to get the currently
    logged-in user from a token. It decodes the token, validates it, and
    fetches the user from the database.
    """
    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = schemas.UserBase(username=username) # You can add more token data fields here
    except JWTError:
        raise credentials_exception
    
    user = await crud.get_user_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

from dotenv import load_dotenv
import os
load_dotenv()
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware

from . import auth, crud, models, schemas
from .database import engine, get_db, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn: await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# --- User Endpoints ---
@app.post("/users/", response_model=schemas.UserSchema)
async def create_user(user: schemas.UserCreate, db: AsyncSession = Depends(get_db)):
    db_user = await crud.get_user_by_username(db, username=user.username)
    if db_user: raise HTTPException(status_code=400, detail="Username already registered")
    hashed_password = auth.get_password_hash(user.password)
    new_user = await crud.create_user(db=db, user=user, hashed_password=hashed_password)
    return new_user

@app.post("/token")
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    user = await crud.get_user_by_username(db, username=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    access_token = auth.create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me/", response_model=schemas.UserSchema)
async def read_users_me(current_user: models.User = Depends(auth.get_current_user)): return current_user

# --- MainCard Endpoints ---
@app.post("/main-cards/", response_model=schemas.MainCardSchema)
async def create_main_card(main_card: schemas.MainCardCreate, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    return await crud.create_main_card(db=db, main_card=main_card, user_id=current_user.id)

@app.get("/main-cards/", response_model=List[schemas.MainCardSchema])
async def read_main_cards(current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    return await crud.get_main_cards(db=db, user_id=current_user.id)

@app.get("/main-cards/{main_card_id}", response_model=schemas.MainCardSchema)
async def read_main_card(main_card_id: int, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    db_main_card = await crud.get_main_card(db=db, main_card_id=main_card_id, user_id=current_user.id)
    if db_main_card is None:
        raise HTTPException(status_code=404, detail="Main Card not found")
    return db_main_card

# --- API Configuration Endpoints ---
@app.post("/api-configs/", response_model=schemas.ApiConfigSchema)
async def create_api_config(
    config: schemas.ApiConfigCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.create_api_config(db=db, config=config, user_id=current_user.id)

@app.get("/api-configs/", response_model=List[schemas.ApiConfigSchema])
async def read_api_configs(
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    return await crud.get_api_configs(db=db, user_id=current_user.id)

@app.patch("/api-configs/{config_id}", response_model=schemas.ApiConfigSchema)
async def update_api_config(config_id: int, config_update: schemas.ApiConfigUpdate, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    db_config = await crud.get_api_config(db, config_id=config_id, user_id=current_user.id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return await crud.update_api_config(db=db, db_config=db_config, config_update=config_update)

@app.delete("/api-configs/{config_id}")
async def delete_api_config(config_id: int, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    db_config = await crud.get_api_config(db, config_id=config_id, user_id=current_user.id)
    if not db_config:
        raise HTTPException(status_code=404, detail="Configuration not found")
    return await crud.delete_api_config(db=db, db_config=db_config)

# --- Chat Endpoints ---
@app.post("/main-cards/{main_card_id}/chats/", response_model=schemas.ChatSchema)
async def create_chat_in_main_card(main_card_id: int, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    main_card = await crud.get_main_card(db=db, main_card_id=main_card_id, user_id=current_user.id)
    if not main_card:
        raise HTTPException(status_code=404, detail="Main Card not found or you don't have permission.")
    return await crud.create_chat_in_main_card(db=db, main_card_id=main_card_id)

@app.get("/chats/{chat_id}", response_model=schemas.ChatSchema)
async def read_chat(chat_id: int, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    chat = await crud.get_chat(db, chat_id=chat_id, user_id=current_user.id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

@app.post("/chats/{chat_id}/messages", response_model=schemas.ChatSchema)
async def chat_completion(chat_id: int, request: schemas.ChatCompletionRequest, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    chat = await crud.get_chat(db, chat_id=chat_id, user_id=current_user.id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return await crud.get_chat_completion(db=db, chat=chat, request=request)


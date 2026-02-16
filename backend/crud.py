from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import flag_modified

from . import models, schemas

# --- Helper: Safe Message Appender ---
async def append_message_to_chat(db: AsyncSession, chat_id: int, role: str, content: str, images: list = None):
    """Safely appends a message to the chat history and commits it."""
    result = await db.execute(select(models.Chat).filter(models.Chat.id == chat_id))
    chat = result.scalars().first()
    
    if not chat:
        return None

    current_history = list(chat.history) if chat.history else []
    
    new_message = {
        "role": role,
        "content": content,
        "versions": [content],
        "current_version": 0,
        "images": images or []
    }
    
    current_history.append(new_message)
    chat.history = current_history
    
    flag_modified(chat, "history")
    await db.commit()
    await db.refresh(chat)
    return chat

async def add_version_to_last_message(db: AsyncSession, chat_id: int, content: str):
    """Adds a new version to the LAST message in the history."""
    result = await db.execute(select(models.Chat).filter(models.Chat.id == chat_id))
    chat = result.scalars().first()
    
    if not chat or not chat.history:
        return None

    current_history = list(chat.history)
    last_msg_index = len(current_history) - 1
    last_msg = current_history[last_msg_index]

    if "versions" not in last_msg:
        last_msg["versions"] = [last_msg["content"]]
        last_msg["current_version"] = 0
    
    last_msg["versions"].append(content)
    last_msg["current_version"] = len(last_msg["versions"]) - 1
    last_msg["content"] = content
    
    current_history[last_msg_index] = last_msg
    chat.history = current_history
    
    flag_modified(chat, "history")
    await db.commit()
    await db.refresh(chat)
    return chat

# --- User CRUD Functions ---
async def get_user_by_username(db: AsyncSession, username: str):
    result = await db.execute(select(models.User).filter(models.User.username == username))
    return result.scalars().first()

async def get_user_by_username_with_relations(db: AsyncSession, username: str):
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.main_cards).selectinload(models.MainCard.chats),
            selectinload(models.User.api_configs)
        )
        .filter(models.User.username == username)
    )
    return result.scalars().first()

async def create_user(db: AsyncSession, user: schemas.UserCreate, hashed_password: str):
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

# --- MainCard CRUD Functions ---
async def get_main_cards(db: AsyncSession, user_id: int):
    result = await db.execute(
        select(models.MainCard)
        .options(selectinload(models.MainCard.chats))
        .filter(models.MainCard.owner_id == user_id)
    )
    return result.scalars().all()

async def get_main_card(db: AsyncSession, main_card_id: int, user_id: int):
    result = await db.execute(
        select(models.MainCard)
        .options(selectinload(models.MainCard.chats))
        .filter(models.MainCard.id == main_card_id, models.MainCard.owner_id == user_id)
    )
    return result.scalars().first()

async def create_main_card(db: AsyncSession, main_card: schemas.MainCardCreate, user_id: int):
    db_main_card = models.MainCard(**main_card.model_dump(), owner_id=user_id)
    db.add(db_main_card)
    await db.commit()
    await db.refresh(db_main_card)
    return db_main_card

async def update_main_card(db: AsyncSession, db_main_card: models.MainCard, main_card_update: schemas.MainCardUpdate):
    update_data = main_card_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_main_card, key, value)
    await db.commit()
    await db.refresh(db_main_card)
    return db_main_card

async def delete_main_card(db: AsyncSession, db_main_card: models.MainCard):
    await db.delete(db_main_card)
    await db.commit()
    return {"ok": True}

# --- API Configuration CRUD Functions ---
async def get_api_configs(db: AsyncSession, user_id: int):
    result = await db.execute(select(models.ApiConfig).filter(models.ApiConfig.owner_id == user_id))
    return result.scalars().all()

async def get_api_config(db: AsyncSession, config_id: int, user_id: int):
    result = await db.execute(select(models.ApiConfig).filter(models.ApiConfig.id == config_id, models.ApiConfig.owner_id == user_id))
    return result.scalars().first()

async def create_api_config(db: AsyncSession, config: schemas.ApiConfigCreate, user_id: int):
    db_config = models.ApiConfig(**config.model_dump(), owner_id=user_id)
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def update_api_config(db: AsyncSession, db_config: models.ApiConfig, config_update: schemas.ApiConfigUpdate):
    update_data = config_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_config, key, value)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def delete_api_config(db: AsyncSession, db_config: models.ApiConfig):
    await db.delete(db_config)
    await db.commit()
    return {"ok": True}

# --- Chat CRUD Functions ---
async def get_chat(db: AsyncSession, chat_id: int, user_id: int):
    result = await db.execute(
        select(models.Chat).join(models.MainCard).filter(models.Chat.id == chat_id, models.MainCard.owner_id == user_id)
    )
    return result.scalars().first()

async def create_chat_in_main_card(db: AsyncSession, main_card_id: int):
    db_chat = models.Chat(main_card_id=main_card_id, history=[])
    db.add(db_chat)
    await db.commit()
    await db.refresh(db_chat)
    return db_chat

async def update_chat(db: AsyncSession, chat: models.Chat, chat_update: schemas.ChatUpdate):
    update_data = chat_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(chat, key, value)
    await db.commit()
    await db.refresh(chat)
    return chat

async def delete_chat(db: AsyncSession, chat: models.Chat):
    await db.delete(chat)
    await db.commit()
    return {"ok": True}
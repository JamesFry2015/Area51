from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import os
import httpx
from fastapi import HTTPException

from . import models, schemas

# --- User CRUD Functions ---
async def get_user_by_username(db: AsyncSession, username: str):
    """Asynchronously fetches a user by username without loading relationships."""
    result = await db.execute(select(models.User).filter(models.User.username == username))
    return result.scalars().first()

async def get_user_by_username_with_relations(db: AsyncSession, username: str):
    """Asynchronously fetches a user, eagerly loading their relationships."""
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
    """Creates a new user in the database."""
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

# --- MainCard CRUD Functions ---
async def get_main_cards(db: AsyncSession, user_id: int):
    """Fetches all Main Cards for a user, eagerly loading their chats."""
    result = await db.execute(
        select(models.MainCard)
        .options(selectinload(models.MainCard.chats))
        .filter(models.MainCard.owner_id == user_id)
    )
    return result.scalars().all()

async def get_main_card(db: AsyncSession, main_card_id: int, user_id: int):
    """Fetches a single Main Card for a user, eagerly loading its chats."""
    result = await db.execute(
        select(models.MainCard)
        .options(selectinload(models.MainCard.chats))
        .filter(models.MainCard.id == main_card_id, models.MainCard.owner_id == user_id)
    )
    return result.scalars().first()

async def create_main_card(db: AsyncSession, main_card: schemas.MainCardCreate, user_id: int):
    """Creates a new Main Card for a user."""
    db_main_card = models.MainCard(**main_card.model_dump(), owner_id=user_id)
    db.add(db_main_card)
    await db.commit()
    await db.refresh(db_main_card)
    return db_main_card

async def update_main_card(db: AsyncSession, db_main_card: models.MainCard, main_card_update: schemas.MainCardUpdate):
    """Updates an existing Main Card."""
    update_data = main_card_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_main_card, key, value)
    await db.commit()
    await db.refresh(db_main_card)
    return db_main_card

async def delete_main_card(db: AsyncSession, db_main_card: models.MainCard):
    """Deletes a Main Card."""
    await db.delete(db_main_card)
    await db.commit()
    return {"ok": True}

# --- API Configuration CRUD Functions ---
async def get_api_configs(db: AsyncSession, user_id: int):
    """Fetches all API configurations for a user."""
    result = await db.execute(select(models.ApiConfig).filter(models.ApiConfig.owner_id == user_id))
    return result.scalars().all()

async def get_api_config(db: AsyncSession, config_id: int, user_id: int):
    """Fetches a single API configuration for a user."""
    result = await db.execute(select(models.ApiConfig).filter(models.ApiConfig.id == config_id, models.ApiConfig.owner_id == user_id))
    return result.scalars().first()

async def create_api_config(db: AsyncSession, config: schemas.ApiConfigCreate, user_id: int):
    """Creates a new API configuration for a user."""
    db_config = models.ApiConfig(**config.model_dump(), owner_id=user_id)
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def update_api_config(db: AsyncSession, db_config: models.ApiConfig, config_update: schemas.ApiConfigUpdate):
    """Updates an existing API configuration."""
    update_data = config_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_config, key, value)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def delete_api_config(db: AsyncSession, db_config: models.ApiConfig):
    """Deletes an API configuration."""
    await db.delete(db_config)
    await db.commit()
    return {"ok": True}

# --- Chat CRUD Functions ---
async def get_chat(db: AsyncSession, chat_id: int, user_id: int):
    """Fetches a single chat session, ensuring it belongs to the user."""
    result = await db.execute(
        select(models.Chat).join(models.MainCard).filter(models.Chat.id == chat_id, models.MainCard.owner_id == user_id)
    )
    return result.scalars().first()

async def create_chat_in_main_card(db: AsyncSession, main_card_id: int):
    """Creates a new, empty chat session within a Main Card."""
    db_chat = models.Chat(main_card_id=main_card_id)
    db.add(db_chat)
    await db.commit()
    await db.refresh(db_chat)
    return db_chat

async def get_chat_completion(db: AsyncSession, chat: models.Chat, request: schemas.ChatCompletionRequest):
    """Handles the full logic of getting an LLM response for a chat turn."""
    main_card = await db.get(models.MainCard, chat.main_card_id)
    
    api_messages = []
    # Prepend system prompts and memory
    if main_card.description:
        api_messages.append({"role": "system", "content": main_card.description})
    if chat.system_prompt:
        api_messages.append({"role": "system", "content": chat.system_prompt})
    if chat.chat_memory:
        api_messages.append({"role": "system", "content": f"Chat Memory (for context):\n{chat.chat_memory}"})

    # Add initial prompts and chat history
    if main_card.initial_message:
        api_messages.append({"role": "user", "content": main_card.initial_message})
    if main_card.example_response:
        api_messages.append({"role": "assistant", "content": main_card.example_response})
    
    current_history = list(chat.history)
    current_history.append({"role": "user", "content": request.message})
    api_messages.extend(current_history)

    if request.response_prefill:
        api_messages.append({"role": "assistant", "content": request.response_prefill})
    
    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is missing.")

    headers = {"Authorization": f"Bearer {api_key.strip()}", "Content-Type": "application/json"}
    
    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'response_prefill', 'request_body']
    }
    payload["messages"] = api_messages

    if request.request_body:
        payload.update(request.request_body)
    
    timeout = httpx.Timeout(10.0, read=60.0)
    transport = httpx.AsyncHTTPTransport(retries=2)

    try:
        async with httpx.AsyncClient(transport=transport, timeout=timeout) as client:
            response = await client.post(request.base_url, headers=headers, json=payload)
            response.raise_for_status()
            response_message_content = response.json()['choices'][0]['message']['content']

        final_message = (request.response_prefill or "") + response_message_content

        current_history.append({"role": "assistant", "content": final_message})
        chat.history = current_history
        await db.commit()
        await db.refresh(chat)
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

    return chat

async def update_chat(db: AsyncSession, chat: models.Chat, chat_update: schemas.ChatUpdate):
    """Updates a chat session."""
    update_data = chat_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(chat, key, value)
    await db.commit()
    await db.refresh(chat)
    return chat

async def delete_chat(db: AsyncSession, chat: models.Chat):
    """Deletes a chat session."""
    await db.delete(chat)
    await db.commit()
    return {"ok": True}
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import json, os, httpx
from fastapi import HTTPException

from . import models, schemas

# --- User CRUD Functions ---
async def get_user_by_username(db: AsyncSession, username: str):
    """
    Asynchronously fetches a user by username without loading relationships.
    """
    result = await db.execute(
        select(models.User).filter(models.User.username == username)
    )
    return result.scalars().first()

async def get_user_by_username_with_relations(db: AsyncSession, username: str):
    """
    Asynchronously fetches a user, eagerly loading their relationships.
    """
    result = await db.execute(
        select(models.User)
        .options(
            selectinload(models.User.main_cards).selectinload(models.MainCard.chats),
            selectinload(models.User.api_configs)
        )
        .filter(models.User.username == username)
    )
    user = result.scalars().first()
    return user

async def create_user(db: AsyncSession, user: schemas.UserCreate, hashed_password: str):
    """
    Creates a new user in the database.
    """
    db_user = models.User(username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

# --- MainCard CRUD Functions ---
async def get_main_cards(db: AsyncSession, user_id: int):
    """
    Fetches all Main Cards for a user, eagerly loading their chats.
    """
    result = await db.execute(
        select(models.MainCard)
        .options(selectinload(models.MainCard.chats)) 
        .filter(models.MainCard.owner_id == user_id)
    )
    main_cards = result.scalars().all()
    # History is now automatically handled by the JSON type
    return main_cards

async def get_main_card(db: AsyncSession, main_card_id: int, user_id: int):
    """
    Fetches a single Main Card for a user, eagerly loading its chats.
    """
    result = await db.execute(
        select(models.MainCard)
        .options(selectinload(models.MainCard.chats))
        .filter(models.MainCard.id == main_card_id, models.MainCard.owner_id == user_id)
    )
    main_card = result.scalars().first()
    # History is now automatically handled by the JSON type
    return main_card

async def create_main_card(db: AsyncSession, main_card: schemas.MainCardCreate, user_id: int):
    """
    Creates a new Main Card for a user.
    """
    db_main_card = models.MainCard(**main_card.model_dump(), owner_id=user_id)
    db.add(db_main_card)
    await db.commit()
    await db.refresh(db_main_card)
    return db_main_card

async def update_main_card(db: AsyncSession, db_main_card: models.MainCard, main_card_update: schemas.MainCardUpdate):
    """
    Updates an existing Main Card.
    """
    update_data = main_card_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_main_card, key, value)
    await db.commit()
    await db.refresh(db_main_card)
    return db_main_card

async def delete_main_card(db: AsyncSession, db_main_card: models.MainCard):
    """
    Deletes a Main Card.
    """
    await db.delete(db_main_card)
    await db.commit()
    return {"ok": True}

# --- API Configuration CRUD Functions ---
async def get_api_configs(db: AsyncSession, user_id: int):
    """
    Fetches all API configurations for a user.
    """
    result = await db.execute(select(models.ApiConfig).filter(models.ApiConfig.owner_id == user_id))
    return result.scalars().all()

async def get_api_config(db: AsyncSession, config_id: int, user_id: int):
    """
    Fetches a single API configuration for a user.
    """
    result = await db.execute(select(models.ApiConfig).filter(models.ApiConfig.id == config_id, models.ApiConfig.owner_id == user_id))
    return result.scalars().first()

async def create_api_config(db: AsyncSession, config: schemas.ApiConfigCreate, user_id: int):
    """
    Creates a new API configuration for a user.
    """
    db_config = models.ApiConfig(**config.model_dump(), owner_id=user_id)
    db.add(db_config)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def update_api_config(db: AsyncSession, db_config: models.ApiConfig, config_update: schemas.ApiConfigUpdate):
    """
    Updates an existing API configuration.
    """
    for key, value in config_update.model_dump(exclude_unset=True).items():
        setattr(db_config, key, value)
    await db.commit()
    await db.refresh(db_config)
    return db_config

async def delete_api_config(db: AsyncSession, db_config: models.ApiConfig):
    """
    Deletes an API configuration.
    """
    await db.delete(db_config)
    await db.commit()
    return {"ok": True}

# --- Chat CRUD Functions ---
async def get_chat(db: AsyncSession, chat_id: int, user_id: int):
    """
    Fetches a single chat session, ensuring it belongs to the user.
    """
    result = await db.execute(
        select(models.Chat).join(models.MainCard).filter(models.Chat.id == chat_id, models.MainCard.owner_id == user_id)
    )
    chat = result.scalars().first()
    # History is now automatically handled by the JSON type
    return chat

async def create_chat_in_main_card(db: AsyncSession, main_card_id: int):
    """
    Creates a new, empty chat session within a Main Card.
    """
    # The 'history' field defaults to an empty list, so no need to set it
    db_chat = models.Chat(main_card_id=main_card_id)
    db.add(db_chat)
    await db.commit()
    await db.refresh(db_chat)
    return db_chat

async def get_chat_completion(db: AsyncSession, chat: models.Chat, request: schemas.ChatCompletionRequest):
    """
    Handles the full logic of getting an LLM response for a chat turn.
    """
    # Eagerly load the parent main card to access its properties
    main_card = await db.get(models.MainCard, chat.main_card_id)
    
    # Build the initial history from the Main Card's prompts
    initial_history = []
    if main_card.initial_message:
        initial_history.append({"role": "user", "content": main_card.initial_message})
    if main_card.example_response:
        initial_history.append({"role": "assistant", "content": main_card.example_response})
    
    # Add the user's new message and build the full message list for the API
    current_history = list(chat.history)
    current_history.append({"role": "user", "content": request.message})

    api_messages = [{"role": "system", "content": main_card.description}] if main_card.description else []
    api_messages.extend(initial_history)
    api_messages.extend(current_history)

    # Handle response_prefill by adding it as the last assistant message
    if request.response_prefill:
        api_messages.append({"role": "assistant", "content": request.response_prefill})
    
    # Since model and base_url are now required by the schema, we can use them directly.
    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    api_url = request.base_url

    if not api_key:
        raise HTTPException(status_code=400, detail="API key is missing. Please provide one in the chat settings or set OPENROUTER_API_KEY.")

    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Area51 Chat App"
    }
    
    # Build the payload, excluding any null values and fields handled separately.
    # The context_window parameter is passed through, assuming the proxy/model API supports it.
    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'response_prefill']
    }
    payload["messages"] = api_messages
    
    # Define more robust transport settings for production
    timeout = httpx.Timeout(10.0, read=60.0)  # 10s connect, 60s read
    transport = httpx.AsyncHTTPTransport(retries=2) # Retry up to 2 times on transport errors

    # Make the API call and handle potential errors
    try:
        async with httpx.AsyncClient(transport=transport, timeout=timeout) as client:
            response = await client.post(api_url, headers=headers, json=payload)
            response.raise_for_status()
            response_message_content = response.json()['choices'][0]['message']['content']

        # Combine prefill with the model's response if it was used
        if request.response_prefill:
            final_message = request.response_prefill + response_message_content
        else:
            final_message = response_message_content

        # On success, append the final assistant message to history
        current_history.append({"role": "assistant", "content": final_message})
        chat.history = current_history
        await db.commit()
        await db.refresh(chat)
    except httpx.HTTPStatusError as e:
        # Do not save the error to history; raise an exception for the endpoint to handle
        raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
    except Exception as e:
        # Do not save the error to history
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

    return chat

async def delete_chat(db: AsyncSession, chat: models.Chat):
    """
    Deletes a chat session.
    """
    await db.delete(chat)
    await db.commit()
    return {"ok": True}

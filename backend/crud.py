from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import json, os, httpx

from . import models, schemas

# --- User CRUD Functions ---
async def get_user_by_username(db: AsyncSession, username: str):
    """
    Asynchronously fetches a user, eagerly loading their relationships
    to prevent async loading issues.
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
    # Manually decode the history for each chat within each main card.
    if user:
        for card in user.main_cards:
            for chat in card.chats:
                chat.history = json.loads(chat.history_json)
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
    # Manually decode the history for each chat within each main card.
    for card in main_cards:
        for chat in card.chats:
            chat.history = json.loads(chat.history_json)
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
    # Also apply the history decoding here for consistency.
    if main_card:
        for chat in main_card.chats:
            chat.history = json.loads(chat.history_json)
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
    if chat:
        chat.history = json.loads(chat.history_json)
    return chat

async def create_chat_in_main_card(db: AsyncSession, main_card_id: int):
    """
    Creates a new, empty chat session within a Main Card.
    """
    db_chat = models.Chat(main_card_id=main_card_id, history_json='[]')
    db.add(db_chat)
    await db.commit()
    await db.refresh(db_chat)
    db_chat.history = json.loads(db_chat.history_json)
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
    chat.history.append({"role": "user", "content": request.message})
    api_messages = [{"role": "system", "content": main_card.description}] if main_card.description else []
    api_messages.extend(initial_history)
    api_messages.extend(chat.history)
    
    # Determine which API key and URL to use
    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    api_url = request.base_url or "https://openrouter.ai/api/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key.strip()}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:8000",
        "X-Title": "Area51 Chat App"
    }
    
    # Build the payload, excluding any null values
    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'reasoning']
    }
    if request.reasoning:
        payload['reasoning'] = { "enabled": True }
    payload["model"] = payload.get("model") or "openrouter/auto"
    payload["messages"] = api_messages
    
    # Make the API call and handle potential errors
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(api_url, headers=headers, json=payload, timeout=60.0)
            response.raise_for_status()
            response_data = response.json()
            response_choice = response_data['choices'][0]
            response_message_content = response_choice['message']['content']
            response_reasoning = response_choice['message'].get('reasoning')

        assistant_message = {
            "role": "assistant",
            "content": response_message_content,
            "reasoning": response_reasoning
        }
        chat.history.append(assistant_message)
        chat.history_json = json.dumps(chat.history)
        await db.commit()
        await db.refresh(chat)

        # Decode the history again before returning
        chat.history = json.loads(chat.history_json)
        return chat

    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")


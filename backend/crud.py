from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import os
import json
import httpx
from fastapi import HTTPException
from sqlalchemy.orm.attributes import flag_modified

from . import models, schemas

# --- Helper: Safe Message Appender ---
async def append_message_to_chat(db: AsyncSession, chat_id: int, role: str, content: str):
    """Safely appends a message to the chat history and commits it."""
    result = await db.execute(select(models.Chat).filter(models.Chat.id == chat_id))
    chat = result.scalars().first()
    
    if not chat:
        return None

    current_history = list(chat.history) if chat.history else []
    
    # Initialize versioning structure
    new_message = {
        "role": role,
        "content": content,
        "versions": [content],
        "current_version": 0
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
    last_msg = current_history[last_msg_index] # This is a dict

    # Ensure keys exist (migration for old messages)
    if "versions" not in last_msg:
        last_msg["versions"] = [last_msg["content"]]
        last_msg["current_version"] = 0
    
    # Add new version
    last_msg["versions"].append(content)
    last_msg["current_version"] = len(last_msg["versions"]) - 1
    last_msg["content"] = content # Update main content display
    
    # Update list
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

async def get_chat_completion(db: AsyncSession, chat: models.Chat, request: schemas.ChatCompletionRequest):
    # If not regenerating, save user message
    if not request.regenerate and request.message:
        await append_message_to_chat(db, chat.id, "user", request.message)
        await db.refresh(chat) 

    main_card = await db.get(models.MainCard, chat.main_card_id)
    
    api_messages = []
    if main_card.description:
        api_messages.append({"role": "system", "content": main_card.description})
    if chat.system_prompt:
        api_messages.append({"role": "system", "content": chat.system_prompt})
    if chat.chat_memory:
        api_messages.append({"role": "system", "content": f"Chat Memory (for context):\n{chat.chat_memory}"})

    if main_card.initial_message:
        api_messages.append({"role": "user", "content": main_card.initial_message})
    if main_card.example_response:
        api_messages.append({"role": "assistant", "content": main_card.example_response})
    
    # Use current history. If regenerating, the history already contains the user prompt.
    for msg in chat.history:
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    if request.response_prefill:
        api_messages.append({"role": "assistant", "content": request.response_prefill})
    
    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is missing.")

    headers = {"Authorization": f"Bearer {api_key.strip()}", "Content-Type": "application/json"}
    
    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'response_prefill', 'request_body', 'stream', 'regenerate']
    }
    payload["messages"] = api_messages

    if request.stream:
        payload["stream"] = True

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
        
        if request.regenerate:
            await add_version_to_last_message(db, chat.id, final_message)
        else:
            await append_message_to_chat(db, chat.id, "assistant", final_message)
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

    return chat

async def get_chat_completion_stream(db: AsyncSession, chat: models.Chat, request: schemas.ChatCompletionRequest):
    """
    Handles streaming LLM response. 
    """
    main_card = await db.get(models.MainCard, chat.main_card_id)

    # 1. Prepare API Messages
    api_messages = []
    if main_card.description:
        api_messages.append({"role": "system", "content": main_card.description})
    if chat.system_prompt:
        api_messages.append({"role": "system", "content": chat.system_prompt})
    if chat.chat_memory:
        api_messages.append({"role": "system", "content": f"Chat Memory (for context):\n{chat.chat_memory}"})

    if main_card.initial_message:
        api_messages.append({"role": "user", "content": main_card.initial_message})
    if main_card.example_response:
        api_messages.append({"role": "assistant", "content": main_card.example_response})

    # Add existing chat history
    # IMPORTANT: The chat.history already contains the user message (saved in main.py)
    # or the full conversation context if regenerating.
    for msg in chat.history:
        api_messages.append({"role": msg["role"], "content": msg["content"]})

    if request.response_prefill:
        api_messages.append({"role": "assistant", "content": request.response_prefill})

    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        yield f"data: Error: API key is missing. Check your settings.\n\n"
        return

    headers = {"Authorization": f"Bearer {api_key.strip()}", "Content-Type": "application/json"}

    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'response_prefill', 'request_body', 'stream', 'regenerate']
    }
    payload["messages"] = api_messages
    payload["stream"] = True

    if request.request_body:
        payload.update(request.request_body)

    timeout = httpx.Timeout(10.0, read=120.0)

    accumulated_content = ""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", request.base_url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"data: Error: API responded with status {response.status_code}: {error_text.decode('utf-8')}\n\n"
                    return

                async for chunk in response.aiter_lines():
                    if chunk.startswith("data: "):
                        data = chunk[6:]
                        if data.strip() == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            json_data = json.loads(data)
                            content = json_data['choices'][0]['delta'].get('content', '')
                            if content:
                                accumulated_content += content
                                chunk_data = json.dumps({"choices": [{"delta": {"content": content}}]})
                                yield f"data: {chunk_data}\n\n"
                        except Exception:
                            pass
    except httpx.ConnectError:
        yield f"data: Error: Could not connect to the API URL. Check the URL in settings.\n\n"
    except Exception as e:
        yield f"data: Error: {str(e)}\n\n"
    finally:
        # Save aggregated response to DB
        if accumulated_content:
            try:
                final_text = (request.response_prefill or "") + accumulated_content
                if request.regenerate:
                    print("DEBUG: Regenerating - adding version to last message.")
                    await add_version_to_last_message(db, chat.id, final_text)
                else:
                    print("DEBUG: Normal generation - appending new message.")
                    await append_message_to_chat(db, chat.id, "assistant", final_text)
            except Exception as e:
                print(f"DEBUG: Critical Error saving assistant response: {str(e)}")

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
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

async def get_chat_completion(db: AsyncSession, chat: models.Chat, request: schemas.ChatCompletionRequest):
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
    
    # Process history for images
    for msg in chat.history:
        content = msg.get("content", "")
        images = msg.get("images", [])
        
        if images:
            content_list = [{"type": "text", "text": content}]
            for img in images:
                content_list.append({
                    "type": "image_url",
                    "image_url": {"url": img}
                })
            api_messages.append({"role": msg["role"], "content": content_list})
        else:
            api_messages.append({"role": msg["role"], "content": content})

    if request.response_prefill:
        api_messages.append({"role": "assistant", "content": request.response_prefill})
    
    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is missing.")

    headers = {"Authorization": f"Bearer {api_key.strip()}", "Content-Type": "application/json"}
    
    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'response_prefill', 'request_body', 'stream', 'regenerate', 'images']
    }
    payload["messages"] = api_messages

    if request.stream:
        payload["stream"] = True

    if request.request_body:
        payload.update(request.request_body)
    
    timeout = httpx.Timeout(10.0, read=600.0)
    transport = httpx.AsyncHTTPTransport(retries=2)

    try:
        async with httpx.AsyncClient(transport=transport, timeout=timeout) as client:
            response = await client.post(request.base_url, headers=headers, json=payload)
            response.raise_for_status()
            response_message_content = response.json()['choices'][0]['message']['content']

        # FIX: Check if content is empty (e.g. strict reasoning exclusion) and raise error
        if not response_message_content and not request.response_prefill:
             error_msg = "Error: Model returned no content. Check 'reasoning' settings or max tokens."
             await append_message_to_chat(db, chat.id, "assistant", error_msg)
             return chat

        final_message = (request.response_prefill or "") + response_message_content
        
        last_role = chat.history[-1]["role"] if chat.history else None

        if request.regenerate and last_role == "assistant":
            await add_version_to_last_message(db, chat.id, final_message)
        else:
            await append_message_to_chat(db, chat.id, "assistant", final_message)
        
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")

    return chat

async def get_chat_completion_stream(db: AsyncSession, chat: models.Chat, request: schemas.ChatCompletionRequest):
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

    # Process history for images
    for msg in chat.history:
        content = msg.get("content", "")
        images = msg.get("images", [])
        
        if images:
            content_list = [{"type": "text", "text": content}]
            for img in images:
                content_list.append({
                    "type": "image_url",
                    "image_url": {"url": img}
                })
            api_messages.append({"role": msg["role"], "content": content_list})
        else:
            api_messages.append({"role": msg["role"], "content": content})

    if request.response_prefill:
        api_messages.append({"role": "assistant", "content": request.response_prefill})

    api_key = request.api_key or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        yield f"data: Error: API key is missing. Check your settings.\n\n"
        return

    headers = {"Authorization": f"Bearer {api_key.strip()}", "Content-Type": "application/json"}

    payload = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k not in ['api_key', 'base_url', 'message', 'response_prefill', 'request_body', 'stream', 'regenerate', 'images']
    }
    payload["messages"] = api_messages
    payload["stream"] = True

    if request.request_body:
        payload.update(request.request_body)

    timeout = httpx.Timeout(10.0, read=600.0)

    accumulated_content = ""
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", request.base_url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    error_msg = f"Error: API responded with status {response.status_code}: {error_text.decode('utf-8')}"
                    yield f"data: {error_msg}\n\n"
                    accumulated_content = error_msg 
                    return

                async for chunk in response.aiter_lines():
                    if chunk.startswith("data: "):
                        data = chunk[6:]
                        if data.strip() == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            json_data = json.loads(data)
                            
                            if "error" in json_data:
                                error_msg = f"Error: {json_data['error'].get('message', 'Unknown API Error')}"
                                yield f"data: {error_msg}\n\n"
                                accumulated_content = error_msg
                                return

                            choices = json_data.get('choices', [])
                            if not choices:
                                continue
                                
                            delta = choices[0].get('delta', {})
                            content = delta.get('content', '')
                            
                            if content:
                                accumulated_content += content
                                chunk_data = json.dumps({"choices": [{"delta": {"content": content}}]})
                                yield f"data: {chunk_data}\n\n"
                        except Exception:
                            pass
    except httpx.ConnectError:
        error_msg = "Error: Could not connect to the API URL. Check the URL in settings."
        yield f"data: {error_msg}\n\n"
        accumulated_content = error_msg
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        yield f"data: {error_msg}\n\n"
        if not accumulated_content:
            accumulated_content = error_msg
        else:
            accumulated_content += f"\n\n[{error_msg}]"
    finally:
        if not accumulated_content:
            error_msg = "Error: The model returned no content. This might happen if 'reasoning' settings excluded all output, or if the model failed to produce a response."
            yield f"data: {error_msg}\n\n"
            accumulated_content = error_msg

        if accumulated_content:
            try:
                final_text = (request.response_prefill or "") + accumulated_content
                
                last_role = chat.history[-1]["role"] if chat.history else None

                if request.regenerate and last_role == "assistant":
                    await add_version_to_last_message(db, chat.id, final_text)
                else:
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
from pydantic import BaseModel
from typing import List, Optional

# --- Message & Completion Schemas ---
class Message(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    message: str
    model: str
    base_url: str
    api_key: Optional[str] = None
    temperature: Optional[float] = 1.0
    max_tokens: Optional[int] = None
    context_window: Optional[int] = None
    top_p: Optional[float] = 1.0
    top_k: Optional[int] = -1
    repetition_penalty: Optional[float] = 1.0
    frequency_penalty: Optional[float] = 0.0
    response_prefill: Optional[str] = None

# --- Chat & MainCard Schemas ---
class ChatBase(BaseModel):
    name: str
    system_prompt: Optional[str] = None
    chat_memory: Optional[str] = None

class ChatCreate(ChatBase):
    pass

class ChatUpdate(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    chat_memory: Optional[str] = None

class ChatSchema(ChatBase):
    id: int
    main_card_id: int
    history: List[Message]
    class Config:
        from_attributes = True

class MainCardBase(BaseModel):
    name: str
    description: Optional[str] = None
    initial_message: Optional[str] = None
    example_response: Optional[str] = None

class MainCardCreate(MainCardBase):
    pass

class MainCardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    initial_message: Optional[str] = None
    example_response: Optional[str] = None

class MainCardSchema(MainCardBase):
    id: int
    owner_id: int
    chats: List[ChatSchema] = []
    class Config:
        from_attributes = True

# --- API Configuration Schemas ---
class ApiConfigBase(BaseModel):
    name: str
    model: str
    proxy_url: str
    custom_prompt: Optional[str] = None

class ApiConfigCreate(ApiConfigBase):
    api_key: Optional[str] = None

class ApiConfigUpdate(BaseModel):
    name: Optional[str] = None
    model: Optional[str] = None
    proxy_url: Optional[str] = None
    api_key: Optional[str] = None
    custom_prompt: Optional[str] = None

class ApiConfigSchema(ApiConfigBase):
    id: int
    owner_id: int
    # api_key is intentionally omitted from this response schema for security
    class Config:
        from_attributes = True

# --- User Schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class UserSchema(UserBase):
    id: int
    main_cards: List[MainCardSchema] = []
    api_configs: List[ApiConfigSchema] = []
    class Config:
        from_attributes = True
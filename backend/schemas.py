from pydantic import BaseModel
from typing import List, Optional

# --- Message & Completion Schemas (no change) ---
class Message(BaseModel):
    role: str
    content: str
class ChatCompletionRequest(BaseModel):
    message: str; model: Optional[str] = None; api_key: Optional[str] = None
    base_url: Optional[str] = None; temperature: Optional[float] = 1.0; top_p: Optional[float] = 1.0
    top_k: Optional[int] = -1; repetition_penalty: Optional[float] = 1.0; frequency_penalty: Optional[float] = 0.0

# --- Chat & MainCard Schemas (no change) ---
class ChatBase(BaseModel): pass
class ChatCreate(ChatBase): pass
class ChatSchema(ChatBase):
    id: int; main_card_id: int; history: List[Message]
    class Config: from_attributes = True
class MainCardBase(BaseModel):
    name: str; description: Optional[str] = None
    initial_message: Optional[str] = None; example_response: Optional[str] = None
class MainCardCreate(MainCardBase): pass

class MainCardUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    initial_message: Optional[str] = None
    example_response: Optional[str] = None

class MainCardSchema(MainCardBase):
    id: int; owner_id: int; chats: List[ChatSchema] = []
    class Config: from_attributes = True

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
    class Config: from_attributes = True

# --- User Schemas ---
class UserBase(BaseModel):
    username: str
class UserCreate(UserBase):
    password: str
class UserSchema(UserBase):
    id: int
    main_cards: List[MainCardSchema] = []
    api_configs: List[ApiConfigSchema] = []
    class Config: from_attributes = True


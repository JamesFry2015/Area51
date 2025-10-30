from pydantic import BaseModel
from typing import List, Optional

# --- Message & Completion Schemas (no change) ---
class Message(BaseModel):
    role: str
    content: str
    reasoning: Optional[dict] = None

class ChatCompletionRequest(BaseModel):
    message: str
    model: Optional[str] = None
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    temperature: Optional[float] = 1.0
    top_p: Optional[float] = 1.0
    top_k: Optional[int] = -1
    repetition_penalty: Optional[float] = 1.0
    frequency_penalty: Optional[float] = 0.0
    reasoning: Optional[bool] = False

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
class MainCardSchema(MainCardBase):
    id: int; owner_id: int; chats: List[ChatSchema] = []
    class Config: from_attributes = True

# --- API Configuration Schemas ---
class ApiConfigBase(BaseModel):
    name: str
    model: str
    proxy_url: str
    api_key: Optional[str] = None
    custom_prompt: Optional[str] = None
class ApiConfigCreate(ApiConfigBase):
    pass
# --- NEW: Schema for updating an existing configuration ---
class ApiConfigUpdate(ApiConfigBase):
    pass
class ApiConfigSchema(ApiConfigBase):
    id: int
    owner_id: int
    api_key: str = "********" 
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


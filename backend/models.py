from sqlalchemy import Column, Integer, String, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship

from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    # --- FIX: Added lazy="selectin" to prevent the MissingGreenlet error ---
    main_cards = relationship("MainCard", back_populates="owner", cascade="all, delete-orphan", lazy="selectin")
    api_configs = relationship("ApiConfig", back_populates="owner", cascade="all, delete-orphan", lazy="selectin")

class MainCard(Base):
    __tablename__ = "main_cards"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    initial_message = Column(String, nullable=True)
    example_response = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="main_cards")
    chats = relationship("Chat", back_populates="main_card", cascade="all, delete-orphan", lazy="selectin")

class Chat(Base):
    __tablename__ = "chats"
    id = Column(Integer, primary_key=True, index=True)
    history = Column(JSON, default=[])
    main_card_id = Column(Integer, ForeignKey("main_cards.id"))
    main_card = relationship("MainCard", back_populates="chats")

class ApiConfig(Base):
    __tablename__ = "api_configs"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    model = Column(String)
    proxy_url = Column(String)
    api_key = Column(String, nullable=True)
    custom_prompt = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="api_configs")


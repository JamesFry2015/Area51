from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base

# Define the connection URL for our async SQLite database.
# The "+aiosqlite" part tells SQLAlchemy to use the async driver we installed.
DATABASE_URL = "sqlite+aiosqlite:///./app.db"

# Create the async engine. This is the entry point to our database.
engine = create_async_engine(DATABASE_URL)

# Create a session class that will be used to interact with the database.
# We configure it to use our async engine and the AsyncSession class.
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

# This is a base class that our database model classes will inherit from.
Base = declarative_base()

# This is an async "dependency" that FastAPI will use.
# It ensures that we get a database session when we need one for an API request
# and that the session is properly closed afterward.
async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from backend.database import Base, get_db
from backend.main import app

# --- Test Database Setup ---
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test_db.db"
engine = create_async_engine(TEST_DATABASE_URL, echo=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)

# --- Dependency Override ---
async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

# --- Pytest Fixtures ---
@pytest_asyncio.fixture(scope="module")
async def async_client():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

# --- Test Cases ---
@pytest.mark.asyncio
async def test_delete_main_card(async_client: AsyncClient):
    # 1. Create a user
    response = await async_client.post("/users/", json={"username": "testuser", "password": "testpassword"})
    assert response.status_code == 200

    # 2. Log in to get a token
    login_response = await async_client.post("/token", data={"username": "testuser", "password": "testpassword"})
    assert login_response.status_code == 200
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Create a main card
    card_data = {"name": "Test Card", "description": "A card for testing deletion."}
    create_response = await async_client.post("/main-cards/", json=card_data, headers=headers)
    assert create_response.status_code == 200
    card_id = create_response.json()["id"]

    # 4. Delete the main card
    delete_response = await async_client.delete(f"/main-cards/{card_id}", headers=headers)
    assert delete_response.status_code == 200
    assert delete_response.json() == {"ok": True}

    # 5. Verify the card is deleted
    get_response = await async_client.get(f"/main-cards/{card_id}", headers=headers)
    assert get_response.status_code == 404
    assert get_response.json()["detail"] == "Main Card not found"
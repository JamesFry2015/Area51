import httpx
import pytest
from backend.main import app
from fastapi.testclient import TestClient

# Mocking the database and httpx for testing
# Since setting up a full async DB test environment is complex in this scratchpad,
# I will create a script that simulates the streaming logic directly or use a mock.

# However, the user asked for a "test script".
# I will create a standalone script that hits the running backend if available, or mocks it.
# Given the environment, I can't easily rely on external API keys (OpenRouter).
# So I will create a unit test for the generator function logic by mocking httpx.

import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from backend import crud, schemas, models

@pytest.mark.asyncio
async def test_get_chat_completion_stream():
    # Mock DB session
    mock_db = AsyncMock()

    # Mock Chat and MainCard
    mock_chat = MagicMock(spec=models.Chat)
    mock_chat.id = 1
    mock_chat.history = []
    mock_chat.main_card_id = 1
    mock_chat.system_prompt = "System prompt"
    mock_chat.chat_memory = "Memory"

    mock_main_card = MagicMock(spec=models.MainCard)
    mock_main_card.description = "Description"
    mock_main_card.initial_message = "Init"
    mock_main_card.example_response = "Example"

    mock_db.get.return_value = mock_main_card

    # Request
    request = schemas.ChatCompletionRequest(
        message="Hello",
        model="test-model",
        base_url="http://test-url",
        api_key="test-key",
        stream=True
    )

    # Mock httpx response
    async def mock_aiter_lines():
        yield "data: {\"choices\": [{\"delta\": {\"content\": \"Hello \"}}]}"
        yield "data: {\"choices\": [{\"delta\": {\"content\": \"World\"}}]}"
        yield "data: [DONE]"

    mock_response = AsyncMock()
    mock_response.aiter_lines = mock_aiter_lines
    mock_response.raise_for_status = MagicMock()

    # Context manager for httpx.stream
    mock_stream_ctx = AsyncMock()
    mock_stream_ctx.__aenter__.return_value = mock_response

    with patch("httpx.AsyncClient.stream", return_value=mock_stream_ctx):
        # Run the generator
        chunks = []
        async for chunk in crud.get_chat_completion_stream(mock_db, mock_chat, request):
            chunks.append(chunk)

        assert chunks == ["Hello ", "World"]

        # Verify DB save
        assert len(mock_chat.history) == 2 # User msg + Assistant msg
        assert mock_chat.history[-1]["role"] == "assistant"
        assert mock_chat.history[-1]["content"] == "Hello World"
        mock_db.commit.assert_called_once()

if __name__ == "__main__":
    # This block allows running the test directly if pytest is installed
    pass

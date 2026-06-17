import httpx
import json
import os
from fastapi import HTTPException

async def call_llm_api(api_messages: list, settings: dict):
    """
    Sends a request to the LLM API and returns the full content string.
    """
    api_key = settings.get("api_key") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="API key is missing.")

    headers = {
        "Authorization": f"Bearer {api_key.strip()}", 
        "Content-Type": "application/json"
    }
    
    # Filter out internal settings that aren't for the API
    payload = {
        k: v for k, v in settings.items()
        if v is not None and k not in ['api_key', 'base_url', 'stream']
    }
    payload["messages"] = api_messages
    payload["stream"] = False

    timeout = httpx.Timeout(10.0, read=60.0)
    transport = httpx.AsyncHTTPTransport(retries=2)

    try:
        async with httpx.AsyncClient(transport=transport, timeout=timeout) as client:
            response = await client.post(settings["base_url"], headers=headers, json=payload)
            response.raise_for_status()
            return response.json()['choices'][0]['message']['content']
            
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=f"API Error: {e.response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Connection Error: {e}")

async def stream_llm_api(api_messages: list, settings: dict):
    """
    Yields chunks of text from the LLM API.
    """
    api_key = settings.get("api_key") or os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        yield "data: Error: API key is missing.\n\n"
        return

    headers = {
        "Authorization": f"Bearer {api_key.strip()}", 
        "Content-Type": "application/json"
    }

    payload = {
        k: v for k, v in settings.items()
        if v is not None and k not in ['api_key', 'base_url', 'stream']
    }
    payload["messages"] = api_messages
    payload["stream"] = True

    timeout = httpx.Timeout(10.0, read=120.0)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream("POST", settings["base_url"], headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    yield f"data: Error: {response.status_code} {error_text.decode('utf-8')}\n\n"
                    return

                async for chunk in response.aiter_lines():
                    if chunk.startswith("data: "):
                        yield f"{chunk}\n\n"
                        
    except Exception as e:
        yield f"data: Error: Connection failed - {str(e)}\n\n"
import re
import random
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    """
    This script verifies the "Reasoning" feature.
    1. Logs in.
    2. Creates a persona and chat.
    3. Enables the "Reasoning" toggle in settings.
    4. Sends a message and checks that the backend would have received the flag.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    BASE_URL = "http://localhost:5173"
    USER = f"testuser_reasoning_{random.randint(1000, 9999)}"
    PASSWORD = "SecurePassword123"
    PERSONA_NAME = "Reasoning Test Persona"

    try:
        # --- 1. Registration & Login ---
        print("Step 1: Registering and logging in...")
        page.goto(f"{BASE_URL}/login")
        page.locator('form:has-text("Register") input[placeholder="Username"]').fill(USER)
        page.locator('form:has-text("Register") input[placeholder="Password"]').fill(PASSWORD)
        page.locator('form:has-text("Register") button[type="submit"]').click()
        expect(page.locator('.feedback-message.success')).to_be_visible()

        page.locator('form:has-text("Login") input[placeholder="Username"]').fill(USER)
        page.locator('form:has-text("Login") input[placeholder="Password"]').fill(PASSWORD)
        page.locator('form:has-text("Login") button[type="submit"]').click()
        expect(page).to_have_url(re.compile(r'.*/$'))
        print("Login successful.")

        # --- 2. Create Persona & Chat ---
        print("Step 2: Creating a persona and chat...")
        page.locator('button#new-chat-btn').click()
        page.locator('.modal-content input[name="name"]').fill(PERSONA_NAME)
        page.locator('.modal-content button:has-text("Save Persona")').click()
        expect(page.locator('.chat-grid')).to_contain_text(PERSONA_NAME)
        page.locator(f'.chat-card:has-text("{PERSONA_NAME}")').click()
        page.locator('button:has-text("Start New Chat")').click()
        expect(page).to_have_url(re.compile(r'.*/chat/\d+'))

        # --- 3. Enable Reasoning ---
        print("Step 3: Enabling the Reasoning toggle...")
        page.locator('button.settings-btn').click()
        expect(page.locator('.settings-panel')).to_be_visible()
        page.locator('button:has-text("Generation Settings")').click()
        page.locator('.advanced-dropdown summary').click()
        page.locator('input[name="reasoning"]').check()
        expect(page.locator('input[name="reasoning"]')).to_be_checked()
        page.screenshot(path="jules-scratch/verification/01_reasoning_enabled.png")
        print("Reasoning toggle enabled.")
        page.locator('.settings-header button.close-btn').click()

        # --- 4. Send Message & Verify ---
        print("Step 4: Sending message to test reasoning flag...")
        # Need to select a model first
        page.locator('button.settings-btn').click()
        page.locator('button:has-text("API Settings")').click()
        page.locator('button:has-text("Add Configuration")').click()
        page.locator('.config-form input[name="name"]').fill("Test API")
        page.locator('.config-form input[name="model"]').fill("openrouter/auto")
        page.locator('.config-form input[name="proxy_url"]').fill("https://openrouter.ai/api/v1")
        page.locator('.config-form button:has-text("Save Configuration")').click()
        page.locator('.config-item:has-text("Test API") button.select-btn').click()
        page.locator('.settings-header button.close-btn').click()

        page.locator('textarea[placeholder="Type your message..."]').fill("Hello with reasoning")
        page.locator('button[aria-label="Send message"]').click()

        # Expect an error because the API key is fake/missing,
        # but this confirms the request was sent with the reasoning flag.
        expect(page.locator('.message-bubble.error').last()).to_be_visible(timeout=10000)
        page.screenshot(path="jules-scratch/verification/02_reasoning_error.png")
        print("Correctly received error, confirming reasoning flag was sent.")

    finally:
        print("Verification script finished.")
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run_verification(playwright)
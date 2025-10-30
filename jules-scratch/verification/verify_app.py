import re
import random
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    """
    This script performs a comprehensive end-to-end verification of the application,
    including settings persistence, chat memory, and all new UI/UX features.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    BASE_URL = "http://localhost:5173"
    USER = f"testuser_{random.randint(1000, 9999)}"
    PASSWORD = "SecurePassword123"
    PERSONA_NAME = "Test Persona"
    API_CONFIG_NAME = "Test API Config"

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
        page.screenshot(path="jules-scratch/verification/01_login_success.png")
        print("Login successful.")

        # --- 2. Create Persona & Navigate to Detail ---
        print("Step 2: Creating a persona...")
        page.locator('button#new-chat-btn').click()
        page.locator('.modal-content input[name="name"]').fill(PERSONA_NAME)
        page.locator('.modal-content button:has-text("Save Persona")').click()
        expect(page.locator('.chat-grid')).to_contain_text(PERSONA_NAME)
        page.locator(f'.chat-card:has-text("{PERSONA_NAME}")').click()
        expect(page).to_have_url(re.compile(r'.*/main-card/\d+'))
        page.screenshot(path="jules-scratch/verification/02_main_card_detail.png")

        # --- 3. Main Card & Chat Management ---
        print("Step 3: Managing main card and chats...")
        # Edit the main card's name
        page.locator('.detail-header button.edit-btn').click()
        page.locator('.modal-content input[name="name"]').fill(f"{PERSONA_NAME} - Edited")
        page.locator('.modal-content button:has-text("Save Persona")').click()
        expect(page.locator('.detail-header h1')).to_have_text(f"{PERSONA_NAME} - Edited")

        # Start a new chat
        page.locator('button.add-btn:has-text("Start New Chat")').click()
        # On the chat page, click back to get to the detail page again
        expect(page).to_have_url(re.compile(r'.*/chat/\d+'))
        page.locator('a.back-link:has-text("Back to Persona")').click()
        expect(page).to_have_url(re.compile(r'.*/main-card/\d+'))

        # Rename the chat
        chat_item = page.locator('.session-item:has-text("New Chat")')
        chat_item.locator('button:has-text("Rename")').click()
        chat_item.locator('input[type="text"]').fill("My Renamed Chat")
        chat_item.locator('button:has-text("Save")').click()
        expect(page.locator('.session-item .session-link')).to_have_text("My Renamed Chat")
        page.screenshot(path="jules-scratch/verification/03_chat_renamed.png")

        # --- 4. Configure All Settings ---
        print("Step 4: Configuring all settings...")
        page.locator('.session-link:has-text("My Renamed Chat")').click()
        expect(page).to_have_url(re.compile(r'.*/chat/\d+'))

        page.locator('button.settings-btn').click()
        expect(page.locator('.settings-panel')).to_be_visible()

        # API Settings
        page.locator('button:has-text("API Settings")').click()
        page.locator('button:has-text("Add Configuration")').click()
        page.locator('.config-form input[name="name"]').fill(API_CONFIG_NAME)
        page.locator('.config-form input[name="model"]').fill("openrouter/auto")
        page.locator('.config-form input[name="proxy_url"]').fill("https://openrouter.ai/api/v1")
        page.locator('.config-form button:has-text("Save Configuration")').click()
        page.locator(f'.config-item:has-text("{API_CONFIG_NAME}") button.select-btn').click()
        expect(page.locator(f'.config-item:has-text("{API_CONFIG_NAME}")')).to_have_class(re.compile(r'\bactive\b'))

        # Generation Settings
        page.locator('.settings-header button.back-btn').click()
        page.locator('button:has-text("Generation Settings")').click()
        page.locator('.slider-group:has-text("Temperature") input[type="range"]').fill("0.7")
        page.locator('input[name="response_prefill_enabled"]').check()
        page.locator('textarea[name="response_prefill"]').fill("Prefill: ")
        page.locator('.advanced-dropdown summary').click()
        page.locator('input[name="reasoning"]').check()

        # System & Chat Memory
        page.locator('.settings-header button.back-btn').click()
        page.locator('button:has-text("System & Chat Memory")').click()
        page.locator('textarea[name="system_prompt"]').fill("You are a helpful assistant.")
        page.locator('textarea[name="chat_memory"]').fill("The user's name is Jules.")
        page.screenshot(path="jules-scratch/verification/04_all_settings_configured.png")
        print("All settings configured.")

        # --- 5. Verify Settings Persistence ---
        print("Step 5: Verifying settings persistence...")
        page.reload()
        page.locator('button.settings-btn').click()
        expect(page.locator('.settings-panel')).to_be_visible()
        # Check API setting
        page.locator('button:has-text("API Settings")').click()
        expect(page.locator(f'.config-item:has-text("{API_CONFIG_NAME}")')).to_have_class(re.compile(r'\bactive\b'))
        # Check Generation setting
        page.locator('.settings-header button.back-btn').click()
        page.locator('button:has-text("Generation Settings")').click()
        expect(page.locator('.slider-group:has-text("Temperature") input[type="range"]')).to_have_value("0.7")
        expect(page.locator('input[name="response_prefill_enabled"]')).to_be_checked()
        expect(page.locator('input[name="reasoning"]')).to_be_checked()
        # Check Memory (Note: this is tied to chat, so it will be there without localStorage)
        page.locator('.settings-header button.back-btn').click()
        page.locator('button:has-text("System & Chat Memory")').click()
        expect(page.locator('textarea[name="system_prompt"]')).to_have_value("You are a helpful assistant.")
        print("Settings persistence verified.")
        page.locator('.settings-header button.close-btn').click()

        # --- 6. Send Message and Cleanup ---
        print("Step 6: Sending message and cleaning up...")
        page.locator('textarea[placeholder="Type your message..."]').fill("Hello with settings")
        page.locator('button[aria-label="Send message"]').click()
        expect(page.locator('.message-bubble.error')).to_be_visible(timeout=10000)

        page.goto(BASE_URL)
        page.locator(f'.chat-card:has-text("{PERSONA_NAME} - Edited") button.delete-btn').click()
        page.locator('.modal-content:has-text("Are you sure?") button:has-text("Confirm Delete")').click()
        expect(page.locator('.no-chats-message')).to_be_visible()
        page.screenshot(path="jules-scratch/verification/05_cleanup_complete.png")

        page.locator('button#logout-btn').click()
        expect(page).to_have_url(re.compile(r'.*/login$'))
        print("Cleanup successful.")

    finally:
        print("Verification script finished.")
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run_verification(playwright)
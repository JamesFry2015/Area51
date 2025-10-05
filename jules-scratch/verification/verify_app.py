import re
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    """
    This script performs an end-to-end verification of the application, including:
    1.  User registration and login.
    2.  Creating and selecting an API configuration.
    3.  Configuring generation settings, including response prefill.
    4.  Creating a persona and starting a chat.
    5.  Sending a message and verifying the UI handles the settings correctly.
    6.  Deleting the persona and logging out.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    BASE_URL = "http://localhost:5173"
    # Use a unique user for this test run
    USER = "testuser_gen_settings"
    PASSWORD = "SecurePassword123"
    PERSONA_NAME = "Test Persona Gen"
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

        # --- 2. Configure API Settings ---
        print("Step 2: Configuring API settings...")
        # Open settings panel from chat page (first need to create a persona and chat)
        page.locator('button#new-chat-btn').click()
        page.locator('.modal-content input[name="name"]').fill(PERSONA_NAME)
        page.locator('.modal-content button:has-text("Save Persona")').click()
        expect(page.locator('.chat-grid')).to_contain_text(PERSONA_NAME)

        page.locator(f'.chat-card:has-text("{PERSONA_NAME}")').click()
        page.locator('button:has-text("Start New Chat")').click()
        expect(page).to_have_url(re.compile(r'.*/chat/\d+'))

        page.locator('button.settings-btn').click()
        expect(page.locator('.settings-panel')).to_be_visible()

        # Go to API Settings
        page.locator('button.settings-menu-button:has-text("API Settings")').click()

        # Add a new configuration
        page.locator('button.add-config-btn').click()
        page.locator('.config-form input[name="name"]').fill(API_CONFIG_NAME)
        page.locator('.config-form input[name="model"]').fill("openrouter/auto")
        page.locator('.config-form input[name="proxy_url"]').fill("https://openrouter.ai/api/v1")
        page.locator('.config-form button:has-text("Save Configuration")').click()

        # Select the new configuration
        config_item = page.locator(f'.config-item:has-text("{API_CONFIG_NAME}")')
        expect(config_item).to_be_visible()
        config_item.locator('button.select-btn').click()
        expect(config_item).to_have_class(re.compile(r'\bactive\b'))
        page.screenshot(path="jules-scratch/verification/02_api_config_selected.png")
        print("API configuration created and selected.")

        # --- 3. Configure Generation Settings ---
        print("Step 3: Configuring generation settings...")
        page.locator('.settings-header button.back-btn').click() # Back to main settings
        page.locator('button.settings-menu-button:has-text("Generation Settings")').click()

        # Change some values
        page.locator('.slider-group:has-text("Temperature") input[type="range"]').set_input_files([]) # Hack to trigger change
        page.locator('.slider-group:has-text("Temperature") input[type="range"]').fill("0.7")
        page.locator('.slider-group:has-text("Max Tokens") input[type="number"]').fill("8000")

        # Enable and fill prefill
        page.locator('input[type="checkbox"][name="response_prefill_enabled"]').check()
        page.locator('textarea[name="response_prefill"]').fill("Prefill text: ")

        page.screenshot(path="jules-scratch/verification/03_generation_settings.png")
        print("Generation settings configured.")
        page.locator('.settings-header button.back-btn').click() # Back to main settings
        page.locator('.settings-header button.close-btn').click() # Close panel

        # --- 4. Send Message and Verify ---
        print("Step 4: Sending message with new settings...")
        page.locator('textarea[placeholder="Type your message..."]').fill("Hello with settings")
        page.locator('button[aria-label="Send message"]').click()

        # Expect an error because the API key is still fake/missing
        expect(page.locator('.message-bubble.error')).to_be_visible(timeout=10000)
        expect(page.locator('.message-bubble.error .message-content')).to_contain_text('API key is missing')
        page.screenshot(path="jules-scratch/verification/04_chat_with_settings_error.png")
        print("Correctly received 'API key missing' error.")

        # --- 5. Cleanup ---
        print("Step 5: Cleaning up...")
        page.goto(BASE_URL) # Go back to dashboard
        page.locator(f'.chat-card:has-text("{PERSONA_NAME}") button.delete-btn').click()
        page.locator('.modal-content:has-text("Are you sure?") button:has-text("Confirm Delete")').click()
        expect(page.locator('.no-chats-message')).to_be_visible()

        page.locator('button#logout-btn').click()
        expect(page).to_have_url(re.compile(r'.*/login$'))
        page.screenshot(path="jules-scratch/verification/05_cleanup_complete.png")
        print("Cleanup successful.")

    finally:
        print("Verification script finished.")
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run_verification(playwright)
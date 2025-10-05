import re
from playwright.sync_api import sync_playwright, expect

def run_verification(playwright):
    """
    This script performs an end-to-end verification of the core application flow:
    1. Registers a new user.
    2. Logs in with the new user.
    3. Creates a new persona (main card).
    4. Navigates to the persona's detail page and starts a chat.
    5. Sends a message and verifies the interaction.
    6. Deletes the persona from the dashboard.
    7. Logs out.
    """
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    BASE_URL = "http://localhost:5173"
    USER = "testuser_jules"
    PASSWORD = "SecurePassword123"

    try:
        # --- 1. Registration ---
        print("Navigating to login page for registration...")
        page.goto(f"{BASE_URL}/login")

        print(f"Registering new user: {USER}")
        page.locator('form:has-text("Register") input[placeholder="Username"]').fill(USER)
        page.locator('form:has-text("Register") input[placeholder="Password"]').fill(PASSWORD)
        page.locator('form:has-text("Register") button[type="submit"]').click()

        # Wait for and verify the success message
        success_message = page.locator('.feedback-message.success')
        expect(success_message).to_be_visible()
        expect(success_message).to_have_text(f"User '{USER}' registered successfully! You can now log in.")
        page.screenshot(path="jules-scratch/verification/01_registration_success.png")
        print("Registration successful.")

        # --- 2. Login ---
        print(f"Logging in as: {USER}")
        page.locator('form:has-text("Login") input[placeholder="Username"]').fill(USER)
        page.locator('form:has-text("Login") input[placeholder="Password"]').fill(PASSWORD)
        page.locator('form:has-text("Login") button[type="submit"]').click()

        # Wait for navigation to the dashboard and verify
        expect(page).to_have_url(re.compile(r'.*/$'))
        expect(page.locator('h1')).to_have_text('Personas')
        page.screenshot(path="jules-scratch/verification/02_login_dashboard.png")
        print("Login successful, dashboard is visible.")

        # --- 3. Create Persona ---
        print("Creating a new persona...")
        page.locator('button#new-chat-btn').click()

        # Fill out the modal form
        modal = page.locator('.modal-content')
        expect(modal).to_be_visible()
        modal.locator('input[name="name"]').fill("Test Persona")
        modal.locator('textarea[name="description"]').fill("A persona for testing.")
        modal.locator('button:has-text("Save Persona")').click()

        # Verify the new persona appears in the grid
        expect(page.locator('.chat-grid')).to_contain_text('Test Persona')
        page.screenshot(path="jules-scratch/verification/03_persona_created.png")
        print("Persona created successfully.")

        # --- 4. Start Chat ---
        print("Navigating to persona detail and starting chat...")
        page.locator('.chat-card:has-text("Test Persona")').click()

        expect(page).to_have_url(re.compile(r'.*/main-card/\d+'))
        expect(page.locator('h1')).to_have_text('Test Persona')

        page.locator('button:has-text("Start New Chat")').click()

        # Verify navigation to the chat page
        expect(page).to_have_url(re.compile(r'.*/chat/\d+'))
        expect(page.locator('h1')).to_have_text('Chat') # Default name
        page.screenshot(path="jules-scratch/verification/04_chat_page.png")
        print("Chat page opened.")

        # --- 5. Send Message ---
        print("Sending a message...")
        page.locator('textarea[placeholder="Type your message..."]').fill("Hello, world!")
        page.locator('button[aria-label="Send message"]').click()

        # Since we use a fake API key, we expect an error message bubble
        expect(page.locator('.message-bubble.error')).to_be_visible()
        expect(page.locator('.message-bubble.error .message-content')).to_contain_text('Error:')
        page.screenshot(path="jules-scratch/verification/05_chat_error_message.png")
        print("Error message from fake API key correctly displayed.")

        # --- 6. Delete Persona ---
        print("Navigating back to dashboard to delete persona...")
        page.locator('a:has-text("← Dashboard")').click()

        expect(page).to_have_url(re.compile(r'.*/$'))
        persona_card = page.locator('.chat-card:has-text("Test Persona")')

        # Click the delete button on the card
        persona_card.locator('button.delete-btn').click()

        # Confirm deletion in the modal
        confirm_modal = page.locator('.modal-content:has-text("Are you sure?")')
        expect(confirm_modal).to_be_visible()
        confirm_modal.locator('button:has-text("Confirm Delete")').click()

        # Verify the persona is gone
        expect(page.locator('.chat-grid')).not_to_contain_text('Test Persona')
        expect(page.locator('.no-chats-message')).to_be_visible()
        page.screenshot(path="jules-scratch/verification/06_persona_deleted.png")
        print("Persona deleted successfully.")

        # --- 7. Logout ---
        print("Logging out...")
        page.locator('button#logout-btn').click()
        expect(page).to_have_url(re.compile(r'.*/login$'))
        page.screenshot(path="jules-scratch/verification/07_logout_success.png")
        print("Logout successful.")

    finally:
        print("Verification script finished.")
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run_verification(playwright)
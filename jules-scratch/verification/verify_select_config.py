import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # 1. Register and Login
            await page.goto("http://localhost:5173/login")
            register_form = page.locator("form", has=page.get_by_role("heading", name="Register"))
            await register_form.get_by_placeholder("Username").fill("testuser")
            await register_form.get_by_placeholder("Password").fill("testpassword")
            await register_form.get_by_role("button", name="Register").click()
            await expect(page.get_by_text("registered successfully!")).to_be_visible()

            login_form = page.locator("form", has=page.get_by_role("heading", name="Login"))
            await login_form.get_by_placeholder("Username").fill("testuser")
            await login_form.get_by_placeholder("Password").fill("testpassword")
            await login_form.get_by_role("button", name="Login").click()
            await expect(page).to_have_url("http://localhost:5173/")

            # 2. Create a Persona and a chat
            await page.get_by_role("button", name="＋ New Persona").click()
            modal = page.locator(".modal-content")
            await modal.get_by_label("Name").fill("Test Persona")
            await modal.get_by_role("button", name="Save").click()
            await page.get_by_text("Test Persona").click()
            await page.get_by_role("button", name="＋ Start New Chat").click()
            await expect(page.get_by_role("heading", name="Test Persona")).to_be_visible()


            # 3. Create a new API configuration
            await page.locator(".settings-btn").click()
            settings_panel = page.locator(".settings-panel")
            await settings_panel.get_by_role("button", name="API Settings").click()
            await settings_panel.get_by_role("button", name="Add Configuration").click()

            config_form = settings_panel.locator(".config-form")
            await config_form.get_by_label("Configuration Name").fill("My Test Model")
            await config_form.get_by_label("Model Name").fill("test-davinci-004")
            await config_form.get_by_role("button", name="Save Configuration").click()

            # 4. Select the new configuration
            config_item = settings_panel.locator(".config-item", has_text="My Test Model")
            await expect(config_item).to_be_visible()
            await config_item.get_by_role("button", name="Select").click()

            # 5. Verify the settings were applied (by checking the input field)
            await page.locator(".settings-btn").click() # Re-open settings
            await expect(settings_panel.locator("input[name='model']")).to_have_value("test-davinci-004")

            print("Verification successful: Model name was correctly updated.")
            await page.screenshot(path="jules-scratch/verification/select_config_verification.png")
            print("Screenshot 'select_config_verification.png' has been taken.")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
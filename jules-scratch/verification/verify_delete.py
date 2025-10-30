import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # 1. Login
            await page.goto("http://localhost:5173/login")

            login_form = page.locator("form", has=page.get_by_role("heading", name="Login"))
            await login_form.get_by_placeholder("Username").fill("testuser")
            await login_form.get_by_placeholder("Password").fill("testpassword")
            await login_form.get_by_role("button", name="Login").click()
            await expect(page).to_have_url("http://localhost:5173/", timeout=10000)

            # 2. Create a Persona to delete
            await page.get_by_role("button", name="＋ New Persona").click()
            modal = page.locator(".modal-content")
            await modal.get_by_label("Name").fill("Card To Be Deleted")
            await modal.get_by_label("Description").fill("This is a test card.")
            await modal.get_by_role("button", name="Save").click()

            card_to_delete = page.get_by_text("Card To Be Deleted")
            await expect(card_to_delete).to_be_visible()

            # 3. Delete the Persona
            card_container = page.locator(".main-card", has_text="Card To Be Deleted")
            await card_container.get_by_role("button", name="Delete").click()

            # 4. Confirm deletion
            await page.get_by_role("button", name="Confirm Delete").click()

            # 5. Verify it's gone
            await expect(card_to_delete).not_to_be_visible()

            # 6. Take screenshot
            await page.screenshot(path="jules-scratch/verification/verification.png")
            print("Screenshot taken successfully.")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            await browser.close()

async def register_user_if_not_exists():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            # First, try to log in to see if the user already exists.
            await page.goto("http://localhost:5173/login")
            login_form = page.locator("form", has=page.get_by_role("heading", name="Login"))
            await login_form.get_by_placeholder("Username").fill("testuser")
            await login_form.get_by_placeholder("Password").fill("testpassword")
            await login_form.get_by_role("button", name="Login").click()

            # If we navigate away, the user exists. If not, we register.
            # Use a short timeout because we expect it to fail if user doesn't exist
            try:
                await expect(page).to_have_url("http://localhost:5173/", timeout=2000)
                print("User 'testuser' already exists. Skipping registration.")
            except Exception:
                print("User 'testuser' not found. Proceeding with registration.")
                register_form = page.locator("form", has=page.get_by_role("heading", name="Register"))
                await register_form.get_by_placeholder("Username").fill("testuser")
                await register_form.get_by_placeholder("Password").fill("testpassword")
                await register_form.get_by_role("button", name="Register").click()
                # Wait for the success feedback message
                await expect(page.get_by_text("registered successfully!")).to_be_visible(timeout=5000)
                print("User 'testuser' registered successfully.")

        except Exception as e:
            print(f"An error occurred during pre-flight user registration: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    # Ensure the user exists before running the main test
    asyncio.run(register_user_if_not_exists())
    # Run the main test
    asyncio.run(main())
import { expect, test } from "@playwright/test"

import { continueWithGoogleButton, expectLoginPageReady } from "./auth-helpers"

test.describe("home page", () => {
	test("unauthenticated users are redirected to /login", async ({ page }) => {
		await page.goto("/")
		await expectLoginPageReady(page)
	})

	test("login page exposes Continue with Google", async ({ page }) => {
		await page.goto("/")
		await expect(continueWithGoogleButton(page)).toBeVisible()
	})
})

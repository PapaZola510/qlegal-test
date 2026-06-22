import { expect, test } from "@playwright/test"

import { expectLoginPageReady, expectRegisterPageReady } from "./auth-helpers"

test.describe("protected route guards", () => {
	test("redirects /dashboard to /login when unauthenticated", async ({ page }) => {
		await page.goto("/dashboard")
		await expectLoginPageReady(page)
	})

	test("redirects /examples/todos to /login when unauthenticated", async ({ page }) => {
		await page.goto("/examples/todos")
		await expectLoginPageReady(page)
	})
})

test.describe("auth page cross-links", () => {
	test("visiting / redirects unauthenticated users to /login", async ({ page }) => {
		await page.goto("/")
		await expect(page).toHaveURL(/\/login/)
	})

	test("login page Create an account link navigates to /register", async ({ page }) => {
		await page.goto("/login")
		await page.getByRole("link", { name: /^create an account$/i }).click()
		await expectRegisterPageReady(page)
	})

	test("register page Sign in link navigates to /login", async ({ page }) => {
		await page.goto("/register")
		await page.getByRole("link", { name: /^sign in$/i }).click()
		await expectLoginPageReady(page)
	})
})

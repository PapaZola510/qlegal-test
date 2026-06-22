import { expect, test } from "@playwright/test"

import {
	continueWithGoogleButton,
	expectLoginPageReady,
	expectRegisterPageReady,
	loginHeading,
	registerHeading,
} from "./auth-helpers"

test.describe("login page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/login")
	})

	test("displays the login heading", async ({ page }) => {
		await expect(loginHeading(page)).toBeVisible()
	})

	test("has a Continue with Google button", async ({ page }) => {
		await expect(continueWithGoogleButton(page)).toBeVisible()
	})

	test("has a link to the register page", async ({ page }) => {
		const link = page.getByRole("link", { name: /^create an account$/i })
		await expect(link).toBeVisible()
		await expect(link).toHaveAttribute("href", "/register")
	})

	test("navigates to register when Create an account is clicked", async ({ page }) => {
		await page.getByRole("link", { name: /^create an account$/i }).click()
		await expectRegisterPageReady(page)
	})
})

test.describe("register page", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/register")
	})

	test("displays the register heading", async ({ page }) => {
		await expect(registerHeading(page)).toBeVisible()
	})

	test("has a Continue with Google button", async ({ page }) => {
		await expect(continueWithGoogleButton(page)).toBeVisible()
	})

	test("has a link back to the login page", async ({ page }) => {
		const link = page.getByRole("link", { name: /^sign in$/i })
		await expect(link).toBeVisible()
		await expect(link).toHaveAttribute("href", "/login")
	})

	test("navigates to login when Sign in is clicked", async ({ page }) => {
		await page.getByRole("link", { name: /^sign in$/i }).click()
		await expectLoginPageReady(page)
	})
})

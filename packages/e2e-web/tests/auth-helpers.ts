import { expect, type Page } from "@playwright/test"

/** Auth column heading on the full-page login layout (not the brand marketing column). */
export function loginHeading(page: Page) {
	return page.getByRole("heading", { name: /welcome back to qlegal/i })
}

/** Auth column heading on the full-page register layout. */
export function registerHeading(page: Page) {
	return page.getByRole("heading", { name: /create your qlegal account/i })
}

export function continueWithGoogleButton(page: Page) {
	return page.getByRole("button", { name: /continue with google/i })
}

export async function expectLoginPageReady(page: Page) {
	await expect(page).toHaveURL(/\/login/)
	await expect(loginHeading(page)).toBeVisible()
	await expect(continueWithGoogleButton(page)).toBeVisible()
}

export async function expectRegisterPageReady(page: Page) {
	await expect(page).toHaveURL(/\/register/)
	await expect(registerHeading(page)).toBeVisible()
	await expect(continueWithGoogleButton(page)).toBeVisible()
}

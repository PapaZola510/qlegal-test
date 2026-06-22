import { defineConfig, devices } from "@playwright/test"

import { AUTH_FILE } from "./constants"

const hasBackend = !!process.env.E2E_AUTH_API_URL

const baseURL = process.env.BASE_URL ?? "http://localhost:3001"

export default defineConfig({
	globalSetup: "./global-setup.ts",
	testDir: "./tests",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["html", { open: "never" }]] : "html",
	timeout: 90_000,
	expect: {
		timeout: 15_000,
	},
	use: {
		baseURL,
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "off",
		actionTimeout: 30_000,
		navigationTimeout: 60_000,
	},
	webServer: process.env.BASE_URL
		? undefined
		: {
				command: "pnpm --filter @repo/web dev",
				url: baseURL,
				reuseExistingServer: !process.env.CI,
				timeout: 120_000,
				cwd: "../..",
			},
	projects: [
		// ── Auth setup (runs once before authenticated tests) ──────────────────
		...(hasBackend
			? [
					{
						name: "setup",
						testDir: ".",
						testMatch: /global\.setup\.ts/,
					},
				]
			: []),

		// ── Unauthenticated tests ──────────────────────────────────────────────
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
			testIgnore: /authenticated\.spec\.ts/,
		},

		// ── Authenticated tests (only when backend is available) ───────────────
		...(hasBackend
			? [
					{
						name: "chromium-authenticated",
						use: {
							...devices["Desktop Chrome"],
							storageState: AUTH_FILE,
						},
						testMatch: /authenticated\.spec\.ts/,
						dependencies: ["setup"],
					},
				]
			: []),
	],
})

import { defineConfig } from "eslint/config"

import { packageConfig } from "@repo/eslint-config/pkg"

export default defineConfig(
	{
		ignores: [
			"eslint.config.mjs",
			"dist/**",
			"drizzle/**",
			// Standalone scripts (excluded from tsconfig; run via tsx)
			"src/seed.ts",
			"src/seed-exam-content.ts",
			"scripts/**",
		],
	},
	packageConfig
)

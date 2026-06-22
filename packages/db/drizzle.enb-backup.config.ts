import "dotenv/config"
import { defineConfig } from "drizzle-kit"

const url = process.env.ENB_BACKUP_DATABASE_URL?.trim()
if (!url) {
	throw new Error("ENB_BACKUP_DATABASE_URL is required for ENB backup migrations")
}

export default defineConfig({
	schema: "./src/enb-backup/schema.ts",
	out: "./src/migrations-enb-backup",
	dialect: "postgresql",
	dbCredentials: { url },
})

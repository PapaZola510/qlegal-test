import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { eq } from "drizzle-orm"

import { AUTH_BASE_PATH } from "@repo/auth"
import { users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

import {
	DEV_ADMIN_EMAIL,
	DEV_ADMIN_NAME,
	DEV_ADMIN_PASSWORD,
	DEV_SUPER_ADMIN_EMAIL,
	DEV_SUPER_ADMIN_NAME,
	DEV_SUPER_ADMIN_PASSWORD,
} from "./dev-admin.constants"

type DevOperatorAccount = {
	email: string
	password: string
	name: string
	platformRole: "admin" | "super_admin"
}

const DEV_OPERATOR_ACCOUNTS: DevOperatorAccount[] = [
	{
		email: DEV_ADMIN_EMAIL,
		password: DEV_ADMIN_PASSWORD,
		name: DEV_ADMIN_NAME,
		platformRole: "admin",
	},
	{
		email: DEV_SUPER_ADMIN_EMAIL,
		password: DEV_SUPER_ADMIN_PASSWORD,
		name: DEV_SUPER_ADMIN_NAME,
		platformRole: "super_admin",
	},
]

/**
 * Ensures dev operator accounts exist (email/password) with the correct platform_role.
 * Skipped in production.
 */
@Injectable()
export class DevAdminBootstrapService implements OnModuleInit {
	private readonly logger = new Logger(DevAdminBootstrapService.name)

	async onModuleInit(): Promise<void> {
		if (env.NODE_ENV === "production") return

		const origin = process.env.BETTER_AUTH_URL?.replace(/\/$/, "") ?? "http://localhost:3001"
		const signUpUrl = `${origin}${AUTH_BASE_PATH}/sign-up/email`

		for (const account of DEV_OPERATOR_ACCOUNTS) {
			try {
				const [existing] = await db
					.select({ id: users.id })
					.from(users)
					.where(eq(users.email, account.email))
					.limit(1)

				if (!existing) {
					const res = await fetch(signUpUrl, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Origin": origin,
						},
						body: JSON.stringify({
							email: account.email,
							password: account.password,
							name: account.name,
						}),
					})
					if (!res.ok) {
						const body = await res.text().catch(() => "")
						this.logger.warn(
							`Dev operator sign-up failed for ${account.email} (${res.status}): ${body || "no body"}`
						)
					} else {
						this.logger.log(`Dev operator account ready (${account.email})`)
					}
				}

				await db
					.update(users)
					.set({ platformRole: account.platformRole, updatedAt: new Date() })
					.where(eq(users.email, account.email))
			} catch (error: unknown) {
				this.logger.warn(
					`Dev operator bootstrap skipped for ${account.email}: ${(error as Error | undefined)?.message ?? String(error)}`
				)
			}
		}
	}
}

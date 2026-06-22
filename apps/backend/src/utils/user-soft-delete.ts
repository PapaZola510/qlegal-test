import { eq } from "drizzle-orm"

import { users } from "@repo/db/schema"

import { db } from "../common/database/database.client"

/**
 * Quanby forbids hard-deleting users; call this from admin or account-closure flows.
 */
export async function softDeleteUserById(userId: string): Promise<void> {
	const now = new Date()
	await db.update(users).set({ deletedAt: now, updatedAt: now }).where(eq(users.id, userId))
}

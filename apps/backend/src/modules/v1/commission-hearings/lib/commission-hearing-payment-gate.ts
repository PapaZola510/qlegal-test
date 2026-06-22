import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import { paymentIntents } from "@repo/db/schema"

import type { db as databaseClient } from "@/common/database/database.client"

export async function assertHearingPaymentSettled(
	db: typeof databaseClient,
	hearingRoomId: string
): Promise<void> {
	const [succeeded] = await db
		.select({ id: paymentIntents.id })
		.from(paymentIntents)
		.where(
			and(
				eq(paymentIntents.hearingRoomId, hearingRoomId),
				eq(paymentIntents.purpose, "commission_hearing"),
				eq(paymentIntents.status, "succeeded")
			)
		)
		.limit(1)

	if (!succeeded) {
		throw new ORPCError("FORBIDDEN", {
			message: "Pay the ₱50 hearing fee before joining",
		})
	}
}

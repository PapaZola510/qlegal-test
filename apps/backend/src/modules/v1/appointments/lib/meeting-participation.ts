import { ORPCError } from "@orpc/server"
import { and, eq } from "drizzle-orm"

import { sessionRoomGuests, sessionRooms, type appointments } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"

/** ENP, client, or joined session-room guest (witness/principal invite). */
export async function assertMeetingParticipantAccess(
	ctx: QlegalSessionContext,
	apt: typeof appointments.$inferSelect
): Promise<void> {
	if (ctx.userId === apt.enpUserId || ctx.userId === apt.clientUserId) return

	const [room] = await db
		.select({ id: sessionRooms.id })
		.from(sessionRooms)
		.where(eq(sessionRooms.appointmentId, apt.id))
		.limit(1)

	if (!room?.id) {
		throw new ORPCError("FORBIDDEN", { message: "You cannot access this meeting" })
	}

	const [guest] = await db
		.select({ userId: sessionRoomGuests.userId })
		.from(sessionRoomGuests)
		.where(
			and(eq(sessionRoomGuests.sessionRoomId, room.id), eq(sessionRoomGuests.userId, ctx.userId))
		)
		.limit(1)

	if (!guest) {
		throw new ORPCError("FORBIDDEN", { message: "You cannot access this meeting" })
	}
}

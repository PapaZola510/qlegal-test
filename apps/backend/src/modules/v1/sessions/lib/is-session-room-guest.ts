import { and, eq } from "drizzle-orm"

import { sessionRoomGuests, sessionRooms } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

/** True when the user joined the live session room as an invited guest (witness / guest signer). */
export async function isSessionRoomGuestForAppointment(
	appointmentId: string,
	userId: string
): Promise<boolean> {
	const [room] = await db
		.select({ id: sessionRooms.id })
		.from(sessionRooms)
		.where(eq(sessionRooms.appointmentId, appointmentId))
		.limit(1)
	if (!room?.id) return false

	const [guest] = await db
		.select({ userId: sessionRoomGuests.userId })
		.from(sessionRoomGuests)
		.where(and(eq(sessionRoomGuests.sessionRoomId, room.id), eq(sessionRoomGuests.userId, userId)))
		.limit(1)

	return !!guest
}

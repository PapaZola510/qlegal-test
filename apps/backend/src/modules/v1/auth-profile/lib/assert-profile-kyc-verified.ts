import { eq } from "drizzle-orm"

import { clientProfiles, enpProfiles } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { env } from "@/config/env.config"

export type ProfileKycRole = "client" | "enp"

function bookingDetail(role: ProfileKycRole): string {
	if (role === "client") {
		return "Complete identity verification on your Profile before booking an appointment."
	}
	return "Complete identity verification on your Profile before starting a session."
}

function meetingDetail(role: ProfileKycRole): string {
	if (role === "client") {
		return "Complete identity verification on your Profile before joining this meeting."
	}
	return "Complete identity verification on your Profile before starting this session."
}

/** @param context Defaults to meeting-style copy. Use `"booking"` for appointment.create. */
export async function assertProfileKycVerified(
	userId: string,
	role: ProfileKycRole,
	context: "booking" | "meeting" = "meeting"
): Promise<{ ok: true } | { ok: false; detail: string }> {
	if (env.NODE_ENV === "development" && env.SESSION_DEV_RELAX_IDENTITY === "true") {
		return { ok: true }
	}
	if (
		env.NODE_ENV === "development" &&
		env.SESSION_DEV_RELAX_CLIENT_HYPERVERGE === "true" &&
		role === "client"
	) {
		return { ok: true }
	}

	const detail = context === "booking" ? bookingDetail(role) : meetingDetail(role)

	if (role === "enp") {
		const [enp] = await db.select().from(enpProfiles).where(eq(enpProfiles.userId, userId)).limit(1)
		if (!enp) return { ok: false, detail: "ENP profile is required." }
		if (enp.identityStatus !== "verified") return { ok: false, detail }
		return { ok: true }
	}

	const [client] = await db
		.select()
		.from(clientProfiles)
		.where(eq(clientProfiles.userId, userId))
		.limit(1)
	if (!client) return { ok: false, detail: "Client profile is required." }
	if (client.identityStatus !== "verified") return { ok: false, detail }
	return { ok: true }
}

import { and, desc, eq, inArray } from "drizzle-orm"

import { appointments, auditEvents } from "@repo/db/schema"

import { db } from "@/common/database/database.client"

const SESSION_LOCATION_AUDIT_EVENT = "session_location_verify"

interface LocationAuditPayload {
	appointmentId?: string
	allowed?: boolean
	details?: {
		formattedAddress?: string
		countryCode?: string
	}
}

function extractFormattedAddress(payload: LocationAuditPayload | null): string | null {
	const address = payload?.details?.formattedAddress?.trim()
	return address || null
}

function formatPhilippinesLocation(
	clientAddress: string | null,
	enpAddress: string | null
): string | null {
	if (!clientAddress && !enpAddress) return null
	if (clientAddress && enpAddress) {
		if (clientAddress === enpAddress) return `Within the Philippines (${clientAddress})`
		return `Within the Philippines — Principal: ${clientAddress}; ENP: ${enpAddress}`
	}
	return `Within the Philippines (${clientAddress ?? enpAddress})`
}

/**
 * Resolves SC col. 10 (location of parties) from lobby `session_location_verify` audit rows.
 */
export async function resolveNotarizationLocationsForAppointments(
	appointmentIds: string[]
): Promise<Map<string, string>> {
	const uniqueIds = [...new Set(appointmentIds.filter(Boolean))]
	if (!uniqueIds.length) return new Map()

	const apptRows = await db
		.select({
			id: appointments.id,
			clientUserId: appointments.clientUserId,
			enpUserId: appointments.enpUserId,
		})
		.from(appointments)
		.where(inArray(appointments.id, uniqueIds))

	if (!apptRows.length) return new Map()

	const auditRows = await db
		.select({
			targetId: auditEvents.targetId,
			actorUserId: auditEvents.actorUserId,
			payload: auditEvents.payload,
			occurredAt: auditEvents.occurredAt,
		})
		.from(auditEvents)
		.where(
			and(
				eq(auditEvents.eventType, SESSION_LOCATION_AUDIT_EVENT),
				inArray(auditEvents.targetId, uniqueIds)
			)
		)
		.orderBy(desc(auditEvents.occurredAt))

	const latestByAppointmentActor = new Map<string, string>()
	for (const row of auditRows) {
		if (!row.targetId || !row.actorUserId) continue
		const payload = row.payload as LocationAuditPayload | null
		if (payload?.allowed !== true) continue
		if (payload.appointmentId && payload.appointmentId !== row.targetId) continue
		const address = extractFormattedAddress(payload)
		if (!address) continue
		const key = `${row.targetId}:${row.actorUserId}`
		if (!latestByAppointmentActor.has(key)) {
			latestByAppointmentActor.set(key, address)
		}
	}

	const result = new Map<string, string>()
	for (const appt of apptRows) {
		const clientAddress = latestByAppointmentActor.get(`${appt.id}:${appt.clientUserId}`) ?? null
		const enpAddress = latestByAppointmentActor.get(`${appt.id}:${appt.enpUserId}`) ?? null
		const formatted = formatPhilippinesLocation(clientAddress, enpAddress)
		if (formatted) result.set(appt.id, formatted)
	}

	return result
}

import { ORPCError } from "@orpc/server"
import { and, desc, eq, isNull } from "drizzle-orm"

import {
	appointmentDocuments,
	enbAccessRequests,
	fileObjects,
	paymentIntents,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"

async function computeMeetingSessionFeeTotal(appointmentId: string): Promise<number> {
	const rows = await db
		.select({ feePhp: appointmentDocuments.feePhp })
		.from(appointmentDocuments)
		.innerJoin(fileObjects, eq(appointmentDocuments.fileObjectId, fileObjects.id))
		.where(
			and(
				eq(appointmentDocuments.appointmentId, appointmentId),
				eq(fileObjects.purpose, "appointment_attachment"),
				isNull(fileObjects.deletedAt)
			)
		)

	let total = 0
	for (const r of rows) {
		if (typeof r.feePhp === "number" && r.feePhp > 0) total += Math.floor(r.feePhp)
	}
	return total
}

async function findSucceededMeetingPaymentIntent(appointmentId: string) {
	const [row] = await db
		.select({ id: paymentIntents.id })
		.from(paymentIntents)
		.where(
			and(
				eq(paymentIntents.appointmentId, appointmentId),
				eq(paymentIntents.purpose, "meeting_session"),
				eq(paymentIntents.status, "succeeded")
			)
		)
		.orderBy(desc(paymentIntents.paidAt))
		.limit(1)
	return row ?? null
}

async function findSucceededCtcPaymentIntent(requestId: string) {
	const [row] = await db
		.select({ id: paymentIntents.id })
		.from(paymentIntents)
		.where(
			and(
				eq(paymentIntents.enbAccessRequestId, requestId),
				eq(paymentIntents.purpose, "ctc_request"),
				eq(paymentIntents.status, "succeeded")
			)
		)
		.orderBy(desc(paymentIntents.paidAt))
		.limit(1)
	return row ?? null
}

/**
 * ENP may always view notarized PDFs. Clients and witnesses (everyone else) must wait until
 * session fees are paid when document fees are required. After the session ends, principals
 * also need an approved certified true copy request before post-session view/download.
 */
export async function assertMeetingNotarizedPdfViewAllowed(
	appointmentId: string,
	viewerUserId: string,
	enpUserId: string,
	opts?: {
		documentFileObjectId?: string
		appointmentStatus?: string
		clientUserId?: string
	}
): Promise<void> {
	if (viewerUserId === enpUserId) return

	const notarialFeePhp = await computeMeetingSessionFeeTotal(appointmentId)
	if (notarialFeePhp > 0) {
		const succeeded = await findSucceededMeetingPaymentIntent(appointmentId)
		if (!succeeded) {
			throw new ORPCError("FORBIDDEN", {
				message: "Complete session fee payment before viewing or downloading notarized documents",
			})
		}
	}

	const documentFileObjectId = opts?.documentFileObjectId?.trim()
	const clientUserId = opts?.clientUserId?.trim()
	if (
		opts?.appointmentStatus === "ended" &&
		clientUserId &&
		viewerUserId === clientUserId &&
		documentFileObjectId
	) {
		const [granted] = await db
			.select({
				id: enbAccessRequests.id,
				requesterPaymentMethod: enbAccessRequests.requesterPaymentMethod,
			})
			.from(enbAccessRequests)
			.where(
				and(
					eq(enbAccessRequests.requesterUserId, viewerUserId),
					eq(enbAccessRequests.appointmentId, appointmentId),
					eq(enbAccessRequests.documentFileObjectId, documentFileObjectId),
					eq(enbAccessRequests.certifiedTrueCopy, true),
					eq(enbAccessRequests.outcome, "granted")
				)
			)
			.limit(1)
		if (!granted) {
			throw new ORPCError("FORBIDDEN", {
				message:
					"View and download are available after your notary approves your certified true copy request",
			})
		}

		if (granted.requesterPaymentMethod === "online") {
			const paid = await findSucceededCtcPaymentIntent(granted.id)
			if (!paid) {
				throw new ORPCError("FORBIDDEN", {
					message:
						"Complete your certified true copy fee payment before viewing or downloading this document",
				})
			}
		}
	}
}

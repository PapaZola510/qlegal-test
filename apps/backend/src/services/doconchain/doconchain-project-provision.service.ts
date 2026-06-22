import { Injectable, Logger } from "@nestjs/common"
import type { Readable } from "node:stream"
import { eq } from "drizzle-orm"

import { enpProfiles, fileObjects, users } from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import { doconchainDevMockOnFailure, env } from "@/config/env.config"
import { assertEnpCommissionAllowsNotarialActs } from "@/modules/v1/auth-profile/lib/assert-enp-commission-active"
import { assertGovernmentIdAllowsNotarialActs } from "@/modules/v1/auth-profile/lib/assert-government-id-allows-notarial-acts"
import { FilesService } from "@/modules/v1/files/files.service"
import {
	buildDoconchainStampJsonFromEnpRow,
	type AppointmentSessionMode,
} from "@/utils/build-doconchain-document-stamp"

import { DoconchainAdapterService } from "./doconchain-adapter.service"

function pdfFilenameForDoconchain(name: string): string {
	const base = name.trim() || "document"
	return base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`
}

async function readableToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = []
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string))
	}
	return Buffer.concat(chunks)
}

/**
 * Shared DocOnChain project creation for meeting uploads and QuickSign (same API as live session).
 */
@Injectable()
export class DoconchainProjectProvisionService {
	private readonly log = new Logger(DoconchainProjectProvisionService.name)

	constructor(
		private readonly dc: DoconchainAdapterService,
		private readonly files: FilesService
	) {}

	private async loadEnpForDoconchain(enpUserId: string) {
		const [row] = await db
			.select({
				prefix: enpProfiles.prefix,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				suffix: enpProfiles.suffix,
				email: users.email,
				rollNo: enpProfiles.rollNo,
				rollDate: enpProfiles.rollDate,
				npnCommissionNo: enpProfiles.npnCommissionNo,
				commissionValidUntil: enpProfiles.commissionValidUntil,
				ptrNo: enpProfiles.ptrNo,
				ptrLocation: enpProfiles.ptrLocation,
				ptrDate: enpProfiles.ptrDate,
				ibpNo: enpProfiles.ibpNo,
				ibpDate: enpProfiles.ibpDate,
				mcleNo: enpProfiles.mcleNo,
				mclePeriod: enpProfiles.mclePeriod,
				mcleDate: enpProfiles.mcleDate,
				notaryAddress: enpProfiles.notaryAddress,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		return row
	}

	async createProjectUuidFromPdfFile(args: {
		enpUserId: string
		subOrgIds: string[]
		fileObjectId: string
		documentName: string
		/** Appointment `session_mode` — drives REN vs IEN on the notarial seal. */
		sessionMode?: AppointmentSessionMode | null
		logContext: "meeting.upload" | "quicksign.createProject" | "quicksign.retryDcProject"
		/** Meeting sessions: defer ENP as signer until explicit add-signers (correct DC order). */
		creatorAsViewer?: boolean
	}): Promise<string> {
		const [fileRow] = await db
			.select({ mime: fileObjects.mime })
			.from(fileObjects)
			.where(eq(fileObjects.id, args.fileObjectId))
			.limit(1)
		const mime = (fileRow?.mime ?? "").toLowerCase()
		if (mime !== "application/pdf") {
			throw new Error(
				"DocOnChain requires a PDF. Upload a PDF file, or use a different format only for local viewing."
			)
		}

		const enp = await this.loadEnpForDoconchain(args.enpUserId)
		if (!enp?.email?.trim()) {
			throw new Error("ENP profile email is required for DocOnChain")
		}
		const govId = await assertGovernmentIdAllowsNotarialActs(args.enpUserId)
		if (!govId.ok) {
			throw new Error(govId.detail)
		}
		const commission = await assertEnpCommissionAllowsNotarialActs(args.enpUserId)
		if (!commission.ok) {
			throw new Error(commission.detail)
		}
		if (!args.subOrgIds.length) {
			throw new Error("No sub-organization context for file access")
		}

		const { stream } = await this.files.openDownloadStreamForTenant(
			args.fileObjectId,
			args.subOrgIds
		)
		const pdf = await readableToBuffer(stream)
		const docStamp = buildDoconchainStampJsonFromEnpRow(enp, {
			sessionMode: args.sessionMode,
		})
		const devMock = doconchainDevMockOnFailure()
		const token = await this.dc.getAccessToken(enp.email, {
			allowOrgFallback: true,
			allowMock: devMock || !this.dc.isConfigured(),
		})
		if (env.DOCONCHAIN_LOG_SENSITIVE === "true") {
			this.log.warn(`DC TOKEN (sensitive) ${args.logContext} email=${enp.email} token=${token}`)
		}
		const { uuid } = await this.dc.createProjectFromPdf({
			token,
			pdf,
			filename: pdfFilenameForDoconchain(args.documentName),
			documentStampJson: docStamp,
			creatorAsViewer: args.creatorAsViewer ?? false,
			userListEditable: false,
			projectType: "DOCUMENT",
			allowMock: devMock || !this.dc.isConfigured() || token.startsWith("mock_dc_token_"),
		})
		if (env.DOCONCHAIN_LOG_SENSITIVE === "true") {
			this.log.warn(`DC PROJECT (sensitive) ${args.logContext} uuid=${uuid} email=${enp.email}`)
		} else {
			this.log.debug(
				`DC project created ${args.logContext} uuid=…${uuid.slice(-12)} email=${enp.email}`
			)
		}
		return uuid
	}
}

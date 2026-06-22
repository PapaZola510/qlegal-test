import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq, max, sql } from "drizzle-orm"

import type { QuicksignErrorCode, QuicksignProject, SignatureField } from "@repo/contracts"
import {
	appointmentDocumentTypes,
	appointmentDocuments,
	appointments,
	clientProfiles,
	documentReviewRequestFiles,
	documentReviewRequests,
	enpDocumentTypes,
	enpProfiles,
	meetingSignatureRequests,
	quicksignProjectDocumentTypes,
	quicksignProjects,
	quicksignSigners,
	registryActs,
	users,
} from "@repo/db/schema"

import {
	DoconchainAdapterService,
	isDoconchainProjectCompleted,
} from "@/services/doconchain/doconchain-adapter.service"
import { LocalSigningService } from "@/services/signing/local-signing.service"
import { LocalStorageService } from "@/services/storage/local-storage.service"
import { DoconchainProjectProvisionService } from "@/services/doconchain/doconchain-project-provision.service"
import { generateDoconchainSignLink } from "@/services/doconchain/generate-sign-link"
import { EMAIL_ADAPTER, type EmailAdapter } from "@/services/email/email-adapter"
import { NotarizedPdfDeliveryService } from "@/services/email/notarized-pdf-delivery.service"
import { buildQuicksignSessionInviteEmail } from "@/services/email/quicksign-session-invite-email"
import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { env, publicAppUrl } from "@/config/env.config"

import { assertEnpCommissionAllowsNotarialActs } from "../auth-profile/lib/assert-enp-commission-active"
import { assertEnpSessionAccess } from "../auth-profile/lib/assert-enp-session-access"
import { assertGovernmentIdAllowsNotarialActs } from "../auth-profile/lib/assert-government-id-allows-notarial-acts"
import { EventsService } from "../events/events.service"
import { EnpDocumentTypesService } from "../enp-document-types/enp-document-types.service"
import { FilesService } from "../files/files.service"
import { IenAttestationService } from "../ien-attestation/ien-attestation.service"
import { RegistryService } from "../registry/registry.service"
import { MeetingSignersService } from "../sessions/meeting-signers.service"
import { SessionsService } from "../sessions/sessions.service"

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "ENP"
}

function splitDisplayName(name: string): { firstName: string; lastName: string } {
	const trimmed = name.trim()
	const parts = trimmed.split(/\s+/).filter(Boolean)
	if (parts.length === 0) return { firstName: "Client", lastName: "." }
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "." }
	return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

function throwQuicksign(
	code: QuicksignErrorCode,
	message: string,
	extra?: { projectId?: string }
): never {
	throw new ORPCError("BAD_REQUEST", {
		message,
		data: { quicksign: { code, ...extra } },
	} as never)
}

type ProjectRow = typeof quicksignProjects.$inferSelect
type SignerRow = typeof quicksignSigners.$inferSelect

@Injectable()
export class QuicksignService {
	private readonly log = new Logger(QuicksignService.name)

	constructor(
		private readonly files: FilesService,
		private readonly dc: DoconchainAdapterService,
		private readonly doconchainProvision: DoconchainProjectProvisionService,
		@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter,
		private readonly events: EventsService,
		@Inject(forwardRef(() => SessionsService))
		private readonly sessions: SessionsService,
		@Inject(forwardRef(() => MeetingSignersService))
		private readonly meetingSigners: MeetingSignersService,
		private readonly registry: RegistryService,
		private readonly notarizedPdfDelivery: NotarizedPdfDeliveryService,
		private readonly ienAttestation: IenAttestationService,
		private readonly enpDocumentTypes: EnpDocumentTypesService,
		private readonly localSigning: LocalSigningService,
		private readonly localStorageService: LocalStorageService
	) {}

	private async resolveSubOrgIds(ctx: QlegalSessionContext): Promise<string[]> {
		if (ctx.subOrgIds?.length) return ctx.subOrgIds
		const [enp] = await db
			.select({ subOrgId: enpProfiles.subOrgId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, ctx.userId))
			.limit(1)
		return enp ? [enp.subOrgId] : []
	}

	private async assertEnp(ctx: QlegalSessionContext | null): Promise<QlegalSessionContext> {
		return assertEnpSessionAccess(ctx)
	}

	private async assertCommissionForNotarialActs(ctx: QlegalSessionContext): Promise<void> {
		const govId = await assertGovernmentIdAllowsNotarialActs(ctx.userId)
		if (!govId.ok) {
			throw new ORPCError("FORBIDDEN", { message: govId.detail })
		}
		const commission = await assertEnpCommissionAllowsNotarialActs(ctx.userId)
		if (!commission.ok) {
			throw new ORPCError("FORBIDDEN", { message: commission.detail })
		}
	}

	private async loadEnpRow(enpUserId: string) {
		const [row] = await db
			.select({
				prefix: enpProfiles.prefix,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				suffix: enpProfiles.suffix,
				email: users.email,
				rollNo: enpProfiles.rollNo,
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

	private async assertQsDocumentFile(fileId: string, enpUserId: string, subOrgIds: string[]) {
		const row = await this.files.getActiveRecordForTenant(fileId, subOrgIds)
		if (!row || row.ownerUserId !== enpUserId || row.purpose !== "qs_original") {
			throwQuicksign(
				"FILE_NOT_ACCESSIBLE",
				"File must be an uploaded QuickSign original owned by you"
			)
		}
	}

	private async loadProjectForEnp(id: string, enpUserId: string): Promise<ProjectRow> {
		const [row] = await db
			.select()
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, id))
			.limit(1)
		if (!row || row.enpUserId !== enpUserId) {
			throw new ORPCError("NOT_FOUND", { message: `QuickSign project ${id} not found` })
		}
		return row
	}

	private async loadSigners(projectId: string): Promise<SignerRow[]> {
		return db
			.select()
			.from(quicksignSigners)
			.where(eq(quicksignSigners.projectId, projectId))
			.orderBy(asc(quicksignSigners.sequenceOrder), asc(quicksignSigners.createdAt))
	}

	private async loadProjectDocumentTypes(projectId: string) {
		return db
			.select({
				id: quicksignProjectDocumentTypes.enpDocumentTypeId,
				name: enpDocumentTypes.name,
				pricePhpSnapshot: quicksignProjectDocumentTypes.pricePhpSnapshot,
			})
			.from(quicksignProjectDocumentTypes)
			.innerJoin(
				enpDocumentTypes,
				eq(enpDocumentTypes.id, quicksignProjectDocumentTypes.enpDocumentTypeId)
			)
			.where(eq(quicksignProjectDocumentTypes.projectId, projectId))
			.orderBy(asc(quicksignProjectDocumentTypes.createdAt))
	}

	private documentUrlPlaceholder(fileId: string): string {
		return `https://files.qlegal.invalid/${fileId}`
	}

	private async shapeProject(
		row: ProjectRow,
		signers: SignerRow[],
		opts?: { signingComplete?: boolean; registrySynced?: boolean }
	): Promise<QuicksignProject> {
		const enpRow = await this.loadEnpRow(row.enpUserId)
		const ownerName = enpRow ? formatEnpName(enpRow) : "ENP"
		const documentTypes = await this.loadProjectDocumentTypes(row.id)
		return {
			id: row.id,
			title: row.title,
			description: row.description,
			ownerId: row.enpUserId,
			ownerName,
			status: row.status,
			documentFileId: row.documentFileObjectId,
			documentUrl: this.documentUrlPlaceholder(row.documentFileObjectId),
			doconchainProjectUuid: row.doconchainProjectUuid,
			signatureFields: row.signatureFields,
			appointmentId: row.appointmentId,
			plotCompletedAt: row.plotCompletedAt?.toISOString() ?? null,
			signatories: signers.map(s => ({
				id: s.id,
				name: `${s.firstName} ${s.lastName}`.trim(),
				email: s.email,
				signedAt: s.signedAt?.toISOString() ?? null,
				order: s.sequenceOrder,
			})),
			documentTypes,
			expiresAt: row.expiresAt?.toISOString() ?? null,
			completedAt: row.completedAt?.toISOString() ?? null,
			signingComplete: opts?.signingComplete,
			registrySynced: opts?.registrySynced,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}

	async list(ctx: QlegalSessionContext | null) {
		ctx = await this.assertEnp(ctx)
		const rows = await db
			.select()
			.from(quicksignProjects)
			.where(eq(quicksignProjects.enpUserId, ctx.userId))
			.orderBy(desc(quicksignProjects.createdAt))
		const result: QuicksignProject[] = []
		for (const r of rows) {
			const signers = await this.loadSigners(r.id)
			result.push(await this.shapeProject(r, signers))
		}
		return result
	}

	async getOne(ctx: QlegalSessionContext | null, id: string) {
		ctx = await this.assertEnp(ctx)
		const row = await this.loadProjectForEnp(id, ctx.userId)
		let signingComplete = row.status === "completed"
		let registrySynced = false

		if (row.doconchainProjectUuid?.trim() && row.appointmentId) {
			const enp = await this.loadEnpRow(ctx.userId)
			if (enp?.email) {
				const progress = await this.syncSigningProgressForProject(row, enp.email.trim())
				signingComplete = progress.signingComplete
				registrySynced = progress.registrySynced
			}
		} else if (row.doconchainProjectUuid?.trim()) {
			const enp = await this.loadEnpRow(ctx.userId)
			if (enp?.email) {
				await this.syncSignatoriesFromDoconchain(id, row.doconchainProjectUuid, enp.email)
			}
		}

		const [freshRow] = await db
			.select()
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, id))
			.limit(1)
		const signers = await this.loadSigners(id)
		return this.shapeProject(freshRow ?? row, signers, { signingComplete, registrySynced })
	}

	async create(
		ctx: QlegalSessionContext | null,
		input: {
			title: string
			description?: string
			documentFileId: string
			signer?: { firstName: string; lastName: string; email: string }
			enpDocumentTypeIds?: string[]
		}
	) {
		ctx = await this.assertEnp(ctx)
		await this.assertCommissionForNotarialActs(ctx)
		const subOrgIds = await this.resolveSubOrgIds(ctx)
		if (!subOrgIds.length) {
			throw new ORPCError("BAD_REQUEST", { message: "No sub-organization context for QuickSign" })
		}
		await this.assertQsDocumentFile(input.documentFileId, ctx.userId, subOrgIds)
		const selectedDocTypes = input.enpDocumentTypeIds?.length
			? await this.enpDocumentTypes.resolveAndValidateSelection({
					enpId: ctx.userId,
					documentTypeIds: input.enpDocumentTypeIds,
				})
			: []

		const now = new Date()
		const [inserted] = await db
			.insert(quicksignProjects)
			.values({
				enpUserId: ctx.userId,
				documentFileObjectId: input.documentFileId,
				title: input.title,
				description: input.description ?? null,
				status: "draft",
				expiresAt: new Date(now.getTime() + 14 * 86400000),
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!inserted)
			throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "QuickSign create failed" })

		const pdf = await this.files.readStoredFileBuffer(input.documentFileId)
		await this.localStorageService.savePdf(inserted.id, pdf)

		const [updated] = await db
			.update(quicksignProjects)
			.set({
				doconchainProjectUuid: inserted.id,
				status: "pending_signatures",
				updatedAt: new Date(),
			})
			.where(eq(quicksignProjects.id, inserted.id))
			.returning()
		if (selectedDocTypes.length) {
			await db.insert(quicksignProjectDocumentTypes).values(
				selectedDocTypes.map(t => ({
					projectId: inserted.id,
					enpDocumentTypeId: t.id,
					pricePhpSnapshot: Math.floor(t.pricePhp),
					createdAt: new Date(),
				}))
			)
		}
		if (input.signer) {
			await this.registerSigner(updated!, input.signer, ctx.userId, 1)
		}
		const signers = await this.loadSigners(inserted.id)
		return this.shapeProject(updated!, signers)
	}

	async retryDcProject(ctx: QlegalSessionContext | null, id: string) {
		ctx = await this.assertEnp(ctx)
		await this.assertCommissionForNotarialActs(ctx)
		const subOrgIds = await this.resolveSubOrgIds(ctx)
		const row = await this.loadProjectForEnp(id, ctx.userId)
		await this.assertQsDocumentFile(row.documentFileObjectId, ctx.userId, subOrgIds)

		try {
			const uuid = await this.doconchainProvision.createProjectUuidFromPdfFile({
				enpUserId: ctx.userId,
				subOrgIds,
				fileObjectId: row.documentFileObjectId,
				documentName: row.title,
				logContext: "quicksign.retryDcProject",
			})
			const [updated] = await db
				.update(quicksignProjects)
				.set({
					doconchainProjectUuid: uuid,
					status: "pending_signatures",
					updatedAt: new Date(),
				})
				.where(eq(quicksignProjects.id, id))
				.returning()
			const signers = await this.loadSigners(id)
			return this.shapeProject(updated!, signers)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			throwQuicksign("DC_PROJECT_CREATE_FAILED", `Retry failed: ${msg.slice(0, 280)}`)
		}
	}

	async addSigner(
		ctx: QlegalSessionContext | null,
		input: { id: string; firstName: string; lastName: string; email: string; order?: number }
	) {
		ctx = await this.assertEnp(ctx)
		await this.assertCommissionForNotarialActs(ctx)
		const row = await this.loadProjectForEnp(input.id, ctx.userId)

		const [seqRow] = await db
			.select({ maxSeq: max(quicksignSigners.sequenceOrder) })
			.from(quicksignSigners)
			.where(eq(quicksignSigners.projectId, row.id))
		const seq = Number(seqRow?.maxSeq ?? 0) + 1

		await this.registerSigner(row, input, ctx.userId, seq)
		const signers = await this.loadSigners(row.id)
		return this.shapeProject(row, signers)
	}

	private async registerSigner(
		row: ProjectRow,
		input: { firstName: string; lastName: string; email: string },
		enpUserId: string,
		sequenceOrder: number
	): Promise<SignerRow> {
		const now = new Date()
		const [sig] = await db
			.insert(quicksignSigners)
			.values({
				projectId: row.id,
				firstName: input.firstName,
				lastName: input.lastName,
				email: input.email,
				sequenceOrder,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!sig) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Signer insert failed" })

		return sig
	}

	async getPlotLink(
		ctx: QlegalSessionContext | null,
		id: string
	): Promise<{ plotLink: string; doconchainProjectUuid: string }> {
		ctx = await this.assertEnp(ctx)
		await this.assertCommissionForNotarialActs(ctx)
		const row = await this.loadProjectForEnp(id, ctx.userId)
		let signers = await this.loadSigners(id)

		if (signers.length === 0) {
			const reviewSigner = await this.resolveReviewClientSignerForProject(id)
			if (reviewSigner) {
				await this.registerSigner(row, reviewSigner, ctx.userId, 1)
				signers = await this.loadSigners(id)
			}
		}

		const localUuid = row.doconchainProjectUuid ?? id
		const plotLink = `${publicAppUrl()}/quicksign/${id}/local-signing`

		return { plotLink, doconchainProjectUuid: localUuid }
	}

	private async resolveReviewClientSignerForProject(
		projectId: string
	): Promise<{ firstName: string; lastName: string; email: string } | null> {
		const [row] = await db
			.select({
				email: users.email,
				firstName: clientProfiles.firstName,
				lastName: clientProfiles.lastName,
				userName: users.name,
			})
			.from(documentReviewRequestFiles)
			.innerJoin(
				documentReviewRequests,
				eq(documentReviewRequests.id, documentReviewRequestFiles.reviewRequestId)
			)
			.innerJoin(users, eq(users.id, documentReviewRequests.clientUserId))
			.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.where(eq(documentReviewRequestFiles.quicksignProjectId, projectId))
			.limit(1)

		if (!row?.email) return null

		let firstName = row.firstName?.trim() ?? ""
		let lastName = row.lastName?.trim() ?? ""
		if (!firstName && !lastName && row.userName) {
			const split = splitDisplayName(row.userName)
			firstName = split.firstName
			lastName = split.lastName
		}

		return {
			email: row.email.trim(),
			firstName: firstName || "Client",
			lastName: lastName || ".",
		}
	}

	async completePlotting(ctx: QlegalSessionContext | null, id: string) {
		ctx = await this.assertEnp(ctx)
		await this.assertCommissionForNotarialActs(ctx)
		await this.loadProjectForEnp(id, ctx.userId)
		const now = new Date()
		const [updated] = await db
			.update(quicksignProjects)
			.set({ plotCompletedAt: now, updatedAt: now })
			.where(eq(quicksignProjects.id, id))
			.returning()
		const signers = await this.loadSigners(id)
		return this.shapeProject(updated!, signers)
	}

	async saveSignatureFields(
		ctx: QlegalSessionContext | null,
		id: string,
		fields: SignatureField[]
	) {
		this.log.log(`[saveSignatureFields] START projectId=${id} userId=${ctx?.userId} fieldCount=${fields.length}`)
		try {
			ctx = await this.assertEnp(ctx)
			this.log.log(`[saveSignatureFields] assertEnp OK userId=${ctx.userId}`)
			await this.assertCommissionForNotarialActs(ctx)
			this.log.log(`[saveSignatureFields] assertCommission OK`)
			const row = await this.loadProjectForEnp(id, ctx.userId)
			this.log.log(`[saveSignatureFields] loadProject OK status=${row.status} plotCompleted=${row.plotCompletedAt}`)
			const now = new Date()
			const [updated] = await db
				.update(quicksignProjects)
				.set({
					signatureFields: fields,
					plotCompletedAt: row.plotCompletedAt ?? now,
					updatedAt: now,
				})
				.where(eq(quicksignProjects.id, id))
				.returning()
			this.log.log(`[saveSignatureFields] DB update OK updated=${Boolean(updated)}`)
			const signers = await this.loadSigners(id)
			this.log.log(`[saveSignatureFields] loadSigners OK count=${signers.length} emails=${signers.map(s => s.email).join(",")}`)
			const result = await this.shapeProject(updated!, signers)
			this.log.log(`[saveSignatureFields] shapeProject OK status=${result.status} signatories=${result.signatories.length}`)
			return result
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			const stack = e instanceof Error ? e.stack : undefined
			this.log.error(`[saveSignatureFields] FAILED projectId=${id} error=${msg}`)
			if (stack) this.log.error(`[saveSignatureFields] STACK: ${stack.slice(0, 500)}`)
			throw e
		}
	}

	async getSignatureFields(ctx: QlegalSessionContext | null, id: string) {
		ctx = await this.assertEnp(ctx)
		const row = await this.loadProjectForEnp(id, ctx.userId)
		return { fields: row.signatureFields ?? [] }
	}

	async stampSignature(
		ctx: QlegalSessionContext | null,
		id: string,
		signerEmail: string,
		signaturePngBase64: string
	): Promise<{ signed: true }> {
		ctx = await this.assertEnp(ctx)
		await this.loadProjectForEnp(id, ctx.userId)
		await this.localSigning.stampSignature(id, signerEmail, signaturePngBase64)
		return { signed: true }
	}

	private formatNotarizationLabel(
		type:
			| "acknowledgment"
			| "jurat"
			| "oath_affirmation"
			| "copy_certification"
			| "signature_witnessing"
	): string {
		return type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
	}

	private async resolveClientUserIdForSigner(
		signerEmail: string,
		explicitClientUserId?: string
	): Promise<string> {
		if (explicitClientUserId?.trim()) {
			const [profile] = await db
				.select({ userId: clientProfiles.userId })
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, explicitClientUserId.trim()))
				.limit(1)
			if (!profile) {
				throw new ORPCError("BAD_REQUEST", {
					message: "clientUserId must be a registered client profile",
				})
			}
			return profile.userId
		}

		const normalized = signerEmail.trim().toLowerCase()
		const [client] = await db
			.select({ userId: users.id })
			.from(users)
			.innerJoin(clientProfiles, eq(clientProfiles.userId, users.id))
			.where(sql`lower(${users.email}) = ${normalized}`)
			.limit(1)

		if (!client) {
			throwQuicksign(
				"SIGNER_NOT_REGISTERED",
				`No registered client account found for ${signerEmail}. The signer must create an account with this email before you can schedule the session.`
			)
		}
		return client.userId
	}

	private async hasRegistryActForAppointment(
		appointmentId: string,
		enpUserId: string
	): Promise<boolean> {
		const [row] = await db
			.select({ id: registryActs.id })
			.from(registryActs)
			.where(
				and(eq(registryActs.appointmentId, appointmentId), eq(registryActs.enpUserId, enpUserId))
			)
			.limit(1)
		return Boolean(row)
	}

	private async syncMeetingSignaturesFromDoconchain(
		appointmentId: string,
		documentFileId: string,
		projectUuid: string,
		enpEmail: string
	): Promise<{ allSigned: boolean; dcCompleted: boolean }> {
		const token = await this.dc.getAccessToken(enpEmail, { allowOrgFallback: false })
		const details = await this.dc.getProjectDetails({ token, projectUuid })
		if (!details) return { allSigned: false, dcCompleted: false }

		const reqRows = await db
			.select({
				id: meetingSignatureRequests.id,
				signerUserId: meetingSignatureRequests.signerUserId,
				status: meetingSignatureRequests.status,
			})
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, appointmentId),
					eq(meetingSignatureRequests.documentFileObjectId, documentFileId)
				)
			)

		const now = new Date()
		for (const row of reqRows) {
			const [user] = await db
				.select({ email: users.email })
				.from(users)
				.where(eq(users.id, row.signerUserId))
				.limit(1)
			const emailNorm = user?.email?.trim().toLowerCase()
			if (!emailNorm) continue

			const dcSigner = details.signers.find(s => s.email.trim().toLowerCase() === emailNorm)
			if (!dcSigner?.signedAt || row.status === "signed") continue

			await db
				.update(meetingSignatureRequests)
				.set({ status: "signed", signedAt: dcSigner.signedAt, updatedAt: now })
				.where(eq(meetingSignatureRequests.id, row.id))
		}

		const refreshed = await db
			.select({ status: meetingSignatureRequests.status })
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, appointmentId),
					eq(meetingSignatureRequests.documentFileObjectId, documentFileId)
				)
			)

		const allSigned = refreshed.length > 0 && refreshed.every(r => r.status === "signed")
		const dcCompleted = isDoconchainProjectCompleted(details)
		return { allSigned: allSigned || dcCompleted, dcCompleted }
	}

	private async syncSigningProgressForProject(
		row: ProjectRow,
		enpEmail: string
	): Promise<{ signingComplete: boolean; registrySynced: boolean }> {
		const projectUuid = row.doconchainProjectUuid?.trim()
		const appointmentId = row.appointmentId
		if (!projectUuid) {
			return { signingComplete: row.status === "completed", registrySynced: false }
		}

		await this.syncSignatoriesFromDoconchain(row.id, projectUuid, enpEmail)

		let allSigned = false
		let dcCompleted = false

		if (appointmentId) {
			const meeting = await this.syncMeetingSignaturesFromDoconchain(
				appointmentId,
				row.documentFileObjectId,
				projectUuid,
				enpEmail
			)
			allSigned = meeting.allSigned
			dcCompleted = meeting.dcCompleted
		} else {
			try {
				const token = await this.dc.getAccessToken(enpEmail, { allowOrgFallback: false })
				const details = await this.dc.getProjectDetails({ token, projectUuid })
				dcCompleted = Boolean(details && isDoconchainProjectCompleted(details))
				const signers = await this.loadSigners(row.id)
				allSigned = signers.length > 0 && signers.every(s => s.signedAt !== null)
			} catch {
				/* DC unavailable */
			}
		}

		if (allSigned || dcCompleted) {
			const now = new Date()
			if (row.status !== "completed") {
				await db
					.update(quicksignProjects)
					.set({ status: "completed", completedAt: now, updatedAt: now })
					.where(eq(quicksignProjects.id, row.id))
			}
			if (!row.notarizedPdfEmailedAt) {
				this.notarizedPdfDelivery.scheduleDeliveryForQuicksignProject(row.id)
			}
		}

		if (!appointmentId) {
			return {
				signingComplete: allSigned || dcCompleted || row.status === "completed",
				registrySynced: false,
			}
		}

		let registrySynced = await this.hasRegistryActForAppointment(appointmentId, row.enpUserId)

		if (dcCompleted && !registrySynced) {
			try {
				const { created } = await this.registry.syncActsFromEndedMeeting({
					appointmentId,
					enpUserId: row.enpUserId,
					meetingEndedAt: new Date(),
					onlyFileObjectId: row.documentFileObjectId ?? undefined,
					allowDuringActiveSession: true,
				})
				if (created > 0) {
					this.log.log(`QuickSign registry: ${created} act(s) for appointment ${appointmentId}`)
				}
				registrySynced = await this.hasRegistryActForAppointment(appointmentId, row.enpUserId)
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				this.log.warn(
					`QuickSign registry populate for appointment ${appointmentId}: ${msg.slice(0, 280)}`
				)
			}
		}

		return {
			signingComplete: allSigned || dcCompleted || row.status === "completed",
			registrySynced,
		}
	}

	private async syncSignatoriesFromDoconchain(
		projectId: string,
		projectUuid: string,
		enpEmail: string
	): Promise<void> {
		try {
			const token = await this.dc.getAccessToken(enpEmail, { allowOrgFallback: false })
			const details = await this.dc.getProjectDetails({ token, projectUuid })
			if (!details?.signers.length) return

			const localSigners = await this.loadSigners(projectId)
			const now = new Date()
			for (const local of localSigners) {
				const dcSigner = details.signers.find(
					s => s.email.trim().toLowerCase() === local.email.trim().toLowerCase()
				)
				if (!dcSigner?.signedAt) continue
				if (local.signedAt && local.signedAt >= dcSigner.signedAt) continue
				await db
					.update(quicksignSigners)
					.set({ signedAt: dcSigner.signedAt, updatedAt: now })
					.where(eq(quicksignSigners.id, local.id))
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.debug(`QuickSign DC signer sync skipped: ${msg.slice(0, 160)}`)
		}
	}

	private async resolveSignDocumentUrl(
		projectUuid: string,
		signerEmail: string,
		projectOwnerEmail: string
	): Promise<string> {
		try {
			return await generateDoconchainSignLink(this.dc, {
				projectUuid,
				signerEmail,
				projectOwnerEmail,
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(
				`QuickSign sign link fallback for ${projectUuid.slice(0, 8)}…: ${msg.slice(0, 120)}`
			)
			const app = env.DOCONCHAIN_APP_URL ?? "https://stg-app.doconchain.com"
			return `${app.replace(/\/$/, "")}/sign/${projectUuid}`
		}
	}

	private principalSignerStatusFromSigners(
		primarySigner: SignerRow,
		signers: SignerRow[]
	): { email: string; name: string; hasSigned: boolean; signedAt: string | null } {
		const refreshed = signers.find(s => s.id === primarySigner.id) ?? primarySigner
		return {
			email: refreshed.email,
			name: `${refreshed.firstName} ${refreshed.lastName}`.trim() || refreshed.email,
			hasSigned: refreshed.signedAt !== null,
			signedAt: refreshed.signedAt?.toISOString() ?? null,
		}
	}

	async finalize(
		ctx: QlegalSessionContext | null,
		input: {
			id: string
			clientUserId?: string
			scheduledAt?: string
			durationMinutes?: number
			title?: string
			notarizationType:
				| "acknowledgment"
				| "jurat"
				| "oath_affirmation"
				| "copy_certification"
				| "signature_witnessing"
			sessionMode: "remote" | "in_person" | "hybrid"
			notes?: string
		}
	) {
		ctx = await this.assertEnp(ctx)
		await this.assertCommissionForNotarialActs(ctx)
		const row = await this.loadProjectForEnp(input.id, ctx.userId)
		if (!row.plotCompletedAt) {
			throwQuicksign("INVALID_STATE", "Complete plotting before scheduling the QuickSign session")
		}
		const signers = await this.loadSigners(row.id)
		if (!signers.length) {
			throwQuicksign("INVALID_STATE", "Add at least one signer before finalizing")
		}
		if (row.appointmentId) {
			throwQuicksign("INVALID_STATE", "This QuickSign project is already linked to an appointment")
		}
		if (!row.doconchainProjectUuid?.trim()) {
			throwQuicksign("INVALID_STATE", "E-sign project is not ready yet")
		}
		if (input.sessionMode === "in_person") {
			await this.ienAttestation.assertEnpAttestationBeforeFinalize(row.id, ctx.userId)
		}

		const primarySigner = signers[0]!
		const clientUserId = await this.resolveClientUserIdForSigner(
			primarySigner.email,
			input.clientUserId
		)

		const now = new Date()
		const scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : now
		if (Number.isNaN(scheduledAt.getTime())) {
			throw new ORPCError("BAD_REQUEST", { message: "scheduledAt must be a valid ISO datetime" })
		}
		const durationMinutes = input.durationMinutes ?? 60
		const title = input.title?.trim() || row.title
		const description = [row.description, input.notes?.trim()].filter(Boolean).join("\n\n") || null
		const projectUuid = row.doconchainProjectUuid.trim()

		const [apt] = await db
			.insert(appointments)
			.values({
				clientUserId,
				enpUserId: ctx.userId,
				title,
				description,
				status: "in_session",
				scheduledAt,
				durationMinutes,
				kind: "quicksign",
				notarizationType: input.notarizationType,
				sessionMode: input.sessionMode,
				confirmedAt: now,
				canStart: true,
				canRejoin: true,
				createdAt: now,
				updatedAt: now,
			})
			.returning()

		if (!apt) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Appointment create failed" })

		await db.insert(appointmentDocuments).values({
			appointmentId: apt.id,
			fileObjectId: row.documentFileObjectId,
			displayName: title,
			documentType: input.notarizationType,
			createdAt: now,
		})

		const projectDocumentTypes = await db
			.select({
				enpDocumentTypeId: quicksignProjectDocumentTypes.enpDocumentTypeId,
				pricePhpSnapshot: quicksignProjectDocumentTypes.pricePhpSnapshot,
			})
			.from(quicksignProjectDocumentTypes)
			.where(eq(quicksignProjectDocumentTypes.projectId, row.id))

		if (projectDocumentTypes.length) {
			await db.insert(appointmentDocumentTypes).values(
				projectDocumentTypes.map(t => ({
					appointmentId: apt.id,
					enpDocumentTypeId: t.enpDocumentTypeId,
					pricePhpSnapshot: t.pricePhpSnapshot,
					createdAt: now,
				}))
			)
		}

		await db
			.update(quicksignProjects)
			.set({ appointmentId: apt.id, updatedAt: now })
			.where(eq(quicksignProjects.id, row.id))

		await this.ienAttestation.linkProjectAttestationsToAppointment(row.id, apt.id)

		await this.sessions.ensureRoomForAppointment(apt.id)

		await this.meetingSigners.setMeetingDocumentSigners(ctx, apt.id, row.documentFileObjectId, [
			{ userId: clientUserId, role: "principal" },
			{ userId: ctx.userId, role: "notary" },
		])

		const appBase = publicAppUrl()
		const lobbyPath = `/appointments/${apt.id}/lobby`
		const clientJoinUrl = `${appBase}${lobbyPath}`
		const enpJoinUrl = `${appBase}${lobbyPath}`

		const enpRow = await this.loadEnpRow(ctx.userId)
		if (!enpRow?.email) {
			throw new ORPCError("BAD_REQUEST", { message: "ENP profile email is required" })
		}
		const enpEmail = enpRow.email.trim()

		const progress = await this.syncSigningProgressForProject(
			{ ...row, appointmentId: apt.id },
			enpEmail
		)
		const signersAfterSync = await this.loadSigners(row.id)

		const isIen = input.sessionMode === "in_person"
		const [clientSignDocumentUrl, enpSignDocumentUrl] = isIen
			? [
					this.ienAttestation.buildIenSignPageUrl(apt.id, row.documentFileObjectId, "principal"),
					this.ienAttestation.buildIenSignPageUrl(apt.id, row.documentFileObjectId, "enp"),
				]
			: await Promise.all([
					this.resolveSignDocumentUrl(projectUuid, primarySigner.email, enpEmail),
					this.resolveSignDocumentUrl(projectUuid, enpEmail, enpEmail),
				])
		const signDocumentUrl = clientSignDocumentUrl
		const principalSignerStatus = this.principalSignerStatusFromSigners(
			primarySigner,
			signersAfterSync
		)

		const enpName = formatEnpName(enpRow)
		const signerName =
			`${primarySigner.firstName} ${primarySigner.lastName}`.trim() || primarySigner.email

		const invite = buildQuicksignSessionInviteEmail({
			recipientName: signerName,
			enpName,
			documentTitle: title,
			notarizationTypeLabel: this.formatNotarizationLabel(input.notarizationType),
			joinSessionUrl: clientJoinUrl,
			signDocumentUrl,
			requiresIenAcknowledgment: isIen,
		})

		await this.email.sendQuicksignSessionInvite(primarySigner.email, invite)

		const payload = { appointmentId: apt.id, status: "in_session" as const }
		this.events.emitToUser(clientUserId, "appointments:updated", payload)
		if (ctx.userId !== clientUserId) {
			this.events.emitToUser(ctx.userId, "appointments:updated", payload)
		}

		return {
			appointmentId: apt.id,
			quicksignProjectId: row.id,
			doconchainProjectUuid: row.doconchainProjectUuid,
			documentFileId: row.documentFileObjectId,
			clientJoinUrl,
			enpJoinUrl,
			signDocumentUrl,
			clientSignDocumentUrl,
			enpSignDocumentUrl,
			principalSignerStatus,
			signingComplete: progress.signingComplete,
			registrySynced: progress.registrySynced,
		}
	}
}

import {
	BadRequestException,
	ForbiddenException,
	HttpException,
	Injectable,
	Logger,
	NotFoundException,
} from "@nestjs/common"
import {
	and,
	asc,
	count,
	desc,
	eq,
	gte,
	inArray,
	isNotNull,
	isNull,
	like,
	lt,
	or,
} from "drizzle-orm"
import type { Response } from "express"

import {
	formatEnbEntryNumber,
	ienAttestationTextForRole,
	type BulkScSyncResult,
	type CreateEnbAccessRequest,
	type CreateRegistryAct,
	type DecideEnbAccessRequest,
	type EnbAccessRequest,
	type EnbEntryLookupResult,
	type FinalizeSessionDraftInput,
	type LookupEnbEntryForAccess,
	type ProtestProceedings,
	type RecordIncompleteAct,
	type RegistryAct,
	type RequestCertifiedTrueCopy,
	type SubmitMonthlyNotarialBook,
	type SubmitMonthlyNotarialBookResult,
	type SubmitVirtualEnbAccessRequest,
	type UpsertProtestProceedings,
} from "@repo/contracts"
import {
	appointmentDocuments,
	appointments,
	clientProfiles,
	enbAccessRequests,
	enpProfiles,
	fileObjects,
	ienNotarialAttestations,
	meetingEnbSignatureRequests,
	meetingSignatureRequests,
	paymentIntents,
	quicksignProjects,
	quicksignSigners,
	registryActs,
	registryProtestProceedings,
	users,
} from "@repo/db/schema"

import { NotarizedPdfArchiveService } from "@/services/notarized-pdf/notarized-pdf-archive.service"
import { ScRegistryAdapterService } from "@/services/sc-registry/sc-registry-adapter.service"
import { defaultScAddress } from "@/services/sc-registry/supreme-court-client.js"
import { db } from "@/common/database/database.client"
import { EnbBackupService } from "@/common/enb-backup/enb-backup.service"
import { env } from "@/config/env.config"
import { assertEnpCommissionAllowsNotarialActs } from "@/modules/v1/auth-profile/lib/assert-enp-commission-active"
import { assertGovernmentIdAllowsNotarialActs } from "@/modules/v1/auth-profile/lib/assert-government-id-allows-notarial-acts"
import { FilesService } from "@/modules/v1/files/files.service"

import { resolveNotarizationLocationsForAppointments } from "./lib/resolve-notarization-location.js"

const ACT_TYPES: RegistryAct["actType"][] = [
	"deed_of_sale",
	"affidavit",
	"special_power_of_attorney",
	"general_power_of_attorney",
	"acknowledgment",
	"jurat",
	"oath",
	"certification",
	"protest",
	"deposition",
	"other",
]

function isActType(v: string): v is RegistryAct["actType"] {
	return (ACT_TYPES as string[]).includes(v)
}

function scActTypeForRegistryRow(
	registryActType: string,
	meetingDocumentType: string | null | undefined
): string {
	const raw = meetingDocumentType?.trim()
	const preset = raw?.toUpperCase()
	const snake = raw?.toLowerCase().replace(/\s+/g, "_") ?? ""

	if (preset === "SIGNATURE_WITNESSING" || snake === "signature_witnessing") {
		return "signature_witnessing"
	}
	if (preset === "JURAT" || snake === "jurat") return "jurat"
	if (
		preset === "AFFIRMATION" ||
		preset === "OATH_AFFIRMATION" ||
		preset === "OATH" ||
		snake === "oath_affirmation" ||
		snake === "affirmation"
	) {
		return "oath"
	}
	if (preset === "COPY_CERTIFICATION" || snake === "copy_certification") {
		return "certification"
	}
	if (preset === "ACKNOWLEDGMENT" || snake === "acknowledgment") return "acknowledgment"
	return registryActType
}

function mapMeetingDocumentTypeToActType(
	documentType: string | null | undefined,
	projectDescription: string | null | undefined,
	projectTitle: string
): RegistryAct["actType"] {
	const raw = documentType?.trim()
	const preset = raw?.toUpperCase()
	const snake = raw?.toLowerCase().replace(/\s+/g, "_") ?? ""

	if (preset === "JURAT" || snake === "jurat") return "jurat"
	if (
		preset === "AFFIRMATION" ||
		preset === "OATH_AFFIRMATION" ||
		snake === "oath_affirmation" ||
		snake === "affirmation"
	) {
		return "oath"
	}
	if (preset === "SIGNATURE_WITNESSING" || snake === "signature_witnessing") {
		return "acknowledgment"
	}
	if (preset === "ACKNOWLEDGMENT" || snake === "acknowledgment") return "acknowledgment"
	if (preset === "COPY_CERTIFICATION" || snake === "copy_certification") {
		return "certification"
	}

	const fromDesc = projectDescription?.replace(/^Meeting\s*·\s*/i, "").trim()
	if (fromDesc) return mapNotarizationLabelToActType(fromDesc)
	if (documentType?.trim()) return mapNotarizationLabelToActType(documentType)
	return mapNotarizationLabelToActType(projectTitle)
}

function mapNotarizationLabelToActType(label: string): RegistryAct["actType"] {
	const snake = label.trim().toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_")
	if (isActType(snake)) return snake
	const lower = label.toLowerCase()
	if (lower.includes("deed") && lower.includes("sale")) return "deed_of_sale"
	if (lower.includes("affidavit")) return "affidavit"
	if (lower.includes("special") && lower.includes("power")) return "special_power_of_attorney"
	if (lower.includes("general") && lower.includes("power")) return "general_power_of_attorney"
	if (lower.includes("acknowledgment")) return "acknowledgment"
	if (lower.includes("jurat")) return "jurat"
	if (lower.includes("oath")) return "oath"
	if (lower.includes("certif")) return "certification"
	if (lower.includes("protest")) return "protest"
	if (lower.includes("deposition")) return "deposition"
	return "other"
}

function parsePartiesLine(line: string): { name: string; role: string }[] {
	return line
		.split(/\s*&\s+/g)
		.map(part => part.trim())
		.filter(Boolean)
		.map(chunk => {
			const m = chunk.match(/^(.+?)\s*\(([^)]+)\)\s*$/)
			if (m?.[1] && m[2]) return { name: m[1].trim(), role: m[2].trim() }
			return { name: chunk, role: "Party" }
		})
}

function toIso(d: Date | string | null | undefined): string | null {
	if (!d) return null
	const date = d instanceof Date ? d : new Date(d)
	if (Number.isNaN(date.getTime())) return null
	return date.toISOString()
}

function executedAtToIso(d: Date | string): string {
	return toIso(d) ?? new Date().toISOString()
}

/** Live SC reference from a prior successful sync (not stub/mock). */
function hasLiveScExternalRef(ref: string | null | undefined): boolean {
	const raw = ref?.trim() ?? ""
	if (!raw || raw.startsWith("mock_sc_") || raw.startsWith("NRID-STUB-")) return false
	return raw.includes("NRID-")
}

function fileLabelFromS3Key(key: string): string {
	const base = key.split("/").pop() ?? key
	try {
		return decodeURIComponent(base)
	} catch {
		return base
	}
}

function parseFeesFromDescription(description: string | null): number | null {
	if (!description) return null
	const m = description.match(/Fees:\s*PHP\s*(\d+)/i)
	if (!m?.[1]) return null
	const n = Number.parseInt(m[1], 10)
	return Number.isFinite(n) ? n : null
}

function formatEnpPartyName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "Notary"
}

const MEETING_FILE_DEDUPE_PREFIX = "qlegal-file:"
const MEETING_DC_DEDUPE_PREFIX = "qlegal-dc:"
const MEETING_DC_CODE_PREFIX = "qlegal-dc-code:"
const QLEGAL_CODE_PREFIX = "qlegal-code:"
const QLEGAL_HASH_PREFIX = "qlegal-hash:"

function registryActDescription(
	doconchainProjectUuid: string,
	fileObjectId: string,
	qlegalCode?: string | null,
	qlegalHash?: string | null
): string {
	const parts = [
		`${MEETING_DC_DEDUPE_PREFIX}${doconchainProjectUuid.trim()}`,
		`${MEETING_FILE_DEDUPE_PREFIX}${fileObjectId}`,
	]
	if (qlegalCode) parts.push(`${QLEGAL_CODE_PREFIX}${qlegalCode.trim()}`)
	if (qlegalHash) parts.push(`${QLEGAL_HASH_PREFIX}${qlegalHash.trim()}`)
	return parts.join("|")
}

function parseDescriptionValue(description: string | null | undefined, prefix: string): string | null {
	if (!description?.trim()) return null
	for (const segment of description.split("|")) {
		const trimmed = segment.trim()
		if (trimmed.startsWith(prefix)) {
			const val = trimmed.slice(prefix.length).trim()
			return val || null
		}
	}
	return null
}

function parseRegistryActDescription(description: string | null | undefined): {
	documentFileObjectId: string | null
	doconchainProjectUuid: string | null
	documentCode: string | null
} {
	if (!description?.trim()) {
		return { documentFileObjectId: null, doconchainProjectUuid: null, documentCode: null }
	}
	let documentFileObjectId: string | null = null
	let doconchainProjectUuid: string | null = null
	let documentCode: string | null = null

	const segments = description.includes("|") ? description.split("|") : [description]
	for (const part of segments) {
		const segment = part.trim()
		if (segment.startsWith(MEETING_FILE_DEDUPE_PREFIX)) {
			documentFileObjectId = segment.slice(MEETING_FILE_DEDUPE_PREFIX.length).trim() || null
		}
		if (segment.startsWith(MEETING_DC_CODE_PREFIX)) {
			documentCode = segment.slice(MEETING_DC_CODE_PREFIX.length).trim() || null
		} else if (segment.startsWith(MEETING_DC_DEDUPE_PREFIX)) {
			doconchainProjectUuid = segment.slice(MEETING_DC_DEDUPE_PREFIX.length).trim() || null
		}
	}

	return { documentFileObjectId, doconchainProjectUuid, documentCode }
}

function mergeDocumentCodeIntoDescription(
	description: string | null | undefined,
	documentCode: string
): string {
	const parsed = parseRegistryActDescription(description)
	const code = documentCode.trim()
	if (!code) return description?.trim() ?? ""
	if (parsed.doconchainProjectUuid && parsed.documentFileObjectId) {
		return registryActDescription(parsed.doconchainProjectUuid, parsed.documentFileObjectId, code)
	}
	if (parsed.doconchainProjectUuid) {
		return `${MEETING_DC_DEDUPE_PREFIX}${parsed.doconchainProjectUuid}|${MEETING_DC_CODE_PREFIX}${code}`
	}
	if (description?.includes(MEETING_DC_CODE_PREFIX)) {
		return description
			.split("|")
			.map(part =>
				part.trim().startsWith(MEETING_DC_CODE_PREFIX) ? `${MEETING_DC_CODE_PREFIX}${code}` : part
			)
			.join("|")
	}
	const base = description?.trim()
	return base ? `${base}|${MEETING_DC_CODE_PREFIX}${code}` : `${MEETING_DC_CODE_PREFIX}${code}`
}

function entryNumberForRow(row: typeof registryActs.$inferSelect): string {
	const stored = row.entryNumber?.trim()
	if (stored) return stored
	return formatEnbEntryNumber({
		actNumber: row.actNumber,
		pageNo: row.pageNo,
		executedAt: row.executedAt,
	})
}

function rowToAct(
	row: typeof registryActs.$inferSelect,
	sessionMode: "remote" | "in_person" | "hybrid" | null = null,
	appointmentPurpose: string | null = null
): RegistryAct {
	const parties = row.parties as { name: string; role: string }[]
	const { documentFileObjectId, doconchainProjectUuid, documentCode } =
		parseRegistryActDescription(row.description)

	return {
		id: row.id,
		enpId: row.enpUserId,
		actNumber: row.actNumber,
		entryNumber: entryNumberForRow(row),
		completionStatus: row.completionStatus ?? "completed",
		incompleteReason: row.incompleteReason ?? null,
		incompleteCircumstances: row.incompleteCircumstances ?? null,
		actType: row.actType,
		title: row.title,
		parties,
		executedAt: executedAtToIso(row.executedAt),
		documentUrl: row.documentUrl ?? null,
		documentFileObjectId,
		doconchainProjectUuid,
		documentCode,
		scStatus: row.scStatus,
		scSubmittedAt: toIso(row.scSubmittedAt),
		scSyncedAt: toIso(row.scSyncedAt),
		scRejectionReason: row.scRejectionReason ?? null,
		scExternalRef: row.scExternalRef ?? null,
		appointmentId: row.appointmentId ?? null,
		appointmentPurpose: appointmentPurpose?.trim() || null,
		sessionMode,
		bookNo: row.bookNo ?? null,
		pageNo: row.pageNo ?? null,
		feePhp: row.feePhp ?? null,
		notarizationLocation: null,
		principalEnbSignatures: [],
		ienNotarialAttestations: [],
		enbAccessRequests: [],
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	}
}

@Injectable()
export class RegistryService {
	private readonly log = new Logger(RegistryService.name)

	constructor(
		private readonly scRegistry: ScRegistryAdapterService,
		private readonly files: FilesService,
		private readonly notarizedArchive: NotarizedPdfArchiveService,
		private readonly enbBackup: EnbBackupService
	) {}

	private scheduleEnbBackup(actId: string): void {
		this.enbBackup.scheduleSyncActById(actId)
	}

	async userHasEnpProfile(userId: string): Promise<boolean> {
		const [row] = await db
			.select({ userId: enpProfiles.userId })
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, userId))
			.limit(1)
		return Boolean(row)
	}

	/** Local signer roles for registry parties (principal / witness / notary). */
	private async loadMeetingSignatureRows(appointmentId: string, documentFileObjectId: string) {
		return db
			.select({
				signerUserId: meetingSignatureRequests.signerUserId,
				signerRole: meetingSignatureRequests.signerRole,
				status: meetingSignatureRequests.status,
				signedAt: meetingSignatureRequests.signedAt,
			})
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, appointmentId),
					eq(meetingSignatureRequests.documentFileObjectId, documentFileObjectId)
				)
			)
			.orderBy(asc(meetingSignatureRequests.signingOrder))
	}

	private resolveExecutedAt(
		project: typeof quicksignProjects.$inferSelect,
		signers: (typeof quicksignSigners.$inferSelect)[],
		meetingRows: { signedAt: Date | null }[]
	): Date {
		let best = project.completedAt ?? null
		for (const r of meetingRows) {
			if (!r.signedAt) continue
			if (!best || r.signedAt > best) best = r.signedAt
		}
		for (const s of signers) {
			if (!s.signedAt) continue
			if (!best || s.signedAt > best) best = s.signedAt
		}
		return best ?? new Date()
	}

	private async buildPartiesForRegistryAct(
		enpUserId: string,
		enpDisplayName: string,
		signers: (typeof quicksignSigners.$inferSelect)[],
		meetingRows: { signerUserId: string; signerRole: string }[],
		enpEmailNorm: string
	): Promise<{ name: string; role: string }[]> {
		if (meetingRows.length > 0) {
			const userIds = [...new Set(meetingRows.map(r => r.signerUserId))]
			const nameRows = await db
				.select({
					userId: users.id,
					email: users.email,
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
					clientFirst: clientProfiles.firstName,
					clientLast: clientProfiles.lastName,
				})
				.from(users)
				.leftJoin(enpProfiles, eq(enpProfiles.userId, users.id))
				.leftJoin(clientProfiles, eq(clientProfiles.userId, users.id))
				.where(inArray(users.id, userIds))

			const parties = meetingRows.map(r => {
				const u = nameRows.find(n => n.userId === r.signerUserId)
				const name =
					u?.firstName && u?.lastName
						? `${u.firstName} ${u.lastName}`.trim()
						: u?.clientFirst && u?.clientLast
							? `${u.clientFirst} ${u.clientLast}`.trim()
							: (u?.email?.split("@")[0] ?? "Signer")
				const role =
					r.signerRole === "notary"
						? "Notary"
						: r.signerRole === "witness"
							? "Witness"
							: "Principal"
				return { name, role }
			})
			if (!parties.some(p => p.role === "Notary")) {
				parties.push({ name: enpDisplayName, role: "Notary" })
			}
			return parties
		}

		const parties: { name: string; role: string }[] = signers.map(s => ({
			name: `${s.firstName} ${s.lastName}`.trim(),
			role: enpEmailNorm && s.email.trim().toLowerCase() === enpEmailNorm ? "Notary" : "Principal",
		}))
		if (!parties.some(p => p.role === "Notary")) {
			parties.push({ name: enpDisplayName, role: "Notary" })
		}
		return parties
	}

	/**
	 * Populate registry acts when a meeting ends (only trigger — no list-page DocOnChain calls).
	 * Per document: `GET /api/v2/projects/{uuid}`; insert only when DocOnChain reports COMPLETED.
	 * Idempotent per ENP + `doconchainProjectUuid`. PDF URLs are resolved on demand later.
	 */
	/** @deprecated Prefer meeting-end populate; kept for internal callers only. */
	async syncActForCompletedNotarization(args: {
		appointmentId: string
		enpUserId: string
		documentFileObjectId: string
		notarizedAt?: Date
	}): Promise<{ created: boolean }> {
		const { created } = await this.syncActsFromEndedMeeting({
			appointmentId: args.appointmentId,
			enpUserId: args.enpUserId,
			meetingEndedAt: args.notarizedAt ?? new Date(),
			onlyFileObjectId: args.documentFileObjectId,
		})
		return { created: created > 0 }
	}

	async syncActsFromEndedMeeting(args: {
		appointmentId: string
		enpUserId: string
		meetingEndedAt?: Date
		/** When set, only sync this meeting document. */
		onlyFileObjectId?: string
		/**
		 * Default false — rows stay internal until the meeting ends and appear in the notarial book.
		 * ENB signing passes true so acts exist for principal acknowledgments during the session.
		 */
		allowDuringActiveSession?: boolean
		/** When true, treat all meeting signers as signed even if DocOnChain status still lags. */
		allowWhenMeetingSignaturesComplete?: boolean
	}): Promise<{ created: number; skipped: number }> {
		const meetingEndedAt = args.meetingEndedAt ?? new Date()
		let created = 0
		let skipped = 0
		try {
			const [appt] = await db
				.select()
				.from(appointments)
				.where(eq(appointments.id, args.appointmentId))
				.limit(1)
			if (!appt || appt.enpUserId !== args.enpUserId) return { created: 0, skipped: 0 }

			if (!args.allowDuringActiveSession && appt.status !== "ended") {
				this.log.debug(
					`Registry populate deferred for appointment ${args.appointmentId} (status=${appt.status})`
				)
				return { created: 0, skipped: 0 }
			}

			const enpEmail = await this.loadEnpEmail(args.enpUserId)
			const enpEmailNorm = enpEmail?.toLowerCase() ?? ""

			const [enpProf] = await db
				.select({
					prefix: enpProfiles.prefix,
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
					suffix: enpProfiles.suffix,
					directoryBaseFeePhp: enpProfiles.directoryBaseFeePhp,
				})
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, args.enpUserId))
				.limit(1)
			const enpDisplayName = enpProf ? formatEnpPartyName(enpProf) : "Notary"
			const defaultFeePhp =
				enpProf?.directoryBaseFeePhp !== null &&
				enpProf?.directoryBaseFeePhp !== undefined &&
				enpProf.directoryBaseFeePhp > 0
					? enpProf.directoryBaseFeePhp
					: 500

			const docLinks = await db
				.select()
				.from(appointmentDocuments)
				.where(eq(appointmentDocuments.appointmentId, args.appointmentId))
				.orderBy(asc(appointmentDocuments.createdAt))

			type RegistrySyncCandidate = {
				link: (typeof docLinks)[number]
				project: typeof quicksignProjects.$inferSelect
				projectUuid: string
				signers: (typeof quicksignSigners.$inferSelect)[]
				titleBase: string
				executedAt: Date
				actType: RegistryAct["actType"]
				feePhp: number | null
				parties: { name: string; role: string }[]
				description: string
			}

			const candidates: RegistrySyncCandidate[] = []

			for (const link of docLinks) {
				if (args.onlyFileObjectId && link.fileObjectId !== args.onlyFileObjectId) {
					continue
				}
				if (!link.documentType?.trim()) {
					skipped++
					continue
				}

				const [project] = await db
					.select()
					.from(quicksignProjects)
					.where(
						and(
							eq(quicksignProjects.enpUserId, args.enpUserId),
							eq(quicksignProjects.documentFileObjectId, link.fileObjectId)
						)
					)
					.orderBy(desc(quicksignProjects.createdAt))
					.limit(1)

				const projectUuid = project?.doconchainProjectUuid?.trim()
				if (!project || !projectUuid) {
					skipped++
					continue
				}

				const fileDedupeMarker = `${MEETING_FILE_DEDUPE_PREFIX}${link.fileObjectId}`
				const [existingForMeeting] = await db
					.select({ id: registryActs.id })
					.from(registryActs)
					.where(
						and(
							eq(registryActs.appointmentId, args.appointmentId),
							like(registryActs.description, `%${fileDedupeMarker}%`)
						)
					)
					.limit(1)
				if (existingForMeeting) {
					skipped++
					continue
				}

				if (project.status !== "completed") {
					skipped++
					this.log.debug(
						`Registry populate: project ${projectUuid.slice(0, 8)}… not completed (status=${project.status})`
					)
					continue
				}

				const meetingRows = await this.loadMeetingSignatureRows(
					args.appointmentId,
					link.fileObjectId
				)

				const signers = await db
					.select()
					.from(quicksignSigners)
					.where(eq(quicksignSigners.projectId, project.id))
					.orderBy(asc(quicksignSigners.sequenceOrder), asc(quicksignSigners.createdAt))

				const [fileRow] = await db
					.select()
					.from(fileObjects)
					.where(eq(fileObjects.id, link.fileObjectId))
					.limit(1)
				const titleBase =
					link.displayName?.trim() || (fileRow ? fileLabelFromS3Key(fileRow.s3Key) : project.title)
				const actType = mapMeetingDocumentTypeToActType(
					link.documentType,
					project.description,
					project.title
				)
				const feePhp = parseFeesFromDescription(project.description) ?? defaultFeePhp
				const parties = await this.buildPartiesForRegistryAct(
					args.enpUserId,
					enpDisplayName,
					signers,
					meetingRows,
					enpEmailNorm
				)

				const executedAt =
					project.completedAt instanceof Date
						? project.completedAt
						: project.completedAt
							? new Date(project.completedAt)
							: meetingEndedAt

				const qlegalCode = parseDescriptionValue(project.description, "qlegal-code:")
				const qlegalHash = parseDescriptionValue(project.description, "qlegal-hash:")

				candidates.push({
					link,
					project,
					projectUuid,
					signers,
					titleBase,
					executedAt,
					actType,
					feePhp,
					parties,
					description: registryActDescription(
						projectUuid,
						link.fileObjectId,
						qlegalCode,
						qlegalHash
					),
				})
			}

			candidates.sort((a, b) => {
				const bySeal = a.executedAt.getTime() - b.executedAt.getTime()
				if (bySeal !== 0) return bySeal
				return a.link.createdAt.getTime() - b.link.createdAt.getTime()
			})

			for (const candidate of candidates) {
				const actNumber = await this.nextActNumber(args.enpUserId)
				const now = new Date()
				const bookNo = this.resolveEnbBookNo(candidate.executedAt)
				const pageNo = this.formatEnbPageNo(
					await this.nextEnbPageNo(args.enpUserId, candidate.executedAt)
				)
				const enbFields = this.registryEnbFields({
					actNumber,
					pageNo,
					executedAt: candidate.executedAt,
				})
				const [inserted] = await db
					.insert(registryActs)
					.values({
						enpUserId: args.enpUserId,
						appointmentId: args.appointmentId,
						actNumber,
						actType: candidate.actType,
						title: candidate.titleBase,
						parties: candidate.parties,
						executedAt: candidate.executedAt,
						documentUrl: null,
						bookNo,
						pageNo,
						feePhp: candidate.feePhp,
						description: candidate.description,
						scStatus: "draft",
						scSubmittedAt: null,
						scSyncedAt: null,
						scRejectionReason: null,
						scExternalRef: null,
						...enbFields,
						createdAt: now,
						updatedAt: now,
					})
					.returning()
				created++
				if (inserted) {
					this.scheduleEnbBackup(inserted.id)
					void this.tryScSyncRegistryActAfterInsert({
						enpUserId: args.enpUserId,
						row: inserted,
						sessionMode: appt.sessionMode,
						meetingDocumentType: candidate.link.documentType,
					})
				}
			}

			await this.backfillMissingEnbBookPages(args.enpUserId, meetingEndedAt)

			const summary = `Ended meeting ${args.appointmentId}: ${created} registry act(s) created, ${skipped} document(s) skipped`
			if (created === 0 && skipped > 0) {
				this.log.warn(`${summary} — check debug logs for completion status / dedupe skips`)
			} else {
				this.log.log(summary)
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.error(
				`Registry populate failed for appointment ${args.appointmentId}: ${msg.slice(0, 500)}`
			)
		}
		return { created, skipped }
	}

	private async tryPersistNotarizedPdfUrl(
		_enpUserId: string,
		_actId: string,
		_documentFileObjectId: string
	): Promise<void> {
		/* documentUrl is unused in local flow — no-op */
	}

	/**
	 * If the ENP's latest ended meeting has no registry rows yet, run populate once (e.g. populate failed at end or code was deployed after end).
	 */
	async repopulateLatestEndedMeetingIfMissing(enpUserId: string): Promise<void> {
		const [latestEnded] = await db
			.select({ id: appointments.id, updatedAt: appointments.updatedAt })
			.from(appointments)
			.where(and(eq(appointments.enpUserId, enpUserId), eq(appointments.status, "ended")))
			.orderBy(desc(appointments.updatedAt))
			.limit(1)
		if (!latestEnded) return

		const [existing] = await db
			.select({ id: registryActs.id })
			.from(registryActs)
			.where(eq(registryActs.appointmentId, latestEnded.id))
			.limit(1)
		if (existing) return

		await this.syncActsFromEndedMeeting({
			appointmentId: latestEnded.id,
			enpUserId,
			meetingEndedAt: latestEnded.updatedAt,
		})
	}

	async findAllForEnp(enpUserId: string): Promise<RegistryAct[]> {
		const rows = await db
			.select({
				row: registryActs,
				sessionMode: appointments.sessionMode,
				appointmentPurpose: appointments.description,
			})
			.from(registryActs)
			.leftJoin(appointments, eq(registryActs.appointmentId, appointments.id))
			.where(
				and(
					eq(registryActs.enpUserId, enpUserId),
					or(isNull(registryActs.appointmentId), eq(appointments.status, "ended"))
				)
			)
			.orderBy(desc(registryActs.executedAt), desc(registryActs.createdAt))

		await this.backfillMissingEntryNumbers(rows.map(r => r.row).filter(r => !r.entryNumber?.trim()))

		const acts = rows.map(({ row, sessionMode, appointmentPurpose }) =>
			rowToAct(row, sessionMode ?? null, appointmentPurpose)
		)
		const withSignatures = await this.attachPrincipalEnbSignatures(acts)
		const withIenAttestations = await this.attachIenNotarialAttestations(withSignatures)
		const withLocations = await this.attachNotarizationLocations(withIenAttestations)
		return this.attachEnbAccessRequests(enpUserId, withLocations)
	}

	private async attachEnbAccessRequests(
		enpUserId: string,
		acts: RegistryAct[]
	): Promise<RegistryAct[]> {
		const requests = await this.listEnbAccessRequests(enpUserId)
		const byActId = new Map<string, EnbAccessRequest[]>()
		const byDocumentKey = new Map<string, EnbAccessRequest[]>()

		for (const req of requests) {
			if (req.registryActId) {
				const list = byActId.get(req.registryActId) ?? []
				list.push(req)
				byActId.set(req.registryActId, list)
			}
			if (req.appointmentId && req.documentFileObjectId) {
				const key = `${req.appointmentId}:${req.documentFileObjectId}`
				const list = byDocumentKey.get(key) ?? []
				list.push(req)
				byDocumentKey.set(key, list)
			}
		}

		return acts.map(act => {
			const linked = new Map<string, EnbAccessRequest>()
			for (const req of byActId.get(act.id) ?? []) linked.set(req.id, req)
			if (act.appointmentId && act.documentFileObjectId) {
				const key = `${act.appointmentId}:${act.documentFileObjectId}`
				for (const req of byDocumentKey.get(key) ?? []) linked.set(req.id, req)
			}
			return {
				...act,
				enbAccessRequests: [...linked.values()],
			}
		})
	}

	async findOneForEnp(enpUserId: string, id: string): Promise<RegistryAct> {
		const loaded = await this.loadActRowForEnp(enpUserId, id)
		await this.assertActVisibleInNotarialBookAsync(loaded.row)
		const act = rowToAct(loaded.row, loaded.sessionMode, loaded.appointmentPurpose)
		const [withSignatures] = await this.attachPrincipalEnbSignatures([act])
		const base = withSignatures ?? act
		const [withIen] = await this.attachIenNotarialAttestations([base])
		const [enriched] = await this.attachNotarizationLocations([withIen ?? base])
		return enriched ?? withIen ?? base
	}

	private async attachNotarizationLocations(acts: RegistryAct[]): Promise<RegistryAct[]> {
		const appointmentIds = acts
			.map(a => a.appointmentId)
			.filter((id): id is string => Boolean(id?.trim()))
		if (!appointmentIds.length) return acts

		const byAppointment = await resolveNotarizationLocationsForAppointments(appointmentIds)
		if (!byAppointment.size) return acts

		return acts.map(act => {
			if (!act.appointmentId) return act
			const notarizationLocation = byAppointment.get(act.appointmentId) ?? null
			if (!notarizationLocation) return act
			return { ...act, notarizationLocation }
		})
	}

	private async attachPrincipalEnbSignatures(acts: RegistryAct[]): Promise<RegistryAct[]> {
		const actIds = acts.map(a => a.id)
		if (!actIds.length) return acts

		const sigRows = await db
			.select({
				registryActId: meetingEnbSignatureRequests.registryActId,
				signerName: meetingEnbSignatureRequests.signerName,
				signerRole: meetingEnbSignatureRequests.signerRole,
				signedAt: meetingEnbSignatureRequests.signedAt,
				signatureAcknowledgment: meetingEnbSignatureRequests.signatureAcknowledgment,
				signatureImageData: meetingEnbSignatureRequests.signatureImageData,
				status: meetingEnbSignatureRequests.status,
			})
			.from(meetingEnbSignatureRequests)
			.where(
				and(
					inArray(meetingEnbSignatureRequests.registryActId, actIds),
					eq(meetingEnbSignatureRequests.status, "signed")
				)
			)
			.orderBy(asc(meetingEnbSignatureRequests.signedAt))

		const byAct = new Map<string, RegistryAct["principalEnbSignatures"]>()
		for (const row of sigRows) {
			if (!row.signedAt) continue
			const list = byAct.get(row.registryActId) ?? []
			list.push({
				signerName: row.signerName,
				signerRole: row.signerRole,
				signedAt: row.signedAt.toISOString(),
				signatureAcknowledgment: row.signatureAcknowledgment ?? null,
				signatureImageData: row.signatureImageData ?? null,
			})
			byAct.set(row.registryActId, list)
		}

		return acts.map(act => ({
			...act,
			principalEnbSignatures: byAct.get(act.id) ?? [],
		}))
	}

	private async attachIenNotarialAttestations(acts: RegistryAct[]): Promise<RegistryAct[]> {
		const appointmentIds = acts
			.map(a => a.appointmentId)
			.filter((id): id is string => Boolean(id?.trim()))
		if (!appointmentIds.length) {
			return acts.map(act => ({ ...act, ienNotarialAttestations: [] }))
		}

		const rows = await db
			.select({
				appointmentId: ienNotarialAttestations.appointmentId,
				documentFileObjectId: ienNotarialAttestations.documentFileObjectId,
				role: ienNotarialAttestations.role,
				signerName: ienNotarialAttestations.signerName,
				signerEmail: ienNotarialAttestations.signerEmail,
				confirmedAt: ienNotarialAttestations.confirmedAt,
				acknowledgmentText: ienNotarialAttestations.acknowledgmentText,
			})
			.from(ienNotarialAttestations)
			.where(inArray(ienNotarialAttestations.appointmentId, appointmentIds))
			.orderBy(asc(ienNotarialAttestations.confirmedAt))

		const byKey = new Map<string, RegistryAct["ienNotarialAttestations"]>()
		for (const row of rows) {
			if (!row.appointmentId) continue
			const key = `${row.appointmentId}:${row.documentFileObjectId}`
			const list = byKey.get(key) ?? []
			list.push({
				role: row.role,
				signerName: row.signerName?.trim() || row.signerEmail,
				signerEmail: row.signerEmail,
				confirmedAt: row.confirmedAt.toISOString(),
				acknowledgmentText: row.acknowledgmentText?.trim() || ienAttestationTextForRole(row.role),
			})
			byKey.set(key, list)
		}

		return acts.map(act => {
			if (!act.appointmentId || !act.documentFileObjectId) {
				return { ...act, ienNotarialAttestations: [] }
			}
			const key = `${act.appointmentId}:${act.documentFileObjectId}`
			return { ...act, ienNotarialAttestations: byKey.get(key) ?? [] }
		})
	}

	private async loadAppointmentStatusForAct(appointmentId: string | null): Promise<string | null> {
		if (!appointmentId) return null
		const [appt] = await db
			.select({ status: appointments.status })
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		return appt?.status ?? null
	}

	private async assertActVisibleInNotarialBookAsync(
		row: typeof registryActs.$inferSelect
	): Promise<void> {
		if (!row.appointmentId) return
		const status = await this.loadAppointmentStatusForAct(row.appointmentId)
		if (status && status !== "ended") {
			throw new NotFoundException(`Registry act ${row.id} not found`)
		}
	}

	private async loadActRowForEnp(
		enpUserId: string,
		id: string
	): Promise<{
		row: typeof registryActs.$inferSelect
		sessionMode: "remote" | "in_person" | "hybrid" | null
		appointmentPurpose: string | null
	}> {
		const [result] = await db
			.select({
				row: registryActs,
				sessionMode: appointments.sessionMode,
				appointmentPurpose: appointments.description,
			})
			.from(registryActs)
			.leftJoin(appointments, eq(registryActs.appointmentId, appointments.id))
			.where(and(eq(registryActs.id, id), eq(registryActs.enpUserId, enpUserId)))
			.limit(1)
		if (!result) throw new NotFoundException(`Registry act ${id} not found`)
		return {
			row: result.row,
			sessionMode: result.sessionMode ?? null,
			appointmentPurpose: result.appointmentPurpose ?? null,
		}
	}

	private async loadQuicksignProjectForDocument(enpUserId: string, documentFileObjectId: string) {
		const [row] = await db
			.select({
				id: quicksignProjects.id,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
				status: quicksignProjects.status,
				notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
			})
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, enpUserId),
					eq(quicksignProjects.documentFileObjectId, documentFileObjectId)
				)
			)
			.orderBy(desc(quicksignProjects.createdAt))
			.limit(1)
		return row
	}

	private async loadEnpEmail(enpUserId: string): Promise<string | null> {
		const [row] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, enpUserId))
			.limit(1)
		return row?.email?.trim() ?? null
	}
	async refreshActNotarizedDocument(
		enpUserId: string,
		actId: string
	): Promise<{ available: boolean; documentUrl: string | null; documentCode: string | null }> {
		const { row } = await this.loadActRowForEnp(enpUserId, actId)
		const parsed = parseRegistryActDescription(row.description)
		const documentFileObjectId = parsed.documentFileObjectId
		const documentCode = parseDescriptionValue(row.description, QLEGAL_CODE_PREFIX)

		if (!documentFileObjectId) {
			return {
				available: Boolean(row.documentUrl?.trim()),
				documentUrl: row.documentUrl ?? null,
				documentCode,
			}
		}

		const qs = await this.loadQuicksignProjectForDocument(enpUserId, documentFileObjectId)

		if (qs?.notarizedFileObjectId) {
			return { available: true, documentUrl: row.documentUrl ?? null, documentCode }
		}
		if (qs?.id) {
			this.notarizedArchive.scheduleArchiveToS3(qs.id)
		}

		if (row.documentUrl?.trim()) {
			return { available: true, documentUrl: row.documentUrl, documentCode }
		}

		return { available: false, documentUrl: null, documentCode }
	}

	async streamActNotarizedPdf(
		enpUserId: string,
		actId: string,
		res: Response,
		opts?: { download?: boolean }
	): Promise<void> {
		const { row } = await this.loadActRowForEnp(enpUserId, actId)
		await this.assertActVisibleInNotarialBookAsync(row)
		const documentFileObjectId = parseRegistryActDescription(row.description).documentFileObjectId
		if (!documentFileObjectId) {
			throw new BadRequestException(
				"This registry entry has no linked meeting document"
			)
		}

		const qs = await this.loadQuicksignProjectForDocument(enpUserId, documentFileObjectId)
		if (!qs?.id) {
			throw new BadRequestException("Meeting document not found")
		}

		await this.notarizedArchive.streamQuicksignNotarizedPdf(qs.id, res, {
			download: opts?.download === true,
		})
	}

	private async backfillMissingEntryNumbers(
		rows: (typeof registryActs.$inferSelect)[]
	): Promise<void> {
		if (rows.length === 0) return
		const now = new Date()
		for (const row of rows) {
			const entryNumber = formatEnbEntryNumber({
				actNumber: row.actNumber,
				pageNo: row.pageNo,
				executedAt: row.executedAt,
			})
			await db
				.update(registryActs)
				.set({ entryNumber, updatedAt: now })
				.where(eq(registryActs.id, row.id))
			this.scheduleEnbBackup(row.id)
		}
	}

	private registryEnbFields(args: {
		actNumber: string
		pageNo: string
		executedAt: Date
		completionStatus?: "completed" | "incomplete"
		incompleteReason?: string | null
		incompleteCircumstances?: string | null
	}) {
		return {
			entryNumber: formatEnbEntryNumber({
				actNumber: args.actNumber,
				pageNo: args.pageNo,
				executedAt: args.executedAt,
			}),
			completionStatus: args.completionStatus ?? ("completed" as const),
			incompleteReason: args.incompleteReason ?? null,
			incompleteCircumstances: args.incompleteCircumstances ?? null,
		}
	}

	private async nextActNumber(enpUserId: string): Promise<string> {
		const year = new Date().getFullYear()
		const start = new Date(year, 0, 1)
		const end = new Date(year + 1, 0, 1)
		const [r] = await db
			.select({ c: count() })
			.from(registryActs)
			.where(
				and(
					eq(registryActs.enpUserId, enpUserId),
					gte(registryActs.createdAt, start),
					lt(registryActs.createdAt, end)
				)
			)
		const n = (r?.c ?? 0) + 1
		return `ACT-${year}-${String(n).padStart(3, "0")}`
	}

	/** Monthly ENB: book 1 = January … book 12 = December (one book submitted per month). */
	private resolveEnbBookNo(referenceDate: Date): string {
		return String(referenceDate.getMonth() + 1)
	}

	private monthBounds(referenceDate: Date): { start: Date; end: Date } {
		const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1)
		const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 1)
		return { start, end }
	}

	private parsePageNumber(pageNo: string | null | undefined): number {
		const digits = (pageNo ?? "").replace(/\D/g, "")
		const n = Number.parseInt(digits, 10)
		return Number.isFinite(n) && n > 0 ? n : 0
	}

	/** Next page in the ENP's monthly book (chronological 1-based count within calendar month). */
	private async nextEnbPageNo(
		enpUserId: string,
		referenceDate: Date,
		reserveCount = 1
	): Promise<number> {
		const { start, end } = this.monthBounds(referenceDate)
		const rows = await db
			.select({ pageNo: registryActs.pageNo })
			.from(registryActs)
			.where(
				and(
					eq(registryActs.enpUserId, enpUserId),
					gte(registryActs.executedAt, start),
					lt(registryActs.executedAt, end),
					isNotNull(registryActs.pageNo)
				)
			)

		let maxPage = 0
		for (const row of rows) {
			maxPage = Math.max(maxPage, this.parsePageNumber(row.pageNo))
		}
		return maxPage + reserveCount
	}

	private formatEnbPageNo(page: number): string {
		return String(Math.max(1, page))
	}

	/** Assign book/page to legacy rows so compliance ENB and SC export stay consistent. */
	private async backfillMissingEnbBookPages(
		enpUserId: string,
		_referenceDate: Date
	): Promise<void> {
		const rows = await db
			.select({
				id: registryActs.id,
				bookNo: registryActs.bookNo,
				pageNo: registryActs.pageNo,
				executedAt: registryActs.executedAt,
			})
			.from(registryActs)
			.where(eq(registryActs.enpUserId, enpUserId))
			.orderBy(asc(registryActs.executedAt), asc(registryActs.createdAt))

		const runningByMonth = new Map<string, number>()
		let updated = 0

		for (const row of rows) {
			const hasBook = Boolean(row.bookNo?.trim())
			const hasPage = Boolean(row.pageNo?.trim())
			const executedAt = row.executedAt instanceof Date ? row.executedAt : new Date(row.executedAt)
			const monthKey = `${executedAt.getFullYear()}-${executedAt.getMonth()}`
			const bookNo = this.resolveEnbBookNo(executedAt)

			if (hasBook && hasPage) {
				const page = this.parsePageNumber(row.pageNo)
				runningByMonth.set(monthKey, Math.max(runningByMonth.get(monthKey) ?? 0, page))
				continue
			}

			const next = (runningByMonth.get(monthKey) ?? 0) + 1
			runningByMonth.set(monthKey, next)
			const pageNo = this.formatEnbPageNo(next)
			await db
				.update(registryActs)
				.set({ bookNo, pageNo, updatedAt: new Date() })
				.where(eq(registryActs.id, row.id))
			this.scheduleEnbBackup(row.id)
			updated++
		}

		if (updated > 0) {
			this.log.log(
				`Backfilled ENB book/page for ${updated} registry act(s) (ENP ${enpUserId.slice(0, 8)}…)`
			)
		}
	}

	async create(enpUserId: string, data: CreateRegistryAct): Promise<RegistryAct> {
		const govId = await assertGovernmentIdAllowsNotarialActs(enpUserId)
		if (!govId.ok) {
			throw new ForbiddenException(govId.detail)
		}
		const commission = await assertEnpCommissionAllowsNotarialActs(enpUserId)
		if (!commission.ok) {
			throw new ForbiddenException(commission.detail)
		}
		const executedAt = new Date(data.executedAt)
		const now = new Date()
		const actNumber = await this.nextActNumber(enpUserId)
		const bookNo = this.resolveEnbBookNo(executedAt)
		const pageNo = this.formatEnbPageNo(await this.nextEnbPageNo(enpUserId, executedAt))
		const enbFields = this.registryEnbFields({ actNumber, pageNo, executedAt })
		const [row] = await db
			.insert(registryActs)
			.values({
				enpUserId,
				appointmentId: null,
				actNumber,
				actType: data.actType,
				title: data.title,
				parties: data.parties,
				executedAt,
				documentUrl: data.documentUrl ?? null,
				bookNo,
				pageNo,
				feePhp: null,
				description: null,
				scStatus: "draft",
				scSubmittedAt: null,
				scSyncedAt: null,
				scRejectionReason: null,
				scExternalRef: null,
				...enbFields,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to create registry act")
		this.scheduleEnbBackup(row.id)
		const sessionMode = await this.loadSessionModeForAct(row.appointmentId)
		const appointmentPurpose = await this.loadAppointmentPurposeForAct(row.appointmentId)
		return rowToAct(row, sessionMode, appointmentPurpose)
	}

	private async resolveAppointmentId(
		enpUserId: string,
		appointmentId: string | undefined
	): Promise<string | null> {
		if (!appointmentId?.trim()) return null
		const [appt] = await db
			.select({ id: appointments.id, enpUserId: appointments.enpUserId })
			.from(appointments)
			.where(eq(appointments.id, appointmentId.trim()))
			.limit(1)
		if (!appt) return null
		if (appt.enpUserId !== enpUserId) {
			throw new ForbiddenException("Appointment does not belong to this notary")
		}
		return appt.id
	}

	async finalizeSessionDraft(
		enpUserId: string,
		input: FinalizeSessionDraftInput
	): Promise<RegistryAct> {
		const linkedAppointmentId = await this.resolveAppointmentId(enpUserId, input.appointmentId)
		const actType = mapNotarizationLabelToActType(input.draft.notarizationType)
		const parties = parsePartiesLine(input.draft.parties)
		const feeNum = Number.parseInt(input.draft.fee, 10)
		const feePhp = Number.isFinite(feeNum) ? feeNum : null
		const now = new Date()
		const actNumber = await this.nextActNumber(enpUserId)
		const desc = input.draft.description?.trim() || null
		const draftBook = input.draft.bookNo.trim()
		const draftPage = input.draft.pageNo.trim()
		const bookNo = draftBook || this.resolveEnbBookNo(now)
		const pageNo = draftPage || this.formatEnbPageNo(await this.nextEnbPageNo(enpUserId, now))
		const enbFields = this.registryEnbFields({ actNumber, pageNo, executedAt: now })

		const [row] = await db
			.insert(registryActs)
			.values({
				enpUserId,
				appointmentId: linkedAppointmentId,
				actNumber,
				actType,
				title: input.draft.documentTitle,
				parties,
				executedAt: now,
				documentUrl: null,
				bookNo,
				pageNo,
				feePhp,
				description: desc,
				scStatus: "draft",
				scSubmittedAt: null,
				scSyncedAt: null,
				scRejectionReason: null,
				scExternalRef: null,
				...enbFields,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to finalize draft")
		this.scheduleEnbBackup(row.id)
		const sessionMode = await this.loadSessionModeForAct(row.appointmentId)
		const appointmentPurpose = await this.loadAppointmentPurposeForAct(row.appointmentId)
		return rowToAct(row, sessionMode, appointmentPurpose)
	}

	private async loadEnpCredentialsForScSync(enpUserId: string) {
		const [row] = await db
			.select({
				rollNo: enpProfiles.rollNo,
				npnCommissionNo: enpProfiles.npnCommissionNo,
				homeStreet: enpProfiles.homeStreet,
				barangay: enpProfiles.barangay,
				cityProvince: enpProfiles.cityProvince,
				notaryAddress: enpProfiles.notaryAddress,
			})
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		if (!row) return null

		const address = defaultScAddress(
			row.cityProvince ?? row.notaryAddress ?? "Remote Electronic Notarization"
		)
		if (row.homeStreet?.trim()) address.homeStreet = row.homeStreet.trim()
		if (row.barangay?.trim()) address.barangay = row.barangay.trim()
		if (row.cityProvince?.trim()) address.cityProvince = row.cityProvince.trim()

		return {
			npn: row.npnCommissionNo?.trim() ?? "",
			rollNumber: row.rollNo?.trim() ?? "",
			notaryFacilityNumber: env.SUPREME_COURT_NFN?.trim() ?? "",
			address,
		}
	}

	/**
	 * Best-effort SC sync after registry insert (legacy `populateNotarialRegistryOnMeetingEnd`).
	 * Errors are logged only — meeting end / registry populate must not fail.
	 */
	private async tryScSyncRegistryActAfterInsert(args: {
		enpUserId: string
		row: typeof registryActs.$inferSelect
		sessionMode: "remote" | "in_person" | "hybrid" | null
		meetingDocumentType: string | null | undefined
	}): Promise<void> {
		if (!this.scRegistry.isConfigured()) return

		const enpCreds = await this.loadEnpCredentialsForScSync(args.enpUserId)
		if (!enpCreds?.rollNumber || !enpCreds.npn) return

		try {
			const pdf = await this.loadPdfBytesForRegistryAct(args.enpUserId, args.row)
			const submit = await this.scRegistry.submitAct({
				enpUserId: args.enpUserId,
				externalActId: args.row.id,
				actNumber: args.row.actNumber,
				actType: scActTypeForRegistryRow(args.row.actType, args.meetingDocumentType),
				title: args.row.title,
				parties: args.row.parties as { name: string; role: string }[],
				executedAtIso: executedAtToIso(args.row.executedAt),
				bookNo: args.row.bookNo,
				pageNo: args.row.pageNo,
				description: args.row.description,
				enp: enpCreds,
				sessionMode: args.sessionMode,
				pdf,
			})

			const now = new Date()
			if (!submit.ok) {
				await db
					.update(registryActs)
					.set({
						scStatus: "sync_failed",
						scRejectionReason: submit.error ?? "Supreme Court sync rejected submission",
						updatedAt: now,
					})
					.where(eq(registryActs.id, args.row.id))
				this.scheduleEnbBackup(args.row.id)
				return
			}

			await db
				.update(registryActs)
				.set({
					scStatus: submit.stub ? "pending_review" : "synced",
					scSubmittedAt: now,
					scSyncedAt: submit.stub ? null : now,
					scExternalRef: submit.externalReference ?? submit.nrid ?? null,
					scRejectionReason: submit.stub
						? "Stub sync — configure SUPREME_COURT_* env vars for live SC API"
						: null,
					updatedAt: now,
				})
				.where(eq(registryActs.id, args.row.id))
			this.scheduleEnbBackup(args.row.id)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`SC auto-sync after registry insert ${args.row.id}: ${msg.slice(0, 240)}`)
		}
	}

	private async loadSessionModeForAct(
		appointmentId: string | null | undefined
	): Promise<"remote" | "in_person" | "hybrid" | null> {
		if (!appointmentId?.trim()) return null
		const [appt] = await db
			.select({ sessionMode: appointments.sessionMode })
			.from(appointments)
			.where(eq(appointments.id, appointmentId.trim()))
			.limit(1)
		return appt?.sessionMode ?? null
	}

	private async loadAppointmentPurposeForAct(
		appointmentId: string | null | undefined
	): Promise<string | null> {
		if (!appointmentId?.trim()) return null
		const [appt] = await db
			.select({ description: appointments.description })
			.from(appointments)
			.where(eq(appointments.id, appointmentId.trim()))
			.limit(1)
		return appt?.description?.trim() || null
	}

	private async loadMeetingDocumentTypeForAct(
		appointmentId: string | null | undefined,
		description: string | null
	): Promise<string | null> {
		const { documentFileObjectId } = parseRegistryActDescription(description)
		if (!appointmentId?.trim() || !documentFileObjectId) return null
		const [link] = await db
			.select({ documentType: appointmentDocuments.documentType })
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, appointmentId.trim()),
					eq(appointmentDocuments.fileObjectId, documentFileObjectId)
				)
			)
			.limit(1)
		return link?.documentType ?? null
	}

	private async loadPdfBytesForRegistryAct(
		enpUserId: string,
		row: typeof registryActs.$inferSelect,
		_opts?: { forScSync?: boolean }
	): Promise<{ bytes: Buffer; fileName: string } | null> {
		const { documentFileObjectId } = parseRegistryActDescription(row.description)
		const title = row.title.trim() || "notarized_document.pdf"
		const fileName = title.toLowerCase().endsWith(".pdf") ? title : `${title}.pdf`

		if (!documentFileObjectId) return null

		try {
			const qs = await this.loadQuicksignProjectForDocument(enpUserId, documentFileObjectId)
			if (!qs?.notarizedFileObjectId) return null
			const buf = await this.files.readStoredFileBuffer(qs.notarizedFileObjectId)
			if (!buf?.length) return null
			return { bytes: buf, fileName }
		} catch {
			return null
		}
	}

	private formatMonthlyBookLabel(bookYearKey: string): string {
		const [yearStr, monthStr] = bookYearKey.split("-")
		const year = Number.parseInt(yearStr ?? "", 10)
		const month = Number.parseInt(monthStr ?? "", 10)
		if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
			return bookYearKey
		}
		const monthName = new Date(year, month - 1, 1).toLocaleString("en-US", { month: "long" })
		return `Book ${month} — ${monthName} ${year}`
	}

	private bookYearKeyFromExecutedAt(executedAt: string): string | null {
		const executed = new Date(executedAt)
		if (Number.isNaN(executed.getTime())) return null
		return `${executed.getFullYear()}-${String(executed.getMonth() + 1).padStart(2, "0")}`
	}

	/**
	 * Placeholder for monthly notarial book submission to SCP or ENA.
	 * Validates the book has entries and returns a structured response until integration ships.
	 */
	async submitMonthlyNotarialBook(
		enpUserId: string,
		input: SubmitMonthlyNotarialBook
	): Promise<SubmitMonthlyNotarialBookResult> {
		const acts = await this.findAllForEnp(enpUserId)
		const monthActs = acts.filter(
			a => this.bookYearKeyFromExecutedAt(a.executedAt) === input.bookYearKey
		)

		if (monthActs.length === 0) {
			throw new BadRequestException(
				`No notarial entries found for ${this.formatMonthlyBookLabel(input.bookYearKey)}.`
			)
		}

		const pendingSyncCount = monthActs.filter(
			a => a.scStatus !== "synced" && a.scStatus !== "approved"
		).length

		const bookLabel = this.formatMonthlyBookLabel(input.bookYearKey)
		const destinationLabel =
			input.destination === "scp" ? "Supreme Court Portal (SCP)" : "Electronic Notary Archive (ENA)"

		this.log.log(
			`Monthly notarial book submit placeholder: enp=${enpUserId} book=${input.bookYearKey} destination=${input.destination} entries=${monthActs.length}`
		)

		return {
			status: "placeholder",
			message: `Monthly book submission to ${destinationLabel} is not yet connected. ${monthActs.length} ${monthActs.length === 1 ? "entry" : "entries"} in ${bookLabel} would be submitted when integration is enabled.`,
			bookLabel,
			entryCount: monthActs.length,
			pendingSyncCount,
			destination: input.destination,
			submittedAt: new Date().toISOString(),
		}
	}

	async bulkScSync(enpUserId: string, actIds: string[]): Promise<BulkScSyncResult> {
		if (actIds.length === 0) {
			return { submitted: 0, failed: 0, results: [] }
		}

		try {
			return await this.bulkScSyncInner(enpUserId, actIds)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`SC bulk sync failed: ${msg.slice(0, 240)}`)
			return {
				submitted: 0,
				failed: actIds.length,
				results: actIds.map(actId => ({
					actId,
					success: false as const,
					error: msg.slice(0, 500),
				})),
			}
		}
	}

	private async bulkScSyncInner(enpUserId: string, actIds: string[]): Promise<BulkScSyncResult> {
		const enpCreds = await this.loadEnpCredentialsForScSync(enpUserId)
		if (!enpCreds?.rollNumber || !enpCreds.npn) {
			return {
				submitted: 0,
				failed: actIds.length,
				results: actIds.map(actId => ({
					actId,
					success: false,
					error:
						"Complete your ENP profile (roll number and commission number) before Supreme Court sync.",
				})),
			}
		}

		const rows = await db
			.select()
			.from(registryActs)
			.where(and(eq(registryActs.enpUserId, enpUserId), inArray(registryActs.id, actIds)))

		const byId = new Map(rows.map(r => [r.id, r]))
		const now = new Date()

		const results = await Promise.all(
			actIds.map(async actId => {
				try {
					const row = byId.get(actId)
					if (!row) return { actId, success: false, error: `Act ${actId} not found` } as const

					if (
						row.scStatus === "synced" ||
						row.scStatus === "approved" ||
						hasLiveScExternalRef(row.scExternalRef)
					) {
						return { actId, success: true, error: null } as const
					}

					const pdf = await this.loadPdfBytesForRegistryAct(enpUserId, row, { forScSync: true })
					const sessionMode = await this.loadSessionModeForAct(row.appointmentId)
					const meetingDocumentType = await this.loadMeetingDocumentTypeForAct(
						row.appointmentId,
						row.description
					)

					const submit = await this.scRegistry.submitAct({
						enpUserId,
						externalActId: row.id,
						actNumber: row.actNumber,
						actType: scActTypeForRegistryRow(row.actType, meetingDocumentType),
						title: row.title,
						parties: row.parties as { name: string; role: string }[],
						executedAtIso: executedAtToIso(row.executedAt),
						bookNo: row.bookNo,
						pageNo: row.pageNo,
						description: row.description,
						enp: enpCreds,
						sessionMode,
						pdf,
					})

					if (!submit.ok) {
						await db
							.update(registryActs)
							.set({
								scStatus: "sync_failed",
								scRejectionReason: submit.error ?? "Supreme Court sync rejected submission",
								updatedAt: now,
							})
							.where(eq(registryActs.id, actId))
						this.scheduleEnbBackup(actId)
						return { actId, success: false, error: submit.error ?? "SC sync failed" } as const
					}

					await db
						.update(registryActs)
						.set({
							scStatus: submit.stub ? "pending_review" : "synced",
							scSubmittedAt: now,
							scSyncedAt: submit.stub ? null : now,
							scExternalRef: submit.externalReference ?? submit.nrid ?? null,
							scRejectionReason: submit.stub
								? "Stub sync — configure SUPREME_COURT_* env vars for live SC API"
								: null,
							updatedAt: now,
						})
						.where(eq(registryActs.id, actId))
					this.scheduleEnbBackup(actId)

					return { actId, success: true, error: null } as const
				} catch (e) {
					const msg = e instanceof Error ? e.message : String(e)
					this.log.warn(`SC bulk sync act ${actId}: ${msg.slice(0, 240)}`)
					try {
						await db
							.update(registryActs)
							.set({
								scStatus: "sync_failed",
								scRejectionReason: msg.slice(0, 500),
								updatedAt: now,
							})
							.where(eq(registryActs.id, actId))
						this.scheduleEnbBackup(actId)
					} catch {
						/* ignore secondary DB failure */
					}
					return { actId, success: false, error: msg.slice(0, 500) } as const
				}
			})
		)

		const normalized = actIds.map(actId => {
			const r = results.find(x => x.actId === actId)
			if (!r) {
				return { actId, success: false as const, error: "SC sync failed" }
			}
			if (r.success) {
				return { actId, success: true as const, error: null }
			}
			const err = typeof r.error === "string" && r.error.trim() ? r.error : "SC sync failed"
			return { actId, success: false as const, error: err }
		})

		return {
			submitted: normalized.filter(r => r.success).length,
			failed: normalized.filter(r => !r.success).length,
			results: normalized,
		}
	}

	async recordIncompleteAct(enpUserId: string, input: RecordIncompleteAct): Promise<RegistryAct> {
		const govId = await assertGovernmentIdAllowsNotarialActs(enpUserId)
		if (!govId.ok) throw new ForbiddenException(govId.detail)
		const commission = await assertEnpCommissionAllowsNotarialActs(enpUserId)
		if (!commission.ok) throw new ForbiddenException(commission.detail)

		const executedAt = input.executedAt ? new Date(input.executedAt) : new Date()
		if (Number.isNaN(executedAt.getTime())) {
			throw new BadRequestException("Invalid executedAt")
		}

		const linkedAppointmentId = await this.resolveAppointmentId(enpUserId, input.appointmentId)
		const actNumber = await this.nextActNumber(enpUserId)
		const bookNo = this.resolveEnbBookNo(executedAt)
		const pageNo = this.formatEnbPageNo(await this.nextEnbPageNo(enpUserId, executedAt))
		const now = new Date()
		const enbFields = this.registryEnbFields({
			actNumber,
			pageNo,
			executedAt,
			completionStatus: "incomplete",
			incompleteReason: input.incompleteReason.trim(),
			incompleteCircumstances: input.incompleteCircumstances.trim(),
		})

		const [row] = await db
			.insert(registryActs)
			.values({
				enpUserId,
				appointmentId: linkedAppointmentId,
				actNumber,
				actType: input.actType,
				title: input.title.trim(),
				parties: input.parties,
				executedAt,
				documentUrl: null,
				bookNo,
				pageNo,
				feePhp: null,
				description: null,
				scStatus: "draft",
				scSubmittedAt: null,
				scSyncedAt: null,
				scRejectionReason: null,
				scExternalRef: null,
				...enbFields,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to record incomplete act")
		this.scheduleEnbBackup(row.id)
		const sessionMode = await this.loadSessionModeForAct(row.appointmentId)
		const appointmentPurpose = await this.loadAppointmentPurposeForAct(row.appointmentId)
		return rowToAct(row, sessionMode, appointmentPurpose)
	}

	private async findRegistryActForAppointmentDocument(
		appointmentId: string,
		documentFileId: string
	): Promise<typeof registryActs.$inferSelect | null> {
		const actRows = await db
			.select()
			.from(registryActs)
			.where(eq(registryActs.appointmentId, appointmentId))

		if (actRows.length === 0) return null

		const byParsedFileId = actRows.find(
			row => parseRegistryActDescription(row.description).documentFileObjectId === documentFileId
		)
		if (byParsedFileId) return byParsedFileId

		if (actRows.length === 1) return actRows[0] ?? null

		const byDescriptionContains = actRows.find(row => row.description?.includes(documentFileId))
		return byDescriptionContains ?? null
	}

	async listEnbAccessRequests(enpUserId: string): Promise<EnbAccessRequest[]> {
		await this.repairMislinkedEnbAccessRequestEnpIds(enpUserId)

		const rows = await db
			.select({
				request: enbAccessRequests,
				act: registryActs,
				paymentStatus: paymentIntents.status,
			})
			.from(enbAccessRequests)
			.leftJoin(registryActs, eq(enbAccessRequests.registryActId, registryActs.id))
			.leftJoin(appointments, eq(enbAccessRequests.appointmentId, appointments.id))
			.leftJoin(paymentIntents, eq(enbAccessRequests.paymentIntentId, paymentIntents.id))
			.where(
				or(
					eq(enbAccessRequests.enpUserId, enpUserId),
					eq(registryActs.enpUserId, enpUserId),
					eq(appointments.enpUserId, enpUserId)
				)
			)
			.orderBy(desc(enbAccessRequests.requestedAt))

		return rows.map(({ request, act, paymentStatus }) =>
			this.mapEnbAccessRequestRow(
				request,
				act?.title ?? null,
				act ? entryNumberForRow(act) : null,
				paymentStatus ?? null
			)
		)
	}

	/** Principal CTC rows used appointment.enpUserId; list by registry act owner. */
	private async repairMislinkedEnbAccessRequestEnpIds(enpUserId: string): Promise<void> {
		const rows = await db
			.select({
				id: enbAccessRequests.id,
				requestEnpUserId: enbAccessRequests.enpUserId,
				actEnpUserId: registryActs.enpUserId,
			})
			.from(enbAccessRequests)
			.innerJoin(registryActs, eq(enbAccessRequests.registryActId, registryActs.id))
			.where(eq(registryActs.enpUserId, enpUserId))

		const now = new Date()
		for (const row of rows) {
			if (row.requestEnpUserId === row.actEnpUserId) continue
			await db
				.update(enbAccessRequests)
				.set({ enpUserId: row.actEnpUserId, updatedAt: now })
				.where(eq(enbAccessRequests.id, row.id))
		}
	}

	private async assertEnbAccessRequestOwnedByEnp(
		enpUserId: string,
		request: typeof enbAccessRequests.$inferSelect
	): Promise<void> {
		if (request.registryActId) {
			await this.loadActRowForEnp(enpUserId, request.registryActId)
			return
		}
		if (request.enpUserId !== enpUserId) {
			throw new NotFoundException("ENB access request not found")
		}
	}

	async createEnbAccessRequest(
		enpUserId: string,
		input: CreateEnbAccessRequest
	): Promise<EnbAccessRequest> {
		if (!input.registryActId?.trim() && !input.bookNo?.trim()) {
			throw new BadRequestException("Provide registryActId or bookNo for the ENB entry scope")
		}

		if (input.registryActId?.trim()) {
			await this.loadActRowForEnp(enpUserId, input.registryActId.trim())
		}

		await this.assertFileObjectsExist([
			input.requesterSignatureFileObjectId,
			input.identityEvidenceFileObjectId,
		])

		const now = new Date()
		const [row] = await db
			.insert(enbAccessRequests)
			.values({
				enpUserId,
				registryActId: input.registryActId?.trim() || null,
				bookNo: input.bookNo?.trim() || null,
				certifiedTrueCopy: false,
				requesterUserId: null,
				appointmentId: null,
				documentFileObjectId: null,
				requestType: input.requestType,
				requesterName: input.requesterName.trim(),
				requesterAddress: input.requesterAddress.trim(),
				lawfulPurpose: input.lawfulPurpose.trim(),
				requesterSignatureImageData: null,
				requesterSignatureFileObjectId: input.requesterSignatureFileObjectId?.trim() || null,
				identityEvidenceFileObjectId: input.identityEvidenceFileObjectId?.trim() || null,
				outcome: "pending",
				refusalReason: null,
				requestedAt: now,
				decidedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to create ENB access request")

		let actTitle: string | null = null
		let entryNumber: string | null = null
		if (row.registryActId) {
			const act = await this.loadActRowForEnp(enpUserId, row.registryActId)
			actTitle = act.row.title
			entryNumber = entryNumberForRow(act.row)
		}
		return this.mapEnbAccessRequestRow(row, actTitle, entryNumber)
	}

	async createPrincipalCertifiedTrueCopyRequest(
		clientUserId: string,
		input: RequestCertifiedTrueCopy
	): Promise<EnbAccessRequest> {
		const [apt] = await db
			.select({
				id: appointments.id,
				enpUserId: appointments.enpUserId,
				clientUserId: appointments.clientUserId,
				status: appointments.status,
			})
			.from(appointments)
			.where(
				and(eq(appointments.id, input.appointmentId), eq(appointments.clientUserId, clientUserId))
			)
			.limit(1)
		if (!apt) {
			throw new NotFoundException(
				"Appointment not found or you are not the client for this session"
			)
		}
		if (apt.status !== "ended") {
			throw new BadRequestException(
				"Certified true copy requests are available after the notarization session has ended"
			)
		}

		const [docLink] = await db
			.select({ fileObjectId: appointmentDocuments.fileObjectId })
			.from(appointmentDocuments)
			.where(
				and(
					eq(appointmentDocuments.appointmentId, input.appointmentId),
					eq(appointmentDocuments.fileObjectId, input.documentFileId)
				)
			)
			.limit(1)
		if (!docLink) {
			throw new NotFoundException("Document not found for this appointment")
		}

		const act = await this.findRegistryActForAppointmentDocument(
			input.appointmentId,
			input.documentFileId
		)
		if (!act) {
			throw new BadRequestException(
				"The notarial registry entry is not available yet. Contact your notary if this persists."
			)
		}

		const [pending] = await db
			.select({ id: enbAccessRequests.id })
			.from(enbAccessRequests)
			.where(
				and(
					eq(enbAccessRequests.requesterUserId, clientUserId),
					eq(enbAccessRequests.registryActId, act.id),
					eq(enbAccessRequests.certifiedTrueCopy, true),
					eq(enbAccessRequests.outcome, "pending")
				)
			)
			.limit(1)
		if (pending) {
			throw new BadRequestException(
				"You already have a pending certified true copy request for this document"
			)
		}

		const [client] = await db
			.select({
				firstName: clientProfiles.firstName,
				lastName: clientProfiles.lastName,
				identityStatus: clientProfiles.identityStatus,
			})
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, clientUserId))
			.limit(1)
		if (!client) {
			throw new ForbiddenException("Client profile required to request a certified true copy")
		}
		if (client.identityStatus !== "verified") {
			throw new BadRequestException(
				"Complete identity verification on your Profile before requesting a certified true copy"
			)
		}

		const requesterName = `${client.firstName} ${client.lastName}`.trim() || "Principal"
		const now = new Date()
		const [row] = await db
			.insert(enbAccessRequests)
			.values({
				enpUserId: act.enpUserId,
				registryActId: act.id,
				bookNo: act.bookNo,
				appointmentId: apt.id,
				documentFileObjectId: input.documentFileId,
				requesterUserId: clientUserId,
				certifiedTrueCopy: true,
				requestType: "copy",
				requesterName,
				requesterAddress: input.requesterAddress.trim(),
				lawfulPurpose: input.lawfulPurpose.trim(),
				requesterPaymentMethod: input.paymentMethod,
				requesterSignatureImageData: null,
				requesterSignatureFileObjectId: null,
				identityEvidenceFileObjectId: null,
				outcome: "pending",
				refusalReason: null,
				requestedAt: now,
				decidedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to create certified true copy request")

		return this.mapEnbAccessRequestRow(row, act.title, entryNumberForRow(act))
	}

	async lookupEnbEntryForVirtualAccess(
		input: LookupEnbEntryForAccess
	): Promise<EnbEntryLookupResult> {
		const enpUserId = input.enpUserId.trim()
		const bookNo = input.bookNo.trim()
		const entryNumber = input.entryNumber?.trim()

		if (!(await this.userHasEnpProfile(enpUserId))) {
			throw new NotFoundException("Notary not found")
		}

		const enpName = await this.loadEnpDisplayName(enpUserId)

		if (entryNumber) {
			const [act] = await db
				.select()
				.from(registryActs)
				.where(
					and(
						eq(registryActs.enpUserId, enpUserId),
						eq(registryActs.bookNo, bookNo),
						or(eq(registryActs.entryNumber, entryNumber), eq(registryActs.actNumber, entryNumber))
					)
				)
				.limit(1)
			if (!act) {
				throw new NotFoundException(
					"No registry entry matches that book and entry number for this notary"
				)
			}

			return {
				registryActId: act.id,
				entryNumber: entryNumberForRow(act),
				bookNo: act.bookNo ?? bookNo,
				pageNo: act.pageNo,
				title: act.title,
				enpName,
				actType: act.actType,
				executedAt: act.executedAt?.toISOString() ?? null,
			}
		}

		const [bookRow] = await db
			.select({ id: registryActs.id })
			.from(registryActs)
			.where(and(eq(registryActs.enpUserId, enpUserId), eq(registryActs.bookNo, bookNo)))
			.limit(1)
		if (!bookRow) {
			throw new NotFoundException("No entries found for that book and notary")
		}

		return {
			registryActId: null,
			entryNumber: null,
			bookNo,
			pageNo: null,
			title: null,
			enpName,
			actType: null,
			executedAt: null,
		}
	}

	async createVirtualEnbAccessRequest(
		requesterUserId: string,
		input: SubmitVirtualEnbAccessRequest
	): Promise<EnbAccessRequest> {
		await this.assertRequesterIdentityForVirtualEnbAccess(requesterUserId)

		const enpUserId = input.enpUserId.trim()
		if (!(await this.userHasEnpProfile(enpUserId))) {
			throw new NotFoundException("Notary not found")
		}
		if (requesterUserId === enpUserId) {
			throw new BadRequestException(
				"You cannot submit a virtual ENB access request to your own notarial book"
			)
		}

		let registryActId = input.registryActId?.trim() || null
		let bookNo = input.bookNo?.trim() || null
		let actTitle: string | null = null
		let entryNumber: string | null = null

		if (registryActId) {
			const act = await this.loadActRowForEnp(enpUserId, registryActId)
			bookNo = act.row.bookNo ?? bookNo
			actTitle = act.row.title
			entryNumber = entryNumberForRow(act.row)
		} else if (bookNo) {
			const lookup = await this.lookupEnbEntryForVirtualAccess({
				enpUserId,
				bookNo,
				entryNumber: input.entryNumber?.trim() || undefined,
			})
			registryActId = lookup.registryActId
			bookNo = lookup.bookNo
			actTitle = lookup.title
			entryNumber = lookup.entryNumber
		} else {
			throw new BadRequestException("Provide a registry entry or book number for this request")
		}

		const pendingConditions = [
			eq(enbAccessRequests.requesterUserId, requesterUserId),
			eq(enbAccessRequests.enpUserId, enpUserId),
			eq(enbAccessRequests.requestType, input.requestType),
			eq(enbAccessRequests.certifiedTrueCopy, false),
			eq(enbAccessRequests.outcome, "pending"),
		]
		if (registryActId) {
			pendingConditions.push(eq(enbAccessRequests.registryActId, registryActId))
		} else if (bookNo) {
			pendingConditions.push(
				eq(enbAccessRequests.bookNo, bookNo),
				isNull(enbAccessRequests.registryActId)
			)
		}

		const [pending] = await db
			.select({ id: enbAccessRequests.id })
			.from(enbAccessRequests)
			.where(and(...pendingConditions))
			.limit(1)
		if (pending) {
			throw new BadRequestException("You already have a pending request for this ENB scope")
		}

		const now = new Date()
		const [row] = await db
			.insert(enbAccessRequests)
			.values({
				enpUserId,
				registryActId,
				bookNo,
				certifiedTrueCopy: false,
				requesterUserId,
				appointmentId: null,
				documentFileObjectId: null,
				requestType: input.requestType,
				requesterName: input.requesterName.trim(),
				requesterAddress: input.requesterAddress.trim(),
				lawfulPurpose: input.lawfulPurpose.trim(),
				requesterSignatureImageData: input.signatureImageData,
				requesterSignatureFileObjectId: null,
				identityEvidenceFileObjectId: null,
				outcome: "pending",
				refusalReason: null,
				requestedAt: now,
				decidedAt: null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to create ENB access request")

		return this.mapEnbAccessRequestRow(row, actTitle, entryNumber)
	}

	async listEnbAccessRequestsForRequester(requesterUserId: string): Promise<EnbAccessRequest[]> {
		const rows = await db
			.select({
				request: enbAccessRequests,
				act: registryActs,
			})
			.from(enbAccessRequests)
			.leftJoin(registryActs, eq(enbAccessRequests.registryActId, registryActs.id))
			.where(eq(enbAccessRequests.requesterUserId, requesterUserId))
			.orderBy(desc(enbAccessRequests.requestedAt))

		return rows.map(({ request, act }) =>
			this.mapEnbAccessRequestRow(request, act?.title ?? null, act ? entryNumberForRow(act) : null)
		)
	}

	async decideEnbAccessRequest(
		enpUserId: string,
		input: DecideEnbAccessRequest
	): Promise<EnbAccessRequest> {
		const [existing] = await db
			.select()
			.from(enbAccessRequests)
			.where(eq(enbAccessRequests.id, input.id))
			.limit(1)
		if (!existing) throw new NotFoundException("ENB access request not found")
		await this.assertEnbAccessRequestOwnedByEnp(enpUserId, existing)
		if (existing.registryActId && existing.enpUserId !== enpUserId) {
			const { row: act } = await this.loadActRowForEnp(enpUserId, existing.registryActId)
			await db
				.update(enbAccessRequests)
				.set({ enpUserId: act.enpUserId, updatedAt: new Date() })
				.where(eq(enbAccessRequests.id, existing.id))
		}
		if (existing.outcome !== "pending") {
			throw new BadRequestException("This request has already been decided")
		}
		if (input.outcome === "refused" && !input.refusalReason?.trim()) {
			throw new BadRequestException("Refusal reason is required when denying a request")
		}

		if (existing.certifiedTrueCopy && input.outcome === "granted") {
			if (!input.ctcCompliance) {
				throw new BadRequestException(
					"Complete the certified true copy compliance form before granting this request"
				)
			}
			if (!input.enpSignatureImageData?.trim()) {
				throw new BadRequestException(
					"Electronic Notary Public signature is required before granting a certified true copy"
				)
			}
			if (
				input.ctcCompliance.lawEnforcementCourtOrderAttached &&
				!input.ctcCompliance.lawEnforcementNotes?.trim()
			) {
				throw new BadRequestException(
					"Describe the attached court order when the requesting party is law enforcement"
				)
			}
		}

		const now = new Date()
		const [row] = await db
			.update(enbAccessRequests)
			.set({
				outcome: input.outcome,
				refusalReason: input.outcome === "refused" ? (input.refusalReason?.trim() ?? null) : null,
				enpSignatureImageData:
					existing.certifiedTrueCopy && input.outcome === "granted"
						? (input.enpSignatureImageData?.trim() ?? null)
						: existing.enpSignatureImageData,
				ctcComplianceForm:
					existing.certifiedTrueCopy && input.outcome === "granted"
						? {
								requestingPartyIdentityCheck:
									input.ctcCompliance!.requestingPartyIdentityCheck.trim(),
								notarialActDate: input.ctcCompliance!.notarialActDate.trim(),
								documentType: input.ctcCompliance!.documentType.trim(),
								principalNames: input.ctcCompliance!.principalNames.trim(),
								witnessNames: input.ctcCompliance!.witnessNames?.trim() || null,
								purposeOfRequest: input.ctcCompliance!.purposeOfRequest.trim(),
								entryRequested: input.ctcCompliance!.entryRequested.trim(),
								lawEnforcementCourtOrderAttached:
									input.ctcCompliance!.lawEnforcementCourtOrderAttached,
								lawEnforcementNotes:
									input.ctcCompliance!.lawEnforcementNotes?.trim() || null,
								paymentMethod: input.ctcCompliance!.paymentMethod,
							}
						: existing.ctcComplianceForm,
				decidedAt: now,
				updatedAt: now,
			})
			.where(eq(enbAccessRequests.id, input.id))
			.returning()
		if (!row) throw new NotFoundException("ENB access request not found")

		let actTitle: string | null = null
		let entryNumber: string | null = null
		if (row.registryActId) {
			const act = await this.loadActRowForEnp(enpUserId, row.registryActId)
			actTitle = act.row.title
			entryNumber = entryNumberForRow(act.row)
		}
		return this.mapEnbAccessRequestRow(row, actTitle, entryNumber)
	}

	async getProtestProceedings(
		enpUserId: string,
		registryActId: string
	): Promise<ProtestProceedings | null> {
		const act = await this.loadActRowForEnp(enpUserId, registryActId)
		if (act.row.actType !== "protest") {
			throw new BadRequestException("Protest proceedings apply only to protest act types")
		}
		const [row] = await db
			.select()
			.from(registryProtestProceedings)
			.where(eq(registryProtestProceedings.registryActId, registryActId))
			.limit(1)
		if (!row) return null
		return this.mapProtestProceedingsRow(row)
	}

	async upsertProtestProceedings(
		enpUserId: string,
		input: UpsertProtestProceedings
	): Promise<ProtestProceedings> {
		const act = await this.loadActRowForEnp(enpUserId, input.registryActId)
		if (act.row.actType !== "protest") {
			throw new BadRequestException("Protest proceedings apply only to protest act types")
		}

		const now = new Date()
		const values = {
			demandBy: input.demandBy?.trim() || null,
			demandWhen: input.demandWhen?.trim() || null,
			demandWhere: input.demandWhere?.trim() || null,
			sumDemanded: input.sumDemanded?.trim() || null,
			presented: input.presented ?? null,
			presentationNotes: input.presentationNotes?.trim() || null,
			notices: input.notices ?? [],
			otherFacts: input.otherFacts?.trim() || null,
			updatedAt: now,
		}

		const [row] = await db
			.insert(registryProtestProceedings)
			.values({
				registryActId: input.registryActId,
				...values,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: registryProtestProceedings.registryActId,
				set: values,
			})
			.returning()
		if (!row) throw new NotFoundException("Failed to save protest proceedings")
		return this.mapProtestProceedingsRow(row)
	}

	private mapProtestProceedingsRow(
		row: typeof registryProtestProceedings.$inferSelect
	): ProtestProceedings {
		return {
			registryActId: row.registryActId,
			demandBy: row.demandBy,
			demandWhen: row.demandWhen,
			demandWhere: row.demandWhere,
			sumDemanded: row.sumDemanded,
			presented: row.presented,
			presentationNotes: row.presentationNotes,
			notices: row.notices ?? [],
			otherFacts: row.otherFacts,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}

	private mapEnbAccessRequestRow(
		row: typeof enbAccessRequests.$inferSelect,
		registryActTitle: string | null,
		entryNumber: string | null,
		ctcPaymentStatus: typeof paymentIntents.$inferSelect["status"] | null = null
	): EnbAccessRequest {
		return {
			id: row.id,
			enpUserId: row.enpUserId,
			registryActId: row.registryActId,
			bookNo: row.bookNo,
			requestType: row.requestType,
			certifiedTrueCopy: row.certifiedTrueCopy,
			requesterUserId: row.requesterUserId,
			appointmentId: row.appointmentId,
			documentFileObjectId: row.documentFileObjectId,
			requesterName: row.requesterName,
			requesterAddress: row.requesterAddress,
			lawfulPurpose: row.lawfulPurpose,
			requesterSignatureImageData: row.requesterSignatureImageData ?? null,
			requesterSignatureFileObjectId: row.requesterSignatureFileObjectId,
			identityEvidenceFileObjectId: row.identityEvidenceFileObjectId,
			requesterPaymentMethod: row.requesterPaymentMethod ?? null,
			paymentIntentId: row.paymentIntentId ?? null,
			ctcPaymentStatus,
			outcome: row.outcome,
			refusalReason: row.refusalReason,
			enpSignatureImageData: row.enpSignatureImageData ?? null,
			ctcComplianceForm: row.ctcComplianceForm
				? {
						...row.ctcComplianceForm,
						witnessNames: row.ctcComplianceForm.witnessNames ?? undefined,
						lawEnforcementNotes: row.ctcComplianceForm.lawEnforcementNotes ?? undefined,
					}
				: null,
			requestedAt: row.requestedAt.toISOString(),
			decidedAt: row.decidedAt?.toISOString() ?? null,
			registryActTitle,
			entryNumber,
			createdAt: row.createdAt,
			updatedAt: row.updatedAt,
		}
	}

	private async assertFileObjectsExist(fileObjectIds: (string | undefined)[]): Promise<void> {
		for (const id of fileObjectIds) {
			const trimmed = id?.trim()
			if (!trimmed) continue
			const [file] = await db
				.select({ id: fileObjects.id })
				.from(fileObjects)
				.where(eq(fileObjects.id, trimmed))
				.limit(1)
			if (!file) throw new BadRequestException(`File ${trimmed} not found`)
		}
	}

	private async loadEnpDisplayName(enpUserId: string): Promise<string> {
		const [prof] = await db
			.select({
				prefix: enpProfiles.prefix,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				suffix: enpProfiles.suffix,
			})
			.from(enpProfiles)
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		return prof ? formatEnpPartyName(prof) : "Notary"
	}

	private async assertRequesterIdentityForVirtualEnbAccess(requesterUserId: string): Promise<void> {
		const [client] = await db
			.select({ identityStatus: clientProfiles.identityStatus })
			.from(clientProfiles)
			.where(eq(clientProfiles.userId, requesterUserId))
			.limit(1)
		if (!client) return
		if (client.identityStatus !== "verified") {
			throw new BadRequestException(
				"Complete identity verification on your Profile before submitting a virtual ENB access request"
			)
		}
	}
}

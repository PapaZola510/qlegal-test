import { createHash } from "node:crypto"
import { Inject, Injectable, Logger } from "@nestjs/common"
import { and, eq, inArray } from "drizzle-orm"

import {
	enpProfiles,
	meetingSignatureRequests,
	quicksignProjects,
	quicksignSigners,
	registryActs,
	users,
} from "@repo/db/schema"

import { FilesService } from "@/modules/v1/files/files.service"
import { LocalStorageService } from "@/services/storage/local-storage.service"
import { NotarizedPdfArchiveService } from "@/services/notarized-pdf/notarized-pdf-archive.service"
import { db } from "@/common/database/database.client"

import { EMAIL_ADAPTER, type EmailAdapter } from "./email-adapter"
import { buildNotarizedPdfDeliveryEmail } from "./notarized-pdf-delivery-email"

/** Background retry schedule (~5 min total); avoids blocking HTTP handlers or sync polls. */
const DELIVERY_RETRY_DELAYS_MS = [
	0, 2_000, 4_000, 8_000, 12_000, 20_000, 30_000, 45_000, 60_000, 90_000, 120_000,
]

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function formatEnpName(row: {
	prefix: string | null
	firstName: string
	lastName: string
	suffix: string | null
}): string {
	const parts = [row.prefix, row.firstName, row.lastName, row.suffix].filter(Boolean)
	return parts.join(" ").trim() || "Electronic Notary Public"
}

@Injectable()
export class NotarizedPdfDeliveryService {
	private readonly log = new Logger(NotarizedPdfDeliveryService.name)
	/** One background job per project until success or schedule exhausted. */
	private readonly activeJobs = new Set<string>()

	constructor(
		@Inject(EMAIL_ADAPTER) private readonly email: EmailAdapter,
		private readonly files: FilesService,
		private readonly localStorage: LocalStorageService,
		private readonly notarizedArchive: NotarizedPdfArchiveService
	) {}

	/** Fire-and-forget with idempotent background retries (safe to call from meeting polls). */
	scheduleDeliveryForQuicksignProject(projectId: string): void {
		if (this.activeJobs.has(projectId)) return
		void this.runDeliveryJob(projectId).catch(e => {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`Notarized PDF delivery job failed project=${projectId}: ${msg.slice(0, 280)}`)
		})
	}

	private async runDeliveryJob(projectId: string): Promise<void> {
		if (this.activeJobs.has(projectId)) return
		this.activeJobs.add(projectId)
		try {
			for (let attempt = 0; attempt < DELIVERY_RETRY_DELAYS_MS.length; attempt += 1) {
				const delay = DELIVERY_RETRY_DELAYS_MS[attempt] ?? 0
				if (delay > 0) await sleep(delay)

				const outcome = await this.tryDeliverOnce(projectId, {
					tryVault: attempt >= 3,
					checkSigningStatus: attempt === 0 || attempt % 4 === 0,
				})
				if (outcome === "done") return
				if (outcome === "abort") return
			}
			this.log.warn(
				`Notarized PDF email not sent after ${DELIVERY_RETRY_DELAYS_MS.length} attempts (project ${projectId})`
			)
		} finally {
			this.activeJobs.delete(projectId)
		}
	}

	private async tryDeliverOnce(
		projectId: string,
		opts: { tryVault: boolean; checkSigningStatus: boolean }
	): Promise<"done" | "retry" | "abort"> {
		const [row] = await db
			.select({
				id: quicksignProjects.id,
				enpUserId: quicksignProjects.enpUserId,
				title: quicksignProjects.title,
				status: quicksignProjects.status,
				doconchainProjectUuid: quicksignProjects.doconchainProjectUuid,
				appointmentId: quicksignProjects.appointmentId,
				documentFileObjectId: quicksignProjects.documentFileObjectId,
				notarizedFileObjectId: quicksignProjects.notarizedFileObjectId,
				notarizedPdfEmailedAt: quicksignProjects.notarizedPdfEmailedAt,
			})
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectId))
			.limit(1)

		if (!row?.doconchainProjectUuid?.trim()) return "abort"
		if (row.notarizedPdfEmailedAt) return "done"

		const projectUuid = row.doconchainProjectUuid.trim()
		const enp = await this.loadEnpRow(row.enpUserId)
		if (!enp?.email) return "abort"

		const signingComplete = await this.isSigningComplete(
			row,
			enp.email,
			projectUuid,
			opts.checkSigningStatus
		)
		if (!signingComplete) return "retry"

		const recipients = await this.resolvePrincipalAndWitnessEmails(row, enp.email)
		if (recipients.length === 0) {
			this.log.debug(
				`Notarized PDF delivery: no principal/witness recipients for project ${projectId}`
			)
			return "abort"
		}

		let pdfBytes: Buffer | null = null
		if (row.notarizedFileObjectId) {
			try {
				pdfBytes = await this.files.readStoredFileBuffer(row.notarizedFileObjectId)
			} catch (e) {
				this.log.warn(
					`Failed to read notarized PDF from S3 for email: ${(e instanceof Error ? e.message : String(e)).slice(0, 160)}`
				)
			}
		}
		if (!pdfBytes) {
			pdfBytes = await this.localStorage.readPdf(projectId).catch(() => null)
		}
		if (!pdfBytes) return "retry"

		const pdf = await this.notarizedArchive.stampPdfForProject(pdfBytes, projectUuid)

		const hash = createHash("sha256").update(pdf).digest("hex")
		const [qsRow] = await db
			.select({ description: quicksignProjects.description })
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectId))
			.limit(1)
		const oldDesc = qsRow?.description ?? ""
		if (oldDesc.includes("qlegal-hash:")) {
			const newDesc = oldDesc.replace(/(qlegal-hash:)[^\|]*/, `$1${hash}`)
			await db
				.update(quicksignProjects)
				.set({ description: newDesc, updatedAt: new Date() })
				.where(eq(quicksignProjects.id, projectId))
			if (row.appointmentId) {
				const [actRow] = await db
					.select({ id: registryActs.id, description: registryActs.description })
					.from(registryActs)
					.where(eq(registryActs.appointmentId, row.appointmentId))
					.limit(1)
				if (actRow?.description?.includes("qlegal-hash:")) {
					const newActDesc = actRow.description.replace(/(qlegal-hash:)[^\|]*/, `$1${hash}`)
					await db
						.update(registryActs)
						.set({ description: newActDesc, updatedAt: new Date() })
						.where(eq(registryActs.id, actRow.id))
				}
			}
		}

		await this.notarizedArchive.archiveQuicksignProjectPdf(projectId, pdf).catch(e => {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.warn(`Notarized PDF S3 archive during email job: ${msg.slice(0, 200)}`)
		})

		const enpName = formatEnpName(enp)
		const mail = buildNotarizedPdfDeliveryEmail({
			documentTitle: row.title,
			enpName,
		})

		let sent = 0
		for (const to of recipients) {
			try {
				await this.email.sendNotarizedPdfDelivery(to, {
					...mail,
					pdf,
				})
				sent += 1
				this.log.log(`Notarized PDF emailed to ${to} (project ${projectId})`)
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				this.log.warn(`Notarized PDF email failed for ${to}: ${msg.slice(0, 200)}`)
			}
		}

		if (sent === recipients.length) {
			await db
				.update(quicksignProjects)
				.set({ notarizedPdfEmailedAt: new Date(), updatedAt: new Date() })
				.where(eq(quicksignProjects.id, projectId))
			return "done"
		}

		return "retry"
	}

	private async isSigningComplete(
		row: {
			id: string
			status: string
			appointmentId: string | null
			documentFileObjectId: string
		},
		_enpEmail: string,
		_projectUuid: string,
		_checkSigningStatus: boolean
	): Promise<boolean> {
		if (row.status === "completed") return true

		if (row.appointmentId) {
			const sigRows = await db
				.select({ status: meetingSignatureRequests.status })
				.from(meetingSignatureRequests)
				.where(
					and(
						eq(meetingSignatureRequests.appointmentId, row.appointmentId),
						eq(meetingSignatureRequests.documentFileObjectId, row.documentFileObjectId)
					)
				)
			if (sigRows.length > 0 && sigRows.every(r => r.status === "signed")) return true
		}

		const qsSigners = await db
			.select({ signedAt: quicksignSigners.signedAt })
			.from(quicksignSigners)
			.where(eq(quicksignSigners.projectId, row.id))
		if (qsSigners.length > 0 && qsSigners.every(s => s.signedAt !== null)) return true

		return false
	}

	private async resolvePrincipalAndWitnessEmails(
		row: {
			id: string
			enpUserId: string
			appointmentId: string | null
			documentFileObjectId: string
		},
		enpEmail: string
	): Promise<string[]> {
		const enpNorm = enpEmail.trim().toLowerCase()
		const out = new Map<string, string>()

		const qsSigners = await db
			.select({ email: quicksignSigners.email })
			.from(quicksignSigners)
			.where(eq(quicksignSigners.projectId, row.id))

		for (const s of qsSigners) {
			const email = s.email.trim()
			if (!email) continue
			if (email.toLowerCase() === enpNorm) continue
			out.set(email.toLowerCase(), email)
		}

		if (row.appointmentId) {
			const meetingSigners = await db
				.select({
					signerUserId: meetingSignatureRequests.signerUserId,
					signerRole: meetingSignatureRequests.signerRole,
				})
				.from(meetingSignatureRequests)
				.where(
					and(
						eq(meetingSignatureRequests.appointmentId, row.appointmentId),
						eq(meetingSignatureRequests.documentFileObjectId, row.documentFileObjectId)
					)
				)

			const principalWitness = meetingSigners.filter(
				s => s.signerRole === "principal" || s.signerRole === "witness"
			)
			const userIds = principalWitness.map(s => s.signerUserId)
			if (userIds.length > 0) {
				const userRows = await db
					.select({ id: users.id, email: users.email })
					.from(users)
					.where(inArray(users.id, userIds))
				for (const u of userRows) {
					const email = u.email?.trim()
					if (!email) continue
					if (email.toLowerCase() === enpNorm) continue
					out.set(email.toLowerCase(), email)
				}
			}
		}

		return [...out.values()]
	}

	private async loadEnpRow(enpUserId: string) {
		const [row] = await db
			.select({
				prefix: enpProfiles.prefix,
				firstName: enpProfiles.firstName,
				lastName: enpProfiles.lastName,
				suffix: enpProfiles.suffix,
				email: users.email,
			})
			.from(enpProfiles)
			.innerJoin(users, eq(users.id, enpProfiles.userId))
			.where(eq(enpProfiles.userId, enpUserId))
			.limit(1)
		return row
	}
}

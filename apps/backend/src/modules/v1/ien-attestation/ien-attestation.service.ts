import { Injectable, Logger } from "@nestjs/common"
import { ORPCError } from "@orpc/server"
import { and, asc, desc, eq } from "drizzle-orm"

import {
	meetingAttestationRoleForUser,
	notarialAttestationTextFor,
	requiresNotarialAttestation,
	witnessAttestationApplies,
	type IenAttestationRole,
	type ListIenAttestationsResponse,
	type NotarialAttestationActType,
	type ResolveIenSignUrlResponse,
} from "@repo/contracts"
import {
	appointments,
	clientProfiles,
	enpProfiles,
	ienNotarialAttestations,
	meetingSignatureRequests,
	quicksignProjects,
	quicksignSigners,
	users,
} from "@repo/db/schema"

import { db } from "@/common/database/database.client"
import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { publicAppUrl } from "@/config/env.config"

type AppointmentRow = typeof appointments.$inferSelect

@Injectable()
export class IenAttestationService {
	private readonly log = new Logger(IenAttestationService.name)

	constructor() {}

	buildIenSignPageUrl(
		appointmentId: string,
		documentFileId: string,
		role: IenAttestationRole
	): string {
		const base = publicAppUrl().replace(/\/$/, "")
		const params = new URLSearchParams({
			documentFileId,
			role,
		})
		return `${base}/appointments/${encodeURIComponent(appointmentId)}/ien-sign?${params.toString()}`
	}

	async recordQuicksignEnpAttestation(
		ctx: QlegalSessionContext | null,
		projectId: string,
		notarizationType?: NotarialAttestationActType
	): Promise<ListIenAttestationsResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const project = await this.loadProjectForEnp(projectId, ctx.userId)
		const actType = notarizationType ?? "acknowledgment"

		const [enpUser] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, ctx.userId))
			.limit(1)
		if (!enpUser?.email) {
			throw new ORPCError("BAD_REQUEST", { message: "ENP email is required" })
		}

		const signerName = await this.resolveSignerDisplayName(ctx.userId, "enp")
		const acknowledgmentText = this.resolveAttestationText({
			notarizationType: actType,
			sessionMode: "in_person",
			role: "enp",
		})
		const now = new Date()
		await db
			.insert(ienNotarialAttestations)
			.values({
				quicksignProjectId: project.id,
				appointmentId: project.appointmentId,
				documentFileObjectId: project.documentFileObjectId,
				role: "enp",
				userId: ctx.userId,
				signerEmail: enpUser.email.trim(),
				signerName,
				acknowledgmentText,
				confirmedAt: now,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: [
					ienNotarialAttestations.quicksignProjectId,
					ienNotarialAttestations.role,
					ienNotarialAttestations.userId,
				],
				set: {
					confirmedAt: now,
					signerEmail: enpUser.email.trim(),
					signerName,
					acknowledgmentText,
				},
			})

		return this.listForProject(project.id)
	}

	async listForProject(projectId: string): Promise<ListIenAttestationsResponse> {
		const project = await this.loadProjectById(projectId)
		const apt = project.appointmentId
			? await this.loadAppointmentOptional(project.appointmentId)
			: null
		return this.buildListResponse(project, await this.loadAttestationRows(project.id), apt)
	}

	async listForAppointmentDocument(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		documentFileId: string
	): Promise<ListIenAttestationsResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointment(appointmentId)
		await this.assertCanViewAppointmentAttestations(ctx, apt, documentFileId)

		const project = await this.loadProjectForAppointmentDocument(apt, documentFileId)
		return this.buildListResponse(project, await this.loadAttestationRows(project.id), apt)
	}

	async recordAppointmentAttestation(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		documentFileId: string,
		role: IenAttestationRole
	): Promise<ListIenAttestationsResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointment(appointmentId)
		if (!this.isAttestationRequired(apt)) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Notarial attestations do not apply to this session",
			})
		}

		const project = await this.loadProjectForAppointmentDocument(apt, documentFileId)
		const [user] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, ctx.userId))
			.limit(1)
		if (!user?.email) {
			throw new ORPCError("BAD_REQUEST", { message: "Signer email is required" })
		}

		await this.assertRoleAllowedForUser(ctx, apt, documentFileId, role)

		const signerName = await this.resolveSignerDisplayName(ctx.userId, role)
		const acknowledgmentText = this.resolveAttestationText({
			notarizationType: apt.notarizationType,
			sessionMode: apt.sessionMode,
			role,
		})
		const now = new Date()
		await db
			.insert(ienNotarialAttestations)
			.values({
				quicksignProjectId: project.id,
				appointmentId: apt.id,
				documentFileObjectId: documentFileId,
				role,
				userId: ctx.userId,
				signerEmail: user.email.trim(),
				signerName,
				acknowledgmentText,
				confirmedAt: now,
				createdAt: now,
			})
			.onConflictDoUpdate({
				target: [
					ienNotarialAttestations.quicksignProjectId,
					ienNotarialAttestations.role,
					ienNotarialAttestations.userId,
				],
				set: {
					confirmedAt: now,
					appointmentId: apt.id,
					signerEmail: user.email.trim(),
					signerName,
					acknowledgmentText,
				},
			})

		return this.buildListResponse(project, await this.loadAttestationRows(project.id), apt)
	}

	/** Records a notarial attestation when required; no-op if already recorded or not applicable. */
	async recordAppointmentAttestationIfRequired(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		documentFileId: string,
		role: IenAttestationRole
	): Promise<void> {
		if (!ctx?.userId) return

		const apt = await this.loadAppointment(appointmentId)
		if (!this.isAttestationRequired(apt)) return

		const project = await this.loadProjectForAppointmentDocument(apt, documentFileId)
		const rows = await this.loadAttestationRows(project.id)
		if (rows.some(r => r.userId === ctx.userId && r.role === role)) return

		await this.recordAppointmentAttestation(ctx, appointmentId, documentFileId, role)
	}

	async resolveSignUrl(
		ctx: QlegalSessionContext | null,
		appointmentId: string,
		documentFileId: string,
		role: IenAttestationRole
	): Promise<ResolveIenSignUrlResponse> {
		if (!ctx?.userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })

		const apt = await this.loadAppointment(appointmentId)
		if (!(apt.sessionMode === "in_person" && apt.kind === "quicksign")) {
			throw new ORPCError("BAD_REQUEST", {
				message: "IEN sign URLs apply only to in-person QuickSign sessions",
			})
		}

		const project = await this.loadProjectForAppointmentDocument(apt, documentFileId)
		await this.assertRoleAllowedForUser(ctx, apt, documentFileId, role)

		const rows = await this.loadAttestationRows(project.id)
		const hasAttestation = rows.some(r => r.role === role && r.userId === ctx.userId)
		if (!hasAttestation) {
			return {
				signDocumentUrl: null,
				attestationRequired: true,
				attestationComplete: false,
			}
		}

		const signDocumentUrl = await this.resolveLocalSignUrl(project, apt, role, ctx.userId)
		return {
			signDocumentUrl,
			attestationRequired: false,
			attestationComplete: true,
		}
	}

	async assertUserAttestationBeforeMeetingSign(args: {
		apt: AppointmentRow
		documentFileId: string
		signerUserId: string
	}): Promise<void> {
		if (!this.isAttestationRequired(args.apt)) return

		const role = await this.resolveUserAttestationRole(
			args.apt,
			args.documentFileId,
			args.signerUserId
		)
		if (!role) return

		const project = await this.loadProjectForAppointmentDocument(args.apt, args.documentFileId)
		const rows = await this.loadAttestationRows(project.id)
		if (rows.some(r => r.userId === args.signerUserId && r.role === role)) return

		throw new ORPCError("BAD_REQUEST", {
			message: "Acknowledge the notarial certification before signing this document",
		})
	}

	async assertEnpAttestationBeforeFinalize(projectId: string, enpUserId: string): Promise<void> {
		const [row] = await db
			.select({ id: ienNotarialAttestations.id })
			.from(ienNotarialAttestations)
			.where(
				and(
					eq(ienNotarialAttestations.quicksignProjectId, projectId),
					eq(ienNotarialAttestations.role, "enp"),
					eq(ienNotarialAttestations.userId, enpUserId)
				)
			)
			.limit(1)
		if (!row) {
			throw new ORPCError("BAD_REQUEST", {
				message: "Acknowledge the IEN notarial certification before sending signing links",
			})
		}
	}

	async linkProjectAttestationsToAppointment(
		projectId: string,
		appointmentId: string
	): Promise<void> {
		await db
			.update(ienNotarialAttestations)
			.set({ appointmentId })
			.where(eq(ienNotarialAttestations.quicksignProjectId, projectId))
	}

	private isAttestationRequired(apt: AppointmentRow): boolean {
		return requiresNotarialAttestation({ kind: apt.kind, sessionMode: apt.sessionMode })
	}

	private resolveAttestationText(args: {
		notarizationType: NotarialAttestationActType
		sessionMode: AppointmentRow["sessionMode"]
		role: IenAttestationRole
	}): string {
		const text = notarialAttestationTextFor({
			notarizationType: args.notarizationType,
			sessionMode: args.sessionMode,
			role: args.role,
			signingMode: "live",
		})
		if (!text) {
			throw new ORPCError("BAD_REQUEST", {
				message: `No notarial attestation text is configured for role ${args.role}`,
			})
		}
		return text
	}

	private async resolveUserAttestationRole(
		apt: AppointmentRow,
		documentFileId: string,
		userId: string
	): Promise<IenAttestationRole | null> {
		const witnessRows = await db
			.select({ signerUserId: meetingSignatureRequests.signerUserId })
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentFileId),
					eq(meetingSignatureRequests.signerRole, "witness")
				)
			)
		return meetingAttestationRoleForUser({
			userId,
			enpUserId: apt.enpUserId,
			clientUserId: apt.clientUserId,
			witnessUserIds: witnessRows.map(r => r.signerUserId),
		})
	}

	private async buildListResponse(
		project: typeof quicksignProjects.$inferSelect,
		rows: (typeof ienNotarialAttestations.$inferSelect)[],
		apt: AppointmentRow | null
	): Promise<ListIenAttestationsResponse> {
		const signers = await db
			.select()
			.from(quicksignSigners)
			.where(eq(quicksignSigners.projectId, project.id))
			.orderBy(asc(quicksignSigners.sequenceOrder))

		const requiredRoles: IenAttestationRole[] = ["enp", "principal"]
		const [enp] = await db
			.select({ email: users.email })
			.from(users)
			.where(eq(users.id, project.enpUserId))
			.limit(1)
		const witnessEmails = signers
			.slice(1)
			.map(s => s.email.trim().toLowerCase())
			.filter(email => email && email !== enp?.email?.trim().toLowerCase())

		const notarizationType = apt?.notarizationType ?? "acknowledgment"
		if (witnessEmails.length && witnessAttestationApplies(notarizationType)) {
			requiredRoles.push("witness")
		}

		const attestationRequired = apt ? this.isAttestationRequired(apt) : true

		return {
			attestations: rows.map(r => ({
				role: r.role,
				userId: r.userId,
				signerName: r.signerName?.trim() || r.signerEmail,
				signerEmail: r.signerEmail,
				confirmedAt: r.confirmedAt.toISOString(),
				acknowledgmentText: r.acknowledgmentText?.trim() || "",
			})),
			requiredRoles,
			attestationRequired,
		}
	}

	private async resolveSignerDisplayName(
		userId: string,
		role: IenAttestationRole
	): Promise<string> {
		const [user] = await db
			.select({ email: users.email, name: users.name })
			.from(users)
			.where(eq(users.id, userId))
			.limit(1)
		const email = user?.email?.trim() ?? ""

		if (role === "enp") {
			const [enp] = await db
				.select({
					prefix: enpProfiles.prefix,
					firstName: enpProfiles.firstName,
					lastName: enpProfiles.lastName,
					suffix: enpProfiles.suffix,
				})
				.from(enpProfiles)
				.where(eq(enpProfiles.userId, userId))
				.limit(1)
			if (enp) {
				const parts = [enp.prefix, enp.firstName, enp.lastName, enp.suffix]
					.map(p => p?.trim())
					.filter(Boolean)
				if (parts.length) return parts.join(" ")
			}
		} else {
			const [client] = await db
				.select({
					firstName: clientProfiles.firstName,
					lastName: clientProfiles.lastName,
				})
				.from(clientProfiles)
				.where(eq(clientProfiles.userId, userId))
				.limit(1)
			if (client) {
				const name = `${client.firstName} ${client.lastName}`.trim()
				if (name) return name
			}
		}

		return user?.name?.trim() || email || "Signer"
	}

	private async loadAttestationRows(projectId: string) {
		return db
			.select()
			.from(ienNotarialAttestations)
			.where(eq(ienNotarialAttestations.quicksignProjectId, projectId))
			.orderBy(asc(ienNotarialAttestations.confirmedAt))
	}

	private async loadProjectById(projectId: string) {
		const [row] = await db
			.select()
			.from(quicksignProjects)
			.where(eq(quicksignProjects.id, projectId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `QuickSign project ${projectId} not found` })
		return row
	}

	private async loadProjectForEnp(projectId: string, enpUserId: string) {
		const row = await this.loadProjectById(projectId)
		if (row.enpUserId !== enpUserId) {
			throw new ORPCError("NOT_FOUND", { message: `QuickSign project ${projectId} not found` })
		}
		return row
	}

	private async loadAppointment(appointmentId: string) {
		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		if (!row)
			throw new ORPCError("NOT_FOUND", { message: `Appointment ${appointmentId} not found` })
		return row
	}

	private async loadAppointmentOptional(appointmentId: string): Promise<AppointmentRow | null> {
		const [row] = await db
			.select()
			.from(appointments)
			.where(eq(appointments.id, appointmentId))
			.limit(1)
		return row ?? null
	}

	/**
	 * Meeting uploads create `quicksign_projects` with `appointmentId` null so multiple
	 * instruments per appointment are allowed (`appointment_id` is unique on that table).
	 * Resolve by ENP + file id (see `MeetingSignersService.loadQuicksignProjectForDocument`).
	 */
	private async loadProjectForAppointmentDocument(apt: AppointmentRow, documentFileId: string) {
		const [project] = await db
			.select()
			.from(quicksignProjects)
			.where(
				and(
					eq(quicksignProjects.enpUserId, apt.enpUserId),
					eq(quicksignProjects.documentFileObjectId, documentFileId)
				)
			)
			.orderBy(desc(quicksignProjects.updatedAt))
			.limit(1)
		if (!project) {
			throw new ORPCError("NOT_FOUND", { message: "QuickSign project not found for this document" })
		}
		if (project.appointmentId && project.appointmentId !== apt.id) {
			throw new ORPCError("NOT_FOUND", { message: "QuickSign project not found for this document" })
		}
		return project
	}

	private async assertCanViewAppointmentAttestations(
		ctx: QlegalSessionContext,
		apt: AppointmentRow,
		documentFileId: string
	): Promise<void> {
		if (ctx.userId === apt.enpUserId || ctx.userId === apt.clientUserId) return

		const [witness] = await db
			.select({ id: meetingSignatureRequests.id })
			.from(meetingSignatureRequests)
			.where(
				and(
					eq(meetingSignatureRequests.appointmentId, apt.id),
					eq(meetingSignatureRequests.documentFileObjectId, documentFileId),
					eq(meetingSignatureRequests.signerUserId, ctx.userId),
					eq(meetingSignatureRequests.signerRole, "witness")
				)
			)
			.limit(1)
		if (witness) return

		throw new ORPCError("FORBIDDEN", { message: "You cannot view attestations for this session" })
	}

	private async assertRoleAllowedForUser(
		ctx: QlegalSessionContext,
		apt: AppointmentRow,
		documentFileId: string,
		role: IenAttestationRole
	): Promise<void> {
		const resolved = await this.resolveUserAttestationRole(apt, documentFileId, ctx.userId)
		if (resolved !== role) {
			throw new ORPCError("FORBIDDEN", {
				message: `You cannot record the ${role} attestation for this document`,
			})
		}
	}

	private async resolveLocalSignUrl(
		project: typeof quicksignProjects.$inferSelect,
		apt: AppointmentRow,
		role: IenAttestationRole,
		userId: string
	): Promise<string> {
		// Local signing: return the IEN sign page URL
		return this.buildIenSignPageUrl(apt.id, project.documentFileObjectId, role)
	}
}

import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { AllowAnonymous, Session, type UserSession } from "@thallesp/nestjs-better-auth"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { IenAttestationService } from "../ien-attestation/ien-attestation.service"
import { AppointmentsService } from "./appointments.service"

function readQlegal(context: unknown): QlegalSessionContext | null {
	return (context as { qlegal: QlegalSessionContext | null }).qlegal
}

function requireAuthSession(session: UserSession): string {
	const userId = session.user?.id
	if (!userId) throw new ORPCError("UNAUTHORIZED", { message: "Authentication required" })
	return userId
}

function resolveQlegalContext(context: unknown, session: UserSession): QlegalSessionContext {
	const qlegal = readQlegal(context)
	if (!qlegal?.userId) {
		// Fallback for requests where middleware/context hydration races or is absent.
		return {
			userId: session.user!.id,
			sessionId: "unknown",
			role: "none",
			subOrgIds: [],
			complianceAuditAccess: false,
		}
	}
	if (qlegal.userId !== session.user!.id) {
		throw new ORPCError("FORBIDDEN", {
			message: "Session context does not match authenticated user",
		})
	}
	return qlegal
}

@Controller()
export class AppointmentsController {
	constructor(
		private readonly service: AppointmentsService,
		private readonly ienAttestation: IenAttestationService
	) {}

	@AllowAnonymous()
	@Implement(v1.appointment.searchDirectory)
	async searchDirectory() {
		return implement(v1.appointment.searchDirectory).handler(async ({ input }) => {
			return this.service.searchDirectory(input)
		})
	}

	@AllowAnonymous()
	@Implement(v1.appointment.resolveBookingInvite)
	async resolveBookingInvite() {
		return implement(v1.appointment.resolveBookingInvite).handler(async ({ input }) => {
			return this.service.resolveBookingInvite(input.token)
		})
	}

	@Implement(v1.appointment.rotateBookingInvite)
	async rotateBookingInvite(@Session() session: UserSession) {
		return implement(v1.appointment.rotateBookingInvite).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.rotateBookingInvite(qlegal)
		})
	}

	@Implement(v1.appointment.list)
	async list(@Session() session: UserSession) {
		return implement(v1.appointment.list).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.list(qlegal, input ?? { page: 1, limit: 10 })
		})
	}

	@Implement(v1.appointment.listAllMeetingRecordings)
	async listAllMeetingRecordings(@Session() session: UserSession) {
		return implement(v1.appointment.listAllMeetingRecordings).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.listAllMeetingRecordings(qlegal)
		})
	}

	@Implement(v1.appointment.get)
	async get(@Session() session: UserSession) {
		return implement(v1.appointment.get).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.getOne(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.listAttachments)
	async listAttachments(@Session() session: UserSession) {
		return implement(v1.appointment.listAttachments).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.listAttachments(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.listBookedDocumentTypes)
	async listBookedDocumentTypes(@Session() session: UserSession) {
		return implement(v1.appointment.listBookedDocumentTypes).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.listBookedDocumentTypes(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.listMeetingRecordings)
	async listMeetingRecordings(@Session() session: UserSession) {
		return implement(v1.appointment.listMeetingRecordings).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.listMeetingRecordings(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.linkMeetingDocument)
	async linkMeetingDocument(@Session() session: UserSession) {
		return implement(v1.appointment.linkMeetingDocument).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.linkMeetingDocument(qlegal, input.id, {
				fileObjectId: input.fileObjectId,
				documentName: input.documentName,
				documentType: input.documentType,
				enpDocumentTypeId: input.enpDocumentTypeId,
				feePhp: input.feePhp,
			})
		})
	}

	@Implement(v1.appointment.createMeetingDocumentProject)
	async createMeetingDocumentProject(@Session() session: UserSession) {
		return implement(v1.appointment.createMeetingDocumentProject).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.service.createMeetingDocumentProject(qlegal, input.id, {
					fileObjectId: input.fileObjectId,
					feePhp: input.feePhp,
				})
			}
		)
	}

	@Implement(v1.appointment.updateMeetingDocumentFee)
	async updateMeetingDocumentFee(@Session() session: UserSession) {
		return implement(v1.appointment.updateMeetingDocumentFee).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.service.updateMeetingDocumentFee(
					qlegal,
					input.id,
					input.fileObjectId,
					input.feePhp
				)
			}
		)
	}

	@Implement(v1.appointment.deleteMeetingDocument)
	async deleteMeetingDocument(@Session() session: UserSession) {
		return implement(v1.appointment.deleteMeetingDocument).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.deleteMeetingDocument(qlegal, input.id, input.fileObjectId)
		})
	}

	@Implement(v1.appointment.linkMeetingRecording)
	async linkMeetingRecording(@Session() session: UserSession) {
		return implement(v1.appointment.linkMeetingRecording).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.linkMeetingRecording(qlegal, input.id, {
				fileObjectId: input.fileObjectId,
				fileName: input.fileName,
			})
		})
	}

	@Implement(v1.appointment.deleteMeetingRecording)
	async deleteMeetingRecording(@Session() session: UserSession) {
		return implement(v1.appointment.deleteMeetingRecording).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.deleteMeetingRecording(qlegal, input.id, input.fileObjectId)
		})
	}

	@Implement(v1.appointment.getMeetingPaymentStatus)
	async getMeetingPaymentStatus(@Session() session: UserSession) {
		return implement(v1.appointment.getMeetingPaymentStatus).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.getMeetingPaymentStatus(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.listMeetingPaymentBrands)
	async listMeetingPaymentBrands(@Session() session: UserSession) {
		return implement(v1.appointment.listMeetingPaymentBrands).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.service.listMeetingPaymentBrands(qlegal, String(input.id))
			}
		)
	}

	@Implement(v1.appointment.createMeetingPayment)
	async createMeetingPayment(@Session() session: UserSession) {
		return implement(v1.appointment.createMeetingPayment).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			const paymentOptionCode =
				typeof input.paymentOptionCode === "string" ? input.paymentOptionCode : undefined
			return this.service.createMeetingPayment(qlegal, String(input.id), paymentOptionCode)
		})
	}

	@Implement(v1.appointment.simulateMeetingPayment)
	async simulateMeetingPayment(@Session() session: UserSession) {
		return implement(v1.appointment.simulateMeetingPayment).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.simulateMeetingPayment(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.create)
	async create(@Session() session: UserSession) {
		return implement(v1.appointment.create).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.create(qlegal, input)
		})
	}

	@Implement(v1.appointment.updateStatus)
	async updateStatus(@Session() session: UserSession) {
		return implement(v1.appointment.updateStatus).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.updateStatus(qlegal, input.id, input.status, input.declineReason)
		})
	}

	@Implement(v1.appointment.sendBookingQuote)
	async sendBookingQuote(@Session() session: UserSession) {
		return implement(v1.appointment.sendBookingQuote).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.sendBookingQuote(qlegal, input)
		})
	}

	@Implement(v1.appointment.acceptBookingQuote)
	async acceptBookingQuote(@Session() session: UserSession) {
		return implement(v1.appointment.acceptBookingQuote).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.acceptBookingQuote(qlegal, input.id)
		})
	}

	@Implement(v1.appointment.declineBookingQuote)
	async declineBookingQuote(@Session() session: UserSession) {
		return implement(v1.appointment.declineBookingQuote).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.declineBookingQuote(qlegal, input)
		})
	}

	@Implement(v1.appointment.recordIenAttestation)
	async recordIenAttestation(@Session() session: UserSession) {
		return implement(v1.appointment.recordIenAttestation).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.ienAttestation.recordAppointmentAttestation(
				qlegal,
				input.id,
				input.documentFileId,
				input.role
			)
		})
	}

	@Implement(v1.appointment.listIenAttestations)
	async listIenAttestations(@Session() session: UserSession) {
		return implement(v1.appointment.listIenAttestations).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.ienAttestation.listForAppointmentDocument(qlegal, input.id, input.documentFileId)
		})
	}

	@Implement(v1.appointment.resolveIenSignUrl)
	async resolveIenSignUrl(@Session() session: UserSession) {
		return implement(v1.appointment.resolveIenSignUrl).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.ienAttestation.resolveSignUrl(qlegal, input.id, input.documentFileId, input.role)
		})
	}
}

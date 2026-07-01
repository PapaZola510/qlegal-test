import { Controller } from "@nestjs/common"
import { Implement } from "@orpc/nest"
import { implement, ORPCError } from "@orpc/server"
import { Session, type UserSession } from "@thallesp/nestjs-better-auth"

import type { QlegalSessionContext } from "@/common/session/qlegal-session.types"
import { v1 } from "@/config/api-versions.config"

import { MeetingEnbSigningService } from "./meeting-enb-signing.service"
import { MeetingSignersService } from "./meeting-signers.service"
import { SessionLivenessService } from "./session-liveness.service"
import { SessionsService } from "./sessions.service"

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
		// Sessions endpoints should still work based on authenticated session user.
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
export class SessionsController {
	constructor(
		private readonly service: SessionsService,
		private readonly sessionLiveness: SessionLivenessService,
		private readonly meetingSigners: MeetingSignersService,
		private readonly meetingEnbSigning: MeetingEnbSigningService
	) {}

	@Implement(v1.session.list)
	async list(@Session() session: UserSession) {
		return implement(v1.session.list).handler(async ({ context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.findAll(qlegal)
		})
	}

	@Implement(v1.session.get)
	async get(@Session() session: UserSession) {
		return implement(v1.session.get).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.findOne(qlegal, input.id)
		})
	}

	@Implement(v1.session.updateStatus)
	async updateStatus(@Session() session: UserSession) {
		return implement(v1.session.updateStatus).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.updateSessionStatus(qlegal, input.id, input.status, input.notes)
		})
	}

	@Implement(v1.session.lobbyCheck)
	async lobbyCheck(@Session() session: UserSession) {
		return implement(v1.session.lobbyCheck).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.lobbyCheck(qlegal, input)
		})
	}

	@Implement(v1.session.startHostedLiveness)
	async startHostedLiveness(@Session() session: UserSession) {
		return implement(v1.session.startHostedLiveness).handler(async ({ input }) => {
			const userId = requireAuthSession(session)
			return this.sessionLiveness.startHostedLiveness(
				userId,
				input.appointmentId,
				input.guestInviteToken,
				input.returnShell ?? "site",
				input.returnPath
			)
		})
	}

	@Implement(v1.session.getSessionLivenessStatus)
	async getSessionLivenessStatus(@Session() session: UserSession) {
		return implement(v1.session.getSessionLivenessStatus).handler(async ({ input }) => {
			const userId = requireAuthSession(session)
			return this.sessionLiveness.getSessionLivenessStatus(
				userId,
				input.appointmentId,
				input.guestInviteToken
			)
		})
	}

	@Implement(v1.session.completeSessionLiveness)
	async completeSessionLiveness(@Session() session: UserSession) {
		return implement(v1.session.completeSessionLiveness).handler(async ({ input }) => {
			const userId = requireAuthSession(session)
			return this.sessionLiveness.completeSessionLiveness(
				userId,
				input.appointmentId,
				input.transactionId,
				input.guestInviteToken
			)
		})
	}

	@Implement(v1.session.issueJoinToken)
	async issueJoinToken(@Session() session: UserSession) {
		return implement(v1.session.issueJoinToken).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.issueJoinToken(qlegal, input.appointmentId)
		})
	}

	@Implement(v1.session.issueGuestJoinToken)
	async issueGuestJoinToken(@Session() session: UserSession) {
		return implement(v1.session.issueGuestJoinToken).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.issueGuestJoinToken(qlegal, input)
		})
	}

	@Implement(v1.session.enableGuestSigner)
	async enableGuestSigner(@Session() session: UserSession) {
		return implement(v1.session.enableGuestSigner).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.enableGuestSigner(qlegal, input.id)
		})
	}

	@Implement(v1.session.inviteSessionGuest)
	async inviteSessionGuest(@Session() session: UserSession) {
		return implement(v1.session.inviteSessionGuest).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.inviteSessionGuest(qlegal, input)
		})
	}

	@Implement(v1.session.listSessionChat)
	async listSessionChat(@Session() session: UserSession) {
		return implement(v1.session.listSessionChat).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.listSessionChat(qlegal, input.id)
		})
	}

	@Implement(v1.session.sendSessionChat)
	async sendSessionChat(@Session() session: UserSession) {
		return implement(v1.session.sendSessionChat).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.service.sendSessionChat(qlegal, input.id, input.body)
		})
	}

	@Implement(v1.session.listMeetingSignerParticipants)
	async listMeetingSignerParticipants(@Session() session: UserSession) {
		return implement(v1.session.listMeetingSignerParticipants).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.meetingSigners.listMeetingSignerParticipants(qlegal, input.meetingId)
			}
		)
	}

	@Implement(v1.session.listMeetingDocumentSignerAssignments)
	async listMeetingDocumentSignerAssignments(@Session() session: UserSession) {
		return implement(v1.session.listMeetingDocumentSignerAssignments).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.meetingSigners.listMeetingDocumentSignerAssignments(
					qlegal,
					input.meetingId,
					input.documentId
				)
			}
		)
	}

	@Implement(v1.session.setMeetingDocumentSigners)
	async setMeetingDocumentSigners(@Session() session: UserSession) {
		return implement(v1.session.setMeetingDocumentSigners).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingSigners.setMeetingDocumentSigners(
				qlegal,
				input.meetingId,
				input.documentId,
				input.signers
			)
		})
	}

	@Implement(v1.session.listMeetingDocumentSigners)
	async listMeetingDocumentSigners(@Session() session: UserSession) {
		return implement(v1.session.listMeetingDocumentSigners).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingSigners.listMeetingDocumentSigners(
				qlegal,
				input.meetingId,
				input.documentId
			)
		})
	}

	@Implement(v1.session.generateMeetingDocumentPlotLink)
	async generateMeetingDocumentPlotLink(@Session() session: UserSession) {
		return implement(v1.session.generateMeetingDocumentPlotLink).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.meetingSigners.generateMeetingDocumentPlotLink(
					qlegal,
					input.meetingId,
					input.documentId
				)
			}
		)
	}

	@Implement(v1.session.markMeetingDocumentPlotted)
	async markMeetingDocumentPlotted(@Session() session: UserSession) {
		return implement(v1.session.markMeetingDocumentPlotted).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingSigners.markMeetingDocumentPlotted(
				qlegal,
				input.meetingId,
				input.documentId,
				input.signatureFields
			)
		})
	}

	@Implement(v1.session.initiateMeetingSigning)
	async initiateMeetingSigning(@Session() session: UserSession) {
		return implement(v1.session.initiateMeetingSigning).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingSigners.initiateMeetingSigning(
				qlegal,
				input.meetingId,
				input.documentId,
				input.email,
				input.projectUuid,
				input.isPlotting
			)
		})
	}

	@Implement(v1.session.generateMeetingDocumentSignLink)
	async generateMeetingDocumentSignLink(@Session() session: UserSession) {
		return implement(v1.session.generateMeetingDocumentSignLink).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.meetingSigners.generateMeetingDocumentSignLink(
					qlegal,
					input.meetingId,
					input.documentId,
					input.signerEmail
				)
			}
		)
	}

	@Implement(v1.session.markSignedForCurrentUser)
	async markSignedForCurrentUser(@Session() session: UserSession) {
		return implement(v1.session.markSignedForCurrentUser).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingSigners.markSignedForCurrentUser(
			qlegal,
			input.meetingId,
			input.documentId,
			input.signaturePngBase64
		)
		})
	}

	@Implement(v1.session.reSignNotarizedDocument)
	async reSignNotarizedDocument(@Session() session: UserSession) {
		return implement(v1.session.reSignNotarizedDocument).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingSigners.reSignNotarizedDocument(
				qlegal,
				input.meetingId,
				input.documentId
			)
		})
	}

	@Implement(v1.session.getMeetingEnbSigningStatus)
	async getMeetingEnbSigningStatus(@Session() session: UserSession) {
		return implement(v1.session.getMeetingEnbSigningStatus).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingEnbSigning.getStatus(qlegal, input.meetingId)
		})
	}

	@Implement(v1.session.startMeetingEnbSigning)
	async startMeetingEnbSigning(@Session() session: UserSession) {
		return implement(v1.session.startMeetingEnbSigning).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingEnbSigning.startEnbSigning(qlegal, input.meetingId)
		})
	}

	@Implement(v1.session.listMeetingEnbSignatureRequests)
	async listMeetingEnbSignatureRequests(@Session() session: UserSession) {
		return implement(v1.session.listMeetingEnbSignatureRequests).handler(
			async ({ input, context }) => {
				requireAuthSession(session)
				const qlegal = resolveQlegalContext(context, session)
				return this.meetingEnbSigning.listRequests(qlegal, input.meetingId)
			}
		)
	}

	@Implement(v1.session.signMeetingEnbEntry)
	async signMeetingEnbEntry(@Session() session: UserSession) {
		return implement(v1.session.signMeetingEnbEntry).handler(async ({ input, context }) => {
			requireAuthSession(session)
			const qlegal = resolveQlegalContext(context, session)
			return this.meetingEnbSigning.signEntry(qlegal, input)
		})
	}
}

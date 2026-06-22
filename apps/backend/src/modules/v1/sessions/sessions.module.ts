import { forwardRef, Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"
import { NotarizedPdfDeliveryModule } from "@/services/email/notarized-pdf-delivery.module"
import { HypervergeKycLogsService } from "@/services/hyperverge/hyperverge-kyc-logs.service"
import { HypervergeLivenessService } from "@/services/hyperverge/hyperverge-liveness.service"
import { LiveKitTokenService } from "@/services/livekit/livekit-token.service"
import { NotarizedPdfArchiveModule } from "@/services/notarized-pdf/notarized-pdf-archive.module"
import { LocalSigningService } from "@/services/signing/local-signing.service"
import { LocalStorageService } from "@/services/storage/local-storage.service"

import { AppointmentsModule } from "../appointments/appointments.module"
import { EventsModule } from "../events/events.module"
import { FilesModule } from "../files/files.module"
import { IenAttestationModule } from "../ien-attestation/ien-attestation.module"
import { RegistryModule } from "../registry/registry.module"
import { LocationVerificationController } from "./location-verification.controller"
import { LocationVerificationService } from "./location-verification.service"
import { MeetingDocumentNotarizedController } from "./meeting-document-notarized.controller"
import { MeetingEnbSigningService } from "./meeting-enb-signing.service"
import { MeetingSignersService } from "./meeting-signers.service"
import { SessionLivenessService } from "./session-liveness.service"
import { SessionsController } from "./sessions.controller"
import { SessionsService } from "./sessions.service"

@Module({
	imports: [
		EventsModule,
		FilesModule,
		IenAttestationModule,
		NotarizedPdfDeliveryModule,
		NotarizedPdfArchiveModule,
		forwardRef(() => AppointmentsModule),
		RegistryModule,
	],
	controllers: [
		SessionsController,
		MeetingDocumentNotarizedController,
		LocationVerificationController,
	],
	providers: [
		SessionsService,
		SessionLivenessService,
		HypervergeLivenessService,
		HypervergeKycLogsService,
		MeetingSignersService,
		MeetingEnbSigningService,
		LiveKitTokenService,
		LocationVerificationService,
		LocalSigningService,
		LocalStorageService,
		emailAdapterProvider,
	],
	exports: [SessionsService, MeetingSignersService],
})
export class SessionsModule {}

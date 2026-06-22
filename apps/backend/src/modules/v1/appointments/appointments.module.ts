import { forwardRef, Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"
import { HitpayModule } from "@/services/hitpay/hitpay.module"
import { TlpeModule } from "@/services/tlpe/tlpe.module"

import { EnpDocumentTypesModule } from "../enp-document-types/enp-document-types.module"
import { EventsModule } from "../events/events.module"
import { FilesModule } from "../files/files.module"
import { IenAttestationModule } from "../ien-attestation/ien-attestation.module"
import { RegistryModule } from "../registry/registry.module"
import { SessionsModule } from "../sessions/sessions.module"
import { AppointmentsCanStartCron } from "./appointments-can-start.cron"
import { AppointmentsController } from "./appointments.controller"
import { AppointmentsService } from "./appointments.service"
import { MeetingDocumentsController } from "./meeting-documents.controller"

@Module({
	imports: [
		EventsModule,
		IenAttestationModule,
		EnpDocumentTypesModule,
		FilesModule,
		HitpayModule,
		TlpeModule,
		RegistryModule,
		forwardRef(() => SessionsModule),
	],
	controllers: [AppointmentsController, MeetingDocumentsController],
	providers: [AppointmentsService, AppointmentsCanStartCron, emailAdapterProvider],
	exports: [AppointmentsService],
})
export class AppointmentsModule {}

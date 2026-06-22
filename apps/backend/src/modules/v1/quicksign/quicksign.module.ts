import { forwardRef, Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"
import { NotarizedPdfDeliveryModule } from "@/services/email/notarized-pdf-delivery.module"
import { LocalSigningService } from "@/services/signing/local-signing.service"
import { LocalStorageService } from "@/services/storage/local-storage.service"

import { EnpDocumentTypesModule } from "../enp-document-types/enp-document-types.module"
import { EventsModule } from "../events/events.module"
import { FilesModule } from "../files/files.module"
import { IenAttestationModule } from "../ien-attestation/ien-attestation.module"
import { RegistryModule } from "../registry/registry.module"
import { SessionsModule } from "../sessions/sessions.module"
import { QuicksignController } from "./quicksign.controller"
import { QuicksignService } from "./quicksign.service"

@Module({
	imports: [
		FilesModule,
		EnpDocumentTypesModule,
		IenAttestationModule,
		EventsModule,
		RegistryModule,
		NotarizedPdfDeliveryModule,
		forwardRef(() => SessionsModule),
	],
	controllers: [QuicksignController],
	providers: [QuicksignService, LocalSigningService, LocalStorageService, emailAdapterProvider],
	exports: [QuicksignService],
})
export class QuicksignModule {}

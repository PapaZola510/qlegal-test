import { Module } from "@nestjs/common"

import { emailAdapterProvider } from "@/services/email/email-adapter.provider"

import { EnpDocumentTypesModule } from "../enp-document-types/enp-document-types.module"
import { EventsModule } from "../events/events.module"
import { FilesModule } from "../files/files.module"
import { QuicksignModule } from "../quicksign/quicksign.module"
import { DocumentReviewRequestsController } from "./document-review-requests.controller"
import { DocumentReviewRequestsService } from "./document-review-requests.service"

@Module({
	imports: [EventsModule, EnpDocumentTypesModule, FilesModule, QuicksignModule],
	controllers: [DocumentReviewRequestsController],
	providers: [DocumentReviewRequestsService, emailAdapterProvider],
	exports: [DocumentReviewRequestsService],
})
export class DocumentReviewRequestsModule {}

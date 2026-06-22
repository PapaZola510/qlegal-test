import { Module } from "@nestjs/common"

import { FilesModule } from "../files/files.module"
import { RegistryModule } from "../registry/registry.module"
import { ComplianceAccessLogService } from "./access-log.service"
import { ComplianceAuditController } from "./compliance-audit.controller"
import { ComplianceAuditService } from "./compliance-audit.service"
import { ComplianceAvRecordingController } from "./compliance-av-recording.controller"
import { ComplianceDocumentNotarizedController } from "./compliance-document-notarized.controller"
import { ComplianceExportService } from "./compliance-export.service"

@Module({
	imports: [FilesModule, RegistryModule],
	controllers: [
		ComplianceAuditController,
		ComplianceDocumentNotarizedController,
		ComplianceAvRecordingController,
	],
	exports: [ComplianceAccessLogService, ComplianceAuditService, ComplianceExportService],
	providers: [ComplianceAccessLogService, ComplianceAuditService, ComplianceExportService],
})
export class ComplianceAuditModule {}

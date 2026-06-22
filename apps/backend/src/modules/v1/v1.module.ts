import { Module } from "@nestjs/common"

import { AdminModule } from "./admin/admin.module"
import { AppointmentsModule } from "./appointments/appointments.module"
import { AuthProfileModule } from "./auth-profile/auth-profile.module"
import { CertExamModule } from "./cert-exam/cert-exam.module"
import { CommissionHearingsModule } from "./commission-hearings/commission-hearings.module"
import { ComplianceAuditModule } from "./compliance-audit/compliance-audit.module"
import { ContractAiModule } from "./contract-ai/contract-ai.module"
import { DocumentReviewRequestsModule } from "./document-review-requests/document-review-requests.module"
import { EmailMfaModule } from "./email-mfa/email-mfa.module"
import { EmailVerificationModule } from "./email-verification/email-verification.module"
import { EnbAccessModule } from "./enb-access/enb-access.module"
import { EnpCommissionApplicationsModule } from "./enp-commission-applications/enp-commission-applications.module"
import { EnpDocumentTypesModule } from "./enp-document-types/enp-document-types.module"
import { EventsModule } from "./events/events.module"
import { ExamplesModule } from "./examples/examples.module"
import { FilesModule } from "./files/files.module"
import { HealthModule } from "./health/health.module"
import { IntegrationModule } from "./integration/integration.module"
import { LegalTemplatesModule } from "./legal-templates/legal-templates.module"
import { MaintenanceModule } from "./maintenance/maintenance.module"
import { MessagesModule } from "./messages/messages.module"
import { OnboardingModule } from "./onboarding/onboarding.module"
import { PaymentsModule } from "./payments/payments.module"
import { QuicksignModule } from "./quicksign/quicksign.module"
import { RegistryModule } from "./registry/registry.module"
import { SessionsModule } from "./sessions/sessions.module"
import { SignedModule } from "./signed/signed.module"
import { SubOrgsModule } from "./sub-orgs/sub-orgs.module"
import { TicketsModule } from "./tickets/tickets.module"
import { VerifyModule } from "./verify/verify.module"

@Module({
	imports: [
		ExamplesModule,
		HealthModule,
		IntegrationModule,
		TicketsModule,
		AuthProfileModule,
		EmailMfaModule,
		EmailVerificationModule,
		OnboardingModule,
		CertExamModule,
		PaymentsModule,
		SubOrgsModule,
		AppointmentsModule,
		SessionsModule,
		QuicksignModule,
		RegistryModule,
		EnbAccessModule,
		SignedModule,
		MessagesModule,
		MaintenanceModule,
		ContractAiModule,
		AdminModule,
		ComplianceAuditModule,
		VerifyModule,
		EventsModule,
		FilesModule,
		DocumentReviewRequestsModule,
		EnpCommissionApplicationsModule,
		CommissionHearingsModule,
		EnpDocumentTypesModule,
		LegalTemplatesModule,
	],
})
export class V1Module {}

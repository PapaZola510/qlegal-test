import { oc } from "@orpc/contract"

import { adminContract } from "./admin/admin.contract.js"
import { appointmentsContract } from "./appointments/appointments.contract.js"
import { authProfileContract } from "./auth-profile/auth-profile.contract.js"
import { certExamContract } from "./cert-exam/cert-exam.contract.js"
import { commissionHearingsContract } from "./commission-hearings/commission-hearings.contract.js"
import { complianceAuditContract } from "./compliance-audit/compliance-audit.contract.js"
import { contractAiContract } from "./contract-ai/contract-ai.contract.js"
import { documentReviewRequestsContract } from "./document-review-requests/document-review-requests.contract.js"
import { emailMfaContract } from "./email-mfa/email-mfa.contract.js"
import { emailVerificationContract } from "./email-verification/email-verification.contract.js"
import { enbAccessContract } from "./enb-access/enb-access.contract.js"
import { enpCommissionApplicationsContract } from "./enp-commission-applications/enp-commission-applications.contract.js"
import { enpDocumentTypesContract } from "./enp-document-types/enp-document-types.contract.js"
import { v1Example } from "./examples/v1.example.js"
import { healthContract } from "./health/health.contract.js"
import { integrationContract } from "./integration/integration.contract.js"
import { legalTemplatesContract } from "./legal-templates/legal-templates.contract.js"
import { maintenanceContract } from "./maintenance/maintenance.contract.js"
import { messagesContract } from "./messages/messages.contract.js"
import { onboardingContract } from "./onboarding/onboarding.contract.js"
import { paymentsContract } from "./payments/payments.contract.js"
import { quicksignContract } from "./quicksign/quicksign.contract.js"
import { registryContract } from "./registry/registry.contract.js"
import { sessionsContract } from "./sessions/sessions.contract.js"
import { signedContract } from "./signed/signed.contract.js"
import { subOrgsContract } from "./sub-orgs/sub-orgs.contract.js"
import { ticketContract } from "./tickets/tickets.contract.js"
import { verifyContract } from "./verify/verify.contract.js"

/**
 * V1 contract router (versioned paths: /v1/*)
 * Assembles all v1 feature contracts and applies the /v1 prefix
 */
export const v1Contract = oc.prefix("/v1").router(
	oc.router({
		health: healthContract,
		example: v1Example,
		ticket: ticketContract,
		maintenance: maintenanceContract,
		authProfile: authProfileContract,
		emailMfa: emailMfaContract,
		emailVerification: emailVerificationContract,
		onboarding: onboardingContract,
		certExam: certExamContract,
		payment: paymentsContract,
		subOrg: subOrgsContract,
		appointment: appointmentsContract,
		session: sessionsContract,
		quicksign: quicksignContract,
		registry: registryContract,
		enbAccess: enbAccessContract,
		signed: signedContract,
		message: messagesContract,
		contractAi: contractAiContract,
		admin: adminContract,
		complianceAudit: complianceAuditContract,
		verify: verifyContract,
		documentReviewRequest: documentReviewRequestsContract,
		enpCommissionApplication: enpCommissionApplicationsContract,
		commissionHearing: commissionHearingsContract,
		enpDocumentType: enpDocumentTypesContract,
		integration: integrationContract,
		legalTemplates: legalTemplatesContract,
	})
)

export type V1Contract = typeof v1Contract

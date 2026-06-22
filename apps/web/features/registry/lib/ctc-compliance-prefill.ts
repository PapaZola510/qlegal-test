import type { CtcComplianceForm, EnbAccessRequest } from "@repo/contracts"

import { REGISTRY_ACT_TYPE_LABELS, type RegistryAct } from "./fixtures"

export function buildCtcCompliancePrefill(
	request: EnbAccessRequest,
	act: RegistryAct | undefined
): CtcComplianceForm {
	const principalNames =
		act?.principals
			.filter(p => p.role.toLowerCase().includes("principal") || p.role.toLowerCase() === "signer")
			.map(p => p.name)
			.join(", ") ||
		act?.principals.map(p => p.name).join(", ") ||
		request.requesterName

	const witnessNames =
		act?.witnesses.filter(Boolean).join(", ") ||
		act?.principals
			.filter(p => p.role.toLowerCase().includes("witness"))
			.map(p => p.name)
			.join(", ") ||
		""

	const notarialActDate = act?.date ?? act?.executedAt?.slice(0, 10) ?? ""
	const documentType = act
		? `${REGISTRY_ACT_TYPE_LABELS[act.actType]} — ${act.documentTitle}`
		: (request.registryActTitle ?? "")

	return {
		requestingPartyIdentityCheck: "E KYC (Liveness and Detection)",
		notarialActDate,
		documentType,
		principalNames: principalNames.trim() || request.requesterName,
		witnessNames: witnessNames.trim() || undefined,
		purposeOfRequest: request.lawfulPurpose,
		entryRequested: request.entryNumber ?? act?.entryNumber ?? act?.registryNo ?? "",
		lawEnforcementCourtOrderAttached: false,
		lawEnforcementNotes: undefined,
		paymentMethod: request.requesterPaymentMethod ?? "cash",
	}
}

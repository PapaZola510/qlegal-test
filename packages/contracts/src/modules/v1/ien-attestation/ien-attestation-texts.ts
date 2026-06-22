import type { IenAttestationRole } from "./ien-attestation.schema.js"
import {
	notarialAttestationTextFor,
	type NotarialAttestationActType,
	type NotarialAttestationSessionMode,
	type NotarialAttestationSigningMode,
} from "./notarial-attestation-texts.js"

export {
	notarialAttestationChannel,
	notarialAttestationTextFor,
	requiresNotarialAttestation,
	witnessAttestationApplies,
	type NotarialAttestationActType,
	type NotarialAttestationSessionMode,
	type NotarialAttestationSigningMode,
} from "./notarial-attestation-texts.js"

export const IEN_ATTESTATION_ROLE_LABELS: Record<IenAttestationRole, string> = {
	enp: "Electronic Notary Public (ENP)",
	principal: "Principal",
	witness: "Witness",
}

export const IEN_ATTESTATION_CHECKBOX_LABEL = "I have read and acknowledge the foregoing statement."

/** @deprecated Prefer {@link notarialAttestationTextFor} with act and session context. */
export const IEN_ATTESTATION_TEXTS: Record<IenAttestationRole, string> = {
	enp:
		notarialAttestationTextFor({
			notarizationType: "acknowledgment",
			sessionMode: "in_person",
			role: "enp",
		}) ?? "",
	principal:
		notarialAttestationTextFor({
			notarizationType: "acknowledgment",
			sessionMode: "in_person",
			role: "principal",
		}) ?? "",
	witness:
		notarialAttestationTextFor({
			notarizationType: "acknowledgment",
			sessionMode: "in_person",
			role: "witness",
		}) ?? "",
}

/** @deprecated Prefer {@link notarialAttestationTextFor}. */
export function ienAttestationTextForRole(role: IenAttestationRole): string {
	return (
		notarialAttestationTextFor({
			notarizationType: "acknowledgment",
			sessionMode: "in_person",
			role,
		}) ?? IEN_ATTESTATION_TEXTS[role]
	)
}

export function meetingAttestationRoleForUser(args: {
	userId: string
	enpUserId: string
	clientUserId: string
	witnessUserIds: string[]
}): IenAttestationRole | null {
	if (args.userId === args.enpUserId) return "enp"
	if (args.userId === args.clientUserId) return "principal"
	if (args.witnessUserIds.includes(args.userId)) return "witness"
	return null
}

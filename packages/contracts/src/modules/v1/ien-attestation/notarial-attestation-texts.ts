import type { IenAttestationRole } from "./ien-attestation.schema.js"

export type NotarialAttestationSigningMode = "live" | "pre_signed"

export type NotarialAttestationActType =
	| "acknowledgment"
	| "jurat"
	| "oath_affirmation"
	| "copy_certification"
	| "signature_witnessing"

export type NotarialAttestationSessionMode = "remote" | "in_person" | "hybrid"

const LOCATION =
	"I likewise confirm that, at the time of the electronic notarial act, I was physically located within the Philippines or, where authorized by applicable rules, within a Philippine Embassy, Consular Office, or the Office of a Philippine Honorary Consul abroad."

/** REN = remote/hybrid videoconference; IEN = in-person electronic means. */
export function notarialAttestationChannel(
	sessionMode: NotarialAttestationSessionMode
): "ien" | "ren" {
	return sessionMode === "in_person" ? "ien" : "ren"
}

export function requiresNotarialAttestation(args: {
	kind: "standard" | "quicksign" | "commission_hearing"
	sessionMode: NotarialAttestationSessionMode
}): boolean {
	if (args.kind === "commission_hearing") return false
	if (args.kind === "quicksign" && args.sessionMode === "in_person") return true
	if (args.kind === "standard") return true
	return false
}

export function witnessAttestationApplies(notarizationType: NotarialAttestationActType): boolean {
	return (
		notarizationType === "acknowledgment" ||
		notarizationType === "copy_certification" ||
		notarizationType === "signature_witnessing"
	)
}

const ACKNOWLEDGMENT_LIVE: Record<"ien" | "ren", Record<IenAttestationRole, string>> = {
	ien: {
		enp: `I certify that the Principal and the Witnesses, if any, personally appeared before me, were properly identified through competent evidence of identity, and voluntarily executed the electronic document with full understanding of its nature and legal consequences. I further certify that the document presented for notarization is the same document acknowledged, sworn to, affirmed, executed, or signed before me, and that all parties concerned were physically located within the Philippines or, where permitted, within a Philippine Embassy, Consular Office, or Office of a Philippine Honorary Consul abroad at the time of the electronic notarial act.`,

		principal: `By proceeding, I certify that I have reviewed the electronic document, that the electronic signature affixed by me was voluntarily applied through the Electronic Notarization Facility (ENF), and that it was affixed for the purposes stated in the document. I further confirm that the electronic document presented for notarization is the same document that I executed, acknowledged, or witnessed, as applicable, and that all statements made herein are true and correct. ${LOCATION}`,

		witness: `I confirm that I personally witnessed the Principal electronically sign this document through the Electronic Notarization Facility (ENF) in the full view of the Electronic Notary Public (ENP). I voluntarily affixed my electronic signature to this document as a witness and affirm that the electronic document presented for notarization is the same document that I witnessed being executed by the Principal. ${LOCATION}`,
	},
	ren: {
		enp: `I certify that I verified the identities of the Principal and the Witness(es), if any, through the Electronic Notarization Facility (ENF); personally virtually observed them affix their electronic signatures to the electronic document in my full view; and confirmed that such signatures were voluntarily affixed for the purposes stated therein. The Principal declared that the electronic signature was affixed as his/her free and voluntary act and deed. I further certify that the electronic document presented for notarization is the same electronic document executed, acknowledged, sworn to, affirmed, or signed by the Principal and the Witness(es), if any. ${LOCATION}`,

		principal: `By proceeding, I certify that I have reviewed the electronic document, that the electronic signature affixed by me was voluntarily applied through the Electronic Notarization Facility (ENF), and that it was affixed for the purposes stated in the document. I further confirm that the electronic document presented for notarization is the same document that I executed, acknowledged, or witnessed, as applicable, and that all statements made herein are true and correct. ${LOCATION}`,

		witness: `I confirm that I personally witnessed the Principal electronically sign this document through the Electronic Notarization Facility (ENF) in the full view of the Electronic Notary Public (ENP). I voluntarily affixed my electronic signature to this document as a witness and affirm that the electronic document presented for notarization is the same document that I witnessed being executed by the Principal. ${LOCATION}`,
	},
}

const ACKNOWLEDGMENT_PRE_SIGNED: Record<
	"ien" | "ren",
	Partial<Record<IenAttestationRole, string>>
> = {
	ien: {
		principal: `I confirm that the signature appearing on this electronic document is my own and that I voluntarily affixed it for the purposes stated herein. I further declare that I signed this electronic document as my free and voluntary act and deed and that I understand its nature, contents, and legal consequences. ${LOCATION}`,

		witness: `I confirm that the signature appearing on this electronic document is my own and that I voluntarily affixed it as a witness to the execution of this electronic document by the Principal. ${LOCATION}`,
	},
	ren: {
		principal: `I confirm that the signature appearing on this electronic document is my own and that I voluntarily affixed it for the purposes stated herein. I further declare that I signed this electronic document as my free and voluntary act and deed and that I understand its nature, contents, and legal consequences. ${LOCATION}`,

		witness: `I confirm that the signature appearing on this electronic document is my own and that I voluntarily affixed it as a witness to the execution of this electronic document by the Principal. ${LOCATION}`,
	},
}

const JURAT_LIVE: Record<"ien" | "ren", Partial<Record<IenAttestationRole, string>>> = {
	ien: {
		enp: `I certify that the Principal personally appeared before me through the Electronic Notarization Facility (ENF) and, in my full view, affixed his/her electronic signature to the electronic document. I further certify that the Principal took an oath (or affirmation) before me and declared that the contents of the electronic document are true and correct based on his/her personal knowledge and/or authentic records. ${LOCATION}`,

		principal: `I confirm that I personally affixed my electronic signature to this electronic document through the Electronic Notarization Facility (ENF) in the full view of the Electronic Notary Public (ENP). I further solemnly swear (or affirm) that I have read and understood the contents of this electronic document and that the statements, representations, and allegations contained herein are true and correct based on my personal knowledge and/or authentic records. ${LOCATION}`,
	},
	ren: {
		enp: `I certify that the Principal appeared virtually before me through the Electronic Notarization Facility (ENF) and, in my full virtual view, affixed his/her electronic signature to the electronic document. I further certify that the Principal took an oath (or affirmation) before me and declared that the contents of the electronic document are true and correct based on his/her personal knowledge and/or authentic records. ${LOCATION}`,

		principal: `I confirm that I personally affixed my electronic signature to this electronic document through the Electronic Notarization Facility (ENF) in the full view of the Electronic Notary Public (ENP). I further solemnly swear (or affirm) that I have read and understood the contents of this electronic document and that the statements, representations, and allegations contained herein are true and correct based on my personal knowledge and/or authentic records. ${LOCATION}`,
	},
}

const OATH_AFFIRMATION_LIVE: Record<"ien" | "ren", Partial<Record<IenAttestationRole, string>>> = {
	ien: {
		enp: `I certify that the Principal personally appeared before me through the Electronic Notarization Facility (ENF), and in my full view, affixed his/her electronic signature to the electronic document. I further certify that the Principal declared under oath and under penalty of law that he/she had read and understood the contents of the electronic document and that the statements contained therein are true and correct based on his/her personal knowledge and/or authentic records. ${LOCATION}`,

		principal: `I confirm that I personally affixed my electronic signature to this electronic document through the ENF in the presence of the ENP, and I declare under oath and under penalty of law that the contents of this electronic document are true and correct. ${LOCATION}`,
	},
	ren: {
		enp: `I certify that the Principal appeared virtually before me through the Electronic Notarization Facility (ENF), and in my full virtual view, affixed his/her electronic signature to the electronic document. I further certify that the Principal declared under oath and under penalty of law that he/she had read and understood the contents of the electronic document and that the statements contained therein are true and correct based on his/her personal knowledge and/or authentic records. ${LOCATION}`,

		principal: `I confirm that I personally affixed my electronic signature to this electronic document through the ENF in the presence of the ENP, and I declare under oath and under penalty of law that the contents of this electronic document are true and correct. ${LOCATION}`,
	},
}

const OATH_AFFIRMATION_PRE_SIGNED: Record<
	"ien" | "ren",
	Partial<Record<IenAttestationRole, string>>
> = {
	ien: {
		enp: `I certify that the Principal personally appeared before me through the Electronic Notarization Facility (ENF) and confirmed that the electronic signature appearing on the electronic document is his/her own. I further certify that the Principal, under oath (or affirmation) and under penalty of law, avowed the truthfulness of the contents of the electronic document. ${LOCATION}`,

		principal: `I confirm that the electronic signature appearing on this electronic document is my own and was affixed by me. I further declare, under oath (or affirmation) and under penalty of law, that I have reviewed and understand the contents of this electronic document and that the statements, representations, and allegations contained therein are true and correct to the best of my knowledge and belief. ${LOCATION}`,
	},
	ren: {
		enp: `I certify that the Principal appeared virtually before me through the Electronic Notarization Facility (ENF) and confirmed that the electronic signature appearing on the electronic document is his/her own. I further certify that the Principal, under oath (or affirmation) and under penalty of law, avowed the truthfulness of the contents of the electronic document. ${LOCATION}`,

		principal: `I confirm that the electronic signature appearing on this electronic document is my own and was affixed by me. I further declare, under oath (or affirmation) and under penalty of law, that I have reviewed and understand the contents of this electronic document and that the statements, representations, and allegations contained therein are true and correct to the best of my knowledge and belief. ${LOCATION}`,
	},
}

function resolveActType(
	notarizationType: NotarialAttestationActType
): "acknowledgment" | "jurat" | "oath_affirmation" {
	if (notarizationType === "jurat") return "jurat"
	if (notarizationType === "oath_affirmation") return "oath_affirmation"
	return "acknowledgment"
}

export function notarialAttestationTextFor(args: {
	notarizationType: NotarialAttestationActType
	sessionMode: NotarialAttestationSessionMode
	role: IenAttestationRole
	signingMode?: NotarialAttestationSigningMode
}): string | null {
	const channel = notarialAttestationChannel(args.sessionMode)
	const signingMode = args.signingMode ?? "live"
	const act = resolveActType(args.notarizationType)

	if (signingMode === "pre_signed") {
		if (act === "acknowledgment") {
			return ACKNOWLEDGMENT_PRE_SIGNED[channel][args.role] ?? null
		}
		if (act === "oath_affirmation") {
			return OATH_AFFIRMATION_PRE_SIGNED[channel][args.role] ?? null
		}
		return null
	}

	if (act === "acknowledgment") {
		return ACKNOWLEDGMENT_LIVE[channel][args.role] ?? null
	}
	if (act === "jurat") {
		return JURAT_LIVE[channel][args.role] ?? null
	}
	return OATH_AFFIRMATION_LIVE[channel][args.role] ?? null
}

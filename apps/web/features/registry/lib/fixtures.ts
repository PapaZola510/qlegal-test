import type { EnbAccessRequest, RegistryAct as RegistryActApi } from "@repo/contracts"

import { formatScEntryNo } from "./sc-entry-number"
import { scNotarialActLabel } from "./sc-notarial-act-labels"

export function displayEntryNumber(
	act: Pick<RegistryAct, "entryNumber" | "registryNo" | "pageNo" | "executedAt" | "date">
): string {
	if (act.entryNumber?.trim()) return act.entryNumber.trim()
	return formatScEntryNo(act)
}

export type RegistryActType = RegistryActApi["actType"]

export const REGISTRY_ACT_TYPE_LABELS: Record<RegistryActType, string> = {
	deed_of_sale: "Deed of Sale",
	affidavit: "Affidavit",
	special_power_of_attorney: "Special Power of Attorney",
	general_power_of_attorney: "General Power of Attorney",
	acknowledgment: "Acknowledgment",
	jurat: "Jurat",
	oath: "Oath / Affirmation",
	certification: "Copy Certification",
	protest: "Protest",
	deposition: "Deposition",
	other: "Other",
}

export type SCSyncStatus = "synced" | "pending" | "failed" | "not_started"

export const SC_SYNC_LABELS: Record<SCSyncStatus, string> = {
	synced: "Synced",
	pending: "Pending",
	failed: "Failed",
	not_started: "Not Started",
}

export interface RegistryPrincipal {
	name: string
	role: string
}

export interface RegistryAct {
	id: string
	registryNo: string
	/** Canonical SC-format ENB entry number (doc-page-month-year). */
	entryNumber: string | null
	completionStatus: "completed" | "incomplete"
	incompleteReason: string | null
	incompleteCircumstances: string | null
	/** ISO timestamp of notarization (SC date & time column). */
	executedAt: string
	date: string
	documentTitle: string
	actType: RegistryActType
	fee: number
	scSync: SCSyncStatus
	nrid: string
	nrn: string
	bookNo: string | null
	pageNo: string | null
	/** Linked appointment when the act originated from a booking session. */
	appointmentId: string | null
	/** Client purpose / notes from linked appointment booking. */
	appointmentPurpose: string | null
	/** From linked appointment when available (IEN vs REN). */
	sessionMode: "remote" | "in_person" | "hybrid" | null
	/** Geolocation or venue text captured at notarization (SC col. 8). */
	notarizationLocation: string | null
	principals: RegistryPrincipal[]
	/** Principal ENB e-signatures from the live session (Rule §4). */
	principalEnbSignatures: {
		signerName: string
		signerRole?: "principal" | "witness"
		signedAt: string
		signatureAcknowledgment: string | null
		signatureImageData?: string | null
	}[]
	/** IEN checkbox acknowledgments before DocOnChain signing. */
	ienNotarialAttestations: {
		role: "enp" | "principal" | "witness"
		signerName: string
		signerEmail: string
		confirmedAt: string
		acknowledgmentText: string
	}[]
	witnesses: string[]
	location: string
	/** Stored `document_url` on the registry act, when set. */
	documentUrl: string
	/** Meeting-sourced acts: file object id used to resolve DocOnChain notarized PDF. */
	documentFileObjectId: string | null
	/** DocOnChain project UUID when the act was created from a meeting signing flow. */
	projectUuid: string | null
	/** DOC Verify code from DocOnChain vault (on sealed PDF / QR). */
	documentCode: string | null
	/** ENB inspect/copy and CTC requests linked to this registry entry. */
	enbAccessRequests: EnbAccessRequest[]
	scFailureReason: string | null
	scFailureTimestamp: string | null
	pdfUploadPending: boolean
	commissionInactive: boolean
}

/** Download filename for DocOnChain notarized PDF (`document_url` rows). */
export function notarizedPdfDownloadFilename(
	act: Pick<RegistryAct, "documentTitle" | "registryNo">
): string {
	const base = act.documentTitle.trim() || act.registryNo
	const safe = base.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 120)
	return /\.pdf$/i.test(safe)
		? `${safe.replace(/\.pdf$/i, "")}-notarized.pdf`
		: `${safe}-notarized.pdf`
}

export function generateCsvContent(acts: RegistryAct[]): string {
	const header = [
		"Entry No.",
		"Electronic Notarial Act",
		"Date and Time",
		"Document Title or Description",
		"Principals (Name and Address)",
		"Witnesses (Name and Address)",
		"Competent Evidence of Identity",
		"Fee Charged",
		"Parties Within Philippines Statement",
		"Mode (IEN/REN) and Circumstances",
		"Not Completed — Reasons",
		"Inspect / Copy / CTC Requests",
	].join(",")
	const rows = acts.map(a => {
		const principals = a.principals.map(p => p.name).join("; ")
		const witnesses = a.witnesses.join("; ")
		const identity = a.principals
			.map(p => `${p.name}: ${p.role || "on file"}`)
			.concat(a.witnesses.map(w => `${w}: on file`))
			.join("; ")
		const mode = a.sessionMode === "in_person" ? "IEN" : "REN"
		const incomplete =
			a.completionStatus === "incomplete"
				? [a.incompleteReason, a.incompleteCircumstances].filter(Boolean).join("; ")
				: ""
		const access = (a.enbAccessRequests ?? [])
			.map(
				r =>
					`${r.requestType}${r.certifiedTrueCopy ? " (CTC)" : ""}: ${r.requesterName} — ${r.outcome}`
			)
			.join(" | ")
		return [
			displayEntryNumber(a),
			scNotarialActLabel(a.actType),
			a.executedAt,
			a.documentTitle,
			principals,
			witnesses,
			identity,
			String(a.fee),
			a.notarizationLocation ?? a.location ?? "",
			mode,
			incomplete,
			access,
		]
			.map(cell => `"${String(cell).replace(/"/g, '""')}"`)
			.join(",")
	})
	return [header, ...rows].join("\n")
}

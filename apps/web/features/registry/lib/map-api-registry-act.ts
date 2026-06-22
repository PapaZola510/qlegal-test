import type { RegistryAct as RegistryActApi } from "@repo/contracts"

import type { RegistryAct, RegistryPrincipal, SCSyncStatus } from "./fixtures"

function mapScSync(api: RegistryActApi): SCSyncStatus {
	const { nrid } = parseScExternalRefs(api.scExternalRef)
	// Row may already have a live NRID while status is still pending (e.g. client error after server sync).
	if (nrid !== "—" && !nrid.startsWith("NRID-STUB-")) return "synced"

	switch (api.scStatus) {
		case "synced":
		case "approved":
			return "synced"
		case "sync_failed":
		case "rejected":
			return "failed"
		case "draft":
			return "not_started"
		case "pending_upload":
		case "uploaded":
		case "pending_review":
		default:
			return "pending"
	}
}

function splitParties(api: RegistryActApi): {
	principals: RegistryPrincipal[]
	witnesses: string[]
} {
	const principals: RegistryPrincipal[] = []
	const witnesses: string[] = []
	for (const p of api.parties) {
		if (/\bnotary\b/i.test(p.role)) continue
		if (/\bwitness\b/i.test(p.role)) witnesses.push(p.name)
		else principals.push({ name: p.name, role: p.role })
	}
	return { principals, witnesses }
}

function formatLocation(api: RegistryActApi): string {
	const geolocation = api.notarizationLocation?.trim()
	if (geolocation) return geolocation
	const book = api.bookNo?.trim()
	const page = api.pageNo?.trim()
	if (book || page) return [`Book ${book ?? "—"}`, `Page ${page ?? "—"}`].join(" · ")
	return "—"
}

function parseScExternalRefs(ref: string | null | undefined): { nrid: string; nrn: string } {
	const raw = ref?.trim()
	if (!raw) return { nrid: "—", nrn: "—" }
	if (raw.includes("|")) {
		const [nrid, nrn] = raw.split("|", 2)
		return {
			nrid: nrid?.trim() || "—",
			nrn: nrn?.trim() || "—",
		}
	}
	if (raw.startsWith("mock_sc_")) return { nrid: "—", nrn: "—" }
	return { nrid: raw, nrn: "—" }
}

function timestampIso(value: RegistryActApi["updatedAt"]): string | null {
	if (value === null || value === undefined) return null
	if (typeof value === "string") return value
	if (value instanceof Date) return value.toISOString()
	return null
}

/** Maps API {@link RegistryActApi} to the richer row model used by the registry table UI. */
export function mapApiRegistryActToRow(api: RegistryActApi): RegistryAct {
	const { principals, witnesses } = splitParties(api)
	const scSync = mapScSync(api)
	const { nrid, nrn } = parseScExternalRefs(api.scExternalRef)

	return {
		id: api.id,
		registryNo: api.actNumber,
		entryNumber: api.entryNumber ?? null,
		completionStatus: api.completionStatus ?? "completed",
		incompleteReason: api.incompleteReason ?? null,
		incompleteCircumstances: api.incompleteCircumstances ?? null,
		executedAt: api.executedAt,
		date: api.executedAt.slice(0, 10),
		documentTitle: api.title,
		actType: api.actType,
		fee: api.feePhp ?? 0,
		scSync,
		nrid,
		nrn,
		bookNo: api.bookNo ?? null,
		pageNo: api.pageNo ?? null,
		appointmentId: api.appointmentId ?? null,
		appointmentPurpose: api.appointmentPurpose ?? null,
		sessionMode: api.sessionMode ?? null,
		notarizationLocation: api.notarizationLocation ?? null,
		principals,
		principalEnbSignatures: api.principalEnbSignatures ?? [],
		ienNotarialAttestations: api.ienNotarialAttestations ?? [],
		witnesses,
		location: formatLocation(api),
		documentUrl: api.documentUrl ?? "",
		documentFileObjectId: api.documentFileObjectId ?? null,
		projectUuid: api.doconchainProjectUuid?.trim() || null,
		documentCode: api.doconchainDocumentCode?.trim() || null,
		scFailureReason: api.scRejectionReason,
		scFailureTimestamp:
			scSync === "failed"
				? (api.scSubmittedAt ?? api.scSyncedAt ?? timestampIso(api.updatedAt))
				: null,
		pdfUploadPending: !api.documentUrl?.trim(),
		commissionInactive: false,
		enbAccessRequests: api.enbAccessRequests ?? [],
	}
}

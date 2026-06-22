import { Logger } from "@nestjs/common"

import { isScCommissionStatusBlocked } from "@/modules/v1/auth-profile/lib/enp-commission-validation"
import { persistEnpScCommissionStatus } from "@/modules/v1/auth-profile/lib/sync-enp-sc-commission-status"

import {
	formatScDate,
	getSupremeCourtAccessToken,
	mapRegistryActTypeToSc,
	parseScAddress,
	queryNotaryCommissionStatus,
	resolveModeOfNotarization,
	scNormalizeId,
	submitConsolidatedNotarialAct,
	supremeCourtIsConfigured,
	uploadNotarialPdfToSupremeCourt,
	type ScAddress,
	type ScConsolidatedPayload,
} from "./supreme-court-client.js"

const log = new Logger("syncNotarialActToSupremeCourt")

export type SyncNotarialActParty = { name: string; role: string }

/** Minimal act shape aligned with legacy `syncNotarialActToSupremeCourt` input. */
export type SyncNotarialActInput = {
	externalActId: string
	actType: string
	title: string
	parties: SyncNotarialActParty[]
	executedAt: Date | string
	updatedAt?: Date | string
	bookNo?: string | null
	pageNo?: string | null
	description?: string | null
	/** Appointment `session_mode` — drives SC `modeOfNotarization`. */
	sessionMode?: "remote" | "in_person" | "hybrid" | null
	notaryFacilityNumber: string
	notaryPublicNumber: string
	rollNumber: string
	/** When set, persists the live SC `/cs` status on successful commission check. */
	enpUserId?: string
	/** ENP address fields or free-text fallback for SC principals/witnesses. */
	address?: ScAddress | string | null
	documentFile?: Buffer | null
	documentFileName?: string | null
}

export type SyncResult = {
	notarialRegistryID: string
	notarialRegistryNumber: string
	stub?: boolean
}

function principalParties(parties: SyncNotarialActParty[]): SyncNotarialActParty[] {
	return parties.filter(p => !/\bwitness\b/i.test(p.role) && !/\bnotary\b/i.test(p.role))
}

function witnessParties(parties: SyncNotarialActParty[]): SyncNotarialActParty[] {
	return parties.filter(p => /\bwitness\b/i.test(p.role))
}

function buildListOfPrincipals(
	parties: SyncNotarialActParty[],
	address: ScAddress
): ScConsolidatedPayload["listOfPrincipals"] {
	const principals = principalParties(parties)
	const rows =
		principals.length > 0
			? principals.map(p => ({
					principalName: p.name.trim(),
					principalAddress: address,
				}))
			: []
	if (rows.length === 0) {
		throw new Error("Principal name is required before Supreme Court sync.")
	}
	const empty = rows.find(r => !r.principalName)
	if (empty) {
		throw new Error("Principal name is required before Supreme Court sync.")
	}
	return rows
}

/**
 * Sync one notarial act to the Supreme Court eNotarization API (legacy parity).
 * Steps: normalize IDs → commission check → consolidated metadata → optional PDF (NRN-based).
 */
export async function syncNotarialActToSupremeCourt(
	input: SyncNotarialActInput
): Promise<SyncResult> {
	if (!supremeCourtIsConfigured()) {
		const stubNrid = `NRID-STUB-${input.externalActId.slice(0, 8).toUpperCase()}`
		const stubNrn = `NRN-STUB-${input.externalActId.slice(0, 8).toUpperCase()}`
		return {
			notarialRegistryID: stubNrid,
			notarialRegistryNumber: stubNrn,
			stub: true,
		}
	}

	const token = await getSupremeCourtAccessToken()
	const npn = scNormalizeId(input.notaryPublicNumber, "NPN-")
	const rn = scNormalizeId(input.rollNumber, "RN-")
	const nfn = scNormalizeId(input.notaryFacilityNumber, "NFN-")

	if (!npn || !rn) {
		throw new Error(
			"ENP profile must include roll number (RN) and notary public number (NPN) before Supreme Court sync."
		)
	}

	const { rawStatus, normalizedStatus } = await queryNotaryCommissionStatus({ token, npn, rn })
	if (isScCommissionStatusBlocked(normalizedStatus)) {
		throw new Error(
			`Supreme Court reports commission status: ${rawStatus || "Inactive"}. Notarial acts are not allowed.`
		)
	}
	if (input.enpUserId) {
		await persistEnpScCommissionStatus(input.enpUserId, normalizedStatus)
	}

	const address =
		typeof input.address === "string"
			? parseScAddress(input.address)
			: (input.address ?? parseScAddress(null))

	const executedDate = formatScDate(input.executedAt)
	const updatedDate = formatScDate(input.updatedAt ?? input.executedAt)
	const pageNum = Number.parseInt(input.pageNo ?? "1", 10)
	const bookNum = Number.parseInt(input.bookNo ?? "1", 10)

	const listOfPrincipals = buildListOfPrincipals(input.parties, address)
	const witnesses = witnessParties(input.parties)
	const principalAddress = listOfPrincipals[0]?.principalAddress ?? address
	const listOfWitness = witnesses.map(w => ({
		witnessName: w.name.trim(),
		witnessAddress: principalAddress,
	}))

	const consolidated: ScConsolidatedPayload = {
		notaryFacilityNumber: nfn,
		notaryPublicNumber: npn,
		rollNumber: rn,
		metaData: {
			dateNotarized: executedDate,
			notarialActType: mapRegistryActTypeToSc(input.actType),
			notarialPageNumber: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
			notarialBookNumber: Number.isFinite(bookNum) && bookNum > 0 ? bookNum : 1,
			description: input.title.trim() || "Notarial act",
			modeOfNotarization: resolveModeOfNotarization(input.sessionMode),
			remarks: input.description?.trim() || input.title.trim() || "Notarial act",
			dateUpdated: updatedDate,
		},
		listOfPrincipals,
		listOfWitness,
	}

	const { nrid, nrn } = await submitConsolidatedNotarialAct(consolidated, token)

	const pdf = input.documentFile
	const pdfName = input.documentFileName?.trim()
	if (pdf?.length && pdfName) {
		try {
			await uploadNotarialPdfToSupremeCourt({
				token,
				nrid,
				nrn,
				pdfBytes: pdf,
				fileName: pdfName,
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			log.warn(`SC PDF upload failed for ${nrid} (metadata saved): ${msg.slice(0, 240)}`)
		}
	}

	log.log(
		JSON.stringify({
			event: "sc_registry_sync_ok",
			externalActId: input.externalActId,
			nrid,
			nrn,
		})
	)

	return {
		notarialRegistryID: nrid,
		notarialRegistryNumber: nrn,
	}
}

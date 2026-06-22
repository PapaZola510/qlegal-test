import { Injectable, Logger } from "@nestjs/common"

import { supremeCourtIsConfigured, type ScAddress } from "./supreme-court-client.js"
import {
	syncNotarialActToSupremeCourt,
	type SyncNotarialActInput,
	type SyncNotarialActParty,
} from "./sync-notarial-act.js"

export interface ScRegistryEnpCredentials {
	npn: string
	rollNumber: string
	notaryFacilityNumber: string
	address: ScAddress
}

export interface ScRegistrySubmitPayload {
	enpUserId?: string
	externalActId: string
	actNumber: string
	actType: string
	title: string
	parties: SyncNotarialActParty[]
	executedAtIso: string
	bookNo?: string | null
	pageNo?: string | null
	description?: string | null
	enp: ScRegistryEnpCredentials
	sessionMode?: "remote" | "in_person" | "hybrid" | null
	pdf?: { bytes: Buffer; fileName: string } | null
}

export interface ScRegistrySubmitResult {
	ok: boolean
	nrid?: string
	nrn?: string
	externalReference?: string
	error?: string
	stub?: boolean
}

@Injectable()
export class ScRegistryAdapterService {
	private readonly log = new Logger(ScRegistryAdapterService.name)

	isConfigured(): boolean {
		return supremeCourtIsConfigured()
	}

	/** One act per call — delegates to {@link syncNotarialActToSupremeCourt}. */
	async submitAct(payload: ScRegistrySubmitPayload): Promise<ScRegistrySubmitResult> {
		const input: SyncNotarialActInput = {
			enpUserId: payload.enpUserId,
			externalActId: payload.externalActId,
			actType: payload.actType,
			title: payload.title,
			parties: payload.parties,
			executedAt: payload.executedAtIso,
			bookNo: payload.bookNo,
			pageNo: payload.pageNo,
			description: payload.description,
			sessionMode: payload.sessionMode,
			notaryFacilityNumber: payload.enp.notaryFacilityNumber,
			notaryPublicNumber: payload.enp.npn,
			rollNumber: payload.enp.rollNumber,
			address: payload.enp.address,
			documentFile: payload.pdf?.bytes,
			documentFileName: payload.pdf?.fileName,
		}

		try {
			const result = await syncNotarialActToSupremeCourt(input)
			const nrid = result.notarialRegistryID
			const nrn = result.notarialRegistryNumber

			return {
				ok: true,
				stub: result.stub,
				nrid,
				nrn,
				externalReference: nrn ? `${nrid}|${nrn}` : nrid,
			}
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			this.log.warn(`SC registry sync error: ${msg}`)
			return { ok: false, error: msg }
		}
	}
}

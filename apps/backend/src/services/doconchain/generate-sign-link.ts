import { doconchainOrgEmailFallback } from "@/config/env.config"

import { type DoconchainAdapterService } from "./doconchain-adapter.service"

export async function generateDoconchainSignLink(
	dc: DoconchainAdapterService,
	args: {
		projectUuid: string
		signerEmail: string
		projectOwnerEmail: string
	}
): Promise<string> {
	const ownerEmail = args.projectOwnerEmail.trim()
	const signerEmail = args.signerEmail.trim()
	const orgEmail = doconchainOrgEmailFallback()?.trim()

	async function mintWithToken(tokenEmail: string): Promise<string> {
		dc.clearTokenCacheForEmail(tokenEmail)
		const token = await dc.getAccessToken(tokenEmail, { allowOrgFallback: false })
		return dc.getSignLink({
			token,
			projectUuid: args.projectUuid,
			email: signerEmail,
		})
	}

	const tokenCandidates = [ownerEmail, orgEmail].filter(
		(email, index, all): email is string => Boolean(email) && all.indexOf(email) === index
	)
	if (!tokenCandidates.length) {
		throw new Error("ENP or organization email is required to mint DocOnChain sign links")
	}

	let lastError: unknown
	for (let i = 0; i < tokenCandidates.length; i++) {
		try {
			return await mintWithToken(tokenCandidates[i]!)
		} catch (e) {
			lastError = e
			const msg = e instanceof Error ? e.message : String(e)
			const unauthorized = msg.includes("401") || msg.toLowerCase().includes("unauthorized")
			if (!unauthorized || i >= tokenCandidates.length - 1) {
				throw e
			}
		}
	}

	throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

import type { UserProfile } from "@repo/contracts"

export type NotarialCredentialField = {
	label: string
	value: string | null | undefined
}

function nonEmpty(value: string | null | undefined): boolean {
	return typeof value === "string" && value.trim().length > 0
}

/** Fields required for DocOnChain notarial seal + Supreme Court sync reminders. */
export function listNotarialCredentialFields(profile: UserProfile): NotarialCredentialField[] {
	return [
		{ label: "Roll of Attorneys no.", value: profile.rollNumber },
		{ label: "Roll date", value: profile.rollDate },
		{ label: "NPN", value: profile.commissionNumber },
		{ label: "Commission valid until", value: profile.commissionExpiry },
		{ label: "PTR no.", value: profile.ptrNumber },
		{ label: "PTR place", value: profile.ptrLocation },
		{ label: "PTR date", value: profile.ptrDate },
		{ label: "IBP membership no.", value: profile.ibpNumber },
		{ label: "IBP date", value: profile.ibpDate },
		{ label: "MCLE compliance note", value: profile.mclePeriod },
		{ label: "MCLE compliance no.", value: profile.mcleNumber },
		{ label: "MCLE date", value: profile.mcleDate },
		{ label: "Business / notary address", value: profile.officeAddress },
		{
			label: "Commission area",
			value: profile.commissionArea ?? profile.regionProvinceCity,
		},
	]
}

export function missingNotarialCredentialFields(profile: UserProfile): NotarialCredentialField[] {
	return listNotarialCredentialFields(profile).filter(f => !nonEmpty(f.value))
}

export function isNotarialCredentialsComplete(profile: UserProfile): boolean {
	return missingNotarialCredentialFields(profile).length === 0
}

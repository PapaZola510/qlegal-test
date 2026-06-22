import type { UserProfile } from "@repo/contracts"

export type CommissionQualificationsExtras = {
	citizenship: string
	ulasComplianceNumber: string
}

export function buildQualificationsStatement(
	profile: UserProfile,
	extras: CommissionQualificationsExtras
): string {
	const lines = [
		`I, ${profile.name}, hereby state my personal qualifications for an electronic notarial commission:`,
		"",
		`Citizenship: ${extras.citizenship.trim() || "—"}`,
		`Date of birth: — (on government-issued ID)`,
		`Residential address: ${profile.residentialAddress?.trim() || "—"}`,
		`Regular place of work or business: ${profile.officeAddress?.trim() || "—"}`,
		`Telephone / mobile: ${profile.phone?.trim() || "—"}`,
		`Professional Tax Receipt (PTR) number: ${profile.ptrNumber?.trim() || "—"}`,
		`Roll of Attorneys number: ${profile.rollNumber?.trim() || "—"}`,
		`IBP membership number: ${profile.ibpNumber?.trim() || "—"}`,
		`MCLE compliance number: ${profile.mcleNumber?.trim() || "—"}`,
		`ULAS compliance number: ${extras.ulasComplianceNumber.trim() || "—"}`,
		`Email address: ${profile.email}`,
		"",
		"I affirm that the foregoing information is true and correct to the best of my knowledge.",
	]
	return lines.join("\n")
}

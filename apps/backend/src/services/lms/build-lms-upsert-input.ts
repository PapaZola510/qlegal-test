import type { enpProfiles, users } from "@repo/db/schema"

import type { LmsKycStatus, LmsUpsertUserInput } from "./lms.client"

type UserRow = Pick<typeof users.$inferSelect, "id" | "email" | "name">
type EnpRow = Pick<
	typeof enpProfiles.$inferSelect,
	| "firstName"
	| "lastName"
	| "phoneE164"
	| "notaryAddress"
	| "homeStreet"
	| "barangay"
	| "cityProvince"
	| "identityStatus"
	| "identityVerifiedAt"
>

function mapKycStatus(identityStatus: EnpRow["identityStatus"]): LmsKycStatus {
	switch (identityStatus) {
		case "verified":
			return "VERIFIED"
		case "pending":
			return "PENDING"
		case "failed":
			return "REJECTED"
		case "unverified":
		default:
			return "UNVERIFIED"
	}
}

function composeAddress(parts: Array<string | null | undefined>): string | null {
	const cleaned = parts.map(p => p?.trim()).filter((p): p is string => !!p)
	return cleaned.length ? cleaned.join(", ") : null
}

function splitName(full: string): { firstName: string; lastName: string } {
	const trimmed = full.trim()
	if (!trimmed) return { firstName: "", lastName: "" }
	const parts = trimmed.split(/\s+/)
	if (parts.length === 1) return { firstName: parts[0]!, lastName: "" }
	return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") }
}

/**
 * Build draft §1 upsert body from QLegal user + ENP profile rows.
 *
 * **Role:** We send an integration marker role for LMS **audit only**. QLearn must
 * persist the user as a **student** learner and must not create teacher/admin/dean roles from
 * this integration (see product rules for `/integration/users/upsert`).
 */
export function buildLmsUpsertInput(user: UserRow, enp: EnpRow): LmsUpsertUserInput {
	const fallback = splitName(user.name ?? "")
	const firstName = enp.firstName?.trim() || fallback.firstName
	const lastName = enp.lastName?.trim() || fallback.lastName

	return {
		id: user.id,
		email: user.email,
		firstName,
		middleName: null,
		lastName,
		phoneNumber: enp.phoneE164?.trim() ?? null,
		address:
			composeAddress([enp.notaryAddress, enp.homeStreet, enp.barangay, enp.cityProvince]) ??
			enp.notaryAddress?.trim() ??
			null,
		homeStreet: enp.homeStreet?.trim() ?? null,
		barangay: enp.barangay?.trim() ?? null,
		cityProvince: enp.cityProvince?.trim() ?? null,
		// QLearn's current integration sample accepts "PRINCIPAL" for this flow.
		role: "PRINCIPAL",
		kycStatus: mapKycStatus(enp.identityStatus),
		kycVerifiedAt: enp.identityVerifiedAt ? new Date(enp.identityVerifiedAt).toISOString() : null,
	}
}

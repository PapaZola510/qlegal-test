import { isScCommissionStatusBlocked } from "./enp-commission-validation"

export type EnpCommissionRecordStatus = "active" | "expired" | "suspended"

export function deriveEnpCommissionRecordStatus(
	row:
		| {
				certificateStatus: "none" | "certified" | "revoked"
				commissionValidUntil: Date | null
				scCommissionStatus: string | null
		  }
		| undefined
): EnpCommissionRecordStatus {
	if (!row) return "expired"
	if (row.certificateStatus === "revoked") return "suspended"
	if (isScCommissionStatusBlocked(row.scCommissionStatus)) return "suspended"
	const until = row.commissionValidUntil
	if (!until) return "expired"
	return until.getTime() >= Date.now() ? "active" : "expired"
}

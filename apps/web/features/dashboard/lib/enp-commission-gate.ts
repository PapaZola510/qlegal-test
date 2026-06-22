import type { UserProfile } from "@repo/contracts"

export type EnpCommissionGateContext = "confirm" | "join" | "generic"

export function isEnpCommissionBlocked(profile: UserProfile | undefined): boolean {
	return profile?.role === "enp" && profile.commissionValidation?.blocked === true
}

export function enpCommissionBlockedBody(profile: UserProfile): string {
	return (
		profile.commissionValidation?.blockReason ??
		"Your notarial commission is not active. You cannot perform notarial acts until your commission is renewed and your profile is updated."
	)
}

export function enpCommissionGateContextLine(context: EnpCommissionGateContext): string {
	switch (context) {
		case "confirm":
			return "You cannot confirm appointment requests until your notarial commission is active."
		case "join":
			return "You cannot start or join a notarization session until your notarial commission is active."
		default:
			return "Notarial acts are unavailable until your commission is active."
	}
}

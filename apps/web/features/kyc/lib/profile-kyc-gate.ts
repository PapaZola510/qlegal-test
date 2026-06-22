import type { UserProfile } from "@repo/contracts"

export function isProfileKycVerified(status: UserProfile["identityStatus"] | undefined): boolean {
	return status === "verified"
}

export function profileKycGateMessage(
	role: UserProfile["role"],
	context: "booking" | "lobby" | "respond"
): string {
	const isEnp = role === "enp"
	if (context === "booking") {
		return "Verify your identity on your Profile before you can book an appointment with a notary."
	}
	if (context === "respond") {
		return "Verify your identity on your Profile before you can confirm or decline appointment requests."
	}
	if (isEnp) {
		return "Verify your identity on your Profile before you can start or join this session."
	}
	return "Verify your identity on your Profile before you can join this meeting."
}

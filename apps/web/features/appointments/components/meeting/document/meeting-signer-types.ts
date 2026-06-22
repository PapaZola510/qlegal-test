export type SignerParticipant = {
	userId: string
	displayName: string
	email: string
	role: "enp" | "client" | "guest_signer"
}

export type SignerRole = "principal" | "witness"

export function getFullName(p: Pick<SignerParticipant, "displayName">): string {
	return p.displayName.trim() || "Participant"
}

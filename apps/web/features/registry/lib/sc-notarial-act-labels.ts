import type { RegistryActType } from "./fixtures"

/** Registry / meeting act type → Supreme Court notarial register column label. */
const SC_NOTARIAL_ACT_LABELS: Record<RegistryActType, string> = {
	acknowledgment: "Acknowledgment",
	jurat: "Jurat",
	oath: "Affirmation or Oath",
	affidavit: "Jurat",
	certification: "Copy Certification",
	deed_of_sale: "Acknowledgment",
	special_power_of_attorney: "Acknowledgment",
	general_power_of_attorney: "Acknowledgment",
	protest: "Acknowledgment",
	deposition: "Acknowledgment",
	other: "Acknowledgment",
}

export function scNotarialActLabel(actType: RegistryActType): string {
	return SC_NOTARIAL_ACT_LABELS[actType] ?? "Acknowledgment"
}

export function scNotarizationMode(
	sessionMode: "remote" | "in_person" | "hybrid" | null | undefined
): "IEN" | "REN" {
	if (sessionMode === "in_person") return "IEN"
	return "REN"
}

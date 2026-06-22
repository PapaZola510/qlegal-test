import type { Appointment } from "@repo/contracts"

type NotarizationType = Appointment["notarizationType"]

const ALL_ACTS: NotarizationType[] = [
	"acknowledgment",
	"jurat",
	"oath_affirmation",
	"copy_certification",
	"signature_witnessing",
]

/** Acts the ENP may quote — from `directorySpecializations`; empty profile list means all acts. */
export function resolveEnpNotarialActOptions(
	specializations: NotarizationType[] | null | undefined
): NotarizationType[] {
	if (!specializations?.length) return ALL_ACTS
	const allowed = new Set(specializations)
	const filtered = ALL_ACTS.filter(act => allowed.has(act))
	return filtered.length > 0 ? filtered : ALL_ACTS
}

export const NOTARIZATION_TYPE_OPTIONS = [
	{ value: "acknowledgment", label: "Acknowledgment" },
	{ value: "jurat", label: "Jurat" },
	{ value: "oath_affirmation", label: "Oath / Affirmation" },
	{ value: "copy_certification", label: "Copy Certification" },
	{ value: "signature_witnessing", label: "Signature Witnessing" },
] as const

export const SESSION_MODE_OPTIONS = [
	{ value: "remote", label: "Remote (Online)" },
	{ value: "in_person", label: "In-Person" },
	{ value: "hybrid", label: "Hybrid" },
] as const

export type WizardNotarizationType = (typeof NOTARIZATION_TYPE_OPTIONS)[number]["value"]
export type WizardSessionMode = (typeof SESSION_MODE_OPTIONS)[number]["value"]

export const MAX_DOCUMENT_FILES = 10
export const MAX_PROPOSED_SLOTS = 3

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function notarizationLabel(value: string | null | undefined): string {
	if (!value) return "—"
	return NOTARIZATION_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value
}

export function sessionModeLabel(value: string): string {
	return SESSION_MODE_OPTIONS.find(o => o.value === value)?.label ?? value
}

export function formatSlotIso(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso
	return d.toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	})
}

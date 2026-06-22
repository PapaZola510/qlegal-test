import { NOTARIZATION_TYPE_OPTIONS, type NotarizationType } from "@/features/quicksign/lib/fixtures"

/** Same presets as QuickSign upload / create project. */
export type MeetingDocumentTypePreset = NotarizationType

export const MEETING_DOCUMENT_TYPE_PRESETS = NOTARIZATION_TYPE_OPTIONS

/** Legacy meeting uploads (uppercase) before QuickSign alignment. */
const LEGACY_PRESET_LABELS: Record<string, string> = {
	SIGNATURE_WITNESSING: "Signature Witnessing",
	JURAT: "Jurat",
	AFFIRMATION: "Oath / Affirmation",
	OATH_AFFIRMATION: "Oath / Affirmation",
	ACKNOWLEDGMENT: "Acknowledgment",
	COPY_CERTIFICATION: "Copy Certification",
}

export function formatMeetingDocumentType(value: string | undefined): string {
	if (!value?.trim()) return "—"
	const trimmed = value.trim()
	const snake = trimmed.toLowerCase().replace(/\s+/g, "_")
	const fromQuickSign = NOTARIZATION_TYPE_OPTIONS.find(o => o.value === snake)
	if (fromQuickSign) return fromQuickSign.label
	return LEGACY_PRESET_LABELS[trimmed.toUpperCase()] ?? trimmed
}

import type { Appointment } from "@repo/contracts"

export type AppointmentStatus = Appointment["status"]

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
	pending: "Pending",
	quote_sent: "Quote sent",
	confirmed: "Confirmed",
	in_session: "In Session",
	ended: "Ended",
	declined: "Declined",
	cancelled: "Cancelled",
}

export const NOTARIZATION_TYPE_LABELS: Record<Appointment["notarizationType"], string> = {
	acknowledgment: "Acknowledgment",
	jurat: "Jurat",
	oath_affirmation: "Oath / Affirmation",
	copy_certification: "Copy Certification",
	signature_witnessing: "Signature Witnessing",
}

export const SESSION_MODE_LABELS: Record<Appointment["sessionMode"], string> = {
	remote: "Remote",
	in_person: "In-Person",
	hybrid: "Hybrid",
}

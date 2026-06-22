export const EMAIL_ADAPTER = Symbol("EMAIL_ADAPTER")

export type TransactionalEmailTemplate =
	| "welcome"
	| "email_verification_otp"
	| "login_mfa_otp"
	| "exam_pass"
	| "exam_fail"
	| "certificate_issued"
	| "exam_retake_instructions"
	| "appointment_confirmed"
	| "appointment_declined"
	| "quicksign_session_invite"

export interface EmailAdapter {
	sendTransactional(
		to: string,
		template: TransactionalEmailTemplate,
		vars: Record<string, string>
	): Promise<void>

	/** HTML invite for QuickSign hybrid sessions (join lobby + direct signing link). */
	sendQuicksignSessionInvite(
		to: string,
		payload: { subject: string; html: string; text: string }
	): Promise<void>

	/** Sealed notarized PDF attachment for principals and witnesses (not ENP). */
	sendNotarizedPdfDelivery(
		to: string,
		payload: {
			subject: string
			html: string
			text: string
			filename: string
			pdf: Buffer
		}
	): Promise<void>
}

import { Injectable, Logger } from "@nestjs/common"

import { env } from "@/config/env.config"

import type { EmailAdapter, TransactionalEmailTemplate } from "./email-adapter"
import { renderTransactionalEmail } from "./transactional-templates"

const SUBJECTS: Record<TransactionalEmailTemplate, string> = {
	welcome: "Welcome to QLegal",
	login_mfa_otp: "Your QLegal Login Code",
	email_verification_otp: "Verify your email — QLegal Code",
	exam_pass: "Congratulations — you passed the certification exam",
	exam_fail: "Certification exam results",
	certificate_issued: "Your ENP certificate is ready",
	exam_retake_instructions: "Exam retake payment confirmed",
	appointment_confirmed: "Your appointment was confirmed",
	appointment_declined: "Your appointment request was declined",
	quicksign_session_invite: "QuickSign — your notarization session is scheduled",
}

@Injectable()
export class ResendEmailAdapter implements EmailAdapter {
	private readonly log = new Logger(ResendEmailAdapter.name)

	async sendTransactional(
		to: string,
		template: TransactionalEmailTemplate,
		vars: Record<string, string>
	) {
		const key = env.RESEND_API_KEY
		if (!key) {
			this.log.warn("RESEND_API_KEY missing; skipping transactional email")
			return
		}
		const from = env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
		const rendered = renderTransactionalEmail(template, vars, {
			subjectFallback: SUBJECTS[template],
		})
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				from,
				to: [to],
				subject: rendered.subject,
				text: rendered.text,
				...(rendered.html ? { html: rendered.html } : {}),
			}),
		})
		if (!res.ok) {
			const t = await res.text()
			this.log.error(`Resend error ${res.status}: ${t}`)
			throw new Error(`Resend transactional email failed with status ${res.status}`)
		}
	}

	async sendQuicksignSessionInvite(
		to: string,
		payload: { subject: string; html: string; text: string }
	) {
		const key = env.RESEND_API_KEY
		if (!key) {
			this.log.warn("RESEND_API_KEY missing; skipping QuickSign invite email")
			return
		}
		const from = env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				from,
				to: [to],
				subject: payload.subject,
				html: payload.html,
				text: payload.text,
			}),
		})
		if (!res.ok) {
			const t = await res.text()
			this.log.error(`Resend QuickSign invite error ${res.status}: ${t}`)
		}
	}

	async sendNotarizedPdfDelivery(
		to: string,
		payload: {
			subject: string
			html: string
			text: string
			filename: string
			pdf: Buffer
		}
	) {
		const key = env.RESEND_API_KEY
		if (!key) {
			this.log.warn("RESEND_API_KEY missing; skipping notarized PDF email")
			return
		}
		const from = env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev"
		const res = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
			body: JSON.stringify({
				from,
				to: [to],
				subject: payload.subject,
				html: payload.html,
				text: payload.text,
				attachments: [
					{
						filename: payload.filename,
						content: payload.pdf.toString("base64"),
					},
				],
			}),
		})
		if (!res.ok) {
			const t = await res.text()
			this.log.error(`Resend notarized PDF email error ${res.status}: ${t}`)
		}
	}
}

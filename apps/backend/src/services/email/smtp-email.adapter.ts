import { Injectable, Logger } from "@nestjs/common"
import nodemailer from "nodemailer"
import type Mail from "nodemailer/lib/mailer"

import { env } from "@/config/env.config"

import type { EmailAdapter, TransactionalEmailTemplate } from "./email-adapter"
import { isSmtpEmailConfigured, smtpPassword } from "./smtp-config"
import { renderTransactionalEmail } from "./transactional-templates"

const TRANSACTIONAL_SUBJECTS: Record<TransactionalEmailTemplate, string> = {
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
export class SmtpEmailAdapter implements EmailAdapter {
	private readonly log = new Logger(SmtpEmailAdapter.name)
	private transporter: Mail | null = null

	private getTransporter(): Mail {
		if (this.transporter) return this.transporter

		const pass = smtpPassword()
		this.transporter = nodemailer.createTransport({
			host: env.EMAIL_HOST!.trim(),
			port: env.EMAIL_PORT ?? 587,
			secure: false,
			auth: {
				user: env.EMAIL_USER!.trim(),
				pass,
			},
		})
		return this.transporter
	}

	private formatFrom(): string {
		const name = env.EMAIL_FROM_NAME?.trim() || "Quanby Legal"
		const isGmail = env.EMAIL_HOST?.toLowerCase().includes("gmail") ?? false
		// Gmail app passwords require the authenticated mailbox as From.
		const address = isGmail
			? env.EMAIL_USER?.trim() || env.EMAIL_FROM?.trim() || "noreply@localhost"
			: env.EMAIL_FROM?.trim() || env.EMAIL_USER?.trim() || "noreply@localhost"
		return `"${name}" <${address}>`
	}

	private async deliver(
		to: string,
		subject: string,
		text: string,
		opts?: {
			html?: string
			attachments?: Array<{ filename: string; content: Buffer; contentType?: string }>
		}
	) {
		if (!isSmtpEmailConfigured()) {
			this.log.warn(`SMTP not configured; skipping email to ${to}`)
			return
		}

		try {
			const info = await this.getTransporter().sendMail({
				from: this.formatFrom(),
				to,
				subject,
				text,
				...(opts?.html ? { html: opts.html } : {}),
				...(opts?.attachments?.length ? { attachments: opts.attachments } : {}),
			})
			this.log.log(`Email sent to ${to} — ${subject} (${info.messageId ?? "ok"})`)
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			this.log.error(`SMTP failed for ${to}: ${msg}`)
			throw e
		}
	}

	async sendTransactional(
		to: string,
		template: TransactionalEmailTemplate,
		vars: Record<string, string>
	) {
		const rendered = renderTransactionalEmail(template, vars, {
			subjectFallback: TRANSACTIONAL_SUBJECTS[template],
		})
		await this.deliver(
			to,
			rendered.subject,
			rendered.text,
			rendered.html ? { html: rendered.html } : {}
		)
	}

	async sendQuicksignSessionInvite(
		to: string,
		payload: { subject: string; html: string; text: string }
	) {
		await this.deliver(to, payload.subject, payload.text, { html: payload.html })
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
		await this.deliver(to, payload.subject, payload.text, {
			html: payload.html,
			attachments: [
				{
					filename: payload.filename,
					content: payload.pdf,
					contentType: "application/pdf",
				},
			],
		})
	}
}

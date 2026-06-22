import { Injectable, Logger } from "@nestjs/common"

import type { EmailAdapter, TransactionalEmailTemplate } from "./email-adapter"

@Injectable()
export class ConsoleEmailAdapter implements EmailAdapter {
	private readonly log = new Logger(ConsoleEmailAdapter.name)

	async sendTransactional(
		to: string,
		template: TransactionalEmailTemplate,
		vars: Record<string, string>
	) {
		this.log.log(`[email:${template}] to=${to} ${JSON.stringify(vars)}`)
	}

	async sendQuicksignSessionInvite(
		to: string,
		payload: { subject: string; html: string; text: string }
	) {
		this.log.log(`[email:quicksign_session_invite] to=${to} subject=${payload.subject}`)
		this.log.debug(payload.text)
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
		this.log.log(
			`[email:notarized_pdf] to=${to} subject=${payload.subject} attachment=${payload.filename} (${payload.pdf.length} bytes)`
		)
	}
}

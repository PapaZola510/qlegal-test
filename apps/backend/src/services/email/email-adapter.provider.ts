import type { Provider, Type } from "@nestjs/common"

import { env } from "@/config/env.config"

import { ConsoleEmailAdapter } from "./console-email.adapter"
import { EMAIL_ADAPTER, type EmailAdapter } from "./email-adapter"
import { ResendEmailAdapter } from "./resend-email.adapter"
import { isSmtpEmailConfigured } from "./smtp-config"
import { SmtpEmailAdapter } from "./smtp-email.adapter"

export { isSmtpEmailConfigured } from "./smtp-config"

export function resolveEmailAdapterClass(): Type<EmailAdapter> {
	if (env.RESEND_API_KEY?.trim()) return ResendEmailAdapter
	if (isSmtpEmailConfigured()) return SmtpEmailAdapter
	return ConsoleEmailAdapter
}

export function createEmailAdapter(): EmailAdapter {
	const Adapter = resolveEmailAdapterClass()
	return new Adapter()
}

export const emailAdapterProvider: Provider = {
	provide: EMAIL_ADAPTER,
	useClass: resolveEmailAdapterClass(),
}

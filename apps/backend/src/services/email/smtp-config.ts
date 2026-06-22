import { env } from "@/config/env.config"

export function smtpPassword(): string {
	return env.EMAIL_PASS?.trim() || env.EMAIL_PASSWORD?.trim() || ""
}

export function isSmtpEmailConfigured(): boolean {
	return Boolean(env.EMAIL_HOST?.trim() && env.EMAIL_USER?.trim() && smtpPassword())
}

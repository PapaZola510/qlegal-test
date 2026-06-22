import { SetMetadata } from "@nestjs/common"

export const AUDIT_EVENT_KEY = "qlegal:auditEvent"

export interface AuditEventConfig {
	eventType: string
	targetTable?: string
}

export function AuditEvent(config: AuditEventConfig) {
	return SetMetadata(AUDIT_EVENT_KEY, config)
}

export type QlegalRole = "enp" | "client" | "none" | "admin" | "super_admin" | "sub_org_admin"

export interface QlegalSessionContext {
	userId: string
	sessionId: string
	role: QlegalRole
	subOrgIds: string[]
	complianceAuditAccess: boolean
}

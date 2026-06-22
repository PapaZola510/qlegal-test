"use client"

export type AdminUserRole = "admin" | "attorney_enp" | "client" | "staff"
export type AdminUserStatus = "active" | "suspended" | "deleted"

export interface AdminUser {
	id: string
	name: string
	email: string
	role: AdminUserRole
	status: AdminUserStatus
	createdAt: string
	deletedAt: string | null
	hasCertificate: boolean
	certificateRevokedAt: string | null
}

export interface SubOrg {
	id: string
	name: string
	type: string
	memberCount: number
	adminName: string
	createdAt: string
	status: "active" | "inactive"
}

export interface RegistryOversightEntry {
	id: string
	notaryName: string
	totalActs: number
	pendingSync: number
	failedSync: number
	lastActivity: string
	commissionStatus: "active" | "expired" | "suspended"
}

export interface ScSyncEvent {
	id: string
	registryNo: string
	notaryName: string
	status: "synced" | "pending" | "failed" | "retrying"
	attemptCount: number
	lastAttempt: string
	errorMessage: string | null
}

export interface IdentityAuditEntry {
	id: string
	userName: string
	verificationType: "government_id" | "biometric" | "liveness" | "otp"
	result: "passed" | "failed" | "pending"
	timestamp: string
	ipAddress: string
	notes: string
}

export interface PaymentRecord {
	id: string
	userName: string
	description: string
	amount: number
	currency: string
	status: "paid" | "pending" | "failed" | "refunded"
	paidAt: string | null
	createdAt: string
	markedPaidByAdmin: boolean
}

export const ADMIN_ROLE_LABELS: Record<AdminUserRole, string> = {
	admin: "Admin",
	attorney_enp: "ENP (Notary)",
	client: "Client",
	staff: "Staff",
}

export const FIXTURE_ADMIN_USERS: AdminUser[] = [
	{
		id: "u-1",
		name: "Maria Cruz",
		email: "maria.cruz@example.com",
		role: "attorney_enp",
		status: "active",
		createdAt: "2025-11-01",
		deletedAt: null,
		hasCertificate: true,
		certificateRevokedAt: null,
	},
	{
		id: "u-2",
		name: "Juan Dela Cruz",
		email: "juan.dc@example.com",
		role: "client",
		status: "active",
		createdAt: "2026-01-15",
		deletedAt: null,
		hasCertificate: false,
		certificateRevokedAt: null,
	},
	{
		id: "u-3",
		name: "Ana Santos",
		email: "ana.santos@example.com",
		role: "attorney_enp",
		status: "active",
		createdAt: "2025-12-10",
		deletedAt: null,
		hasCertificate: true,
		certificateRevokedAt: null,
	},
	{
		id: "u-4",
		name: "Ricardo Tan",
		email: "ricardo.tan@example.com",
		role: "client",
		status: "deleted",
		createdAt: "2026-02-20",
		deletedAt: "2026-04-15",
		hasCertificate: false,
		certificateRevokedAt: null,
	},
	{
		id: "u-5",
		name: "Carmen Lim",
		email: "carmen.lim@example.com",
		role: "staff",
		status: "active",
		createdAt: "2026-03-01",
		deletedAt: null,
		hasCertificate: false,
		certificateRevokedAt: null,
	},
	{
		id: "u-6",
		name: "Jose Reyes",
		email: "jose.reyes@example.com",
		role: "attorney_enp",
		status: "suspended",
		createdAt: "2025-09-10",
		deletedAt: null,
		hasCertificate: true,
		certificateRevokedAt: "2026-04-01",
	},
	{
		id: "u-7",
		name: "Miguel Garcia",
		email: "miguel.garcia@example.com",
		role: "admin",
		status: "active",
		createdAt: "2025-08-01",
		deletedAt: null,
		hasCertificate: false,
		certificateRevokedAt: null,
	},
]

export const FIXTURE_SUB_ORGS: SubOrg[] = [
	{
		id: "org-1",
		name: "Cruz & Associates Law Office",
		type: "Law Firm",
		memberCount: 12,
		adminName: "Maria Cruz",
		createdAt: "2025-11-01",
		status: "active",
	},
	{
		id: "org-2",
		name: "Santos Notarial Services",
		type: "Notary Office",
		memberCount: 5,
		adminName: "Ana Santos",
		createdAt: "2026-01-10",
		status: "active",
	},
	{
		id: "org-3",
		name: "Reyes Legal Group",
		type: "Law Firm",
		memberCount: 8,
		adminName: "Jose Reyes",
		createdAt: "2025-10-15",
		status: "inactive",
	},
]

export const FIXTURE_REGISTRY_OVERSIGHT: RegistryOversightEntry[] = [
	{
		id: "ro-1",
		notaryName: "Maria Cruz",
		totalActs: 45,
		pendingSync: 2,
		failedSync: 0,
		lastActivity: "2026-04-30",
		commissionStatus: "active",
	},
	{
		id: "ro-2",
		notaryName: "Ana Santos",
		totalActs: 32,
		pendingSync: 1,
		failedSync: 1,
		lastActivity: "2026-04-29",
		commissionStatus: "active",
	},
	{
		id: "ro-3",
		notaryName: "Jose Reyes",
		totalActs: 18,
		pendingSync: 0,
		failedSync: 3,
		lastActivity: "2026-04-20",
		commissionStatus: "expired",
	},
	{
		id: "ro-4",
		notaryName: "Ricardo Tan",
		totalActs: 7,
		pendingSync: 0,
		failedSync: 0,
		lastActivity: "2026-04-25",
		commissionStatus: "active",
	},
]

export const FIXTURE_SC_SYNC_EVENTS: ScSyncEvent[] = [
	{
		id: "sc-1",
		registryNo: "2026-001",
		notaryName: "Maria Cruz",
		status: "synced",
		attemptCount: 1,
		lastAttempt: "2026-04-28 10:15",
		errorMessage: null,
	},
	{
		id: "sc-2",
		registryNo: "2026-002",
		notaryName: "Maria Cruz",
		status: "pending",
		attemptCount: 0,
		lastAttempt: "—",
		errorMessage: null,
	},
	{
		id: "sc-3",
		registryNo: "2026-004",
		notaryName: "Ana Santos",
		status: "failed",
		attemptCount: 3,
		lastAttempt: "2026-04-20 14:33",
		errorMessage: "SC endpoint timeout — server unreachable",
	},
	{
		id: "sc-4",
		registryNo: "2026-007",
		notaryName: "Jose Reyes",
		status: "retrying",
		attemptCount: 2,
		lastAttempt: "2026-04-30 08:00",
		errorMessage: "Connection reset by peer",
	},
	{
		id: "sc-5",
		registryNo: "2026-008",
		notaryName: "Maria Cruz",
		status: "synced",
		attemptCount: 1,
		lastAttempt: "2026-04-10 09:45",
		errorMessage: null,
	},
]

export const FIXTURE_IDENTITY_AUDIT: IdentityAuditEntry[] = [
	{
		id: "ia-1",
		userName: "Juan Dela Cruz",
		verificationType: "government_id",
		result: "passed",
		timestamp: "2026-04-30 10:00",
		ipAddress: "203.0.113.45",
		notes: "Philippine Driver's License verified",
	},
	{
		id: "ia-2",
		userName: "Juan Dela Cruz",
		verificationType: "liveness",
		result: "passed",
		timestamp: "2026-04-30 10:01",
		ipAddress: "203.0.113.45",
		notes: "Facial match confirmed",
	},
	{
		id: "ia-3",
		userName: "Ana Santos",
		verificationType: "biometric",
		result: "failed",
		timestamp: "2026-04-29 14:30",
		ipAddress: "198.51.100.12",
		notes: "Fingerprint mismatch — retry requested",
	},
	{
		id: "ia-4",
		userName: "Ricardo Tan",
		verificationType: "otp",
		result: "passed",
		timestamp: "2026-04-28 09:15",
		ipAddress: "192.0.2.78",
		notes: "SMS OTP verified",
	},
	{
		id: "ia-5",
		userName: "Carmen Lim",
		verificationType: "government_id",
		result: "pending",
		timestamp: "2026-04-30 11:00",
		ipAddress: "203.0.113.99",
		notes: "Awaiting manual review",
	},
]

export const FIXTURE_PAYMENTS: PaymentRecord[] = [
	{
		id: "pay-1",
		userName: "Juan Dela Cruz",
		description: "Notarization — Deed of Sale",
		amount: 500,
		currency: "PHP",
		status: "paid",
		paidAt: "2026-04-28",
		createdAt: "2026-04-28",
		markedPaidByAdmin: false,
	},
	{
		id: "pay-2",
		userName: "Ana Santos",
		description: "Notarization — Affidavit of Loss",
		amount: 300,
		currency: "PHP",
		status: "pending",
		paidAt: null,
		createdAt: "2026-04-29",
		markedPaidByAdmin: false,
	},
	{
		id: "pay-3",
		userName: "Ricardo Tan",
		description: "Notarization — Copy Certification",
		amount: 200,
		currency: "PHP",
		status: "failed",
		paidAt: null,
		createdAt: "2026-04-27",
		markedPaidByAdmin: false,
	},
	{
		id: "pay-4",
		userName: "Carmen Lim",
		description: "Notarization — Contract of Lease",
		amount: 600,
		currency: "PHP",
		status: "paid",
		paidAt: "2026-04-26",
		createdAt: "2026-04-25",
		markedPaidByAdmin: true,
	},
	{
		id: "pay-5",
		userName: "Miguel Garcia",
		description: "Platform Subscription — Monthly",
		amount: 1500,
		currency: "PHP",
		status: "paid",
		paidAt: "2026-04-01",
		createdAt: "2026-04-01",
		markedPaidByAdmin: false,
	},
]

export function getAdminUserKpis() {
	const total = FIXTURE_ADMIN_USERS.length
	const active = FIXTURE_ADMIN_USERS.filter(u => u.status === "active").length
	const deleted = FIXTURE_ADMIN_USERS.filter(u => u.status === "deleted").length
	const suspended = FIXTURE_ADMIN_USERS.filter(u => u.status === "suspended").length
	return { total, active, deleted, suspended }
}

export function getPaymentKpis() {
	const total = FIXTURE_PAYMENTS.reduce((s, p) => s + p.amount, 0)
	const paid = FIXTURE_PAYMENTS.filter(p => p.status === "paid").reduce((s, p) => s + p.amount, 0)
	const pending = FIXTURE_PAYMENTS.filter(p => p.status === "pending").reduce(
		(s, p) => s + p.amount,
		0
	)
	return { total, paid, pending }
}

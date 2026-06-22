import type {
	AccessLogEntry,
	AvRecording,
	CommissionRecord,
	EnbSummary,
	NotarizedDocument,
} from "@repo/contracts"

export const FIXTURE_COMMISSION_RECORDS: CommissionRecord[] = [
	{
		enpUserId: "enp-001",
		enpName: "Atty. Maria Cruz",
		email: "maria.cruz@example.com",
		npnCommissionNo: "NPN-2026-001",
		commissionValidUntil: "2026-12-31T00:00:00.000Z",
		ptrNo: "PTR-88921",
		ibpNo: "IBP-55219",
		notaryAddress: "Makati City, Metro Manila",
		scCommissionStatus: "active",
		commissionStatus: "active",
	},
]

export const FIXTURE_ENBS: EnbSummary[] = [
	{
		enpUserId: "enp-001",
		enpName: "Atty. Maria Cruz",
		bookNo: "ENB-2026-01",
		actCount: 12,
		firstActAt: "2026-01-03T09:00:00.000Z",
		lastActAt: "2026-05-18T10:30:00.000Z",
	},
]

export const FIXTURE_NOTARIZED_DOCUMENTS: NotarizedDocument[] = [
	{
		id: "act-001",
		enpUserId: "enp-001",
		enpName: "Atty. Maria Cruz",
		actNumber: "A-2026-0001",
		actType: "acknowledgment",
		title: "Secretary Certificate",
		bookNo: "ENB-2026-01",
		pageNo: "12",
		executedAt: "2026-05-18T10:30:00.000Z",
		scStatus: "synced",
		hasDocument: true,
		documentFileObjectId: null,
	},
]

export const FIXTURE_AV_RECORDINGS: AvRecording[] = [
	{
		id: "rec-001",
		sessionId: "session-001",
		appointmentId: "appt-001",
		enpUserId: "enp-001",
		enpName: "Atty. Maria Cruz",
		sha256: "8f14e45fceea167a5a36dedd4bea2543f8f14e45fceea167a5a36dedd4bea2543",
		sizeBytes: 84531200,
		mime: "video/webm",
		createdAt: "2026-05-18T10:45:00.000Z",
	},
]

export const FIXTURE_ACCESS_LOG: AccessLogEntry[] = [
	{
		id: "log-001",
		actorUserId: "auditor-001",
		actorRole: "client",
		action: "list_query",
		targetType: "registry_act",
		targetId: null,
		prevHash: null,
		rowHash: "aa0f1c2e3b4d5a69788776655443322110ffeeddbbccaa998877665544332211",
		occurredAt: "2026-05-18T11:00:00.000Z",
	},
	{
		id: "log-002",
		actorUserId: "auditor-001",
		actorRole: "client",
		action: "export",
		targetType: "compliance_export",
		targetId: "export-001",
		prevHash: "aa0f1c2e3b4d5a69788776655443322110ffeeddbbccaa998877665544332211",
		rowHash: "bb0f1c2e3b4d5a69788776655443322110ffeeddbbccaa998877665544332212",
		occurredAt: "2026-05-18T11:05:00.000Z",
	},
]

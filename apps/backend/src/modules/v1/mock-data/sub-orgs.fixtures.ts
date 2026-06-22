const now = new Date().toISOString()
const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString()

export const mockSubOrgs = [
	{
		id: "org_001",
		name: "Santos & Partners Law Office",
		slug: "santos-partners",
		description: "Full-service notarial practice based in Makati City.",
		logoUrl: null,
		memberCount: 3,
		isActive: true,
		createdAt: lastMonth,
		updatedAt: now,
	},
	{
		id: "org_002",
		name: "Garcia Notarial Services",
		slug: "garcia-notarial",
		description: "Solo practitioner office in Quezon City.",
		logoUrl: null,
		memberCount: 1,
		isActive: true,
		createdAt: lastMonth,
		updatedAt: lastMonth,
	},
	{
		id: "org_003",
		name: "Metro Manila Notaries Association",
		slug: "mm-notaries",
		description: "Professional association of notaries in the NCR.",
		logoUrl: null,
		memberCount: 25,
		isActive: false,
		createdAt: lastMonth,
		updatedAt: lastMonth,
	},
]

export const mockSubOrgMembers = [
	{
		id: "mem_001",
		userId: "usr_enp_001",
		subOrgId: "org_001",
		userName: "Atty. Maria Santos",
		userEmail: "maria.santos@example.com",
		role: "admin" as const,
		joinedAt: lastMonth,
	},
	{
		id: "mem_002",
		userId: "usr_enp_003",
		subOrgId: "org_002",
		userName: "Atty. Rosa Garcia",
		userEmail: "rosa.garcia@example.com",
		role: "admin" as const,
		joinedAt: lastMonth,
	},
]

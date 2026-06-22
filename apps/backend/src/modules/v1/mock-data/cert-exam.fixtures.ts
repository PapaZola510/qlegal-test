const now = new Date().toISOString()
const yesterday = new Date(Date.now() - 86400000).toISOString()
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString()
const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString()

export const mockExams = [
	{
		id: "exam_001",
		title: "Notarial Practice Certification Exam",
		description: "Comprehensive exam covering notarial law, procedures, and ethics.",
		durationMinutes: 120,
		passingScore: 75,
		totalQuestions: 50,
		isActive: true,
	},
	{
		id: "exam_002",
		title: "E-Notarization Technology Proficiency",
		description: "Assessment of skills needed for electronic notarization platforms.",
		durationMinutes: 60,
		passingScore: 80,
		totalQuestions: 30,
		isActive: true,
	},
]

export const mockExamAttempts = [
	{
		id: "attempt_001",
		examId: "exam_001",
		userId: "usr_enp_001",
		status: "submitted" as const,
		score: 92,
		startedAt: lastMonth,
		completedAt: lastMonth,
		expiresAt: null,
		answers: null,
		createdAt: lastMonth,
		updatedAt: lastMonth,
	},
	{
		id: "attempt_002",
		examId: "exam_001",
		userId: "usr_enp_002",
		status: "submitted" as const,
		score: 58,
		startedAt: lastWeek,
		completedAt: lastWeek,
		expiresAt: null,
		answers: null,
		createdAt: lastWeek,
		updatedAt: lastWeek,
	},
	{
		id: "attempt_003",
		examId: "exam_002",
		userId: "usr_enp_002",
		status: "in_progress" as const,
		score: null,
		startedAt: yesterday,
		completedAt: null,
		expiresAt: new Date(Date.now() + 3600000).toISOString(),
		answers: null,
		createdAt: yesterday,
		updatedAt: now,
	},
	{
		id: "attempt_004",
		examId: "exam_001",
		userId: "usr_enp_003",
		status: "expired" as const,
		score: null,
		startedAt: lastMonth,
		completedAt: null,
		expiresAt: lastWeek,
		answers: null,
		createdAt: lastMonth,
		updatedAt: lastWeek,
	},
	{
		id: "attempt_005",
		examId: "exam_001",
		userId: "usr_enp_004",
		status: "abandoned" as const,
		score: null,
		startedAt: lastWeek,
		completedAt: null,
		expiresAt: new Date(Date.now() + 7200000).toISOString(),
		answers: null,
		createdAt: lastWeek,
		updatedAt: lastWeek,
	},
]

export const mockExamQuestions = [
	{
		id: "q_001",
		questionText: "What is the primary purpose of notarization?",
		choices: [
			{ key: "a", text: "To authenticate a document" },
			{ key: "b", text: "To provide legal advice" },
			{ key: "c", text: "To draft contracts" },
			{ key: "d", text: "To represent in court" },
		],
		order: 1,
	},
	{
		id: "q_002",
		questionText: "Which of the following requires a notarized document in the Philippines?",
		choices: [
			{ key: "a", text: "Grocery receipt" },
			{ key: "b", text: "Deed of sale for real property" },
			{ key: "c", text: "Personal letter" },
			{ key: "d", text: "Social media post" },
		],
		order: 2,
	},
	{
		id: "q_003",
		questionText: "What must a notary public verify before notarizing?",
		choices: [
			{ key: "a", text: "The document font size" },
			{ key: "b", text: "Identity of the signatory" },
			{ key: "c", text: "The paper quality" },
			{ key: "d", text: "The ink color" },
		],
		order: 3,
	},
]

export interface ExamQuestion {
	id: number
	text: string
	options: string[]
	correctIndex: number
}

export interface ExamSection {
	id: number
	title: string
	questions: ExamQuestion[]
}

export const EXAM_SECTIONS: ExamSection[] = [
	{
		id: 1,
		title: "Notarial Practice Fundamentals",
		questions: Array.from({ length: 10 }, (_, i) => ({
			id: i + 1,
			text: `Sample question ${i + 1} about notarial practice fundamentals and Philippine notarial law.`,
			options: [
				"The notary must personally know the affiant",
				"A competent evidence of identity is required",
				"Both A and B are correct",
				"None of the above",
			],
			correctIndex: 2,
		})),
	},
	{
		id: 2,
		title: "Document Authentication",
		questions: Array.from({ length: 10 }, (_, i) => ({
			id: i + 11,
			text: `Sample question ${i + 1} regarding document authentication procedures and requirements.`,
			options: ["Acknowledgment", "Jurat", "Oath or Affirmation", "Copy Certification"],
			correctIndex: 0,
		})),
	},
	{
		id: 3,
		title: "Legal Ethics for Notaries",
		questions: Array.from({ length: 10 }, (_, i) => ({
			id: i + 21,
			text: `Sample question ${i + 1} about ethical obligations and professional conduct of electronic notaries.`,
			options: [
				"Disclosure of conflict of interest",
				"Maintaining a notarial journal",
				"Refusing unauthorized acts",
				"All of the above",
			],
			correctIndex: 3,
		})),
	},
	{
		id: 4,
		title: "Digital Signature & E-Notarization",
		questions: Array.from({ length: 10 }, (_, i) => ({
			id: i + 31,
			text: `Sample question ${i + 1} covering digital signatures, e-notarization technology, and compliance.`,
			options: [
				"PKI-based digital certificate",
				"Handwritten signature scan",
				"Email confirmation",
				"Verbal agreement",
			],
			correctIndex: 0,
		})),
	},
	{
		id: 5,
		title: "Regulatory Compliance",
		questions: Array.from({ length: 10 }, (_, i) => ({
			id: i + 41,
			text: `Sample question ${i + 1} on regulatory frameworks, reporting requirements, and compliance standards.`,
			options: [
				"Supreme Court guidelines",
				"DOJ circular",
				"Both A and B",
				"Local government ordinance only",
			],
			correctIndex: 2,
		})),
	},
]

export const EXAM_TIME_LIMIT_MINUTES = 60
export const EXAM_WARNING_MINUTES = 5
export const PASSING_SCORE_PERCENT = 70

export interface ExamResult {
	totalQuestions: number
	correctAnswers: number
	scorePercent: number
	passed: boolean
	sectionScores: { sectionId: number; correct: number; total: number }[]
}

export function computeMockResult(passed: boolean): ExamResult {
	const correct = passed ? 42 : 28
	return {
		totalQuestions: 50,
		correctAnswers: correct,
		scorePercent: (correct / 50) * 100,
		passed,
		sectionScores: EXAM_SECTIONS.map(s => ({
			sectionId: s.id,
			correct: passed ? Math.floor(Math.random() * 3) + 7 : Math.floor(Math.random() * 5) + 3,
			total: 10,
		})),
	}
}

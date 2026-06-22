import { oc } from "@orpc/contract"
import { z } from "zod"

import {
	ExamAttemptSchema,
	ExamQuestionSchema,
	ExamResultSchema,
	ExamSchema,
	ResumeExamInputSchema,
	ResumeExamOutputSchema,
	StartExamInputSchema,
	StartExamResponseSchema,
	SubmitExamInputSchema,
	SubmitExamSectionInputSchema,
	SubmitExamSectionResponseSchema,
} from "./cert-exam.schema.js"

export const certExamContract = {
	listExams: oc
		.route({
			method: "GET",
			path: "/cert-exam/exams",
			summary: "List available certification exams",
			tags: ["Certification Exam"],
		})
		.output(z.array(ExamSchema)),

	getAttempts: oc
		.route({
			method: "GET",
			path: "/cert-exam/attempts",
			summary: "Get user exam attempts",
			tags: ["Certification Exam"],
		})
		.output(z.array(ExamAttemptSchema)),

	startExam: oc
		.route({
			method: "POST",
			path: "/cert-exam/start",
			summary: "Start an exam attempt (section 1 questions)",
			tags: ["Certification Exam"],
		})
		.input(StartExamInputSchema)
		.output(StartExamResponseSchema),

	submitSection: oc
		.route({
			method: "POST",
			path: "/cert-exam/submit-section",
			summary: "Submit answers for one section; final section returns graded result",
			tags: ["Certification Exam"],
		})
		.input(SubmitExamSectionInputSchema)
		.output(SubmitExamSectionResponseSchema),

	resumeExam: oc
		.route({
			method: "POST",
			path: "/cert-exam/resume",
			summary: "Resume an in-progress attempt once using the resume token",
			tags: ["Certification Exam"],
		})
		.input(ResumeExamInputSchema)
		.output(ResumeExamOutputSchema),

	submitExam: oc
		.route({
			method: "POST",
			path: "/cert-exam/submit",
			summary: "Submit all answers at once (legacy path; prefer submit-section)",
			tags: ["Certification Exam"],
		})
		.input(SubmitExamInputSchema)
		.output(ExamResultSchema),

	devPerfectExam: oc
		.route({
			method: "POST",
			path: "/cert-exam/dev-perfect",
			summary: "DEV ONLY: submit a perfect score for testing (requires CERT_EXAM_DEV_ASSIST)",
			tags: ["Certification Exam"],
		})
		.input(StartExamInputSchema)
		.output(ExamResultSchema),
}

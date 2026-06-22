import { z } from "zod"

import { ExamAttemptStatusEnum } from "../shared/enums.js"
import { TimestampFields } from "../shared/schemas.js"

export const ExamSchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string(),
	durationMinutes: z.number().int().positive(),
	passingScore: z.number().int().min(0).max(100),
	totalQuestions: z.number().int().positive(),
	sectionCount: z.number().int().positive(),
	questionsPerSection: z.number().int().positive(),
	isActive: z.boolean(),
})

export const ExamAttemptSchema = z.object({
	id: z.string(),
	examId: z.string(),
	userId: z.string(),
	status: ExamAttemptStatusEnum,
	score: z.number().nullable(),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	expiresAt: z.string().nullable(),
	sectionsCompleted: z.number().int().min(0).max(10),
	answers: z.record(z.string(), z.string()).nullable(),
	...TimestampFields,
})

export const ExamQuestionSchema = z.object({
	id: z.string(),
	questionText: z.string(),
	choices: z.array(z.object({ key: z.string(), text: z.string() })),
	order: z.number().int(),
	sectionIndex: z.number().int().positive(),
})

export const StartExamInputSchema = z.object({
	examId: z.string(),
})

export const StartExamResponseSchema = z.object({
	attempt: ExamAttemptSchema,
	questions: z.array(ExamQuestionSchema),
	/** One-time token for resume-once grace; store client-side until exam completes */
	resumeToken: z.string(),
})

export const SubmitExamInputSchema = z.object({
	attemptId: z.string(),
	answers: z.record(z.string(), z.string()),
})

export const ExamResultBreakdownItemSchema = z.object({
	questionId: z.string(),
	promptPreview: z.string(),
	selectedKey: z.string(),
	correctKey: z.string(),
	correct: z.boolean(),
})

export const ExamResultSchema = z.object({
	attemptId: z.string(),
	status: ExamAttemptStatusEnum,
	score: z.number(),
	passed: z.boolean(),
	totalQuestions: z.number(),
	correctAnswers: z.number(),
	breakdown: z.array(ExamResultBreakdownItemSchema),
})

export const SubmitExamSectionInputSchema = z.object({
	attemptId: z.string(),
	sectionIndex: z.number().int().min(1).max(10),
	answers: z.record(z.string(), z.string()),
})

export const SubmitExamSectionResponseSchema = z.object({
	nextQuestions: z.array(ExamQuestionSchema).nullable(),
	result: ExamResultSchema.nullable(),
})

export const ResumeExamInputSchema = z.object({
	attemptId: z.string(),
	resumeToken: z.string().min(16),
})

export const ResumeExamOutputSchema = z.object({
	expiresAt: z.string(),
})

export type Exam = z.infer<typeof ExamSchema>
export type ExamAttempt = z.infer<typeof ExamAttemptSchema>
export type ExamQuestion = z.infer<typeof ExamQuestionSchema>
export type ExamResult = z.infer<typeof ExamResultSchema>

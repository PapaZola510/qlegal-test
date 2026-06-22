import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { orpc, orpcClient } from "@/services/orpc/client"

/** Minimal shape from GET /cert-exam/exams */
export interface CertExamSummary {
	id: string
	title: string
	durationMinutes: number
	passingScore: number
	totalQuestions: number
	sectionCount: number
	questionsPerSection: number
	isActive: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = orpc as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = orpcClient as any

export function useCertExamsQuery() {
	return useQuery({
		...api.certExam.listExams.queryOptions(),
		staleTime: 60 * 1000,
	})
}

export function useCertExamAttemptsQuery() {
	return useQuery({
		...api.certExam.getAttempts.queryOptions(),
		staleTime: 30 * 1000,
	})
}

export function useStartCertExamMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: { examId: string }) => rpc.certExam.startExam(input) as Promise<unknown>,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.certExam.getAttempts.queryOptions().queryKey,
			})
		},
	})
}

export function useSubmitCertExamSectionMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: {
			attemptId: string
			sectionIndex: number
			answers: Record<string, string>
		}) => rpc.certExam.submitSection(input) as Promise<unknown>,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.certExam.getAttempts.queryOptions().queryKey,
			})
		},
	})
}

export function useDevPerfectCertExamMutation() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: { examId: string }) =>
			rpc.certExam.devPerfectExam(input) as Promise<unknown>,
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: api.certExam.getAttempts.queryOptions().queryKey,
			})
			void queryClient.invalidateQueries({ queryKey: api.authProfile.me.queryOptions().queryKey })
			void queryClient.invalidateQueries({
				queryKey: api.onboarding.progress.queryOptions().queryKey,
			})
		},
	})
}

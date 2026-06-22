import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import type { TemplateId } from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const api = orpc as any

/** Load the saved draft for a given template from the database. Returns null if no draft yet. */
export function useLegalTemplateDraftQuery(templateId: TemplateId) {
	return useQuery(
		api.legalTemplates.getDraft.queryOptions({
			input: { templateId },
			staleTime: 30 * 1000,
		})
	)
}

/** Upsert (save) the current form data to the database. */
export function useUpsertLegalTemplateDraftMutation() {
	const queryClient = useQueryClient()
	type UpsertDraftInput = { templateId: TemplateId; data: Record<string, unknown> }

	return useMutation<unknown, Error, UpsertDraftInput>({
		mutationFn: async (input: UpsertDraftInput) =>
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			(orpcClient as any).legalTemplates.upsertDraft(input),
		onSuccess: (_result, variables) => {
			void queryClient.invalidateQueries({
				queryKey: [
					...api.legalTemplates.getDraft.key(),
					{ input: { templateId: variables.templateId } },
				],
			})
		},
	})
}

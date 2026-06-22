import { useMutation, useQuery } from "@tanstack/react-query"

import type { InviteSessionGuestInput, LobbyCheckResult } from "@repo/contracts"

import { orpc, orpcClient } from "@/services/orpc/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- oRPC OpenAPI client inference gap
const api = orpc as any

export function useLobbyCheckQuery(input: {
	appointmentId: string
	guestInviteToken?: string
	enabled?: boolean
}) {
	return useQuery<LobbyCheckResult>({
		...api.session.lobbyCheck.queryOptions({
			input: {
				appointmentId: input.appointmentId,
				guestInviteToken: input.guestInviteToken,
			},
		}),
		enabled: Boolean(input.appointmentId) && (input.enabled ?? true),
		staleTime: 10 * 1000,
		retry: false,
	})
}

export function useInviteSessionGuestMutation() {
	return useMutation({
		mutationFn: async (payload: InviteSessionGuestInput) =>
			(
				orpcClient as {
					session: { inviteSessionGuest: (p: InviteSessionGuestInput) => Promise<unknown> }
				}
			).session.inviteSessionGuest(payload),
	})
}

export function useIssueGuestJoinTokenMutation() {
	return useMutation({
		mutationFn: async (input: { appointmentId: string; guestInviteToken: string }) =>
			(
				orpcClient as {
					session: {
						issueGuestJoinToken: (p: {
							appointmentId: string
							guestInviteToken: string
						}) => Promise<unknown>
					}
				}
			).session.issueGuestJoinToken(input),
	})
}

export function lobbyCheckErrorMessage(result: LobbyCheckResult | undefined): string | null {
	if (!result || result.kind === "ok") return null
	switch (result.kind) {
		case "unauthenticated":
			return "Sign in to continue."
		case "not_found":
			return "This session could not be found."
		case "forbidden":
			return "You do not have access to this session."
		case "wrong_status":
			return "This session is not active yet. Ask the notary to start the meeting."
		case "session_ended":
			return "This session has ended."
		case "identity_required":
			return "detail" in result ? result.detail : "Complete identity verification before joining."
		case "guest_requires_google":
			return "Sign in with Google (or create an account using Google) to join as a guest."
		case "guest_invite_invalid":
			return "This invite link is invalid. Ask the notary for a new link."
		case "guest_invite_expired":
			return "This invite link has expired. Ask the notary for a new link."
		default:
			return "Unable to join this session."
	}
}

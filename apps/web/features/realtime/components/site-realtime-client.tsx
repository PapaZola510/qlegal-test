"use client"

import { useEffect } from "react"

import { authClient } from "@/services/better-auth/auth-client"
import { destroyQlegalSocket, ensureQlegalSocketConnected } from "@/services/ws/ws-client"

/**
 * Keeps a single authenticated WebSocket per browser tab for `/events`.
 * Mounted from the authenticated `(site)` layout only.
 */
export function SiteRealtimeClient() {
	const { data: session, isPending } = authClient.useSession()

	useEffect(() => {
		if (isPending) {
			return
		}
		if (!session?.user?.id) {
			destroyQlegalSocket()
			return
		}
		ensureQlegalSocketConnected()
		return () => {
			destroyQlegalSocket()
		}
	}, [isPending, session?.user?.id])

	return null
}

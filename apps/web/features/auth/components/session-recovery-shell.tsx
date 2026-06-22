"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"

import { Spinner } from "@/core/components/ui/spinner"
import { sessionOptions } from "@/features/auth/api/session.hooks"

/**
 * Shown when the browser still has auth cookies but the API was briefly unreachable
 * (e.g. after `pnpm dev` restarts). Avoids treating that as a logout.
 */
export function SessionRecoveryShell({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const sessionQ = useQuery({
		...sessionOptions,
		retry: 12,
		retryDelay: attempt => Math.min(400 * attempt, 3_000),
		refetchInterval: 2_000,
	})

	React.useEffect(() => {
		if (sessionQ.data?.user) {
			router.refresh()
		}
	}, [router, sessionQ.data?.user])

	return (
		<div className="flex min-h-screen flex-col">
			<div className="bg-muted/40 border-b px-4 py-2">
				<div className="mx-auto flex max-w-7xl items-center gap-2 text-sm">
					<Spinner className="size-4" />
					<span className="text-muted-foreground">
						Reconnecting your session while the server restarts…
					</span>
				</div>
			</div>
			<main className="flex flex-1 flex-col opacity-60">{children}</main>
		</div>
	)
}

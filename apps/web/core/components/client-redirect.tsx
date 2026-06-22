"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { LoadingState } from "@/core/components/shared-states"

interface ClientRedirectProps {
	to: string
}

/**
 * A safe, client-side redirect component that triggers a standard, stable route
 * transition on mount. Avoids Next.js Server Action redirect exceptions
 * that can cause React hook order mismatches (Error #310) during client-side transitions.
 */
export function ClientRedirect({ to }: ClientRedirectProps) {
	const router = useRouter()

	React.useEffect(() => {
		router.replace(to)
	}, [router, to])

	return (
		<div className="flex min-h-[50vh] items-center justify-center">
			<LoadingState message="Redirecting securely…" />
		</div>
	)
}

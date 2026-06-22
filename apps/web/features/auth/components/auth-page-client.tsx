"use client"

import * as React from "react"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

import { FullPageSocialAuth } from "@/features/auth/components/full-page-social-auth"
import {
	readPostLoginRedirectFromQuery,
	savePostLoginRedirect,
} from "@/features/auth/lib/post-login-redirect"

interface AuthPageClientProps {
	mode: "login" | "register"
	/** Parsed on the server from `?redirect=` so login/register SSR without a Suspense fallback. */
	postAuthRedirectPath?: string | null
}

/** Syncs `?redirect=` when the user navigates client-side (tabs / in-app links). */
function PostLoginRedirectSync() {
	const searchParams = useSearchParams()
	const postAuthRedirectPath = readPostLoginRedirectFromQuery(searchParams)

	React.useEffect(() => {
		if (postAuthRedirectPath) savePostLoginRedirect(postAuthRedirectPath)
	}, [postAuthRedirectPath])

	return null
}

export function AuthPageClient({ mode, postAuthRedirectPath = null }: AuthPageClientProps) {
	return (
		<>
			<FullPageSocialAuth mode={mode} postAuthRedirectPath={postAuthRedirectPath} />
			<Suspense fallback={null}>
				<PostLoginRedirectSync />
			</Suspense>
		</>
	)
}

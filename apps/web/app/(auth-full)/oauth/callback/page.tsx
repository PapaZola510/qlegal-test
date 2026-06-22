import type { Metadata } from "next"

import { OAuthCallbackClient } from "@/features/auth/components/oauth-callback-client"

export const metadata: Metadata = {
	title: "Signing in",
}

export default function OAuthCallbackPage() {
	return <OAuthCallbackClient />
}

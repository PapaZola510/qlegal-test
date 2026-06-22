import type { Metadata } from "next"

import { VerifyEmailClient } from "@/features/auth/components/verify-email-client"

export const metadata: Metadata = {
	title: "Verify Email",
}

export default function VerifyEmailPage() {
	return <VerifyEmailClient />
}

import type { Metadata } from "next"

import { EmailMfaClient } from "@/features/auth/components/email-mfa-client"

export const metadata: Metadata = {
	title: "Multi‑factor Authentication",
}

export default function MfaPage() {
	return <EmailMfaClient />
}

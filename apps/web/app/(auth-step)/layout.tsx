import { redirect } from "next/navigation"

import { resolveProtectedSession } from "@/services/better-auth/auth-server"
import { SessionRecoveryShell } from "@/features/auth/components/session-recovery-shell"

/**
 * Layout for in-flight auth steps (MFA, email verification). Renders a
 * full-page shell without the site navigation so users cannot bypass the
 * step by clicking around. Unauthenticated visitors are sent to /login.
 */
export default async function AuthStepLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const auth = await resolveProtectedSession()

	if (auth.kind === "unauthenticated") {
		redirect("/login")
	}

	if (auth.kind === "recoverable") {
		return (
			<div className="min-h-dvh">
				<SessionRecoveryShell>{children}</SessionRecoveryShell>
			</div>
		)
	}

	return <div className="min-h-dvh">{children}</div>
}

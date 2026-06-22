import { redirect } from "next/navigation"

import { resolveProtectedSession } from "@/services/better-auth/auth-server"
import { SessionRecoveryShell } from "@/features/auth/components/session-recovery-shell"
import { TermsAcceptanceModal } from "@/features/auth/components/terms-acceptance-modal"
import { loadEmailMfaStatus } from "@/features/auth/server/load-email-mfa-status"
import { loadTermsStatus } from "@/features/auth/server/load-terms-status"
import { SiteChrome } from "@/features/navigation/components/site-chrome"
import { SiteNavServer } from "@/features/navigation/components/site-nav-server"

export default async function SiteLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const auth = await resolveProtectedSession()

	if (auth.kind === "unauthenticated") {
		redirect("/")
	}

	// Enforce MFA for every login session (backend guard will also block API calls).
	if (auth.kind === "authenticated") {
		const mfa = await loadEmailMfaStatus()
		if (mfa && mfa.mfaVerified === false) {
			redirect("/mfa")
		}
	}

	// Check if the user has accepted T&C (only for fully authenticated sessions).
	const needsTermsAcceptance =
		auth.kind === "authenticated" ? (await loadTermsStatus()) === false : false

	const shell = (
		<SiteChrome>
			<SiteNavServer>{children}</SiteNavServer>
			{needsTermsAcceptance && <TermsAcceptanceModal />}
		</SiteChrome>
	)

	if (auth.kind === "recoverable") {
		return (
			<div className="flex min-h-screen flex-col">
				<SessionRecoveryShell>{shell}</SessionRecoveryShell>
			</div>
		)
	}

	return <div className="flex min-h-screen flex-col">{shell}</div>
}

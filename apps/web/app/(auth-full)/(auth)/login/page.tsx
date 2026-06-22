import { AuthPageClient } from "@/features/auth/components/auth-page-client"
import { readPostLoginRedirectFromQuery } from "@/features/auth/lib/post-login-redirect"

interface LoginPageProps {
	searchParams: Promise<{ redirect?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
	const params = await searchParams
	const redirectParam = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect
	const query = new URLSearchParams()
	if (redirectParam) query.set("redirect", redirectParam)

	return (
		<AuthPageClient mode="login" postAuthRedirectPath={readPostLoginRedirectFromQuery(query)} />
	)
}

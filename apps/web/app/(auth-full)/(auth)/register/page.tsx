import { AuthPageClient } from "@/features/auth/components/auth-page-client"
import { readPostLoginRedirectFromQuery } from "@/features/auth/lib/post-login-redirect"

interface RegisterPageProps {
	searchParams: Promise<{ redirect?: string | string[] }>
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
	const params = await searchParams
	const redirectParam = Array.isArray(params.redirect) ? params.redirect[0] : params.redirect
	const query = new URLSearchParams()
	if (redirectParam) query.set("redirect", redirectParam)

	return (
		<AuthPageClient mode="register" postAuthRedirectPath={readPostLoginRedirectFromQuery(query)} />
	)
}

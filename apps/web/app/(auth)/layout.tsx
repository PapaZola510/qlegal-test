import Link from "next/link"

import { Logo } from "@/core/components/logo"
import { getSession } from "@/services/better-auth/auth-server"
import { SiteNavServer } from "@/features/navigation/components/site-nav-server"

export default async function AuthLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	const session = await getSession()
	const year = new Date().getFullYear()

	if (session) {
		return <SiteNavServer>{children}</SiteNavServer>
	}

	return (
		<div className="bg-background relative flex min-h-screen flex-col overflow-hidden">
			{/* Soft ambient backdrop — primary tint, very low opacity */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10"
				style={{
					backgroundImage:
						"radial-gradient(60rem 40rem at 80% -10%, var(--color-primary) 0%, transparent 65%), radial-gradient(50rem 35rem at -10% 110%, var(--color-primary) 0%, transparent 60%)",
					opacity: 0.06,
				}}
			/>
			{/* Subtle grid texture */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
				style={{
					backgroundImage:
						"linear-gradient(to right, var(--color-border) 1px, transparent 1px), linear-gradient(to bottom, var(--color-border) 1px, transparent 1px)",
					backgroundSize: "44px 44px",
					opacity: 0.18,
				}}
			/>

			<div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:py-8">
				<header className="flex items-center justify-between">
					<Logo href="/" size="default" />
				</header>
				<main className="flex flex-1 flex-col items-center justify-center py-10">{children}</main>
				<footer className="text-muted-foreground flex flex-wrap items-center justify-between gap-3 pt-6 text-xs">
					<span>© {year} Quanby Legal. All rights reserved.</span>
					<Link
						href="/session"
						className="underline-offset-4 opacity-50 hover:underline hover:opacity-100"
					>
						Session debugger
					</Link>
				</footer>
			</div>
		</div>
	)
}

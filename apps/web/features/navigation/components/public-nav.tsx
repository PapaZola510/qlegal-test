"use client"

import type { Route } from "next"
import Link from "next/link"

import { Logo } from "@/core/components/logo"
import { buttonVariants } from "@/core/components/ui/button"
import { LandingAdminLoginDialog } from "@/features/landing/components/landing-admin-login-dialog"
import { LandingSuperAdminLoginDialog } from "@/features/landing/components/landing-super-admin-login-dialog"

export interface PublicNavUser {
	name: string
	email?: string
}

export function PublicNav({ user }: { user: PublicNavUser | null }) {
	return (
		<header className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
			<div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
				<Logo href="/" size="default" text="Quanby Legal" />
				<div className="ml-auto flex items-center gap-2 sm:gap-3">
					{user ? (
						<>
							<span
								className="text-muted-foreground max-w-[min(160px,38vw)] truncate text-xs sm:max-w-[min(280px,40vw)] sm:text-sm"
								title={user.name}
							>
								{user.name}
							</span>
							<Link href={"/dashboard" as Route} className={buttonVariants({ size: "sm" })}>
								Dashboard
							</Link>
						</>
					) : (
						<>
							<Link
								href={"/verify/document" as Route}
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Verify document
							</Link>
							<Link
								href={"/login" as Route}
								className={buttonVariants({ variant: "ghost", size: "sm" })}
							>
								Sign In
							</Link>
							<Link href={"/register" as Route} className={buttonVariants({ size: "sm" })}>
								Get Started
							</Link>
							<LandingAdminLoginDialog />
							<LandingSuperAdminLoginDialog />
						</>
					)}
				</div>
			</div>
		</header>
	)
}

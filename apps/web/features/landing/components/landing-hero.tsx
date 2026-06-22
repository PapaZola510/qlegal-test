"use client"

import type { Route } from "next"
import Link from "next/link"

import { buttonVariants } from "@/core/components/ui/button"

interface LandingHeroProps {
	isLoggedIn: boolean
	userName?: string
	isAdmin?: boolean
}

export function LandingHero({ isLoggedIn, userName, isAdmin }: LandingHeroProps) {
	return (
		<section className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-24 text-center">
			<div className="flex flex-col items-center gap-4">
				{isLoggedIn && userName && (
					<p className="text-muted-foreground text-lg">
						Welcome back, <span className="font-semibold">{userName}</span>
					</p>
				)}
				<h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
					Legal services, simplified.
				</h1>
				<p className="text-muted-foreground max-w-2xl text-lg md:text-xl">
					Notarization, e-signatures, and document management — all in one platform built for
					attorneys, electronic notary publics, and their clients.
				</p>
			</div>

			<div className="flex flex-wrap items-center justify-center gap-3">
				{isLoggedIn ? (
					<>
						<Link href={"/dashboard" as Route} className={buttonVariants({ size: "lg" })}>
							Go to Dashboard
						</Link>
						{isAdmin && (
							<Link
								href={"/admin" as Route}
								className={buttonVariants({ variant: "outline", size: "lg" })}
							>
								Admin panel
							</Link>
						)}
					</>
				) : (
					<>
						<Link href={"/register" as Route} className={buttonVariants({ size: "lg" })}>
							Get Started
						</Link>
						<Link
							href={"/login" as Route}
							className={buttonVariants({ variant: "outline", size: "lg" })}
						>
							Sign In
						</Link>
					</>
				)}
			</div>
		</section>
	)
}

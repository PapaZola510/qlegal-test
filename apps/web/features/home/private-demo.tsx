"use client"

import type { Route } from "next"
import Link from "next/link"

import { buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

export function PrivateDemo() {
	return (
		<section id="request-demo" className="relative overflow-hidden py-20 lg:py-28">
			<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<div className="bg-background rounded-lg border p-10 text-center shadow-sm lg:p-14">
					<h2 className="text-3xl font-bold tracking-tight lg:text-5xl">
						Request a private walkthrough
					</h2>
					<p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
						Create an account to explore the client and ENP workflows with your team.
					</p>
					<div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
						<Link
							href={"/register" as Route}
							className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
						>
							Create account
						</Link>
						<Link
							href={"/login" as Route}
							className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
						>
							Sign in
						</Link>
					</div>
				</div>
			</div>
		</section>
	)
}

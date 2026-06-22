"use client"

import type { Route } from "next"
import Link from "next/link"
import { Calendar03Icon, CustomerService01Icon, FileSearchIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { buttonVariants } from "@/core/components/ui/button"
import { Card } from "@/core/components/ui/card"
import { cn } from "@/core/lib/utils"
import { MotionEffect } from "@/features/home/ui/motion-effect"

const actions = [
	{
		icon: FileSearchIcon,
		title: "I need an ENP",
		description: "Find a notary, upload documents, and request review before scheduling.",
		href: "/find-notary",
		label: "Find a notary",
	},
	{
		icon: Calendar03Icon,
		title: "I am a lawyer",
		description: "Apply for ENP commission workflows and manage online notarization sessions.",
		href: "/register",
		label: "Create account",
	},
	{
		icon: CustomerService01Icon,
		title: "I have a question",
		description: "Sign in or create an account to message, book, and manage your documents.",
		href: "/login",
		label: "Sign in",
	},
]

export function CTA() {
	return (
		<section id="contact-us" className="relative overflow-hidden py-20 lg:py-28">
			<div className="from-primary/10 via-background absolute inset-0 bg-linear-to-br to-pink-500/10" />
			<div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
				<MotionEffect
					inView
					fade
					slide={{ direction: "up", offset: 24 }}
					transition={{ duration: 0.5 }}
					className="mx-auto mb-10 max-w-3xl text-center"
				>
					<h2 className="text-3xl font-bold tracking-tight lg:text-5xl">Start your workflow</h2>
					<p className="text-muted-foreground mt-4 text-lg">
						Choose the path that matches your role in the notarization process.
					</p>
				</MotionEffect>

				<div className="grid gap-5 lg:grid-cols-3">
					{actions.map(action => (
						<Card key={action.title} className="p-6">
							<div className="bg-primary/10 text-primary mb-5 flex size-12 items-center justify-center rounded-lg">
								<HugeiconsIcon icon={action.icon} strokeWidth={2} className="size-6" />
							</div>
							<h3 className="text-xl font-semibold">{action.title}</h3>
							<p className="text-muted-foreground mt-3 min-h-16 text-sm leading-relaxed">
								{action.description}
							</p>
							<Link
								href={action.href as Route}
								className={cn(buttonVariants({ variant: "outline" }), "mt-6 w-full")}
							>
								{action.label}
							</Link>
						</Card>
					))}
				</div>
			</div>
		</section>
	)
}

"use client"

import type { Route } from "next"
import Link from "next/link"
import {
	Certificate01Icon,
	CheckmarkCircle02Icon,
	File01Icon,
	Shield01Icon,
	SignatureIcon,
	UserGroupIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { motion } from "motion/react"

import { LogoIcon } from "@/core/components/logo"
import { buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"
import { MotionEffect } from "@/features/home/ui/motion-effect"

const proofPoints = [
	"DICT National PKI Verified",
	"PropTech Consortium Endorsed",
	"Hyperledger Fabric Audit Trail",
]

const orbitItems = [
	{
		icon: Shield01Icon,
		label: "Compliant",
		angle: 0,
		className: "text-violet-600",
	},
	{
		icon: SignatureIcon,
		label: "E-sign",
		angle: 72,
		className: "text-pink-600",
	},
	{
		icon: Certificate01Icon,
		label: "Official workflows",
		angle: 144,
		className: "text-primary",
	},
	{
		icon: File01Icon,
		label: "Registry",
		angle: 216,
		className: "text-cyan-600",
	},
	{
		icon: UserGroupIcon,
		label: "Sessions",
		angle: 288,
		className: "text-emerald-600",
	},
]

export function Hero() {
	return (
		<section className="relative isolate min-h-dvh overflow-hidden pt-28 pb-16">
			<div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800d_1px,transparent_1px),linear-gradient(to_bottom,#8080800d_1px,transparent_1px)] bg-size-[24px_24px]" />
			<div className="via-background absolute inset-0 bg-linear-to-br from-[rgb(91,26,128)]/8 to-[rgb(233,30,140)]/8" />

			<div className="relative z-10 mx-auto grid min-h-[calc(100dvh-7rem)] max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
				<MotionEffect
					fade
					slide={{ direction: "up", offset: 24 }}
					transition={{ duration: 0.6, type: "spring", stiffness: 160, damping: 22 }}
					className="max-w-3xl text-center lg:text-left"
				>
					<div className="bg-background/70 mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-sm backdrop-blur">
						<HugeiconsIcon icon={Shield01Icon} strokeWidth={2} className="text-primary size-4" />
						Supreme Court-compliant electronic notarization platform
					</div>

					<h1 className="text-5xl leading-tight font-bold tracking-tight sm:text-6xl lg:text-7xl">
						<span className="bg-linear-to-r from-[rgb(91,26,128)] to-[rgb(233,30,140)] bg-clip-text text-transparent">
							Electronic Notarization
						</span>{" "}
						Platform
					</h1>

					<p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-base leading-relaxed sm:text-lg lg:mx-0 lg:text-xl">
						A secure legal consultation and electronic notarization platform for online
						appointments, document signing, notarial registers, and compliance workflows.
					</p>

					<div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
						<Link
							href={"/register" as Route}
							className={cn(buttonVariants({ size: "lg" }), "h-11 px-5")}
						>
							Get started
						</Link>
						<Link
							href={"/login" as Route}
							className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-11 px-5")}
						>
							Sign in
						</Link>
					</div>

					<div className="text-muted-foreground mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm lg:justify-start">
						{proofPoints.map(point => (
							<div key={point} className="flex items-center gap-2">
								<HugeiconsIcon
									icon={CheckmarkCircle02Icon}
									strokeWidth={2}
									className="size-4 text-emerald-600"
								/>
								<span>{point}</span>
							</div>
						))}
					</div>
				</MotionEffect>

				<motion.div
					initial={{ opacity: 0, scale: 0.94 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.7, delay: 0.1 }}
					className="relative mx-auto hidden aspect-square w-full max-w-[520px] items-center justify-center lg:flex"
				>
					<div className="border-primary/15 absolute inset-8 rounded-full border" />
					<div className="border-primary/20 absolute inset-20 rounded-full border" />
					<div className="bg-background/80 relative z-10 flex size-44 items-center justify-center rounded-full border shadow-2xl backdrop-blur">
						<LogoIcon size="lg" className="scale-150" />
					</div>
					<div className="absolute inset-0" aria-hidden>
						{orbitItems.map(item => (
							<motion.div
								key={item.label}
								className={cn(
									"bg-background/90 absolute top-1/2 left-1/2 flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium shadow-lg backdrop-blur",
									item.className
								)}
								initial={{
									transform: `translate(-50%, -50%) rotate(${item.angle}deg) translateX(13rem) rotate(-${item.angle}deg)`,
								}}
								animate={{
									transform: `translate(-50%, -50%) rotate(${item.angle + 360}deg) translateX(13rem) rotate(-${item.angle + 360}deg)`,
								}}
								transition={{
									duration: 28,
									repeat: Number.POSITIVE_INFINITY,
									ease: "linear",
								}}
							>
								<HugeiconsIcon icon={item.icon} strokeWidth={2} className="size-5" />
								{item.label}
							</motion.div>
						))}
					</div>
				</motion.div>
			</div>
		</section>
	)
}

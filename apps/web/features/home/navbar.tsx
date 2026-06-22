"use client"

import { useEffect, useState } from "react"
import type { Route } from "next"
import Link from "next/link"

import { Logo } from "@/core/components/logo"
import { ThemeSwitcher } from "@/core/components/mode-toggle"
import { buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

const navItems = [
	{ label: "Features", href: "#features" },
	{ label: "Compliance", href: "#compliance" },
	{ label: "Get started", href: "#contact-us" },
]

export function Navbar() {
	const [isScrolled, setIsScrolled] = useState(false)

	useEffect(() => {
		const handleScroll = () => setIsScrolled(window.scrollY > 24)
		window.addEventListener("scroll", handleScroll, { passive: true })
		handleScroll()
		return () => window.removeEventListener("scroll", handleScroll)
	}, [])

	return (
		<header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
			<nav
				className={cn(
					"mx-auto flex h-14 max-w-7xl items-center gap-4 rounded-lg border px-3 transition-all",
					isScrolled ? "bg-background/90 shadow-sm backdrop-blur" : "bg-background/70 backdrop-blur"
				)}
			>
				<Logo href={"/" as Route} text="Quanby Legal" size="default" />
				<div className="ml-auto hidden items-center gap-1 md:flex">
					{navItems.map(item => (
						<a
							key={item.href}
							href={item.href}
							className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "font-medium")}
						>
							{item.label}
						</a>
					))}
				</div>
				<div className="ml-auto flex items-center gap-2 md:ml-2">
					<ThemeSwitcher />
					<Link
						href={"/login" as Route}
						className={cn(
							buttonVariants({ variant: "ghost", size: "sm" }),
							"hidden sm:inline-flex"
						)}
					>
						Sign in
					</Link>
					<Link href={"/register" as Route} className={buttonVariants({ size: "sm" })}>
						Get Started
					</Link>
				</div>
			</nav>
		</header>
	)
}

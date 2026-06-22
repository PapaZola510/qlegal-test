"use client"

import type { Route } from "next"
import Link from "next/link"

import { Logo } from "@/core/components/logo"

const footerGroups = [
	{
		label: "Platform",
		items: [
			{ title: "Find a notary", href: "/find-notary" },
			{ title: "Upload document", href: "/upload-document" },
			{ title: "Verify document", href: "/verify/document" },
		],
	},
	{
		label: "Account",
		items: [
			{ title: "Sign in", href: "/login" },
			{ title: "Create account", href: "/register" },
			{ title: "Dashboard", href: "/dashboard" },
		],
	},
	{
		label: "Compliance",
		items: [
			{
				title: "Supreme Court eNotary Rules",
				href: "https://sc.judiciary.gov.ph/enotary-services/enotarization-rules/",
			},
			{ title: "DICT National PKI", href: "https://dict.gov.ph/pnpki" },
			{ title: "DOCONCHAIN", href: "https://doconchain.com" },
		],
	},
]

export function Footer() {
	return (
		<footer className="bg-muted/30 border-t px-4 py-16 sm:px-6 lg:px-8">
			<div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-[1.2fr_2fr]">
				<div className="space-y-4">
					<Logo href={"/" as Route} text="Quanby Legal" size="default" />
					<p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
						Certified legal consultation and electronic notarization workflows for secure, compliant
						online service.
					</p>
					<p className="text-muted-foreground text-xs">
						&copy; {new Date().getFullYear()} Quanby Legal. All rights reserved.
					</p>
				</div>

				<div className="grid gap-8 sm:grid-cols-3">
					{footerGroups.map(group => (
						<div key={group.label}>
							<h3 className="mb-4 text-sm font-semibold">{group.label}</h3>
							<ul className="space-y-3">
								{group.items.map(item => {
									const external = item.href.startsWith("http")
									const className =
										"text-muted-foreground hover:text-foreground text-sm transition-colors"
									return (
										<li key={item.href}>
											{external ? (
												<a
													href={item.href}
													target="_blank"
													rel="noopener noreferrer"
													className={className}
												>
													{item.title}
												</a>
											) : (
												<Link href={item.href as Route} className={className}>
													{item.title}
												</Link>
											)}
										</li>
									)
								})}
							</ul>
						</div>
					))}
				</div>
			</div>
		</footer>
	)
}

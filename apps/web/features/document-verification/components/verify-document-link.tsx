import type { ReactNode } from "react"
import type { Route } from "next"
import Link from "next/link"

import { buttonVariants } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

import { verifyDocumentPageHref } from "../lib/verify-document-url"

interface VerifyDocumentLinkProps {
	actNumber?: string
	projectUuid?: string
	code?: string
	className?: string
	variant?: "default" | "outline" | "secondary" | "ghost" | "link"
	size?: "default" | "sm" | "lg"
	children?: ReactNode
}

/** Link to the public DOC Verify page (third parties, clients, ENPs). */
export function VerifyDocumentLink({
	actNumber,
	projectUuid,
	code,
	className,
	variant = "outline",
	size = "sm",
	children = "Verify authenticity",
}: VerifyDocumentLinkProps) {
	const href = verifyDocumentPageHref({ actNumber, projectUuid, code })
	return (
		<Link
			href={href as Route}
			className={cn(buttonVariants({ variant, size }), className)}
			target="_blank"
			rel="noopener noreferrer"
		>
			{children}
		</Link>
	)
}

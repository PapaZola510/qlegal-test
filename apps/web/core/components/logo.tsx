"use client"

import * as React from "react"
import type { Route } from "next"
import Image from "next/image"
import Link from "next/link"

import { cn } from "@/core/lib/utils"

export interface LogoIconProps extends React.ComponentPropsWithoutRef<"div"> {
	size?: "sm" | "default" | "lg"
	className?: string
}

const sizeMap = {
	sm: 24,
	default: 32,
	lg: 40,
}

export const LogoIcon = React.memo(({ size = "default", className, ...props }: LogoIconProps) => {
	const width = sizeMap[size]
	return (
		<div className={cn("flex items-center justify-center", className)} {...props}>
			<Image
				src="/LOGO.png"
				alt="Quanby Legal Logo"
				width={width}
				height={width}
				priority
				className="object-contain"
			/>
		</div>
	)
})
LogoIcon.displayName = "LogoIcon"

export interface LogoProps {
	text?: string
	href?: Route<string>
	showIcon?: boolean
	size?: "sm" | "default" | "lg"
	className?: string
}

export function Logo({
	text = "Quanby Legal",
	href,
	size = "lg",
	showIcon = true,
	className,
}: LogoProps) {
	const content = (
		<div className="flex items-center gap-2">
			{showIcon && <LogoIcon size={size} />}
			{text && <span className="font-semibold">{text}</span>}
		</div>
	)

	if (href) {
		return (
			<Link
				className={cn("flex items-center rounded-md transition-colors hover:opacity-80", className)}
				href={href}
			>
				{content}
			</Link>
		)
	}

	return <div className={cn("inline-flex items-center", className)}>{content}</div>
}

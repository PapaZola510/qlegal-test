"use client"

import { AlertCircleFreeIcons, Loading03FreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"
import { cn } from "@/core/lib/utils"

interface LoadingStateProps {
	message?: string
	className?: string
}

export function LoadingState({ message = "Loading...", className }: LoadingStateProps) {
	return (
		<div className={cn("flex flex-1 flex-col items-center justify-center gap-3 p-8", className)}>
			<HugeiconsIcon
				icon={Loading03FreeIcons}
				className="text-muted-foreground size-6 animate-spin"
			/>
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	)
}

interface ErrorStateProps {
	message?: string
	onRetry?: () => void
	className?: string
}

export function ErrorState({
	message = "Something went wrong.",
	onRetry,
	className,
}: ErrorStateProps) {
	return (
		<div className={cn("flex flex-1 flex-col items-center justify-center gap-3 p-8", className)}>
			<HugeiconsIcon icon={AlertCircleFreeIcons} className="text-destructive size-6" />
			<p className="text-muted-foreground text-sm">{message}</p>
			{onRetry && (
				<Button variant="outline" size="sm" onClick={onRetry}>
					Try again
				</Button>
			)}
		</div>
	)
}

interface EmptyStateProps {
	title?: string
	message?: string
	action?: React.ReactNode
	className?: string
}

export function EmptyState({
	title = "No results yet",
	message = "There is nothing to show here right now.",
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center",
				className
			)}
		>
			<p className="text-sm font-medium">{title}</p>
			<p className="text-muted-foreground max-w-md text-sm">{message}</p>
			{action && <div className="mt-2">{action}</div>}
		</div>
	)
}

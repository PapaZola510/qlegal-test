"use client"

import { SidebarLeftIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "@/core/lib/utils"
import { useNavigationLayout } from "@/features/navigation/context/navigation-layout-provider"
import type { NavigationLayout } from "@/features/navigation/lib/navigation-layout-preference"

const options: { value: NavigationLayout; label: string; icon: typeof SidebarLeftIcon }[] = [
	{ value: "sidebar", label: "Sidebar", icon: SidebarLeftIcon },
	{
		value: "header",
		label: "Top bar",
		icon: SidebarLeftIcon,
	},
]

function TopBarIcon({ className }: { className?: string }) {
	return (
		<svg
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			aria-hidden
		>
			<rect x="3" y="4" width="18" height="4" rx="1" />
			<rect x="3" y="10" width="18" height="10" rx="1" />
		</svg>
	)
}

export function NavigationLayoutSwitcher({ className }: { className?: string }) {
	const { layout, setLayout } = useNavigationLayout()

	return (
		<div
			className={cn(
				"border-border bg-muted inline-flex items-center gap-0.5 rounded-md border p-0.5",
				className
			)}
			role="group"
			aria-label="Navigation layout"
		>
			{options.map(option => {
				const isActive = layout === option.value

				return (
					<button
						key={option.value}
						type="button"
						aria-label={option.label}
						aria-pressed={isActive}
						onClick={() => setLayout(option.value)}
						className={cn(
							"flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all",
							isActive
								? "bg-background text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						)}
					>
						{option.value === "header" ? (
							<TopBarIcon className="size-3.5" />
						) : (
							<HugeiconsIcon icon={option.icon} className="size-3.5" strokeWidth={2} />
						)}
						<span className="hidden sm:inline">{option.label}</span>
					</button>
				)
			})}
		</div>
	)
}

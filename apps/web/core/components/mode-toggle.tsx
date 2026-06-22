"use client"

import { useSyncExternalStore } from "react"
import { ComputerIcon, Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useThemeTransition } from "@/core/context/theme-provider"

import { cn } from "@/core/lib/utils"

const modes = [
	{ value: "system", icon: ComputerIcon, label: "System" },
	{ value: "light", icon: Sun01Icon, label: "Light" },
	{ value: "dark", icon: Moon01Icon, label: "Dark" },
] as const

function useIsClient() {
	return useSyncExternalStore(
		() => () => {},
		() => true,
		() => false
	)
}

export function ThemeSwitcher({ className }: { className?: string }) {
	const { setTheme, theme } = useThemeTransition()
	const isClient = useIsClient()

	return (
		<div
			className={cn(
				"border-border bg-muted inline-flex items-center gap-0.5 rounded-md border p-0.5",
				className
			)}
			role="group"
			aria-label="Theme"
		>
			{modes.map(mode => (
				<div
					key={mode.value}
					role="button"
					tabIndex={0}
					aria-label={mode.label}
					aria-pressed={isClient ? theme === mode.value : false}
					onClick={() => setTheme(mode.value)}
					onKeyDown={e => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault()
							setTheme(mode.value)
						}
					}}
					className={cn(
						"flex cursor-pointer items-center justify-center rounded-lg p-1 transition-all",
						isClient && theme === mode.value
							? "bg-background text-foreground shadow-xs"
							: "text-muted-foreground hover:text-foreground"
					)}
				>
					<HugeiconsIcon icon={mode.icon} className="size-3.5" />
					<span className="sr-only">{mode.label}</span>
				</div>
			))}
		</div>
	)
}

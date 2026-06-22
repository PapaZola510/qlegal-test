"use client"

import { Logout01FreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/core/components/ui/button"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"

export function AdminHeader({ userName, userEmail }: { userName: string; userEmail: string }) {
	const signOut = useSignOutMutation()

	return (
		<header className="bg-background flex h-12 items-center justify-between gap-4 border-b px-6">
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">{userName}</p>
				<p className="text-muted-foreground truncate text-xs">{userEmail}</p>
			</div>
			<Button
				variant="outline"
				size="sm"
				className="shrink-0 gap-2"
				onClick={() => signOut.mutate()}
				disabled={signOut.isPending}
			>
				<HugeiconsIcon icon={Logout01FreeIcons} className="size-4" strokeWidth={2} />
				{signOut.isPending ? "Signing out…" : "Sign out"}
			</Button>
		</header>
	)
}

"use client"

import * as React from "react"
import { Copy01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { CommissionHearingOpposition } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useGrantOppositorAccessMutation } from "@/features/commission-hearing/api/commission-hearing.hooks"

function toAbsoluteUrl(path: string): string {
	if (/^https?:\/\//i.test(path)) return path
	if (typeof window === "undefined") return path
	return `${window.location.origin}${path.startsWith("/") ? "" : "/"}${path}`
}

export function CommissionOppositionAccessDialog({
	open,
	onOpenChange,
	hearingRoomId,
	applicationId,
	opposition,
}: {
	open: boolean
	onOpenChange: (open: boolean) => void
	hearingRoomId: string
	applicationId: string
	opposition: CommissionHearingOpposition | null
}) {
	const grantAccess = useGrantOppositorAccessMutation()
	const [latestUrl, setLatestUrl] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!open) setLatestUrl(null)
	}, [open])

	async function grantAndCopy() {
		if (!opposition) return
		try {
			const result = await grantAccess.mutateAsync({
				id: hearingRoomId,
				oppositionId: opposition.id,
				applicationId,
			})
			const url = toAbsoluteUrl(result.inviteUrl)
			setLatestUrl(url)
			await navigator.clipboard.writeText(url)
			toast.success("Oppositor hearing link copied")
		} catch (error) {
			toast.error(getOrpcMutationErrorMessage(error, "Could not grant oppositor access."))
		}
	}

	async function copyLatest() {
		if (!latestUrl) return
		try {
			await navigator.clipboard.writeText(latestUrl)
			toast.success("Link copied")
		} catch {
			toast.error("Could not copy link")
		}
	}

	const busy = grantAccess.isPending

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Grant hearing access</DialogTitle>
					<DialogDescription>
						Create a dedicated oppositor lobby link for{" "}
						{opposition?.oppositorEmail ?? "the oppositor"}.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<div className="space-y-2">
						<Label>Oppositor email</Label>
						<Input readOnly value={opposition?.oppositorEmail ?? ""} />
					</div>

					{latestUrl ? (
						<div className="space-y-2">
							<Label>Latest access link</Label>
							<div className="flex gap-2">
								<Input readOnly value={latestUrl} className="text-xs" />
								<Button
									type="button"
									size="icon"
									variant="outline"
									onClick={() => void copyLatest()}
								>
									<HugeiconsIcon icon={Copy01Icon} className="size-4" />
									<span className="sr-only">Copy link</span>
								</Button>
							</div>
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button
						type="button"
						className="w-full gap-2"
						disabled={busy}
						onClick={() => void grantAndCopy()}
					>
						<HugeiconsIcon icon={Copy01Icon} className="size-4" />
						{busy ? "Creating link..." : "Create and copy access link"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

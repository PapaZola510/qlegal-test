"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/core/components/ui/button"
import { Spinner } from "@/core/components/ui/spinner"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/core/components/ui/tooltip"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"

import type { RegistryAct } from "../lib/fixtures"

interface ScSyncButtonProps {
	act: RegistryAct
	runSync: (id: string) => Promise<void>
}

export function ScSyncButton({ act, runSync }: ScSyncButtonProps) {
	const [loading, setLoading] = React.useState(false)

	const hasLiveNrid = act.nrid !== "—" && !act.nrid.startsWith("NRID-STUB-")

	if (act.scSync === "synced" || hasLiveNrid) {
		return <span className="text-xs text-green-600 dark:text-green-400">Synced</span>
	}

	if (act.commissionInactive) {
		return (
			<Tooltip>
				<TooltipTrigger
					render={
						<Button size="sm" variant="outline" disabled className="text-xs">
							Sync
						</Button>
					}
				/>
				<TooltipContent>Commission inactive — cannot sync</TooltipContent>
			</Tooltip>
		)
	}

	if (act.pdfUploadPending && !act.documentFileObjectId) {
		return (
			<Tooltip>
				<TooltipTrigger
					render={
						<Button size="sm" variant="outline" disabled className="text-xs">
							Sync
						</Button>
					}
				/>
				<TooltipContent>
					Link a meeting document to this act before Supreme Court sync (View/Download must be
					available).
				</TooltipContent>
			</Tooltip>
		)
	}

	async function handleSync() {
		setLoading(true)
		try {
			await runSync(act.id)
			toast.success("Sync submitted.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "SC sync failed."))
		} finally {
			setLoading(false)
		}
	}

	return (
		<Button
			size="sm"
			variant="outline"
			className="h-8 min-w-[4.25rem] px-2 text-xs"
			onClick={() => void handleSync()}
			disabled={loading}
		>
			{loading ? <Spinner className="mr-1" /> : null}
			{act.scSync === "failed" ? "Retry" : "Sync"}
		</Button>
	)
}

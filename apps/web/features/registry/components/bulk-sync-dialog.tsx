"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Spinner } from "@/core/components/ui/spinner"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"

import type { RegistryAct } from "../lib/fixtures"

type SyncResult = "synced" | "failed"

interface BulkSyncDialogProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	pendingIds: string[]
	acts: RegistryAct[]
	runBulkSync: (actIds: string[]) => Promise<{
		results: Array<{ actId: string; success: boolean }>
	}>
}

export function BulkSyncDialog({
	open,
	onOpenChange,
	pendingIds,
	acts,
	runBulkSync,
}: BulkSyncDialogProps) {
	const [running, setRunning] = React.useState(false)
	const [progress, setProgress] = React.useState<Record<string, SyncResult | "in_progress">>({})
	const [done, setDone] = React.useState(false)

	React.useEffect(() => {
		if (open) {
			setProgress({})
			setDone(false)
			setRunning(false)
		}
	}, [open])

	async function handleStart() {
		if (pendingIds.length === 0) return
		setRunning(true)
		setDone(false)
		setProgress(Object.fromEntries(pendingIds.map(id => [id, "in_progress" as const])))
		try {
			const result = await runBulkSync(pendingIds)
			const next: Record<string, SyncResult> = {}
			for (const r of result.results) {
				next[r.actId] = r.success ? "synced" : "failed"
			}
			setProgress(next)
			setDone(true)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Bulk SC sync failed."))
			const next: Record<string, SyncResult> = {}
			for (const id of pendingIds) next[id] = "failed"
			setProgress(next)
			setDone(true)
		} finally {
			setRunning(false)
		}
	}

	function handleClose() {
		setProgress({})
		setDone(false)
		setRunning(false)
		onOpenChange(false)
	}

	const counts = React.useMemo(() => {
		const c = { synced: 0, failed: 0 }
		for (const v of Object.values(progress)) {
			if (v === "synced") c.synced++
			else if (v === "failed") c.failed++
		}
		return c
	}, [progress])

	function onDialogOpenChange(next: boolean) {
		if (!next && running) return
		if (!next) handleClose()
	}

	return (
		<Dialog open={open} onOpenChange={onDialogOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Bulk SC Sync</DialogTitle>
					<DialogDescription>
						{done
							? "Sync complete. See results below."
							: `Submit ${pendingIds.length} pending act(s) to the Supreme Court registry.`}
					</DialogDescription>
				</DialogHeader>

				{Object.keys(progress).length > 0 && (
					<div className="max-h-48 space-y-1 overflow-y-auto">
						{pendingIds.map(id => {
							const act = acts.find(a => a.id === id)
							const status = progress[id]
							return (
								<div key={id} className="flex items-center justify-between text-sm">
									<span className="truncate">{act?.registryNo ?? id}</span>
									{status === "in_progress" && <Spinner className="size-3" />}
									{status === "synced" && (
										<Badge variant="default" className="text-[10px]">
											Synced
										</Badge>
									)}
									{status === "failed" && (
										<Badge variant="destructive" className="text-[10px]">
											Failed
										</Badge>
									)}

									{!status && <span className="text-muted-foreground text-xs">Waiting</span>}
								</div>
							)
						})}
					</div>
				)}

				{done && (
					<div className="flex gap-3 text-sm">
						<span className="text-green-600 dark:text-green-400">{counts.synced} succeeded</span>
						<span className="text-destructive">{counts.failed} failed</span>
					</div>
				)}

				<DialogFooter>
					{!running && !done && (
						<>
							<Button variant="outline" onClick={handleClose}>
								Cancel
							</Button>
							<Button onClick={() => void handleStart()}>Start Sync</Button>
						</>
					)}
					{running && (
						<Button disabled>
							<Spinner className="mr-2" />
							Syncing…
						</Button>
					)}
					{done && <Button onClick={handleClose}>Close</Button>}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

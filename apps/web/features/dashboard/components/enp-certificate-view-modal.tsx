"use client"

import * as React from "react"
import { Download04FreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

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
import {
	downloadLmsCertificate,
	fetchLmsCertificatePdf,
} from "@/features/integration/lib/lms-certificate-download"

type EnpCertificateViewModalProps = {
	open: boolean
	onOpenChange: (open: boolean) => void
	certificateId: string
}

export function EnpCertificateViewModal({
	open,
	onOpenChange,
	certificateId,
}: EnpCertificateViewModalProps) {
	const [pdfUrl, setPdfUrl] = React.useState<string | null>(null)
	const [loading, setLoading] = React.useState(false)
	const [error, setError] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!open) {
			setPdfUrl(prev => {
				if (prev) URL.revokeObjectURL(prev)
				return null
			})
			setError(null)
			setLoading(false)
			return
		}

		let cancelled = false
		setLoading(true)
		setError(null)

		void fetchLmsCertificatePdf()
			.then(({ blob }) => {
				if (cancelled) return
				const url = URL.createObjectURL(blob)
				setPdfUrl(url)
			})
			.catch((e: unknown) => {
				if (cancelled) return
				setError(e instanceof Error ? e.message : "Could not load certificate")
			})
			.finally(() => {
				if (!cancelled) setLoading(false)
			})

		return () => {
			cancelled = true
		}
	}, [open])

	const onDownload = () => {
		void downloadLmsCertificate()
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex h-[min(92vh,900px)] w-[min(96vw,80rem)] max-w-[min(96vw,80rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none">
				<DialogHeader className="border-border shrink-0 border-b px-5 py-4 pr-14">
					<DialogTitle>ENP Certificate</DialogTitle>
					<DialogDescription className="font-mono text-xs break-all">
						{certificateId}
					</DialogDescription>
				</DialogHeader>

				<div className="bg-muted/30 min-h-0 flex-1 overflow-hidden">
					{loading ? (
						<div className="flex h-full min-h-[60vh] items-center justify-center">
							<Spinner className="size-8" />
						</div>
					) : error ? (
						<div className="text-muted-foreground flex h-full min-h-[60vh] items-center justify-center px-6 text-center text-sm">
							{error}
						</div>
					) : pdfUrl ? (
						<iframe
							title="ENP certificate preview"
							src={pdfUrl}
							className="size-full min-h-[60vh] border-0"
						/>
					) : null}
				</div>

				<DialogFooter className="border-border shrink-0 border-t px-5 py-4">
					<Button type="button" onClick={onDownload} disabled={loading || Boolean(error)}>
						<HugeiconsIcon icon={Download04FreeIcons} className="mr-2 size-4" strokeWidth={2} />
						Download Certificate
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

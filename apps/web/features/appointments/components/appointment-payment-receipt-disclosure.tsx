"use client"

import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { AppointmentAttachment, MeetingPaymentStatus } from "@repo/contracts"

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/core/components/ui/collapsible"
import { cn } from "@/core/lib/utils"
import {
	useAppointmentAttachmentsQuery,
	useMeetingPaymentStatusQuery,
} from "@/features/appointments/api/meeting.hooks"
import { MeetingFeeBreakdownView } from "@/features/appointments/components/meeting/meeting-fee-breakdown"
import { SessionChargesExportButtons } from "@/features/appointments/components/meeting/session-charges-export-buttons"
import {
	buildSessionChargesExportInput,
	canDownloadSessionChargesReceipt,
} from "@/features/appointments/lib/export-session-charges"

import type { AppointmentStatus } from "../lib/labels"

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

export function AppointmentPaymentReceiptDisclosure({
	appointmentId,
	appointmentTitle,
	status,
}: {
	appointmentId: string
	appointmentTitle: string
	status: AppointmentStatus
}) {
	const enabled = status === "ended"
	const paymentQ = useMeetingPaymentStatusQuery(appointmentId, { enabled })
	const attachmentsQ = useAppointmentAttachmentsQuery(appointmentId, { enabled })

	if (!enabled) return null

	const paymentStatus = paymentQ.data as MeetingPaymentStatus | undefined
	if (paymentQ.isLoading || attachmentsQ.isLoading) return null
	if (!canDownloadSessionChargesReceipt(paymentStatus)) return null

	const attachments = (attachmentsQ.data ?? []) as AppointmentAttachment[]
	const exportInput = buildSessionChargesExportInput(
		appointmentId,
		appointmentTitle,
		attachments,
		paymentStatus
	)
	if (!exportInput || !paymentStatus?.breakdown) return null

	return (
		<Collapsible className="border-border/80 overflow-hidden rounded-lg border">
			<CollapsibleTrigger
				className="group hover:bg-muted/40 flex w-full items-center gap-2 px-3 py-2 text-left transition-colors"
				aria-label="Toggle payment receipt"
			>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-medium">Payment receipt</p>
					<p className="text-muted-foreground mt-0.5 text-[11px]">
						Download PDF or CSV for this completed session
					</p>
				</div>
				<span className="shrink-0 text-xs font-semibold tabular-nums">
					{formatFeePhp(paymentStatus.breakdown.totalPhp)}
				</span>
				<HugeiconsIcon
					icon={ArrowDown01Icon}
					strokeWidth={2}
					className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-panel-open:rotate-180"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className={cn("border-border/80 space-y-3 border-t px-3 py-3")}>
					<MeetingFeeBreakdownView breakdown={paymentStatus.breakdown} compact className="w-full" />
					<div className="flex justify-end">
						<SessionChargesExportButtons
							exportInput={exportInput}
							paymentStatus={paymentStatus}
							size="sm"
						/>
					</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	)
}

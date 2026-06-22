"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { subscribeQlegalEvent } from "@/services/ws/ws-client"
import {
	useCommissionHearingPaymentStatusQuery,
	useCreateCommissionHearingPaymentMutation,
	useSimulateCommissionHearingPaymentMutation,
} from "@/features/commission-hearing/api/commission-hearing.hooks"

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

function qrImageUrl(payload: string): string {
	return `https://quickchart.io/qr?text=${encodeURIComponent(payload)}&size=240&margin=2&ecLevel=M`
}

function HearingQrImage({ payload }: { payload: string }) {
	const [failed, setFailed] = React.useState(false)
	if (failed) return null
	return (
		// eslint-disable-next-line @next/next/no-img-element -- external QR render service
		<img
			src={qrImageUrl(payload)}
			alt="QRPH payment QR code"
			width={240}
			height={240}
			className="mx-auto rounded-md border bg-white p-2"
			onError={() => setFailed(true)}
		/>
	)
}

export function CommissionHearingPaymentPanel({ hearingRoomId }: { hearingRoomId: string }) {
	const statusQ = useCommissionHearingPaymentStatusQuery(hearingRoomId)
	const createPayment = useCreateCommissionHearingPaymentMutation(hearingRoomId)
	const simulatePayment = useSimulateCommissionHearingPaymentMutation(hearingRoomId)

	const status = statusQ.data
	const required = status?.required ?? false
	const paid = status?.paid ?? !required
	const sandboxTestMode = status?.sandboxTestMode ?? false
	const qrPayload = status?.qrCode?.trim() ?? ""
	const checkoutUrl = status?.checkoutUrl?.trim() ?? ""
	const amountPhp = status?.amountPhp ?? 50

	React.useEffect(() => {
		const off = subscribeQlegalEvent("commission-hearing:payment-updated", event => {
			if (event.hearingRoomId !== hearingRoomId) return
			void statusQ.refetch()
		})
		return () => off()
	}, [hearingRoomId, statusQ])

	async function handleCreatePayment() {
		try {
			await createPayment.mutateAsync()
			toast.success(
				sandboxTestMode
					? "Payment link ready. Use the sandbox Mark paid button after review."
					: "QRPH payment ready. Scan with your banking app."
			)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not start QRPH payment."))
		}
	}

	async function handleSimulatePayment() {
		try {
			await simulatePayment.mutateAsync()
			toast.success("Sandbox payment marked as paid. You can join the hearing.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not simulate payment."))
		}
	}

	if (statusQ.isLoading) {
		return <p className="text-muted-foreground text-sm">Loading payment status...</p>
	}

	if (statusQ.isError) {
		return (
			<p className="text-destructive text-sm" role="alert">
				Could not load payment status.
			</p>
		)
	}

	if (!required) return null

	return (
		<Card className="border-primary/25 shadow-sm" id="commission-hearing-payment-panel">
			<CardHeader>
				<CardTitle className="text-base">Commission hearing fee</CardTitle>
				<CardDescription className="text-sm leading-relaxed">
					{paid
						? "Payment received. You can join the commission hearing."
						: "Pay the flat hearing session fee before entering the meeting room."}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<p className="text-center text-2xl font-semibold tabular-nums">{formatFeePhp(amountPhp)}</p>

				{paid ? (
					<p className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-center text-sm font-medium text-emerald-700">
						Payment complete
					</p>
				) : (
					<>
						{sandboxTestMode ? (
							<p className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm leading-relaxed">
								HitPay sandbox may not complete QRPH hosted checkout. Use Mark paid after confirming
								the test payment flow.
							</p>
						) : null}

						<div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
							<Button
								type="button"
								size="sm"
								className="w-full sm:w-auto"
								disabled={createPayment.isPending}
								onClick={() => void handleCreatePayment()}
							>
								{createPayment.isPending
									? "Preparing QR..."
									: qrPayload || checkoutUrl
										? "Refresh QRPH QR"
										: "Show QRPH QR"}
							</Button>
							{sandboxTestMode ? (
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="w-full sm:w-auto"
									disabled={simulatePayment.isPending}
									onClick={() => void handleSimulatePayment()}
								>
									{simulatePayment.isPending ? "Marking paid..." : "Mark paid"}
								</Button>
							) : null}
						</div>

						{qrPayload ? (
							<div className="flex flex-col items-center gap-2">
								<HearingQrImage payload={qrPayload} />
								{qrPayload.startsWith("http") ? (
									<a
										href={qrPayload}
										target="_blank"
										rel="noopener noreferrer"
										className="text-primary text-center text-xs underline"
									>
										Open HitPay checkout in browser
									</a>
								) : null}
							</div>
						) : null}

						{!qrPayload && checkoutUrl ? (
							<div className="flex flex-col items-center gap-2">
								<HearingQrImage payload={checkoutUrl} />
								<a
									href={checkoutUrl}
									target="_blank"
									rel="noopener noreferrer"
									className="text-primary text-center text-xs underline"
								>
									Open HitPay checkout
								</a>
							</div>
						) : null}

						{!qrPayload && !checkoutUrl ? (
							<p className="text-muted-foreground text-center text-xs">
								Tap Show QRPH QR to generate a payment code.
							</p>
						) : (
							<p className="text-muted-foreground text-center text-xs">
								Already paid via your bank? This page checks every few seconds and will update once
								HitPay confirms.
							</p>
						)}
					</>
				)}
			</CardContent>
		</Card>
	)
}

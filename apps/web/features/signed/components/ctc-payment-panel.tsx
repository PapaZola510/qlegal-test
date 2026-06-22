"use client"

import * as React from "react"
import { toast } from "sonner"

import type { CtcPaymentStatus, MeetingPaymentBrands, TlpePaymentBrand } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import { Label } from "@/core/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/core/components/ui/radio-group"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import {
	useCreateCtcPaymentMutation,
	useCtcPaymentBrandsQuery,
	useCtcPaymentStatusQuery,
	useSimulateCtcPaymentMutation,
} from "@/features/signed/api/signed.hooks"
import {
	isCardPaymentBrand,
	isEmvQrPhPayload,
	isEwalletPaymentBrand,
	isHttpPaymentLink,
	isQrPhPaymentBrand,
	MeetingPaymentQrCanvas,
} from "@/features/appointments/components/meeting/meeting-payment-qr"
import { MeetingFeeBreakdownView } from "@/features/appointments/components/meeting/meeting-fee-breakdown"

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

function defaultPaymentBrandLabel(brands: TlpePaymentBrand[]): string {
	const qrPh = brands.find(b => /qr\s*ph|qrph/i.test(b.label))
	return qrPh?.label ?? brands[0]?.label ?? ""
}

function CtcPaymentLinkDisplay({
	paymentUrl,
	brandLabel,
	brandImage,
	tlpeTestMode,
}: {
	paymentUrl: string
	brandLabel: string | null
	brandImage?: string
	tlpeTestMode: boolean
}) {
	const ewallet = isEwalletPaymentBrand(brandLabel)
	const qrPh = isQrPhPaymentBrand(brandLabel)
	const card = isCardPaymentBrand(brandLabel)
	const emvQr = isEmvQrPhPayload(paymentUrl)
	const linkOnly = isHttpPaymentLink(paymentUrl) && !emvQr

	return (
		<div className="flex flex-col items-center gap-3">
			{brandLabel ? (
				<p className="text-muted-foreground flex items-center justify-center gap-2 text-center text-xs">
					{brandImage ? (
						// eslint-disable-next-line @next/next/no-img-element -- TLPE brand icon from API
						<img src={brandImage} alt="" className="size-5 object-contain" />
					) : null}
					Paying with {brandLabel}
				</p>
			) : null}

			{linkOnly && ewallet ? (
				<p className="text-destructive/90 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-center text-xs leading-relaxed">
					Tap <span className="font-medium">Open in {brandLabel}</span> below — do not scan with the
					wallet app.
					{tlpeTestMode ? " In TLPE test mode use Mark paid (sandbox test) locally." : null}
				</p>
			) : null}

			{ewallet ? (
				<a
					href={paymentUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
				>
					Open in {brandLabel ?? "wallet"}
				</a>
			) : card ? (
				<a
					href={paymentUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
				>
					Open card checkout
				</a>
			) : null}

			{qrPh && linkOnly ? (
				<a
					href={paymentUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
				>
					Open QR Ph checkout
				</a>
			) : null}

			{emvQr ? (
				<MeetingPaymentQrCanvas key={paymentUrl} payload={paymentUrl} label="QR Ph payment code" />
			) : null}
		</div>
	)
}

export function CtcPaymentPanel({
	requestId,
	onPaid,
	compact = false,
}: {
	requestId: string
	onPaid?: () => void
	compact?: boolean
}) {
	const statusQ = useCtcPaymentStatusQuery(requestId)
	const brandsQ = useCtcPaymentBrandsQuery(requestId)
	const createPayment = useCreateCtcPaymentMutation(requestId)
	const simulatePayment = useSimulateCtcPaymentMutation(requestId)

	const status = statusQ.data as CtcPaymentStatus | undefined
	const paid = status?.paid ?? false
	const tlpeTestMode = status?.tlpeTestMode ?? false
	const brandsData = brandsQ.data as MeetingPaymentBrands | undefined
	const brands = React.useMemo<TlpePaymentBrand[]>(() => brandsData?.brands ?? [], [brandsData?.brands])
	const [selectedBrandLabel, setSelectedBrandLabel] = React.useState("")

	React.useEffect(() => {
		if (!brands.length) return
		setSelectedBrandLabel(prev => {
			if (prev && brands.some((b: TlpePaymentBrand) => b.label === prev)) return prev
			return defaultPaymentBrandLabel(brands)
		})
	}, [brands])

	React.useEffect(() => {
		if (paid) onPaid?.()
	}, [paid, onPaid])

	async function handleCreatePayment() {
		try {
			await createPayment.mutateAsync(
				selectedBrandLabel ? { paymentOptionCode: selectedBrandLabel } : undefined
			)
			toast.success("AltPayNet payment link ready.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not start payment."))
		}
	}

	async function handleSimulatePayment() {
		try {
			await simulatePayment.mutateAsync()
			toast.success("Sandbox payment marked as paid.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not simulate payment."))
		}
	}

	if (statusQ.isLoading) {
		return <p className="text-muted-foreground text-xs">Loading payment…</p>
	}
	if (statusQ.isError) {
		return (
			<p className="text-destructive text-xs" role="alert">
				Could not load payment status.
			</p>
		)
	}

	const qrPayload = status?.qrCode?.trim() ?? ""
	const checkoutUrl = status?.checkoutUrl?.trim() ?? ""
	const activeBrandLabel = status?.selectedPaymentBrand ?? null
	const displayBrandLabel = (activeBrandLabel ?? selectedBrandLabel) || null
	const displayBrandImage = brands.find(b => b.label === displayBrandLabel)?.image

	if (paid) {
		return (
			<p className="text-xs font-medium text-emerald-600">
				Payment complete{activeBrandLabel ? ` · ${activeBrandLabel}` : ""}
			</p>
		)
	}

	return (
		<div className={cn("space-y-3", compact ? "text-xs" : "text-sm")}>
			<p className="text-muted-foreground leading-relaxed">
				Pay the certified true copy fee via AltPayNet before your notary can grant the request.
			</p>

			{status?.breakdown ? (
				<div className="space-y-2">
					<p className="text-muted-foreground text-xs font-medium">Fee breakdown</p>
					<MeetingFeeBreakdownView breakdown={status.breakdown} className="w-full" />
				</div>
			) : (
				<p className="text-lg font-semibold tabular-nums">{formatFeePhp(status?.totalFeePhp ?? 0)}</p>
			)}

			{tlpeTestMode ? (
				<p className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed">
					TLPE test API: wallet pages may fail — use Mark paid (sandbox test) to continue locally.
				</p>
			) : null}

			{brandsQ.isLoading ? (
				<p className="text-muted-foreground text-xs">Loading payment methods…</p>
			) : brands.length > 0 ? (
				<div className="space-y-2 rounded-md border px-3 py-3">
					<p className="text-muted-foreground text-xs font-medium">Payment method</p>
					<RadioGroup
						value={selectedBrandLabel}
						onValueChange={(value: unknown) => setSelectedBrandLabel(String(value ?? ""))}
						className="gap-2"
					>
						{brands.map((brand: TlpePaymentBrand) => {
							const domId = `ctc-pay-${brand.label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`
							return (
								<div key={brand.label} className="flex items-center gap-3">
									<RadioGroupItem value={brand.label} id={domId} disabled={createPayment.isPending} />
									<Label
										htmlFor={domId}
										className="flex flex-1 cursor-pointer items-center gap-2 font-normal"
									>
										{brand.image ? (
											// eslint-disable-next-line @next/next/no-img-element -- TLPE brand icon from API
											<img src={brand.image} alt="" className="size-5 object-contain" />
										) : null}
										<span className="text-sm font-medium">{brand.label}</span>
									</Label>
								</div>
							)
						})}
					</RadioGroup>
				</div>
			) : null}

			<div className="flex flex-wrap gap-2">
				<Button
					type="button"
					size="sm"
					disabled={createPayment.isPending || (brands.length > 0 && !selectedBrandLabel)}
					onClick={() => void handleCreatePayment()}
				>
					{createPayment.isPending
						? "Preparing…"
						: qrPayload || checkoutUrl
							? "Update payment link"
							: "Get payment link"}
				</Button>
				{tlpeTestMode ? (
					<Button
						type="button"
						size="sm"
						variant="outline"
						disabled={simulatePayment.isPending}
						onClick={() => void handleSimulatePayment()}
					>
						{simulatePayment.isPending ? "Marking paid…" : "Mark paid (sandbox test)"}
					</Button>
				) : null}
			</div>

			{qrPayload || checkoutUrl ? (
				<CtcPaymentLinkDisplay
					paymentUrl={qrPayload || checkoutUrl}
					brandLabel={displayBrandLabel}
					brandImage={displayBrandImage}
					tlpeTestMode={tlpeTestMode}
				/>
			) : null}
		</div>
	)
}

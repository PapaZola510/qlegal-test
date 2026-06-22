"use client"

import * as React from "react"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { AppointmentAttachment, MeetingPaymentStatus, TlpePaymentBrand } from "@repo/contracts"

import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/core/components/ui/collapsible"
import { Label } from "@/core/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/core/components/ui/radio-group"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { cn } from "@/core/lib/utils"
import { buildSessionChargesExportInput } from "@/features/appointments/lib/export-session-charges"

import {
	useAppointmentAttachmentsQuery,
	useCreateMeetingPaymentMutation,
	useMeetingPaymentBrandsQuery,
	useMeetingPaymentStatusQuery,
	useSimulateMeetingPaymentMutation,
} from "../../api/meeting.hooks"
import { MeetingFeeBreakdownView } from "./meeting-fee-breakdown"
import {
	isCardPaymentBrand,
	isEmvQrPhPayload,
	isEwalletPaymentBrand,
	isHttpPaymentLink,
	isQrPhPaymentBrand,
	MeetingPaymentQrCanvas,
} from "./meeting-payment-qr"
import { SessionChargesExportButtons } from "./session-charges-export-buttons"

function formatFeePhp(amount: number): string {
	return `₱${amount.toLocaleString("en-PH")}`
}

function MeetingPaymentLinkDisplay({
	paymentUrl,
	brandLabel,
	tlpeTestMode,
}: {
	paymentUrl: string
	brandLabel: string | null
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
				<p className="text-muted-foreground text-center text-xs">Paying with {brandLabel}</p>
			) : null}

			{linkOnly && ewallet ? (
				<p className="text-destructive/90 border-destructive/30 bg-destructive/5 rounded-md border px-3 py-2 text-center text-xs leading-relaxed">
					Do not use GCash&apos;s Scan QR for this payment. GCash only accepts its own merchant QR
					codes — AltPayNet gives us a web link, which is why you see &quot;QR is not valid.&quot;
					Tap <span className="font-medium">Open in {brandLabel}</span> below and pay in your
					browser instead.
					{tlpeTestMode
						? " In TLPE test mode the wallet page may still fail; use Mark paid (sandbox test)."
						: null}
				</p>
			) : null}

			{linkOnly && qrPh && !ewallet ? (
				<p className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed">
					Do not scan with GCash for QR Ph. Tap Open QR Ph checkout, then scan the QR on the
					AltPayNet page with your <span className="font-medium">banking app</span> (BDO, BPI,
					etc.).
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
				<>
					<p className="text-muted-foreground text-center text-xs leading-relaxed">
						Opens AltPayNet secure card checkout in your browser.
					</p>
					<a
						href={paymentUrl}
						target="_blank"
						rel="noopener noreferrer"
						className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
					>
						Open card checkout
					</a>
				</>
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
				<>
					<p className="text-muted-foreground text-center text-xs leading-relaxed">
						Scan with your banking app or QR Ph–enabled e-wallet.
					</p>
					<MeetingPaymentQrCanvas
						key={paymentUrl}
						payload={paymentUrl}
						label="QR Ph payment code"
					/>
				</>
			) : null}

			{!emvQr && !linkOnly ? (
				<>
					<MeetingPaymentQrCanvas key={paymentUrl} payload={paymentUrl} />
					<a
						href={paymentUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="text-primary text-center text-xs underline"
					>
						Open payment link
					</a>
				</>
			) : null}

			{linkOnly && !ewallet && !card && !qrPh ? (
				<a
					href={paymentUrl}
					target="_blank"
					rel="noopener noreferrer"
					className={cn(buttonVariants({ size: "sm" }), "w-full sm:w-auto")}
				>
					Open payment link
				</a>
			) : null}
		</div>
	)
}

function defaultPaymentBrandLabel(brands: TlpePaymentBrand[]): string {
	const qrPh = brands.find(b => /qr\s*ph|qrph/i.test(b.label))
	return qrPh?.label ?? brands[0]?.label ?? ""
}

function brandDomId(label: string): string {
	return label
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
}

function MeetingPaymentBrandPicker({
	brands,
	selectedLabel,
	onSelect,
	disabled,
	defaultOpen = true,
}: {
	brands: TlpePaymentBrand[]
	selectedLabel: string
	onSelect: (label: string) => void
	disabled?: boolean
	defaultOpen?: boolean
}) {
	const selected = brands.find(b => b.label === selectedLabel)

	return (
		<Collapsible
			defaultOpen={defaultOpen}
			className="border-foreground/15 overflow-hidden rounded-md border"
		>
			<CollapsibleTrigger
				className="group hover:bg-muted/40 flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors"
				aria-label="Toggle payment methods"
			>
				<div className="min-w-0 flex-1">
					<p className="text-muted-foreground text-xs font-medium">Payment method</p>
					{selected ? (
						<p className="mt-0.5 flex items-center gap-2 text-sm font-medium">
							{selected.image ? (
								// eslint-disable-next-line @next/next/no-img-element -- TLPE brand icon from API
								<img src={selected.image} alt="" className="size-5 object-contain" />
							) : null}
							{selected.label}
						</p>
					) : (
						<p className="text-muted-foreground mt-0.5 text-xs">Choose how to pay</p>
					)}
				</div>
				<HugeiconsIcon
					icon={ArrowDown01Icon}
					strokeWidth={2}
					className="text-muted-foreground size-4 shrink-0 transition-transform duration-200 group-data-panel-open:rotate-180"
				/>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="border-foreground/10 space-y-3 border-t px-3 py-3">
					<RadioGroup
						value={selectedLabel}
						onValueChange={(value: unknown) => onSelect(String(value ?? ""))}
						className="gap-3"
					>
						{brands.map(brand => {
							const domId = `meeting-pay-${brandDomId(brand.label)}`
							return (
								<div key={brand.label} className="flex items-center gap-3">
									<RadioGroupItem value={brand.label} id={domId} disabled={disabled} />
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
			</CollapsibleContent>
		</Collapsible>
	)
}

export function MeetingPaymentPanel({
	appointmentId,
	isClient,
	isEnp,
}: {
	appointmentId: string
	isClient: boolean
	isEnp: boolean
}) {
	const statusQ = useMeetingPaymentStatusQuery(appointmentId)
	const attachmentsQ = useAppointmentAttachmentsQuery(appointmentId)
	const createPayment = useCreateMeetingPaymentMutation(appointmentId)
	const simulatePayment = useSimulateMeetingPaymentMutation(appointmentId)

	const status = statusQ.data as MeetingPaymentStatus | undefined
	const required = status?.required ?? false
	const paid = status?.paid ?? !required
	const totalFeePhp = status?.totalFeePhp ?? 0
	const paymentProvider = status?.paymentProvider ?? "tlpe"
	const sandboxTestMode = status?.sandboxTestMode ?? false
	const tlpeTestMode = status?.tlpeTestMode ?? false
	const devTestMode = sandboxTestMode || tlpeTestMode
	const hitpaySandboxSimulateOnly = sandboxTestMode && paymentProvider === "hitpay"
	const showSimulateButton = devTestMode && isClient
	const qrStale = status?.qrStale ?? false
	const showTlpeBrands = isClient && !paid && paymentProvider === "tlpe"

	const brandsQ = useMeetingPaymentBrandsQuery(appointmentId, { enabled: showTlpeBrands })
	const brands = React.useMemo(() => brandsQ.data?.brands ?? [], [brandsQ.data?.brands])
	const [selectedBrandLabel, setSelectedBrandLabel] = React.useState("")

	React.useEffect(() => {
		if (!brands.length) return
		setSelectedBrandLabel(prev => {
			if (prev && brands.some(b => b.label === prev)) return prev
			return defaultPaymentBrandLabel(brands)
		})
	}, [brands])

	async function handleCreatePayment() {
		try {
			await createPayment.mutateAsync(
				selectedBrandLabel ? { paymentOptionCode: selectedBrandLabel } : undefined
			)
			const brandLabel = selectedBrandLabel || status?.selectedPaymentBrand || "payment"
			toast.success(
				devTestMode
					? paymentProvider === "hitpay"
						? "Payment link ready. HitPay sandbox cannot complete QRPH on the hosted page—use “Mark paid (sandbox test)” below."
						: isEwalletPaymentBrand(brandLabel)
							? `${brandLabel} link ready. Open in browser — TLPE test wallets often show “page unavailable”; use Mark paid (sandbox test) locally.`
							: isQrPhPaymentBrand(brandLabel)
								? `${brandLabel} checkout ready. Open the payment page — scan the QR Ph code shown there with your bank app.`
								: `${brandLabel} payment ready. Open the payment link or use “Mark paid (sandbox test)” to skip a real charge.`
					: isEwalletPaymentBrand(brandLabel)
						? `${brandLabel} link ready. Tap “Open in ${brandLabel}” — do not scan with the wallet app.`
						: `${brandLabel} payment ready. Scan with your app or open the payment link.`
			)
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not start payment."))
		}
	}

	async function handleSimulatePayment() {
		try {
			await simulatePayment.mutateAsync()
			toast.success("Sandbox payment marked as paid. You can leave or end the session.")
		} catch (e) {
			toast.error(getOrpcMutationErrorMessage(e, "Could not simulate payment."))
		}
	}

	if (statusQ.isLoading) {
		return <p className="text-muted-foreground text-xs">Loading payment status…</p>
	}

	if (statusQ.isError) {
		return (
			<p className="text-destructive text-xs" role="alert">
				Could not load payment status.
			</p>
		)
	}

	if (!required) {
		return (
			<Card className="shadow-sm">
				<CardHeader className="px-3 pb-2">
					<CardTitle className="text-sm">Session payment</CardTitle>
					<CardDescription className="text-xs">
						No document fees are set for this session. You can end the meeting without payment.
					</CardDescription>
				</CardHeader>
			</Card>
		)
	}

	const qrPayload = status?.qrCode?.trim() ?? ""
	const checkoutUrl = status?.checkoutUrl?.trim() ?? ""
	const attachments = (attachmentsQ.data ?? []) as AppointmentAttachment[]
	const chargesExportInput = buildSessionChargesExportInput(
		appointmentId,
		undefined,
		attachments,
		status
	)
	const activeBrandLabel = status?.selectedPaymentBrand ?? null

	return (
		<Card className="border-primary/25 shadow-sm" id="meeting-payment-panel">
			<CardHeader className="px-3 pb-2">
				<CardTitle className="text-sm">Pay session fees</CardTitle>
				<CardDescription className="text-xs leading-relaxed">
					{paid
						? "Payment received. The notary can end the session."
						: isEnp
							? "Waiting for the client to pay the total notarization fees before anyone can leave or end the meeting."
							: "Choose a payment method and pay the total below before leaving or before the notary ends the session."}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex w-full flex-col items-stretch gap-3 px-3 pt-0 pb-4">
				{status?.breakdown ? (
					<div className="space-y-2">
						<div className="flex items-center justify-between gap-2">
							<p className="text-muted-foreground text-xs font-medium">Fee breakdown</p>
							{chargesExportInput ? (
								<SessionChargesExportButtons
									exportInput={chargesExportInput}
									paymentStatus={status}
									size="sm"
								/>
							) : null}
						</div>
						<MeetingFeeBreakdownView breakdown={status.breakdown} className="w-full" />
					</div>
				) : (
					<p className="text-center text-xl font-semibold tabular-nums">
						{formatFeePhp(totalFeePhp)}
					</p>
				)}

				{paid ? (
					<p className="text-center text-xs font-medium text-emerald-600">
						Payment complete{activeBrandLabel ? ` · ${activeBrandLabel}` : ""}
					</p>
				) : (
					<>
						{sandboxTestMode && paymentProvider === "hitpay" ? (
							<p className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed">
								HitPay sandbox cannot finish PHP payments on the hosted page—QRPh, GCash, and Pay
								all return &quot;Unknown error&quot; (500 on HitPay&apos;s API). That is expected.
								Use &quot;Mark paid (sandbox test)&quot; in this panel, or switch to production
								HitPay keys in apps/backend/.env to test a real charge like the Transactions
								dashboard.
							</p>
						) : null}
						{tlpeTestMode && paymentProvider === "tlpe" ? (
							<p className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed">
								TLPE test API: GrabPay is not enabled on test — use Maya, GCash, or QR Ph. Sandbox
								wallet pages may still fail; use Mark paid (sandbox test) to continue locally.
							</p>
						) : null}

						{qrStale ? (
							<p className="text-muted-foreground rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-center text-xs leading-relaxed">
								{isClient
									? "Document fees changed. Select your payment method and tap Update payment link for the new total above."
									: "Document fees changed. Ask the client to refresh payment for the new total."}
							</p>
						) : null}

						{showTlpeBrands ? (
							brandsQ.isLoading ? (
								<p className="text-muted-foreground text-xs">Loading payment methods…</p>
							) : brandsQ.isError ? (
								<p className="text-destructive text-xs" role="alert">
									Could not load AltPayNet payment methods.
								</p>
							) : brands.length > 0 ? (
								<MeetingPaymentBrandPicker
									brands={brands}
									selectedLabel={selectedBrandLabel}
									onSelect={setSelectedBrandLabel}
									disabled={createPayment.isPending}
									defaultOpen={!(qrPayload || checkoutUrl) || qrStale}
								/>
							) : null
						) : null}

						{isClient ? (
							<div className="flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-center">
								{!hitpaySandboxSimulateOnly ? (
									<Button
										type="button"
										size="sm"
										className="w-full sm:w-auto"
										disabled={
											createPayment.isPending ||
											(showTlpeBrands && brands.length > 0 && !selectedBrandLabel)
										}
										onClick={() => void handleCreatePayment()}
									>
										{createPayment.isPending
											? "Preparing…"
											: qrStale || qrPayload || checkoutUrl
												? "Update payment link"
												: "Get payment link"}
									</Button>
								) : null}
								{showSimulateButton ? (
									<Button
										type="button"
										size="sm"
										variant="outline"
										className="w-full sm:w-auto"
										disabled={simulatePayment.isPending}
										onClick={() => void handleSimulatePayment()}
									>
										{simulatePayment.isPending ? "Marking paid…" : "Mark paid (sandbox test)"}
									</Button>
								) : null}
							</div>
						) : null}

						{isClient && !qrStale && (qrPayload || checkoutUrl) ? (
							<MeetingPaymentLinkDisplay
								paymentUrl={qrPayload || checkoutUrl}
								brandLabel={(activeBrandLabel ?? selectedBrandLabel) || null}
								tlpeTestMode={tlpeTestMode}
							/>
						) : null}

						{!qrPayload && !checkoutUrl && isClient && !hitpaySandboxSimulateOnly ? (
							<p className="text-muted-foreground text-center text-xs">
								{brands.length > 0
									? "Choose a payment method above, then tap Get payment link."
									: "Tap Get payment link to start checkout for this session total."}
							</p>
						) : null}

						{isClient && !paid && (qrPayload || checkoutUrl) ? (
							<p className="text-muted-foreground text-center text-xs">
								Already paid? This page checks payment status every few seconds and will show paid
								once AltPayNet confirms.
							</p>
						) : null}

						{!isClient && !paid && (qrPayload || checkoutUrl) ? (
							<p className="text-muted-foreground text-center text-xs leading-relaxed">
								Payment QR is shown only to the client. Ask them to open the Payment tab to pay{" "}
								{formatFeePhp(totalFeePhp)}
								{activeBrandLabel ? ` via ${activeBrandLabel}` : ""}.
							</p>
						) : null}
					</>
				)}
			</CardContent>
		</Card>
	)
}

"use client"

import * as React from "react"
import QRCode from "qrcode"

/** EMV QR Ph payloads start with 000201 (static) or similar — scannable by banking apps. */
export function isEmvQrPhPayload(payload: string): boolean {
	const trimmed = payload.trim()
	return /^00020[12]/.test(trimmed)
}

export function isHttpPaymentLink(payload: string): boolean {
	return /^https?:\/\//i.test(payload.trim())
}

/** Client-side QR for EMV QR Ph strings or optional link-sharing QRs. */
export function MeetingPaymentQrCanvas({
	payload,
	label = "Payment QR code",
}: {
	payload: string
	label?: string
}) {
	const canvasRef = React.useRef<HTMLCanvasElement>(null)
	const [failed, setFailed] = React.useState(false)
	const [ready, setReady] = React.useState(false)

	React.useEffect(() => {
		const canvas = canvasRef.current
		const text = payload.trim()
		if (!canvas || !text) return
		setFailed(false)
		setReady(false)
		void QRCode.toCanvas(canvas, text, {
			width: 280,
			margin: 2,
			errorCorrectionLevel: "H",
		})
			.then(() => setReady(true))
			.catch(() => setFailed(true))
	}, [payload])

	if (failed) {
		return (
			<p className="text-destructive text-center text-xs" role="alert">
				Could not render QR. Use the payment link button below.
			</p>
		)
	}

	return (
		<canvas
			ref={canvasRef}
			className="mx-auto rounded-md border bg-white p-2"
			style={{ opacity: ready ? 1 : 0.35 }}
			aria-label={label}
		/>
	)
}

export function isEwalletPaymentBrand(label: string | null | undefined): boolean {
	if (!label) return false
	return /gcash|maya|grab|paymaya/i.test(label)
}

export function isQrPhPaymentBrand(label: string | null | undefined): boolean {
	if (!label) return false
	return /qr\s*ph|instapay|pesonet/i.test(label)
}

export function isCardPaymentBrand(label: string | null | undefined): boolean {
	if (!label) return false
	return /visa|master|card/i.test(label)
}

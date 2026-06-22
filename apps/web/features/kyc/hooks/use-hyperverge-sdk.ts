"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import type {
	HypervergeWorkflowKind,
	StartHypervergeAttemptResponse,
	UserProfile,
} from "@repo/contracts"

import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import {
	useDismissIdentityExpiryNoticeMutation,
	useStartHypervergeAttemptMutation,
	useSyncHypervergeSdkCallbackMutation,
} from "@/features/onboarding/api/onboarding.hooks"

interface HyperKycConfigInstance {
	supportDarkMode?: (v: boolean) => void
	setInputs?: (inputs: Record<string, unknown>) => void
}

declare global {
	interface Window {
		HyperKYCModule?: {
			launch: (
				config: HyperKycConfigInstance,
				callback: (result: { status: string }) => void
			) => Promise<void>
		}
		HyperKycConfig?: new (authToken: string, showLandingPage?: boolean) => HyperKycConfigInstance
	}
}

export interface UseHyperVergeSdkOptions {
	/** `onboarding` = full KYC; `liveness` = selfie-only (session lobby). Default onboarding. */
	workflow?: HypervergeWorkflowKind
	/** When true, clears post-expiry notice before launching (quanby profile / dialog parity). Default true. */
	skipExpiryGate?: boolean
	onComplete?: (rawStatus: string) => void
}

function loadScript(src: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (typeof window === "undefined") {
			resolve()
			return
		}
		if (document.querySelector(`script[src="${src}"]`)) {
			resolve()
			return
		}
		const script = document.createElement("script")
		script.src = src
		script.async = true
		script.onload = () => resolve()
		script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
		document.head.appendChild(script)
	})
}

export function useHyperVergeSdk(options: UseHyperVergeSdkOptions = {}) {
	const workflow = options.workflow ?? "onboarding"
	const skipExpiryGate = options.skipExpiryGate ?? true
	const onCompleteRef = useRef(options.onComplete)
	useEffect(() => {
		onCompleteRef.current = options.onComplete
	}, [options.onComplete])

	const profileQ = useAuthProfileMeQuery()
	const startMut = useStartHypervergeAttemptMutation()
	const syncMut = useSyncHypervergeSdkCallbackMutation()
	const dismissMut = useDismissIdentityExpiryNoticeMutation()
	const [status, setStatus] = useState<"idle" | "loading" | "launching" | "done">("idle")
	const [error, setError] = useState<string | null>(null)
	const busyRef = useRef(false)

	const launch = useCallback(async () => {
		if (busyRef.current) return
		busyRef.current = true
		setStatus("loading")
		setError(null)

		const profile = profileQ.data as UserProfile | undefined
		if (!profile) {
			const msg = "Could not load your profile. Try refreshing the page."
			setError(msg)
			toast.error(msg)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("error")
			return
		}

		const renewalPending =
			workflow === "onboarding" &&
			profile.identityStatus === "unverified" &&
			profile.identityLastExpiredAt !== null &&
			profile.identityLastExpiredAt !== undefined &&
			String(profile.identityLastExpiredAt).length > 0

		if (renewalPending && !skipExpiryGate) {
			toast.error(
				`Your previous verification period has ended. Open Profile → Identity verification to continue (${profile.identityVerificationValidityDays}-day window).`
			)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("blocked")
			return
		}

		if (workflow === "onboarding" && renewalPending && skipExpiryGate) {
			try {
				await dismissMut.mutateAsync()
			} catch {
				toast.error("Could not continue. Please try again.")
				busyRef.current = false
				setStatus("done")
				onCompleteRef.current?.("error")
				return
			}
		}

		let attempt: StartHypervergeAttemptResponse
		try {
			const startMutate = startMut.mutateAsync as unknown as (vars: {
				workflow: HypervergeWorkflowKind
			}) => Promise<StartHypervergeAttemptResponse>
			attempt = await startMutate({ workflow })
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Could not start verification"
			setError(msg)
			toast.error(msg)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("error")
			return
		}

		if (!attempt.sdkToken) {
			const msg =
				"HyperVerge is not configured on the server (missing app credentials), or the token request failed. Set HYPERVERGE_APP_ID and HYPERVERGE_APP_KEY on the API."
			setError(msg)
			toast.error(msg)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("error")
			return
		}

		const sdkVersion = attempt.sdkVersion?.trim() || "10.3.0"
		const sdkUrl = `https://hv-web-sdk-cdn.hyperverge.co/hyperverge-web-sdk@${sdkVersion}/src/sdk.min.js`

		try {
			await loadScript(sdkUrl)
		} catch (err) {
			const msg = err instanceof Error ? err.message : "Failed to load verification SDK"
			setError(msg)
			toast.error(msg)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("error")
			return
		}

		const HyperKycConfig = window.HyperKycConfig
		const HyperKYCModule = window.HyperKYCModule
		if (!HyperKycConfig || !HyperKYCModule) {
			const msg = "Verification SDK not available. Please refresh and try again."
			setError(msg)
			toast.error(msg)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("error")
			return
		}

		setStatus("launching")
		const config = new HyperKycConfig(attempt.sdkToken, false)
		if (typeof config.supportDarkMode === "function") {
			config.supportDarkMode(true)
		}

		try {
			await HyperKYCModule.launch(config, (result: { status: string }) => {
				const raw = (result?.status ?? "").trim()
				void (
					syncMut.mutateAsync as unknown as (input: {
						transactionId: string
						status: string
					}) => Promise<unknown>
				)({
					transactionId: attempt.transactionId,
					status: raw || "unknown",
				})
					.then(() => {
						const s = raw.toLowerCase().replace(/\s+/g, "_")
						if (s === "auto_approved" || s === "approved" || s === "success") {
							toast.success(
								"Verification recorded — your status will update when processing completes."
							)
						} else if (s === "auto_declined" || s === "declined") {
							toast.error("Verification was declined. You can try again with clearer documents.")
						} else if (s === "needs_review" || s === "manual_review") {
							toast.message("Verification is under review.")
						} else if (s === "user_cancelled" || s === "user_canceled") {
							toast.message("Verification cancelled.")
						} else if (s === "error") {
							toast.error("Something went wrong during verification.")
						}
						onCompleteRef.current?.(s)
					})
					.catch(() => {
						toast.error("Could not save verification result. Check your connection and try again.")
						onCompleteRef.current?.("error")
					})
					.finally(() => {
						busyRef.current = false
						setStatus("done")
					})
			})
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Verification failed to open"
			setError(msg)
			toast.error(msg)
			busyRef.current = false
			setStatus("done")
			onCompleteRef.current?.("error")
		}
	}, [dismissMut, profileQ.data, skipExpiryGate, startMut, syncMut, workflow])

	const isLoading =
		status === "loading" || status === "launching" || startMut.isPending || dismissMut.isPending

	return { launch, isLoading, error, status }
}

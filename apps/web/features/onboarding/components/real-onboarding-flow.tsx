"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import type { UserProfile } from "@repo/contracts"

import { ErrorState, LoadingState } from "@/core/components/shared-states"
import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { shouldRedirectToOnboarding } from "@/features/auth/lib/should-redirect-to-onboarding"
import { useAuthProfileMeQuery } from "@/features/dashboard/api/dashboard.hooks"
import { CancelEnpOnboardingButton } from "@/features/onboarding/components/cancel-enp-onboarding-button"
import { CertificationCourseStep } from "@/features/onboarding/components/certification-course-step"
import { EnpCertExamStep } from "@/features/onboarding/components/enp-cert-exam-step"
import { EnpProfessionalProfileStep } from "@/features/onboarding/components/enp-professional-profile-step"
import { HorizontalStepper } from "@/features/onboarding/components/horizontal-stepper"
import { isLmsOnboardingEnabled } from "@/features/onboarding/lib/lms-onboarding-enabled"
import {
	onboardingCurrentHeadline,
	onboardingCurrentSupportingCopy,
	resolveOnboardingStepper,
} from "@/features/onboarding/lib/onboarding-step-labels"

function OnboardingFrame({
	profile,
	lmsOnboarding,
	children,
}: {
	profile: UserProfile
	lmsOnboarding: boolean
	children: React.ReactNode
}) {
	if (profile.onboardingStep === "complete") {
		return <div className="mx-auto w-full max-w-2xl md:max-w-3xl">{children}</div>
	}

	const { steps, currentIndex, stepCountLabel } = resolveOnboardingStepper(profile, {
		lmsIntegration: lmsOnboarding,
	})
	const headline = onboardingCurrentHeadline(profile.onboardingStep, profile.role, {
		lmsIntegration: lmsOnboarding,
	})
	const supporting = onboardingCurrentSupportingCopy(profile.onboardingStep, profile.role, {
		lmsIntegration: lmsOnboarding,
	})

	return (
		<div className="mx-auto w-full max-w-2xl space-y-10 md:max-w-3xl">
			<div className="space-y-6">
				<div className="space-y-3 text-center">
					<p className="text-muted-foreground text-[11px] font-semibold tracking-[0.14em] uppercase">
						{stepCountLabel}
					</p>
					<h2 className="text-foreground text-2xl font-semibold tracking-tight md:text-3xl">
						{headline}
					</h2>
					{supporting ? (
						<p className="text-muted-foreground mx-auto max-w-lg text-sm leading-relaxed text-pretty">
							{supporting}
						</p>
					) : null}
				</div>
				<HorizontalStepper steps={steps} currentIndex={currentIndex} className="px-1 sm:px-4" />
				{profile.hasEnpProfile ? (
					<div className="flex justify-center pt-2">
						<CancelEnpOnboardingButton variant="link" className="text-muted-foreground" />
					</div>
				) : null}
			</div>
			{children}
		</div>
	)
}

function EnpOnboardingComplete() {
	const router = useRouter()
	return (
		<Card className="border-border/80 w-full shadow-md">
			<CardHeader className="space-y-1 pb-2 text-center sm:text-left">
				<CardTitle className="text-xl md:text-2xl">ENP setup complete</CardTitle>
				<CardDescription className="text-base leading-relaxed">
					Compliance steps are on file. Use the dashboard for appointments, QuickSign,
					certification, and registry.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3 pt-2">
				<p className="text-muted-foreground text-sm leading-relaxed">
					Reminder: add or update your commission details in Profile so bookings and registry
					records stay accurate.
				</p>
				<div className="flex flex-wrap gap-3">
					<Button
						type="button"
						size="lg"
						className="min-h-11"
						onClick={() => router.push("/dashboard")}
					>
						Go to dashboard
					</Button>
					<Link href="/profile" className={buttonVariants({ variant: "outline", size: "lg" })}>
						Profile
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}

function EnpCommissionStep() {
	const router = useRouter()

	return (
		<Card className="border-border/80 w-full shadow-md">
			<CardContent className="space-y-5 p-6 sm:p-8">
				<p className="text-muted-foreground text-sm leading-relaxed">
					Add your commission number and validity in your profile so bookings and registry workflows
					stay accurate. You can update this anytime — your dashboard is ready now.
				</p>
				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button
						type="button"
						size="lg"
						className="min-h-11"
						onClick={() => router.push("/dashboard")}
					>
						Open dashboard
					</Button>
					<Link href="/profile" className={buttonVariants({ variant: "outline", size: "lg" })}>
						Edit commission in profile
					</Link>
				</div>
			</CardContent>
		</Card>
	)
}

function EnpReviewStep() {
	return (
		<Card className="border-border/80 w-full shadow-md">
			<CardContent className="space-y-5 p-6 sm:p-8">
				<p className="text-muted-foreground text-sm leading-relaxed">
					Check the compliance tiles on your dashboard for anything still pending.
				</p>
				<Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
					Open dashboard
				</Link>
			</CardContent>
		</Card>
	)
}

export function RealOnboardingFlow() {
	const router = useRouter()
	const profileQ = useAuthProfileMeQuery()

	const profile = profileQ.data as UserProfile | undefined

	React.useEffect(() => {
		if (!profile) return
		if (!shouldRedirectToOnboarding(profile)) {
			router.replace("/dashboard")
		}
	}, [profile, router])

	if (profileQ.isPending) {
		return (
			<Card className="border-border/80 mx-auto w-full max-w-2xl md:max-w-3xl">
				<CardContent className="py-20">
					<LoadingState message="Loading your setup…" />
				</CardContent>
			</Card>
		)
	}
	if (profileQ.isError || !profile) {
		return (
			<Card className="border-border/80 mx-auto w-full max-w-2xl md:max-w-3xl">
				<CardContent className="py-16">
					<ErrorState
						message="Could not load your account. Try signing in again."
						onRetry={() => void profileQ.refetch()}
					/>
				</CardContent>
			</Card>
		)
	}

	if (!profile.hasEnpProfile && !shouldRedirectToOnboarding(profile)) {
		return (
			<Card className="border-border/80 mx-auto w-full max-w-2xl md:max-w-3xl">
				<CardContent className="py-10">
					<LoadingState message="Taking you to the dashboard…" />
				</CardContent>
			</Card>
		)
	}

	if (profile.onboardingStep === "complete") {
		const lmsOnboarding = isLmsOnboardingEnabled(profile)
		return (
			<OnboardingFrame profile={profile} lmsOnboarding={lmsOnboarding}>
				<EnpOnboardingComplete />
			</OnboardingFrame>
		)
	}

	if (!profile.hasEnpProfile) {
		return (
			<Card className="border-border/80 mx-auto w-full max-w-2xl md:max-w-3xl">
				<CardContent className="py-10">
					<LoadingState message="Taking you to the dashboard…" />
				</CardContent>
			</Card>
		)
	}

	const step = profile.onboardingStep
	const lmsOnboarding = isLmsOnboardingEnabled(profile)

	return (
		<OnboardingFrame profile={profile} lmsOnboarding={lmsOnboarding}>
			{step === "professional_profile" && <EnpProfessionalProfileStep profile={profile} />}

			{step === "certification_course" && (
				<CertificationCourseStep lmsIntegrationEnabled={lmsOnboarding} />
			)}

			{step === "certificate_upload" &&
				(lmsOnboarding ? (
					<CertificationCourseStep lmsIntegrationEnabled={lmsOnboarding} />
				) : (
					<EnpCertExamStep />
				))}

			{step === "commission_details" && <EnpCommissionStep />}

			{step === "review" && <EnpReviewStep />}
		</OnboardingFrame>
	)
}

import type { UserProfile } from "@repo/contracts"

export const ONBOARDING_STEP_LABEL: Record<UserProfile["onboardingStep"], string> = {
	profile: "Get started",
	client_profile: "Contact details",
	professional_profile: "Practice profile",
	identity_verification: "KYC",
	certification_course: "Course",
	certificate_upload: "Certification exam",
	commission_details: "Commission",
	review: "Final review",
	complete: "Done",
}

const ENP_FLOW_DISPLAY: UserProfile["onboardingStep"][] = [
	"professional_profile",
	"certification_course",
	"certificate_upload",
	"commission_details",
]

const ENP_FLOW_DISPLAY_LMS: UserProfile["onboardingStep"][] = [
	"professional_profile",
	"certification_course",
	"commission_details",
]

export function onboardingCurrentHeadline(
	step: UserProfile["onboardingStep"],
	_role: UserProfile["role"],
	options?: { lmsIntegration?: boolean }
): string {
	if (step === "professional_profile") return "Your practice details"
	if (step === "certification_course") {
		return options?.lmsIntegration ? "Course & Final Quiz on QLearn" : "Certification course"
	}
	if (step === "certificate_upload") return "Certification exam"
	if (step === "commission_details") return "Notary commission"
	if (step === "review") return "Review and finish"
	if (step === "complete") return "ENP setup complete"
	return "Continue ENP setup"
}

export function onboardingCurrentSupportingCopy(
	step: UserProfile["onboardingStep"],
	_role: UserProfile["role"],
	options?: { lmsIntegration?: boolean }
): string {
	if (step === "professional_profile") {
		return "Add your roll number, commission expiry, jurisdiction, and office address as used for Philippine ENP records."
	}
	if (step === "certification_course") {
		if (options?.lmsIntegration) {
			return "Complete all modules and the Final Quiz on QLearn (Mastering Quanby Legal), then sync progress here."
		}
		return "Work through the five modules (nine lessons), then take the multiple-choice certification exam."
	}
	if (step === "certificate_upload") {
		return "Fifty questions from the attorney pool, shuffled each attempt — passing score 70% (35/50). Failed attempts require a ₱500 retake payment."
	}
	if (step === "commission_details") {
		return "Add commission details in your profile so clients can book you as certified."
	}
	return ""
}

/** ENP certification onboarding only (clients skip this flow). */
export function resolveOnboardingStepper(
	profile: UserProfile,
	options?: { lmsIntegration?: boolean }
): {
	steps: { key: string; label: string }[]
	currentIndex: number
	stepCountLabel: string
} {
	const flow = options?.lmsIntegration ? ENP_FLOW_DISPLAY_LMS : ENP_FLOW_DISPLAY
	const steps = flow.map(s => ({
		key: s,
		label: ONBOARDING_STEP_LABEL[s],
	}))
	let idx = flow.indexOf(profile.onboardingStep)
	if (profile.onboardingStep === "identity_verification" && profile.hasEnpProfile) {
		idx = flow.indexOf("certification_course")
	}
	if (profile.onboardingStep === "certificate_upload" && options?.lmsIntegration) {
		idx = flow.indexOf("certification_course")
	}
	if (profile.onboardingStep === "review") idx = flow.length - 1
	if (idx < 0) idx = 0
	return {
		steps,
		currentIndex: idx,
		stepCountLabel: `Step ${idx + 1} of ${steps.length}`,
	}
}

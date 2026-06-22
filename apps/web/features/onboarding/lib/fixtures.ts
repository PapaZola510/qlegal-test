"use client"

export type UserRole = "enp" | "client"

export type OnboardingStep = "profile" | "identity" | "exam" | "certified"

export type IdentityVerificationStatus = "pending" | "verified" | "failed" | "needs_review"

export type ExamStatus = "not_started" | "in_progress" | "passed" | "failed" | "retake_blocked"

export interface EnpProfile {
	firstName: string
	middleName: string
	lastName: string
	email: string
	phone: string
	rollNumber: string
	npn: string
	ptrNumber: string
	ibpNumber: string
	mcleNumber: string
	officeAddress: string
	residentialAddress: string
	commissionArea: string
}

export interface ClientProfile {
	firstName: string
	lastName: string
	email: string
	phone: string
}

export const FIXTURE_ENP_PROFILE: EnpProfile = {
	firstName: "Maria",
	middleName: "Santos",
	lastName: "Cruz",
	email: "maria.cruz@example.com",
	phone: "+63 917 123 4567",
	rollNumber: "12345",
	npn: "NPN-2024-001234",
	ptrNumber: "PTR-2024-5678",
	ibpNumber: "IBP-001234",
	mcleNumber: "MCLE-VII-2024-001",
	officeAddress: "Unit 501, Ayala Tower, Makati City",
	residentialAddress: "123 Sampaguita St., Quezon City",
	commissionArea: "National Capital Region",
}

export const FIXTURE_CLIENT_PROFILE: ClientProfile = {
	firstName: "Juan",
	lastName: "Dela Cruz",
	email: "juan@example.com",
	phone: "+63 918 987 6543",
}

export const ENP_STEPS: { key: OnboardingStep; label: string }[] = [
	{ key: "profile", label: "Profile" },
	{ key: "identity", label: "Identity" },
	{ key: "exam", label: "Exam" },
	{ key: "certified", label: "Certified" },
]

export const CLIENT_STEPS: { key: "profile" | "dashboard"; label: string }[] = [
	{ key: "profile", label: "Profile" },
	{ key: "dashboard", label: "Dashboard" },
]

const STORAGE_KEY = "qlegal-onboarding-state"

export interface OnboardingState {
	role: UserRole
	currentStep: number
	identityStatus: IdentityVerificationStatus
	examStatus: ExamStatus
	profileComplete: boolean
}

const DEFAULT_STATE: OnboardingState = {
	role: "enp",
	currentStep: 0,
	identityStatus: "pending",
	examStatus: "not_started",
	profileComplete: false,
}

export function loadOnboardingState(): OnboardingState {
	if (typeof window === "undefined") return DEFAULT_STATE
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return DEFAULT_STATE
		return { ...DEFAULT_STATE, ...JSON.parse(raw) }
	} catch {
		return DEFAULT_STATE
	}
}

export function saveOnboardingState(state: Partial<OnboardingState>) {
	if (typeof window === "undefined") return
	const current = loadOnboardingState()
	const next = { ...current, ...state }
	localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
	return next
}

export function resetOnboardingState() {
	if (typeof window === "undefined") return
	localStorage.removeItem(STORAGE_KEY)
}

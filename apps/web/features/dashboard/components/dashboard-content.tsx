"use client"

import * as React from "react"
import type { Route } from "next"
import Link from "next/link"
import {
	Award04FreeIcons,
	Calendar03FreeIcons,
	CalendarUserFreeIcons,
	CheckmarkCircleFreeIcons,
	CourtHouseFreeIcons,
	Download04FreeIcons,
	IdentificationFreeIcons,
	IdentityCardFreeIcons,
	JusticeScaleFreeIcons,
	LicenseFreeIcons,
	Mail02FreeIcons,
	MedalFreeIcons,
	Message01FreeIcons,
	Refresh01FreeIcons,
	SecurityCheckFreeIcons,
	Shield01FreeIcons,
	SignatureFreeIcons,
	SmartPhoneFreeIcons,
	StampFreeIcons,
	TaskDoneFreeIcons,
	UserCircleFreeIcons,
	UserShieldFreeIcons,
	ViewFreeIcons,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useQueryClient } from "@tanstack/react-query"
import { format } from "date-fns"
import { toast } from "sonner"

import type {
	EnpCommissionApplication,
	LmsTrainingCertificate,
	MaintenanceWindow,
	UserProfile,
} from "@repo/contracts"

import { ErrorState } from "@/core/components/shared-states"
import { Avatar, AvatarFallback, AvatarImage } from "@/core/components/ui/avatar"
import { Badge } from "@/core/components/ui/badge"
import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { Skeleton } from "@/core/components/ui/skeleton"
import { cn, getInitials } from "@/core/lib/utils"
import {
	selectAppointmentList,
	useAppointmentsQuery,
} from "@/features/appointments/api/appointments.hooks"
import {
	useAuthProfileMeQuery,
	useMaintenanceNoticesQuery,
} from "@/features/dashboard/api/dashboard.hooks"
import { BecomeEnpCard } from "@/features/dashboard/components/become-enp-card"
import { DocumentVerifierCard } from "@/features/dashboard/components/document-verifier-card"
import { EnpCertificateViewModal } from "@/features/dashboard/components/enp-certificate-view-modal"
import { EnpProfileReminder } from "@/features/dashboard/components/enp-profile-reminder"
import { useMyEnpCommissionApplicationsQuery } from "@/features/enp-commission-application/api/enp-commission-application.hooks"
import { CommissionSummaryHearingNotice } from "@/features/enp-commission-application/components/commission-summary-hearing-notice"
import {
	downloadLmsCertificate,
	isLmsCertificateDownloadAvailable,
	isLocallyGeneratedCertificateId,
	isQlearnCertificateId,
} from "@/features/integration/lib/lms-certificate-download"
import {
	invalidateAuthProfileQuery,
	useLmsTrainingCertificateQuery,
	useSyncLmsCourseCompletionMutation,
} from "@/features/onboarding/api/lms-training.hooks"
import { profilePath } from "@/features/profile/lib/profile-routes"
import { env } from "@/env"

const SC_EFILING_URL = "https://efiling.sc.judiciary.gov.ph"
function maintenanceNoticeCopy(window: MaintenanceWindow): string {
	const starts = format(new Date(window.startsAt), "PPp")
	const ends = format(new Date(window.endsAt), "PPp")
	const duration =
		window.durationMinutes >= 60
			? `${Math.floor(window.durationMinutes / 60)}h ${window.durationMinutes % 60}m`
			: `${window.durationMinutes}m`
	return `${starts} to ${ends} (${duration})`
}

function MaintenanceNoticesBanner({ notices }: { notices: MaintenanceWindow[] }) {
	if (notices.length === 0) return null
	return (
		<Card className="border-border shadow-sm">
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Upcoming Maintenance Windows</CardTitle>
				<CardDescription>
					Scheduled platform maintenance. Some features may be unavailable during these windows.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				{notices.map(notice => (
					<div key={notice.id} className="border-border rounded-md border p-3">
						<p className="text-sm font-semibold">{notice.title}</p>
						<p className="text-muted-foreground text-xs">{maintenanceNoticeCopy(notice)}</p>
						<p className="text-sm leading-relaxed">{notice.message}</p>
					</div>
				))}
			</CardContent>
		</Card>
	)
}

type HugeIcon = React.ComponentProps<typeof HugeiconsIcon>["icon"]

function roleDisplayLabel(role: UserProfile["role"]): string {
	switch (role) {
		case "enp":
			return "ENP"
		case "client":
			return "Principal"
		case "admin":
			return "Administrator"
		case "sub_org_admin":
			return "Organization admin"
		default:
			return "User"
	}
}

function roleIcon(role: UserProfile["role"]): HugeIcon {
	switch (role) {
		case "enp":
		case "admin":
		case "sub_org_admin":
			return UserShieldFreeIcons
		default:
			return UserCircleFreeIcons
	}
}

function onboardingCopy(step: UserProfile["onboardingStep"]): { title: string; subtitle: string } {
	if (step === "complete") {
		return { title: "Complete", subtitle: "All steps complete" }
	}
	if (step === "client_profile") {
		return { title: "Client profile", subtitle: "Add phone and optional organization details" }
	}
	if (step === "profile") {
		return { title: "Get started", subtitle: "Account setup" }
	}
	return { title: "In progress", subtitle: "Finish remaining onboarding steps" }
}

function kycCopy(status: UserProfile["identityStatus"]): { title: string; subtitle: string } {
	switch (status) {
		case "verified":
			return { title: "Verified", subtitle: "KYC complete" }
		case "pending":
			return { title: "In progress", subtitle: "Verification under review" }
		default:
			return { title: "Not done", subtitle: "Complete KYC verification" }
	}
}

function certificationCopy(status: UserProfile["certificateStatus"]): {
	title: string
	subtitle: string
} {
	switch (status) {
		case "active":
			return { title: "ENP Certified", subtitle: "" }
		case "passed":
			return { title: "Exam passed", subtitle: "Finalize certificate" }
		default:
			return { title: "Not certified", subtitle: "Complete certification" }
	}
}

function certRefForTile(profile: UserProfile): string {
	if (profile.commissionNumber) return profile.commissionNumber
	return profile.id.replace(/-/g, "").toUpperCase().slice(-8)
}

function displayCertificateId(profile: UserProfile): string {
	if (profile.certificateId && !isLocallyGeneratedCertificateId(profile.certificateId)) {
		return profile.certificateId
	}
	try {
		const created =
			profile.createdAt instanceof Date ? profile.createdAt : new Date(profile.createdAt)
		const d = format(created, "yyyyMMdd")
		const tail = profile.id.replace(/-/g, "").slice(0, 12).toUpperCase()
		return `QL-ENP-${d}-${tail}`
	} catch {
		return `QL-ENP-${profile.id.replace(/-/g, "").slice(0, 20).toUpperCase()}`
	}
}

function identityKycRows(profile: UserProfile): {
	liveness: string
	idUpload: string
	expiry: string
} {
	if (profile.identityStatus === "verified") {
		return {
			liveness: "Complete",
			idUpload: "Complete",
			expiry: `${profile.identityVerificationValidityDays}-day reverification window`,
		}
	}
	return { liveness: "Pending", idUpload: "Pending", expiry: "—" }
}

function scCommissionBadge(profile: UserProfile): { label: string; hint: string } {
	if (profile.role !== "enp") {
		return { label: "—", hint: "ENP accounts only" }
	}
	if (profile.certificateStatus !== "active") {
		return { label: "—", hint: "Complete certification first" }
	}
	const validation = profile.commissionValidation
	if (validation?.blocked) {
		return {
			label: "Blocked",
			hint: validation.blockReason ?? "Commission not active for notarial acts",
		}
	}
	if (validation?.status === "expiring" && validation.warningTier !== null) {
		const days = validation.daysRemaining
		return {
			label: `${validation.warningTier}-day notice`,
			hint:
				days !== null
					? `Commission expires in ${days} day${days === 1 ? "" : "s"} — renew before expiry`
					: "Commission expiring soon — renew with the Supreme Court",
		}
	}
	if (!profile.commissionNumber || profile.onboardingStep !== "complete") {
		return { label: "Pending", hint: "Awaiting SC activation" }
	}
	return { label: "Active", hint: "Commission on file with the Supreme Court" }
}

function scCommissionDetail(profile: UserProfile): {
	headline: string
	body: string
	showChecklist: boolean
	showPendingActions: boolean
} | null {
	if (profile.role !== "enp" || profile.certificateStatus !== "active") {
		return null
	}
	const validation = profile.commissionValidation
	const badge = scCommissionBadge(profile)
	if (validation?.blocked) {
		return {
			headline: "Commission not active",
			body:
				validation.blockReason ??
				"Your notarial commission is not active. Notarial acts are blocked until your commission is renewed and your profile is updated.",
			showChecklist: true,
			showPendingActions: true,
		}
	}
	if (validation?.status === "expiring") {
		return {
			headline: "Commission expiring soon",
			body: `Your commission is valid until ${validation.commissionExpiry ?? profile.commissionExpiry ?? "—"}. Renew with the Supreme Court and update your profile to avoid interruption.`,
			showChecklist: false,
			showPendingActions: false,
		}
	}
	if (badge.label === "Active") {
		return {
			headline: "Commission active",
			body: "Your Electronic Notary Public commission is on file. You may proceed with notarization services according to Supreme Court rules.",
			showChecklist: false,
			showPendingActions: false,
		}
	}
	return {
		headline: "Pending SC Activation",
		body: "Your ENP commission must be activated by the Supreme Court before you can legally practice as an Electronic Notary Public.",
		showChecklist: true,
		showPendingActions: true,
	}
}

type StatTone = "neutral" | "success" | "warning"

function statusDot(tone: StatTone) {
	if (tone === "success") {
		return (
			<span className="inline-flex size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
		)
	}
	if (tone === "warning") {
		return <span className="inline-flex size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
	}
	return null
}

function StatCard({
	label,
	title,
	subtitle,
	icon,
	tone = "neutral",
	children,
}: {
	label: string
	title: string
	subtitle: string
	icon: HugeIcon
	tone?: StatTone
	children?: React.ReactNode
}) {
	return (
		<Card className="border-border shadow-sm transition-colors">
			<CardHeader className="pb-2">
				<div className="flex items-start justify-between gap-3">
					<p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
						{label}
					</p>
					<span
						className={cn(
							"bg-primary/10 text-primary inline-flex size-9 items-center justify-center rounded-lg"
						)}
					>
						<HugeiconsIcon icon={icon} className="size-[18px]" strokeWidth={2} />
					</span>
				</div>
				<div className="flex items-center gap-2">
					{statusDot(tone)}
					<p className="text-foreground text-base leading-snug font-semibold">{title}</p>
				</div>
			</CardHeader>
			<CardContent className="text-muted-foreground pt-0 text-sm leading-relaxed">
				{children ?? subtitle}
			</CardContent>
		</Card>
	)
}

function CardTitleWithIcon({ icon, children }: { icon: HugeIcon; children: React.ReactNode }) {
	return (
		<div className="flex items-center gap-2.5">
			<span className="bg-muted text-muted-foreground inline-flex size-8 items-center justify-center rounded-md">
				<HugeiconsIcon icon={icon} className="size-4" strokeWidth={2} />
			</span>
			<CardTitle className="text-base">{children}</CardTitle>
		</div>
	)
}

function commissionApplicationAction(application: EnpCommissionApplication | null): {
	href: Route
	label: string
	variant: "default" | "outline"
} {
	const fallbackHref = "/enp-commission-application" as Route
	if (!application) {
		return { href: fallbackHref, label: "Submit requirements", variant: "default" }
	}

	const lobbyPath = application.summaryHearing.lobbyPath?.trim()
	const outcomePath = application.summaryHearing.roomId
		? (`/commission-hearings/${application.summaryHearing.roomId}/notice` as Route)
		: null
	if (
		outcomePath &&
		(application.hearingStatus === "ended" ||
			application.status === "approved" ||
			application.status === "rejected")
	) {
		return {
			href: outcomePath,
			label: "View hearing outcome",
			variant: "default",
		}
	}
	if (application.status === "hearing_scheduled" && lobbyPath) {
		return {
			href: lobbyPath as Route,
			label: "Open hearing lobby",
			variant: "default",
		}
	}

	if (application.status === "rejected") {
		return { href: fallbackHref, label: "Review application", variant: "default" }
	}

	return { href: fallbackHref, label: "View submitted requirements", variant: "outline" }
}

function ProfileHeaderCard({ profile }: { profile: UserProfile }) {
	const certified = profile.certificateStatus === "active"
	const kycVerified = profile.identityStatus === "verified"

	return (
		<Card className="border-border relative overflow-hidden shadow-sm">
			<div
				className="from-primary/10 pointer-events-none absolute inset-0 -z-10 bg-gradient-to-br via-transparent to-transparent"
				aria-hidden
			/>
			<CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8">
				<Avatar className="border-border size-20 border sm:size-24">
					{profile.avatarUrl ? <AvatarImage src={profile.avatarUrl} alt="" /> : null}
					<AvatarFallback className="text-lg font-medium">
						{getInitials(profile.name)}
					</AvatarFallback>
				</Avatar>
				<div className="min-w-0 flex-1 space-y-3">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">{profile.name}</h1>
						<div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
							<span className="inline-flex items-center gap-1.5">
								<HugeiconsIcon icon={Mail02FreeIcons} className="size-4" strokeWidth={2} />
								{profile.email}
							</span>
							{profile.phone ? (
								<span className="inline-flex items-center gap-1.5">
									<HugeiconsIcon icon={SmartPhoneFreeIcons} className="size-4" strokeWidth={2} />
									{profile.phone}
								</span>
							) : null}
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="secondary" className="font-normal">
							<HugeiconsIcon icon={roleIcon(profile.role)} strokeWidth={2} />
							{roleDisplayLabel(profile.role)}
						</Badge>
						{certified ? (
							<Badge variant="default" className="font-normal">
								<HugeiconsIcon icon={MedalFreeIcons} strokeWidth={2} />
								ENP Certified
							</Badge>
						) : null}
						{kycVerified ? (
							<Badge variant="outline" className="font-normal">
								<HugeiconsIcon icon={SecurityCheckFreeIcons} strokeWidth={2} />
								KYC Verified
							</Badge>
						) : null}
					</div>
				</div>
			</CardContent>
		</Card>
	)
}

function issuedLmsCertificate(
	data: LmsTrainingCertificate | undefined
): Extract<LmsTrainingCertificate, { issued: true }> | null {
	return data?.issued === true ? data : null
}

function EnpDashboard({ profile }: { profile: UserProfile }) {
	const commissionAppsQ = useMyEnpCommissionApplicationsQuery()
	const latestCommissionApplication = commissionAppsQ.data?.[0] ?? null
	const latestCommissionHearing = latestCommissionApplication?.summaryHearing.scheduledAt
		? latestCommissionApplication.summaryHearing
		: commissionAppsQ.data?.find(app => app.summaryHearing.scheduledAt)?.summaryHearing
	const commissionAction = commissionApplicationAction(latestCommissionApplication)
	const queryClient = useQueryClient()
	const [certificateModalOpen, setCertificateModalOpen] = React.useState(false)
	const apptQ = useAppointmentsQuery({ page: 1, limit: 1 })
	const maintenanceQ = useMaintenanceNoticesQuery()
	const pendingCount = selectAppointmentList(apptQ.data)?.statusCounts.pending ?? 0
	const pendingLabel =
		pendingCount === 0
			? "No pending requests"
			: `${pendingCount} pending request${pendingCount === 1 ? "" : "s"}`

	const ob = onboardingCopy(profile.onboardingStep)
	const kyc = kycCopy(profile.identityStatus)
	const cert = certificationCopy(profile.certificateStatus)
	const lmsEnabled = env.NEXT_PUBLIC_ENABLE_LMS_INTEGRATION === "true"
	const certified = profile.certificateStatus === "active"
	const qlearnCertQ = useLmsTrainingCertificateQuery(lmsEnabled)
	const syncFromQlearn = useSyncLmsCourseCompletionMutation()
	const qlearnCert = issuedLmsCertificate(qlearnCertQ.data as LmsTrainingCertificate | undefined)
	const hasQlearnCertificate = Boolean(qlearnCert)

	React.useEffect(() => {
		if (!lmsEnabled || !qlearnCert?.certificateNumber) return
		invalidateAuthProfileQuery(queryClient)
	}, [lmsEnabled, qlearnCert?.certificateNumber, queryClient])

	React.useEffect(() => {
		if (!lmsEnabled || certified || syncFromQlearn.isPending) return
		void syncFromQlearn.mutateAsync(undefined).then(() => {
			void qlearnCertQ.refetch()
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps -- one-time sync when dashboard loads for uncertified ENPs
	}, [lmsEnabled])
	const profileCertId =
		profile.certificateId && !isLocallyGeneratedCertificateId(profile.certificateId)
			? profile.certificateId
			: null
	const certId = lmsEnabled
		? (qlearnCert?.certificateNumber ??
			(isQlearnCertificateId(profileCertId) ? profileCertId : null) ??
			(qlearnCertQ.isLoading || qlearnCertQ.isFetching
				? "Loading from QLearn…"
				: "Not issued by QLearn yet"))
		: displayCertificateId(profile)
	const certRef = certRefForTile(profile)
	const scTop = scCommissionBadge(profile)
	const scDetail = scCommissionDetail(profile)
	const idRows = identityKycRows(profile)

	const canViewCertificate = lmsEnabled
		? hasQlearnCertificate || isQlearnCertificateId(profileCertId)
		: certified && isLmsCertificateDownloadAvailable(profileCertId ?? profile.certificateId)

	const certificateViewDisabled =
		!canViewCertificate ||
		(lmsEnabled && !hasQlearnCertificate && (qlearnCertQ.isLoading || qlearnCertQ.isFetching))

	const onDownloadCertificate = () => {
		if (lmsEnabled || isQlearnCertificateId(certId) || isQlearnCertificateId(profileCertId)) {
			void downloadLmsCertificate()
			return
		}
		if (isLmsCertificateDownloadAvailable(profileCertId)) {
			void downloadLmsCertificate()
			return
		}
		toast.message("Certificate PDF", {
			description: "Download will be available from your certification record.",
		})
	}

	const onRefreshQlearnCertificate = () => {
		void syncFromQlearn
			.mutateAsync(undefined)
			.then(() => {
				void qlearnCertQ.refetch()
				toast.success("Refreshed certificate from QLearn")
			})
			.catch((e: unknown) =>
				toast.error(e instanceof Error ? e.message : "Could not refresh from QLearn")
			)
	}

	const certSubtitle =
		profile.certificateStatus === "active" ? (
			<span className="text-foreground font-medium">ID: {certRef}</span>
		) : (
			cert.subtitle
		)

	const onboardingTone: StatTone = profile.onboardingStep === "complete" ? "success" : "warning"
	const certTone: StatTone =
		profile.certificateStatus === "active"
			? "success"
			: profile.certificateStatus === "passed"
				? "warning"
				: "neutral"
	const kycTone: StatTone =
		profile.identityStatus === "verified"
			? "success"
			: profile.identityStatus === "pending"
				? "warning"
				: "neutral"
	const scTone: StatTone =
		scTop.label === "Active" ? "success" : scTop.label === "Pending" ? "warning" : "neutral"

	return (
		<div className="space-y-8">
			<MaintenanceNoticesBanner
				notices={(maintenanceQ.data as MaintenanceWindow[] | undefined) ?? []}
			/>
			<ProfileHeaderCard profile={profile} />

			{latestCommissionHearing?.scheduledAt ? (
				<CommissionSummaryHearingNotice hearing={latestCommissionHearing} />
			) : null}

			{/* Status tiles — onboarding through SC commission */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				<StatCard
					label="Onboarding"
					title={ob.title}
					subtitle={ob.subtitle}
					icon={TaskDoneFreeIcons}
					tone={onboardingTone}
				/>
				<StatCard
					label="Account Role"
					title={roleDisplayLabel(profile.role)}
					subtitle="Platform access level"
					icon={roleIcon(profile.role)}
				/>
				<StatCard
					label="Certification"
					title={cert.title}
					subtitle={cert.subtitle}
					icon={MedalFreeIcons}
					tone={certTone}
				>
					{certSubtitle}
				</StatCard>
				<StatCard
					label="KYC Status"
					title={kyc.title}
					subtitle={kyc.subtitle}
					icon={IdentityCardFreeIcons}
					tone={kycTone}
				/>
				<StatCard
					label="SC Commission"
					title={scTop.label}
					subtitle={scTop.hint}
					icon={JusticeScaleFreeIcons}
					tone={scTone}
				/>
			</div>

			{/* ENP profile completeness reminder for Supreme Court sync */}
			<EnpProfileReminder profile={profile} />

			{certified ? (
				<Card className="border-border shadow-sm">
					<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<CardTitleWithIcon icon={CourtHouseFreeIcons}>
								Electronic Notarial Commission
							</CardTitleWithIcon>
							<CardDescription className="text-muted-foreground pl-[42px] text-sm leading-relaxed">
								Submit your personal qualifications, supporting documents, and undertakings to the
								Electronic Notary Administrator (ENA) for commission processing.
							</CardDescription>
						</div>
						<Link
							href={commissionAction.href}
							className={buttonVariants({
								variant: commissionAction.variant,
								className: "shrink-0",
							})}
						>
							{commissionAction.label}
						</Link>
					</CardHeader>
				</Card>
			) : null}

			{/* Certificate */}
			<Card className="border-border shadow-sm">
				<CardHeader>
					<CardTitleWithIcon icon={LicenseFreeIcons}>
						{lmsEnabled ? "Your QLearn Certificate" : "Your Certificate"}
					</CardTitleWithIcon>
					{lmsEnabled ? (
						<CardDescription className="pl-[42px]">
							Issued by QLearn after you pass the Final Quiz on{" "}
							<strong>Mastering Quanby Legal</strong>.
						</CardDescription>
					) : null}
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="bg-muted/40 border-border/60 rounded-md border px-3 py-2.5 font-mono text-sm break-all">
						{certId}
					</div>
					{qlearnCert ? (
						<p className="text-muted-foreground text-sm">
							Issued {new Date(qlearnCert.issuedAt).toLocaleDateString()} ·{" "}
							{qlearnCert.certificateNumber}
						</p>
					) : lmsEnabled && !qlearnCertQ.isLoading && !qlearnCertQ.isFetching ? (
						<p className="text-muted-foreground text-sm">
							Certificate not available yet. Finish the Final Quiz on QLearn, then click Refresh.
						</p>
					) : null}
					<div className="flex flex-wrap gap-2">
						<Button
							type="button"
							size="lg"
							disabled={certificateViewDisabled}
							onClick={() => setCertificateModalOpen(true)}
						>
							<HugeiconsIcon icon={ViewFreeIcons} className="mr-2 size-4" strokeWidth={2} />
							View Certificate
						</Button>
						<Button
							type="button"
							variant="outline"
							size="lg"
							disabled={certificateViewDisabled}
							onClick={onDownloadCertificate}
						>
							<HugeiconsIcon icon={Download04FreeIcons} className="mr-2 size-4" strokeWidth={2} />
							Download Certificate
						</Button>
						{lmsEnabled ? (
							<Button
								type="button"
								variant="outline"
								size="lg"
								disabled={syncFromQlearn.isPending}
								onClick={onRefreshQlearnCertificate}
							>
								<HugeiconsIcon icon={Refresh01FreeIcons} className="mr-2 size-4" strokeWidth={2} />
								{syncFromQlearn.isPending ? "Refreshing…" : "Refresh"}
							</Button>
						) : null}
					</div>
					<EnpCertificateViewModal
						open={certificateModalOpen}
						onOpenChange={setCertificateModalOpen}
						certificateId={certId}
					/>
				</CardContent>
			</Card>

			{/* Identity Verification */}
			<Card className="border-border shadow-sm">
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<CardTitleWithIcon icon={Shield01FreeIcons}>Identity Verification</CardTitleWithIcon>
					<Link
						href={profilePath(profile.role, { focus: "kyc" })}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						Redo KYC Verification
					</Link>
				</CardHeader>
				<CardContent>
					<dl className="divide-border divide-y">
						<div className="flex items-center justify-between gap-4 py-3 first:pt-0">
							<dt className="text-muted-foreground flex items-center gap-2 text-sm">
								<HugeiconsIcon icon={UserCircleFreeIcons} className="size-4" strokeWidth={2} />
								Liveness Check
							</dt>
							<dd className="flex items-center gap-2 text-sm font-medium">
								{statusDot(idRows.liveness === "Complete" ? "success" : "warning")}
								{idRows.liveness}
							</dd>
						</div>
						<div className="flex items-center justify-between gap-4 py-3">
							<dt className="text-muted-foreground flex items-center gap-2 text-sm">
								<HugeiconsIcon icon={IdentificationFreeIcons} className="size-4" strokeWidth={2} />
								ID Upload
							</dt>
							<dd className="flex items-center gap-2 text-sm font-medium">
								{statusDot(idRows.idUpload === "Complete" ? "success" : "warning")}
								{idRows.idUpload}
							</dd>
						</div>
						<div className="flex items-center justify-between gap-4 py-3 last:pb-0">
							<dt className="text-muted-foreground flex items-center gap-2 text-sm">
								<HugeiconsIcon icon={Calendar03FreeIcons} className="size-4" strokeWidth={2} />
								KYC Expiry
							</dt>
							<dd className="text-sm font-medium">{idRows.expiry}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			{/* SC Commission Status (detail) — certified ENPs only */}
			{scDetail ? (
				<Card className="border-border shadow-sm">
					<CardHeader>
						<CardTitleWithIcon icon={CourtHouseFreeIcons}>SC Commission Status</CardTitleWithIcon>
						<CardDescription className="text-foreground flex items-center gap-2 pl-[42px] text-base font-semibold">
							{statusDot(scDetail.headline === "Commission active" ? "success" : "warning")}
							{scDetail.headline}
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<p className="text-muted-foreground text-sm leading-relaxed">{scDetail.body}</p>
						{scDetail.showChecklist ? (
							<div>
								<p className="mb-2 text-sm font-medium">Required steps after certification:</p>
								<ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm leading-relaxed">
									<li>
										Submit your{" "}
										<Link
											href="/enp-commission-application"
											className="text-primary font-medium underline underline-offset-2"
										>
											application for electronic notarial commission
										</Link>{" "}
										to the Electronic Notary Administrator (ENA)
									</li>
									<li>
										Print your ENP certificate and submit it to the Supreme Court of the Philippines
									</li>
									<li>
										Complete the SC e-filing at{" "}
										<a
											href={SC_EFILING_URL}
											target="_blank"
											rel="noopener noreferrer"
											className="text-primary font-medium underline underline-offset-2"
										>
											efiling.sc.judiciary.gov.ph
										</a>
									</li>
									<li>Wait for SC to add you to the national ENP registry</li>
									<li>Commission status will be updated once SC activates your account</li>
								</ul>
							</div>
						) : null}
						{scDetail.showPendingActions ? (
							<div className="flex flex-wrap gap-2 pt-2">
								<Link
									href={commissionAction.href}
									className={buttonVariants({
										size: "default",
										variant: commissionAction.variant,
									})}
								>
									{commissionAction.label}
								</Link>
								<a
									href={SC_EFILING_URL}
									target="_blank"
									rel="noopener noreferrer"
									className={buttonVariants({ variant: "outline", size: "default" })}
								>
									Go to SC e-Filing Portal
								</a>
								<Button
									type="button"
									variant="outline"
									disabled={!certified}
									onClick={onDownloadCertificate}
								>
									Download Certificate for SC Submission
								</Button>
							</div>
						) : null}
					</CardContent>
				</Card>
			) : null}

			{/* Notarization Services */}
			<section className="space-y-3">
				<div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
					<HugeiconsIcon icon={StampFreeIcons} className="size-4" strokeWidth={2} />
					Notarization Services
				</div>
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<Card className="border-border shadow-sm">
						<CardHeader>
							<CardTitleWithIcon icon={CalendarUserFreeIcons}>
								Manage Appointments
							</CardTitleWithIcon>
							<CardDescription className="pl-[42px]">{pendingLabel}</CardDescription>
						</CardHeader>
						<CardContent>
							<Link href="/appointments" className={buttonVariants({ variant: "outline" })}>
								Manage Requests
							</Link>
						</CardContent>
					</Card>
					<Card className="border-border shadow-sm">
						<CardHeader>
							<CardTitleWithIcon icon={SignatureFreeIcons}>QuickSign</CardTitleWithIcon>
							<CardDescription className="text-muted-foreground pl-[42px] leading-relaxed">
								Upload, plot, and send for signing in minutes — no live meeting required.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link href="/quicksign" className={buttonVariants()}>
								Start QuickSign
							</Link>
						</CardContent>
					</Card>
					<DocumentVerifierCard />
				</div>
			</section>
		</div>
	)
}

function ClientDashboard({ profile }: { profile: UserProfile }) {
	const apptQ = useAppointmentsQuery({ page: 1, limit: 1 })
	const maintenanceQ = useMaintenanceNoticesQuery()
	const statusCounts = selectAppointmentList(apptQ.data)?.statusCounts
	const upcomingCount = statusCounts
		? statusCounts.pending + statusCounts.confirmed + statusCounts.in_session
		: 0

	const kyc = kycCopy(profile.identityStatus)
	const idRows = identityKycRows(profile)
	const kycTone: StatTone =
		profile.identityStatus === "verified"
			? "success"
			: profile.identityStatus === "pending"
				? "warning"
				: "neutral"

	return (
		<div className="space-y-8">
			<MaintenanceNoticesBanner
				notices={(maintenanceQ.data as MaintenanceWindow[] | undefined) ?? []}
			/>
			<ProfileHeaderCard profile={profile} />

			<BecomeEnpCard profile={profile} />

			{/* Status tiles */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<StatCard
					label="KYC Status"
					title={kyc.title}
					subtitle={kyc.subtitle}
					icon={IdentityCardFreeIcons}
					tone={kycTone}
				/>
				<StatCard
					label="Account"
					title="Principal"
					subtitle="Book notaries and manage appointments"
					icon={UserCircleFreeIcons}
				/>
				<StatCard
					label="Upcoming"
					title={`${upcomingCount} appointment${upcomingCount === 1 ? "" : "s"}`}
					subtitle="Active and pending requests"
					icon={Calendar03FreeIcons}
				/>
			</div>

			{/* Identity Verification */}
			<Card className="border-border shadow-sm">
				<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div className="space-y-1">
						<CardTitleWithIcon icon={Shield01FreeIcons}>Identity verification</CardTitleWithIcon>
						<CardDescription className="text-muted-foreground pl-[42px] text-sm leading-relaxed">
							Required for secure bookings and messaging. Manage verification from your profile.
						</CardDescription>
					</div>
					<Link
						href={profilePath(profile.role, { focus: "kyc" })}
						className={buttonVariants({ variant: "outline", size: "sm" })}
					>
						Open KYC in profile
					</Link>
				</CardHeader>
				<CardContent>
					<dl className="divide-border divide-y">
						<div className="flex items-center justify-between gap-4 py-3 first:pt-0">
							<dt className="text-muted-foreground flex items-center gap-2 text-sm">
								<HugeiconsIcon icon={UserCircleFreeIcons} className="size-4" strokeWidth={2} />
								Liveness check
							</dt>
							<dd className="flex items-center gap-2 text-sm font-medium">
								{statusDot(idRows.liveness === "Complete" ? "success" : "warning")}
								{idRows.liveness}
							</dd>
						</div>
						<div className="flex items-center justify-between gap-4 py-3">
							<dt className="text-muted-foreground flex items-center gap-2 text-sm">
								<HugeiconsIcon icon={IdentificationFreeIcons} className="size-4" strokeWidth={2} />
								ID upload
							</dt>
							<dd className="flex items-center gap-2 text-sm font-medium">
								{statusDot(idRows.idUpload === "Complete" ? "success" : "warning")}
								{idRows.idUpload}
							</dd>
						</div>
						<div className="flex items-center justify-between gap-4 py-3 last:pb-0">
							<dt className="text-muted-foreground flex items-center gap-2 text-sm">
								<HugeiconsIcon icon={Calendar03FreeIcons} className="size-4" strokeWidth={2} />
								KYC expiry
							</dt>
							<dd className="text-sm font-medium">{idRows.expiry}</dd>
						</div>
					</dl>
				</CardContent>
			</Card>

			{/* Quick actions */}
			<section className="space-y-3">
				<div className="text-muted-foreground flex items-center gap-2 text-sm font-semibold tracking-wide uppercase">
					<HugeiconsIcon icon={CheckmarkCircleFreeIcons} className="size-4" strokeWidth={2} />
					Quick actions
				</div>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Card className="border-border shadow-sm">
						<CardHeader>
							<CardTitleWithIcon icon={CalendarUserFreeIcons}>Appointments</CardTitleWithIcon>
							<CardDescription className="pl-[42px]">
								View, schedule, and join your notary sessions.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link href="/appointments" className={buttonVariants({ variant: "outline" })}>
								Open appointments
							</Link>
						</CardContent>
					</Card>
					<Card className="border-border shadow-sm">
						<CardHeader>
							<CardTitleWithIcon icon={Message01FreeIcons}>Messages</CardTitleWithIcon>
							<CardDescription className="pl-[42px]">
								Talk to your notary and follow up on documents.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link href="/messages" className={buttonVariants({ variant: "outline" })}>
								Open messages
							</Link>
						</CardContent>
					</Card>
					<Card className="border-border shadow-sm">
						<CardHeader>
							<CardTitleWithIcon icon={Award04FreeIcons}>Profile</CardTitleWithIcon>
							<CardDescription className="pl-[42px]">
								Update your personal info and verification details.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Link
								href={profilePath(profile.role)}
								className={buttonVariants({ variant: "outline" })}
							>
								Open profile
							</Link>
						</CardContent>
					</Card>
					<DocumentVerifierCard />
				</div>
			</section>
		</div>
	)
}

function DashboardSkeleton() {
	return (
		<div className="animate-in fade-in space-y-8 duration-500">
			{/* Profile Header Skeleton */}
			<Card className="border-border shadow-sm">
				<CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-8">
					<Skeleton className="size-20 rounded-full sm:size-24" />
					<div className="flex-1 space-y-4">
						<Skeleton className="h-8 w-48" />
						<div className="flex gap-4">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-4 w-24" />
						</div>
						<div className="flex gap-2">
							<Skeleton className="h-6 w-24 rounded-full" />
							<Skeleton className="h-6 w-32 rounded-full" />
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Stat Cards Grid Skeleton */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
				{Array.from({ length: 5 }).map((_, i) => (
					<Card key={i} className="border-border shadow-sm">
						<CardHeader className="space-y-4 pb-2">
							<div className="flex items-start justify-between">
								<Skeleton className="h-3 w-16" />
								<Skeleton className="size-9 rounded-lg" />
							</div>
							<Skeleton className="h-5 w-24" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-3 w-3/4" />
						</CardContent>
					</Card>
				))}
			</div>

			{/* Big Card Skeleton */}
			<Card className="border-border shadow-sm">
				<CardHeader>
					<Skeleton className="h-6 w-40" />
				</CardHeader>
				<CardContent className="space-y-4">
					<Skeleton className="h-12 w-full" />
					<div className="flex gap-2 pt-2">
						<Skeleton className="h-10 w-40" />
						<Skeleton className="h-10 w-40" />
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

export function DashboardContent({ initialProfile }: { initialProfile: UserProfile | null }) {
	const q = useAuthProfileMeQuery(initialProfile)

	if (q.isPending) {
		return <DashboardSkeleton />
	}
	if (q.isError || !q.data) {
		return (
			<Card className="border-border shadow-sm">
				<CardContent className="py-16">
					<ErrorState
						message="Could not load your profile. Sign in and try again."
						onRetry={() => void q.refetch()}
					/>
				</CardContent>
			</Card>
		)
	}

	const profile = q.data as UserProfile

	if (
		profile.role === "enp" ||
		profile.role === "admin" ||
		profile.role === "super_admin" ||
		profile.role === "sub_org_admin"
	) {
		return <EnpDashboard profile={profile} />
	}

	return <ClientDashboard profile={profile} />
}

"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
	BookOpen01Icon,
	Cancel01Icon,
	CheckmarkCircle02Icon,
	LegalDocument01Icon,
	LinkSquare01Icon,
	ShieldUserIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useMutation } from "@tanstack/react-query"

import { Badge } from "@/core/components/ui/badge"
import { Button } from "@/core/components/ui/button"
import { Checkbox } from "@/core/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/core/components/ui/dialog"
import { cn } from "@/core/lib/utils"
import { orpcClient } from "@/services/orpc/client"
import { useSignOutMutation } from "@/features/auth/api/session.hooks"

// ─── Document data ────────────────────────────────────────────────────────────

const TABS = [
	{
		id: "dpa",
		label: "Data Privacy Act",
		shortLabel: "DPA",
		badge: "RA 10173",
		icon: BookOpen01Icon,
		title: "Republic Act No. 10173",
		subtitle: "Data Privacy Act of 2012",
		href: "https://www.privacy.gov.ph/data-privacy-act/",
		color: "from-violet-500 to-purple-600",
		sections: [
			{
				heading: "What data we collect",
				body: "We collect your full name, email, date of birth, government-issued ID, and identity verification biometrics (selfie). During notarial sessions we also record video and collect document contents.",
			},
			{
				heading: "Why we process it",
				body: "Your data is processed to: (a) create and secure your account; (b) verify your identity as required by Supreme Court electronic notarization rules; (c) perform notarial acts; (d) comply with mandatory reporting obligations; and (e) prevent fraud.",
			},
			{
				heading: "Legal basis",
				body: "Processing rests on your explicit consent, contractual necessity (to deliver the services you requested), and legal obligation under the Rules on Electronic Notarization and RA 10173.",
			},
			{
				heading: "Video recording retention",
				body: "Session recordings are stored in a secure AWS S3 bucket (Asia-Pacific region) encrypted with AES-256 and are retained for five (5) years from the date of the notarial act as required by Supreme Court rules. Access is restricted to authorized personnel and the parties to the act.",
			},
			{
				heading: "Your rights as a data subject",
				body: "Under RA 10173 you may: access your data, have inaccuracies corrected, object to processing, request erasure when no longer necessary, and file a complaint with the National Privacy Commission (privacy.gov.ph). Contact our DPO at dpo@quanby.legal — we respond within 15 working days.",
			},
		],
	},
	{
		id: "enb",
		label: "SC Data Sharing",
		shortLabel: "SC Rules",
		badge: "SC Guidelines",
		icon: LegalDocument01Icon,
		title: "Electronic Notarization Data Sharing",
		subtitle: "Supreme Court of the Philippines",
		href: "https://sc.judiciary.gov.ph",
		color: "from-blue-500 to-cyan-600",
		sections: [
			{
				heading: "What this means",
				body: "All notarial acts performed through a Supreme Court-accredited platform must be reported to the National Electronic Notarial Repository (NENR). This is a mandatory legal requirement — it cannot be waived by any party.",
			},
			{
				heading: "Data transmitted to the Supreme Court",
				body: "Per notarial act we transmit: ENP commission details, full names and ID references of all parties, document type and act type, date/time and unique transaction ID, a cryptographic hash of the notarized document, and session recording metadata.",
			},
			{
				heading: "Security of transmission",
				body: "Transmissions to the NENR use TLS 1.3 and are digitally signed with the ENP's Supreme Court-issued certificate. Data at rest in the NENR is encrypted with AES-256.",
			},
			{
				heading: "Who can access the NENR data",
				body: "Access is limited to: the Office of the Court Administrator (regulatory oversight), authorized courts (legal proceedings), and the parties to a notarial act (upon written request with proper identification).",
			},
			{
				heading: "Permanent retention at the NENR",
				body: "Notarial records at the NENR are permanent official judicial records. qLegal retains its own copies for at least five (5) years from the date of each act.",
			},
		],
	},
	{
		id: "platform",
		label: "Platform Terms",
		shortLabel: "Terms",
		badge: "qLegal",
		icon: ShieldUserIcon,
		title: "qLegal Platform Terms of Use",
		subtitle: "Quanby Solutions, Inc.",
		href: null,
		color: "from-emerald-500 to-teal-600",
		sections: [
			{
				heading: "Eligibility",
				body: "You must be at least 18 years old and legally capable of entering contracts under Philippine law to use this platform. Attorneys / Electronic Notarial Publics must hold a valid Supreme Court-issued commission.",
			},
			{
				heading: "Acceptable use",
				body: "You agree not to: submit false or misleading information, impersonate another person, attempt to circumvent identity verification, use the platform for unlawful purposes, or interfere with platform security or integrity.",
			},
			{
				heading: "Electronic signature & notarization validity",
				body: "Electronic notarial acts performed through this platform carry the same legal weight as their traditional counterparts pursuant to the Supreme Court's Rules on Electronic Notarization and the Electronic Commerce Act (RA 8792).",
			},
			{
				heading: "Governing law",
				body: "These terms are governed by the laws of the Republic of the Philippines. Any dispute shall be submitted to the exclusive jurisdiction of the courts of Metro Manila.",
			},
			{
				heading: "Contact",
				body: "For questions about these terms contact legal@quanby.legal. For data privacy concerns contact dpo@quanby.legal.",
			},
		],
	},
] as const

type TabId = (typeof TABS)[number]["id"]

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ heading, body, accent }: { heading: string; body: string; accent: string }) {
	return (
		<div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm">
			<div className={`h-1 w-full bg-gradient-to-r ${accent}`} />
			<div className="p-3.5 sm:p-4">
				<p className="font-montserrat mb-1.5 text-[10px] font-bold tracking-widest text-[var(--primary)] uppercase sm:text-[11px]">
					{heading}
				</p>
				<p className="font-montserrat text-xs leading-relaxed text-[var(--muted-foreground)] sm:text-[13px]">
					{body}
				</p>
			</div>
		</div>
	)
}

// ─── Progress dots ────────────────────────────────────────────────────────────

function ProgressDots({ total, read, active }: { total: number; read: Set<TabId>; active: TabId }) {
	return (
		<div className="flex items-center gap-1.5">
			{TABS.map(t => {
				const isActive = t.id === active
				const isRead = read.has(t.id)
				return (
					<div
						key={t.id}
						className={cn(
							"h-1.5 rounded-full transition-all duration-300",
							isActive
								? "w-6 bg-[var(--primary)]"
								: isRead
									? "w-3 bg-[var(--chart-5)]"
									: "w-3 bg-[var(--border)]"
						)}
					/>
				)
			})}
			<span className="font-montserrat ml-1 text-[10px] text-[var(--muted-foreground)]">
				{read.size}/{total} read
			</span>
		</div>
	)
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function TermsAcceptanceModal() {
	const router = useRouter()
	const [activeTab, setActiveTab] = React.useState<TabId>("dpa")
	const [readTabs, setReadTabs] = React.useState<Set<TabId>>(new Set(["dpa"]))
	const [checked, setChecked] = React.useState(false)
	const [showScrollHint, setShowScrollHint] = React.useState(true)
	const scrollRef = React.useRef<HTMLDivElement>(null)

	const tab = TABS.find(t => t.id === activeTab) ?? TABS[0]!

	const handleTabChange = (id: TabId) => {
		setActiveTab(id)
		setReadTabs(prev => new Set([...prev, id]))
		setShowScrollHint(true)
		scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })
	}

	function handleScroll() {
		const el = scrollRef.current
		if (!el) return
		const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
		if (nearBottom) setShowScrollHint(false)
	}

	const signOutMutation = useSignOutMutation()

	const acceptMutation = useMutation({
		mutationFn: async () => {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			await (orpcClient as any).authProfile.acceptTerms()
		},
		onSuccess: () => router.refresh(),
	})

	const allRead = readTabs.size >= TABS.length
	const canAccept = checked && allRead

	return (
		<Dialog open disablePointerDismissal onOpenChange={() => {}}>
			<DialogContent
				showCloseButton={false}
				className={cn(
					// Base: full-screen on mobile, modal on desktop
					"flex flex-col gap-0 overflow-hidden p-0",
					"h-[100dvh] w-full rounded-none",
					"sm:h-auto sm:max-h-[92dvh] sm:w-full sm:max-w-2xl sm:rounded-2xl"
				)}
			>
				{/* ── Gradient stripe ── */}
				<div
					className="h-1 w-full shrink-0"
					style={{
						background:
							"linear-gradient(90deg, var(--primary) 0%, var(--accent) 40%, var(--secondary) 100%)",
					}}
				/>

				{/* ── Header ── */}
				<DialogHeader className="shrink-0 px-4 py-3 sm:px-6 sm:py-4">
					<div className="flex items-center gap-3">
						<div
							className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-md sm:size-11"
							style={{
								background: "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)",
							}}
						>
							<HugeiconsIcon
								icon={ShieldUserIcon}
								className="size-5 text-white sm:size-6"
								strokeWidth={1.5}
							/>
						</div>
						<div className="min-w-0 flex-1">
							<DialogTitle className="font-poppins text-sm leading-tight font-bold sm:text-base">
								Before you enter the platform
							</DialogTitle>
							<p className="font-montserrat mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)] sm:text-xs">
								Read all 3 documents, tick the box, then tap{" "}
								<strong className="text-[var(--foreground)]">Accept</strong>.
							</p>
						</div>
					</div>
				</DialogHeader>

				{/* ── Step tabs ── */}
				<div className="shrink-0 border-y border-[var(--border)] bg-[var(--muted)]/40">
					<div className="flex overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
						{TABS.map((t, i) => {
							const isActive = t.id === activeTab
							const isRead = readTabs.has(t.id)
							return (
								<button
									key={t.id}
									type="button"
									onClick={() => handleTabChange(t.id)}
									className={cn(
										"font-montserrat relative flex flex-1 shrink-0 flex-col items-center gap-0.5 px-3 py-2.5 text-center transition-colors sm:flex-row sm:gap-2 sm:px-5 sm:py-3 sm:text-left",
										isActive
											? "bg-[var(--background)] text-[var(--primary)]"
											: "text-[var(--muted-foreground)] hover:bg-[var(--muted)]/60 hover:text-[var(--foreground)]"
									)}
								>
									{/* Active indicator */}
									{isActive && (
										<span className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--primary)] sm:inset-y-0 sm:right-auto sm:h-auto sm:w-[2px]" />
									)}

									{/* Step number / checkmark */}
									<span
										className={cn(
											"flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all sm:size-6",
											isRead
												? "bg-[var(--chart-5)]/15 text-[var(--chart-5)]"
												: isActive
													? "bg-[var(--primary)]/10 text-[var(--primary)]"
													: "bg-[var(--muted)] text-[var(--muted-foreground)]"
										)}
									>
										{isRead ? (
											<HugeiconsIcon
												icon={CheckmarkCircle02Icon}
												className="size-3.5"
												strokeWidth={2}
											/>
										) : (
											i + 1
										)}
									</span>

									<span className="text-[10px] leading-tight font-semibold sm:text-xs">
										<span className="sm:hidden">{t.shortLabel}</span>
										<span className="hidden sm:inline">{t.label}</span>
									</span>
								</button>
							)
						})}
					</div>
				</div>

				{/* ── Document content ── */}
				<div ref={scrollRef} onScroll={handleScroll} className="relative flex-1 overflow-y-auto">
					{/* Doc title bar */}
					<div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--background)]/95 px-4 py-2.5 backdrop-blur-sm sm:px-6 sm:py-3">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<Badge
									variant="outline"
									className="shrink-0 border-[var(--primary)]/30 bg-[var(--primary)]/5 py-0 text-[9px] font-semibold text-[var(--primary)] sm:text-[10px]"
								>
									{tab.badge}
								</Badge>
								<p className="font-poppins truncate text-xs font-semibold text-[var(--foreground)] sm:text-sm">
									{tab.title}
								</p>
							</div>
							<p className="font-montserrat mt-0.5 text-[10px] text-[var(--muted-foreground)]">
								{tab.subtitle}
							</p>
						</div>
						{tab.href && (
							<a href={tab.href} target="_blank" rel="noreferrer noopener" className="shrink-0">
								<Button
									variant="ghost"
									size="sm"
									className="font-montserrat h-7 gap-1 text-[10px] sm:text-xs"
								>
									<HugeiconsIcon icon={LinkSquare01Icon} className="size-3" strokeWidth={2} />
									<span className="hidden sm:inline">Official source</span>
									<span className="sm:hidden">Source</span>
								</Button>
							</a>
						)}
					</div>

					{/* Sections */}
					<div className="space-y-2.5 p-4 sm:space-y-3 sm:p-6">
						{tab.sections.map(s => (
							<Section key={s.heading} heading={s.heading} body={s.body} accent={tab.color} />
						))}
					</div>

					{/* Scroll hint */}
					{showScrollHint && (
						<div className="pointer-events-none sticky bottom-0 flex justify-center pb-2">
							<span className="font-montserrat flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--card)]/90 px-3 py-1 text-[10px] text-[var(--muted-foreground)] shadow-sm backdrop-blur-sm">
								Scroll to read more ↓
							</span>
						</div>
					)}
				</div>

				{/* ── Footer ── */}
				<div className="pb-safe-area-inset-bottom shrink-0 border-t border-[var(--border)] bg-[var(--card)] px-4 pt-3 sm:px-6 sm:pt-4 sm:pb-4">
					{/* Progress */}
					<div className="mb-3 flex items-center justify-between gap-2">
						<ProgressDots total={TABS.length} read={readTabs} active={activeTab} />
						{!allRead && (
							<span className="font-montserrat text-[10px] text-[var(--muted-foreground)]">
								Visit all tabs to unlock
							</span>
						)}
					</div>

					{/* Consent checkbox */}
					<label
						className={cn(
							"mb-3 flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors sm:p-3.5",
							checked
								? "border-[var(--primary)]/40 bg-[var(--primary)]/5"
								: allRead
									? "border-[var(--border)] bg-[var(--muted)]/30 hover:border-[var(--primary)]/20"
									: "cursor-not-allowed border-[var(--border)] bg-[var(--muted)]/20 opacity-50"
						)}
					>
						<Checkbox
							checked={checked}
							disabled={!allRead}
							onCheckedChange={v => setChecked(v === true)}
							className="mt-0.5 shrink-0"
							aria-label="I have read and accept the terms"
						/>
						<span className="font-montserrat text-[11px] leading-relaxed text-[var(--muted-foreground)] select-none sm:text-xs">
							I have read and understood all three documents. I consent to the collection and
							processing of my personal information under{" "}
							<strong className="text-[var(--foreground)]">RA 10173</strong> and agree to
							transmission of notarial records to the Supreme Court per the{" "}
							<strong className="text-[var(--foreground)]">
								Electronic Notarization Data Sharing Guidelines
							</strong>
							.
						</span>
					</label>

					{/* Action buttons */}
					<div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
						<Button
							variant="outline"
							disabled={acceptMutation.isPending || signOutMutation.isPending}
							onClick={() => signOutMutation.mutate()}
							className="font-montserrat order-2 flex h-10 items-center gap-2 font-medium sm:order-1 sm:h-11 sm:w-auto"
						>
							<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" strokeWidth={2} />
							{signOutMutation.isPending ? "Signing out…" : "Cancel & Sign out"}
						</Button>
						<Button
							disabled={!canAccept || acceptMutation.isPending || signOutMutation.isPending}
							onClick={() => acceptMutation.mutate()}
							className="font-montserrat order-1 h-11 flex-1 font-bold tracking-wide sm:order-2 sm:h-11"
							style={{
								background: canAccept
									? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 50%, var(--secondary) 100%)"
									: undefined,
							}}
						>
							{acceptMutation.isPending ? "Saving…" : "I Accept — Enter Platform"}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	)
}

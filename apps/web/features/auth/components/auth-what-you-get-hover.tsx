"use client"

import * as React from "react"

import { cn } from "@/core/lib/utils"

const FEATURES = [
	{ id: "notarization", label: "Supreme Court compliant notarization" },
	{ id: "kyc", label: "Secure sign-in with identity verification" },
	{ id: "sessions", label: "QuickSign or live remote notary sessions" },
	{ id: "dashboard", label: "One dashboard for appointments and registry" },
] as const

function FeatureIcon({ id }: { id: (typeof FEATURES)[number]["id"] }) {
	const iconClass = "size-4 text-[var(--primary)]"
	if (id === "notarization") {
		return (
			<svg
				className={iconClass}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden
			>
				<path d="M12 3v17M9 20h6" />
				<path d="M4 7h16" />
				<path d="M4 7l-3 7h6l-3-7z" fill="currentColor" fillOpacity={0.15} />
				<path d="M1 14a3 1 0 006 0" />
				<path d="M20 7l-3 7h6l-3-7z" fill="currentColor" fillOpacity={0.15} />
				<path d="M17 14a3 1 0 006 0" />
			</svg>
		)
	}
	if (id === "kyc") {
		return (
			<svg
				className={iconClass}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden
			>
				<path
					d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
					fill="currentColor"
					fillOpacity={0.15}
				/>
				<path d="M9 11l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		)
	}
	if (id === "sessions") {
		return (
			<svg
				className={iconClass}
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden
			>
				<path
					d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
					fill="currentColor"
					fillOpacity={0.15}
				/>
				<path d="M14 2v6h6" />
				<path d="M16 13H8M12 17H8" />
				<path d="M6 16c2-3 5-1 7-4s2-2 3-3" strokeWidth={1.5} />
			</svg>
		)
	}
	return (
		<svg
			className={iconClass}
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden
		>
			<rect
				x="3"
				y="4"
				width="18"
				height="18"
				rx="2"
				ry="2"
				fill="currentColor"
				fillOpacity={0.15}
			/>
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
			<circle cx="12" cy="15" r="2" />
			<path d="M8 19c0-1.5 2-2.5 4-2.5s4 1 4 2.5" />
		</svg>
	)
}

export function AuthWhatYouGetHover({
	className,
	id = "auth-what-you-get-tooltip",
}: {
	className?: string
	id?: string
}) {
	const panelId = id
	const rootRef = React.useRef<HTMLDivElement>(null)
	const [pinned, setPinned] = React.useState(false)

	React.useEffect(() => {
		if (!pinned) return
		const onPointerDown = (event: PointerEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) {
				setPinned(false)
			}
		}
		document.addEventListener("pointerdown", onPointerDown)
		return () => document.removeEventListener("pointerdown", onPointerDown)
	}, [pinned])

	return (
		<div ref={rootRef} className={cn("group/what-you-get relative flex justify-center", className)}>
			<button
				type="button"
				aria-label="What you get with qLegal"
				aria-expanded={pinned}
				aria-controls={panelId}
				onClick={() => setPinned(current => !current)}
				className="inline-flex size-7 cursor-help items-center justify-center rounded-full border border-[var(--border)] bg-[var(--muted)]/40 text-xs font-semibold text-[var(--muted-foreground)] transition-colors hover:border-[var(--primary)]/30 hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none sm:size-8 sm:text-sm"
			>
				?
			</button>

			{/* In-flow panel (no portal) so hover stays stable across trigger + content */}
			<div
				id={panelId}
				role="tooltip"
				className={cn(
					"absolute bottom-full left-1/2 z-50 mb-1 w-[min(calc(100vw-2rem),18.5rem)] -translate-x-1/2 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-xl",
					"pointer-events-none invisible opacity-0 transition-[opacity,visibility] duration-150",
					"group-hover/what-you-get:pointer-events-auto group-hover/what-you-get:visible group-hover/what-you-get:opacity-100",
					pinned && "pointer-events-auto visible opacity-100"
				)}
			>
				<div className="border-b border-[var(--border)] px-4 py-2.5">
					<p className="text-center font-mono text-[10px] tracking-widest text-[var(--muted-foreground)] uppercase">
						What you get
					</p>
				</div>
				<ul className="space-y-3 p-4">
					{FEATURES.map(feature => (
						<li
							key={feature.id}
							className="font-montserrat flex items-start gap-3 text-sm leading-snug text-[var(--foreground)]/90"
						>
							<span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--primary)]/5 bg-[var(--primary)]/10 shadow-sm">
								<FeatureIcon id={feature.id} />
							</span>
							<span className="pt-1 leading-relaxed">{feature.label}</span>
						</li>
					))}
				</ul>
			</div>
		</div>
	)
}

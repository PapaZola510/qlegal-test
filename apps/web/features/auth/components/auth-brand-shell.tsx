"use client"

import * as React from "react"
import Image from "next/image"
import { motion } from "motion/react"

import { useThemeTransition } from "@/core/context/theme-provider"

interface AuthBrandShellProps {
	children: React.ReactNode
	/** Optional content to render under the right column (e.g. dev access). */
	footer?: React.ReactNode
	/**
	 * Vertical alignment of the right-column content on desktop. Use `start`
	 * for long forms (login/register) and `center` for shorter step screens
	 * (MFA, email verification) so the card sits nicely centered.
	 */
	desktopAlign?: "start" | "center"
}

/**
 * Full-page split shell used by every auth-flow page (login, register, MFA,
 * email verification). Provides the dark brand panel on the left and a
 * scrollable right column that hosts the page-specific content via `children`.
 */
export function AuthBrandShell({ children, footer, desktopAlign = "start" }: AuthBrandShellProps) {
	const { theme, setTheme } = useThemeTransition()
	const [mounted, setMounted] = React.useState(false)

	React.useEffect(() => {
		setMounted(true)
	}, [])

	const isDark = mounted && theme === "dark"

	return (
		<div className="relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[var(--background)] font-sans antialiased selection:bg-[var(--primary)]/10 selection:text-[var(--primary)] lg:flex-row lg:items-stretch">
			{/* Ambient background decorations */}
			<motion.div
				className="pointer-events-none absolute top-1/4 left-1/4 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.1] blur-[100px] md:h-[600px] md:w-[600px] md:blur-[140px] dark:opacity-[0.14]"
				style={{
					background:
						"radial-gradient(circle, var(--accent) 0%, var(--primary) 40%, var(--secondary) 80%, var(--chart-4) 100%)",
				}}
				animate={{
					scale: [1, 1.15, 0.95, 1.05, 1],
					x: [0, 40, -30, 20, 0],
					y: [0, -30, 40, -20, 0],
				}}
				transition={{
					duration: 35,
					repeat: Infinity,
					ease: "easeInOut",
				}}
			/>

			<div
				className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
				style={{
					backgroundImage: `
						linear-gradient(to right, var(--border) 1px, transparent 1px),
						linear-gradient(to bottom, var(--border) 1px, transparent 1px)
					`,
					backgroundSize: "40px 40px",
				}}
			/>

			<div className="pointer-events-none absolute inset-y-0 left-[8%] hidden w-px bg-red-500/10 lg:block" />
			<div className="pointer-events-none absolute inset-y-0 left-[8.2%] hidden w-px bg-red-500/5 lg:block" />

			{/* Top Right Header for Theme Switcher */}
			<div className="absolute top-4 right-4 z-50 sm:top-6 sm:right-6">
				{mounted && (
					<button
						onClick={() => setTheme(isDark ? "light" : "dark")}
						className="relative flex h-8 w-14 cursor-pointer items-center justify-between rounded-full border border-[var(--border)] p-1 px-2 shadow-sm transition-all duration-300 focus:ring-2 focus:ring-[var(--ring)] focus:outline-none"
						style={{
							background: isDark
								? "linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)"
								: "linear-gradient(135deg, #FFFDF9 0%, #E5DFF0 100%)",
						}}
						aria-label="Toggle theme"
					>
						<svg
							className={`size-3.5 transition-opacity ${isDark ? "text-white/50 opacity-30" : "text-amber-600 opacity-100"}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<circle cx="12" cy="12" r="4" />
							<path
								strokeLinecap="round"
								d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
							/>
						</svg>

						<svg
							className={`size-3.5 transition-opacity ${isDark ? "text-indigo-200 opacity-100" : "text-purple-400 opacity-30"}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							strokeWidth={2}
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
							/>
						</svg>

						<motion.div
							className="pointer-events-none absolute left-[3px] flex size-6 items-center justify-center rounded-full bg-white shadow-md"
							animate={{ x: isDark ? 24 : 0 }}
							transition={{ type: "spring", stiffness: 450, damping: 22 }}
						/>
					</button>
				)}
			</div>

			{/* BRAND SHOWCASE — always left on desktop */}
			<div className="relative hidden w-full flex-col justify-center border-b border-[var(--border)] bg-[#0B0414] px-6 py-12 md:px-12 lg:flex lg:min-h-dvh lg:w-[55%] lg:shrink-0 lg:justify-start lg:self-stretch lg:border-r lg:border-b-0 lg:px-20 lg:py-16">
				<div
					className="pointer-events-none absolute inset-0 opacity-80"
					style={{
						background:
							"radial-gradient(circle at bottom left, var(--primary) 0%, transparent 65%), radial-gradient(circle at top right, var(--accent) 0%, transparent 60%), radial-gradient(circle at center, var(--secondary) 0%, transparent 70%)",
					}}
				/>
				<div className="pointer-events-none absolute inset-0 bg-black/20 backdrop-blur-[1px]" />

				<div className="pointer-events-none absolute inset-0 overflow-hidden select-none">
					<motion.div
						className="absolute top-[15%] left-[20%] size-12 text-white/5 dark:text-white/10"
						animate={{ y: [0, -15, 0], rotate: [0, 8, 0] }}
						transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
					>
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M12 3v17M9 20h6M4 7h16M4 7l-3 7h6l-3-7zM20 7l-3 7h6l-3-7z"
							/>
						</svg>
					</motion.div>

					<motion.div
						className="absolute bottom-[20%] left-[15%] size-16 text-white/5 dark:text-white/10"
						animate={{ y: [0, 20, 0], rotate: [0, -12, 0] }}
						transition={{ duration: 22, repeat: Infinity, ease: "easeInOut", delay: 2 }}
					>
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
					</motion.div>

					<motion.div
						className="absolute top-[25%] right-[20%] size-10 text-white/5 dark:text-white/10"
						animate={{ y: [0, -12, 0], rotate: [0, 15, 0] }}
						transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
					>
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0110 0v4" />
						</svg>
					</motion.div>

					<motion.div
						className="absolute right-[25%] bottom-[12%] size-14 text-white/5 dark:text-white/10"
						animate={{ y: [0, 15, 0], rotate: [0, 10, 0] }}
						transition={{ duration: 20, repeat: Infinity, ease: "easeInOut", delay: 3 }}
					>
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
							<path strokeLinecap="round" d="M4 16c2-3 5-1 7-4s2-2 3-3 M16 13H8M12 17H8" />
						</svg>
					</motion.div>

					<motion.div
						className="pointer-events-none absolute -bottom-32 -left-32 h-[480px] w-[480px] text-white/[0.03] select-none dark:text-white/[0.06]"
						animate={{ rotate: 360 }}
						transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
					>
						<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={1.5}>
							<circle cx="50" cy="50" r="40" />
							<path d="M78 78 L95 95" strokeLinecap="round" />
						</svg>
					</motion.div>
				</div>

				<div className="relative z-10 mx-auto flex w-full max-w-xl flex-col gap-8 text-left lg:mx-0 lg:gap-10">
					<motion.div
						initial={{ opacity: 0, y: 15 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ type: "spring", stiffness: 100, damping: 18 }}
						className="flex flex-col gap-4"
					>
						<Image
							src="/qlegal_long.png"
							alt="Q LEGAL Logo"
							width={320}
							height={90}
							priority
							className="h-16 w-auto object-contain brightness-0 drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)] invert md:h-20"
						/>
					</motion.div>

					<div className="space-y-4 md:space-y-6">
						<motion.h1
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.3 }}
							className="font-poppins text-2xl leading-tight font-semibold text-white md:text-4xl md:leading-snug"
						>
							Digital notarization made secure, simple, and trusted.
						</motion.h1>
						<motion.p
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.4 }}
							className="font-montserrat text-sm leading-relaxed text-white/85 md:text-base"
						>
							Q LEGAL is your all-in-one platform for electronic notarization. We provide a
							seamless, secure, and officially recognized way to notarize documents online.
						</motion.p>
					</div>

					<motion.div
						initial="hidden"
						animate="visible"
						variants={{
							hidden: { opacity: 0 },
							visible: {
								opacity: 1,
								transition: {
									staggerChildren: 0.1,
									delayChildren: 0.5,
								},
							},
						}}
						className="flex flex-wrap gap-2 md:gap-3"
					>
						<motion.div
							variants={{
								hidden: { opacity: 0, scale: 0.9, y: 5 },
								visible: { opacity: 1, scale: 1, y: 0 },
							}}
							className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-[10px] text-white shadow-sm backdrop-blur-sm md:text-xs dark:border-white/10 dark:bg-white/5"
						>
							<svg
								className="mr-1.5 size-3 shrink-0 text-white/90"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<circle cx="12" cy="12" r="10" />
								<circle cx="12" cy="12" r="6" strokeDasharray="3 3" />
								<path d="M12 8v8M8 12h8" />
							</svg>
							Court-Compliant
						</motion.div>
						<motion.div
							variants={{
								hidden: { opacity: 0, scale: 0.9, y: 5 },
								visible: { opacity: 1, scale: 1, y: 0 },
							}}
							className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-[10px] text-white shadow-sm backdrop-blur-sm md:text-xs dark:border-white/10 dark:bg-white/5"
						>
							<svg
								className="mr-1.5 size-3 shrink-0 text-white/90"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
							</svg>
							Data Privacy Act
						</motion.div>
						<motion.div
							variants={{
								hidden: { opacity: 0, scale: 0.9, y: 5 },
								visible: { opacity: 1, scale: 1, y: 0 },
							}}
							className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-[10px] text-white shadow-sm backdrop-blur-sm md:text-xs dark:border-white/10 dark:bg-white/5"
						>
							<svg
								className="mr-1.5 size-3 shrink-0 text-white/90"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							Verified Identity
						</motion.div>
						<motion.div
							variants={{
								hidden: { opacity: 0, scale: 0.9, y: 5 },
								visible: { opacity: 1, scale: 1, y: 0 },
							}}
							className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 font-mono text-[10px] text-white shadow-sm backdrop-blur-sm md:text-xs dark:border-white/10 dark:bg-white/5"
						>
							<svg
								className="mr-1.5 size-3 shrink-0 text-white/90"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
								strokeWidth={2}
							>
								<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
								<path d="M14 2v6h6" />
								<path d="M8 13h8M8 17h5" />
							</svg>
							Secure Archiving
						</motion.div>
					</motion.div>
				</div>
			</div>

			{/* CONTENT — always right on desktop */}
			<div className="relative z-20 flex w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-8 md:px-8 lg:h-dvh lg:px-12 lg:py-16">
				<div
					className={`mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 sm:gap-5 lg:flex-none lg:gap-8 ${desktopAlign === "center" ? "lg:justify-center" : "lg:justify-start"}`}
				>
					{children}
				</div>

				{footer ? (
					<div className="mx-auto w-full max-w-md shrink-0 pt-2 pb-1 sm:pt-3">{footer}</div>
				) : null}
			</div>
		</div>
	)
}

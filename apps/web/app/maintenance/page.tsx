import type { Metadata } from "next"
import Image from "next/image"

import { env } from "@/env"

export const metadata: Metadata = {
	title: "Under Maintenance",
	description: "The platform is temporarily unavailable for scheduled maintenance.",
}

// Always render fresh so the page reflects the live kill-switch message.
export const dynamic = "force-dynamic"

const DEFAULT_MESSAGE =
	"We're performing scheduled maintenance and the platform is temporarily unavailable. Please check back shortly — we'll be right back."

function nestApiBase(): string {
	const internal = env.INTERNAL_API_BASE_URL?.replace(/\/$/, "")
	if (internal) return internal
	if (env.NODE_ENV === "development") {
		const proxyOrigin = env.BACKEND_PROXY_ORIGIN?.replace(/\/$/, "") ?? "http://127.0.0.1:3000"
		return `${proxyOrigin}/api`
	}
	return env.NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, "")
}

async function loadMaintenanceMessage(): Promise<string> {
	const base = nestApiBase()
	const version = env.NEXT_PUBLIC_API_VERSION.replace(/^\//, "")
	try {
		const res = await fetch(`${base}/${version}/maintenance/status`, {
			headers: { accept: "application/json" },
			cache: "no-store",
		})
		if (!res.ok) return DEFAULT_MESSAGE
		const data = (await res.json()) as { message?: string | null } | null
		return data?.message?.trim() ? data.message.trim() : DEFAULT_MESSAGE
	} catch {
		return DEFAULT_MESSAGE
	}
}

export default async function MaintenancePage() {
	const message = await loadMaintenanceMessage()

	return (
		<main className="bg-background flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center">
			<Image
				src="/under_maintenance.png?v=2"
				alt="Under maintenance"
				width={600}
				height={400}
				priority
				className="h-auto w-full max-w-md"
			/>
			<div className="max-w-xl space-y-3">
				<h1 className="text-3xl font-semibold">We&apos;re Under Maintenance</h1>
				<p className="text-muted-foreground text-base">{message}</p>
				<p className="text-muted-foreground text-sm">
					Thank you for your patience — this page will restore access automatically once
					maintenance is complete.
				</p>
			</div>
		</main>
	)
}

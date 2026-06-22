"use client"

import * as React from "react"

import type { ListMeetingDocumentSignersResult } from "@repo/contracts"

import { Badge } from "@/core/components/ui/badge"
import { cn } from "@/core/lib/utils"

function statusBadgeVariant(
	status: ListMeetingDocumentSignersResult["signers"][number]["status"]
): "default" | "secondary" | "outline" {
	if (status === "signed") return "default"
	if (status === "current") return "secondary"
	return "outline"
}

function statusLabel(
	status: ListMeetingDocumentSignersResult["signers"][number]["status"]
): string {
	if (status === "signed") return "Signed"
	if (status === "current") return "Current"
	return "Waiting"
}

function roleLabel(role: ListMeetingDocumentSignersResult["signers"][number]["role"]): string {
	if (role === "notary") return "Notary"
	if (role === "witness") return "Witness"
	return "Principal"
}

export const AssignedSignerList = React.memo(function AssignedSignerList({
	signers,
	compact = false,
}: {
	signers: ListMeetingDocumentSignersResult["signers"]
	compact?: boolean
}) {
	if (!signers.length) return null

	if (compact) {
		return (
			<ul className="space-y-1.5">
				{signers.map(s => (
					<li
						key={s.userId ?? `${s.email}-${s.sequence}`}
						className="flex items-center justify-between gap-2 text-xs"
					>
						<span className="min-w-0 truncate">
							<span className="font-medium">{s.displayName}</span>
							<span className="text-muted-foreground">
								{" "}
								· #{s.sequence} {roleLabel(s.role)}
							</span>
						</span>
						<Badge
							variant={statusBadgeVariant(s.status)}
							className={cn("shrink-0 text-[10px]", s.status === "signed" && "bg-green-600")}
						>
							{statusLabel(s.status)}
						</Badge>
					</li>
				))}
			</ul>
		)
	}

	return (
		<div className="border-border bg-muted/30 space-y-2 rounded-md border p-2.5">
			<p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
				Signers
			</p>
			<ul className="space-y-1.5">
				{signers.map(s => (
					<li
						key={s.userId ?? `${s.email}-${s.sequence}`}
						className="bg-background flex items-center justify-between gap-2 rounded border px-2.5 py-2"
					>
						<div className="min-w-0 flex-1">
							<p className="truncate text-xs font-medium">{s.displayName}</p>
							<p className="text-muted-foreground truncate text-[10px]">
								#{s.sequence} · {roleLabel(s.role)}
							</p>
						</div>
						<Badge
							variant={statusBadgeVariant(s.status)}
							className={cn("shrink-0 text-[10px]", s.status === "signed" && "bg-green-600")}
						>
							{statusLabel(s.status)}
						</Badge>
					</li>
				))}
			</ul>
		</div>
	)
})

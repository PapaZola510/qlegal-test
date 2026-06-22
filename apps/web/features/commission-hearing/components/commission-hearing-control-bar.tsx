"use client"

import { Logout01FreeIcons, Mail01Icon, StopCircleFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import type { CommissionHearingParticipantRole } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"

export function CommissionHearingControlBar({
	participantRole,
	isEnding,
	onInviteApplicant,
	onEndSession,
	onLeave,
}: {
	participantRole: CommissionHearingParticipantRole
	isEnding?: boolean
	onInviteApplicant: () => void
	onEndSession: () => void
	onLeave: () => void
}) {
	const isAdminHost = participantRole === "admin"

	return (
		<div className="flex shrink-0 flex-wrap items-center gap-2">
			{isAdminHost ? (
				<>
					<Button
						type="button"
						variant="secondary"
						size="sm"
						className="gap-2"
						onClick={onInviteApplicant}
					>
						<HugeiconsIcon icon={Mail01Icon} className="size-4" />
						Invite applicant
					</Button>
					<Button
						type="button"
						variant="destructive"
						size="sm"
						className="gap-2"
						disabled={isEnding}
						onClick={onEndSession}
					>
						<HugeiconsIcon icon={StopCircleFreeIcons} className="size-4" />
						{isEnding ? "Ending…" : "End session"}
					</Button>
				</>
			) : null}
			<Button type="button" variant="outline" size="sm" className="gap-2" onClick={onLeave}>
				<HugeiconsIcon icon={Logout01FreeIcons} className="size-4" />
				Leave meeting
			</Button>
		</div>
	)
}

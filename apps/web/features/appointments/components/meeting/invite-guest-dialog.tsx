"use client"

import * as React from "react"
import { Copy01Icon, Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

import type { SessionGuestIntendedRole } from "@repo/contracts"

import { Button } from "@/core/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/core/components/ui/dialog"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useInviteSessionGuestMutation } from "@/features/appointments/api/session-guest.hooks"

export function InviteGuestDialog({
	appointmentId,
	open,
	onOpenChange,
}: {
	appointmentId: string
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const inviteMut = useInviteSessionGuestMutation()
	const [recipientEmail, setRecipientEmail] = React.useState("")
	const [intendedRole, setIntendedRole] = React.useState<SessionGuestIntendedRole>("witness")
	const [lastJoinUrl, setLastJoinUrl] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!open) return
		setLastJoinUrl(null)
	}, [open])

	async function runInvite(sendEmail: boolean) {
		const email = recipientEmail.trim()
		if (!email) {
			toast.error("Enter the invitee's email.")
			return
		}
		try {
			const result = (await inviteMut.mutateAsync({
				appointmentId,
				recipientEmail: email,
				intendedRole,
				sendEmail,
			})) as { joinMeetingUrl: string }
			setLastJoinUrl(result.joinMeetingUrl)
			if (sendEmail) {
				toast.success(`Invite email sent to ${email}`)
			} else {
				await navigator.clipboard.writeText(result.joinMeetingUrl)
				toast.success("Invite link copied to clipboard")
			}
		} catch (e) {
			toast.error(
				getOrpcMutationErrorMessage(
					e,
					sendEmail ? "Could not send invite email." : "Could not create invite link."
				)
			)
		}
	}

	async function copyLastLink() {
		if (!lastJoinUrl) return
		try {
			await navigator.clipboard.writeText(lastJoinUrl)
			toast.success("Link copied")
		} catch {
			toast.error("Could not copy link")
		}
	}

	const busy = inviteMut.isPending

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Invite principal or witness</DialogTitle>
					<DialogDescription>
						Send a meeting link so they can sign in and join this live session. Assign their signer
						role on a document after they arrive.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<div className="space-y-2">
						<Label htmlFor="invite-guest-email">Email</Label>
						<Input
							id="invite-guest-email"
							type="email"
							value={recipientEmail}
							onChange={e => setRecipientEmail(e.target.value)}
							placeholder="guest@example.com"
							autoComplete="email"
						/>
					</div>
					<div className="space-y-2">
						<Label>Role in this session</Label>
						<Select
							value={intendedRole}
							onValueChange={v => setIntendedRole(v as SessionGuestIntendedRole)}
						>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="principal">Principal (signer)</SelectItem>
								<SelectItem value="witness">Witness</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{lastJoinUrl ? (
						<div className="space-y-2">
							<Label>Latest invite link</Label>
							<div className="flex gap-2">
								<Input readOnly value={lastJoinUrl} className="text-xs" />
								<Button
									type="button"
									size="icon"
									variant="outline"
									onClick={() => void copyLastLink()}
								>
									<HugeiconsIcon icon={Copy01Icon} className="size-4" />
									<span className="sr-only">Copy link</span>
								</Button>
							</div>
						</div>
					) : null}
				</div>

				<DialogFooter className="flex-col gap-2 sm:flex-col">
					<Button
						type="button"
						className="w-full gap-2"
						disabled={busy}
						onClick={() => void runInvite(true)}
					>
						<HugeiconsIcon icon={Mail01Icon} className="size-4" />
						{busy ? "Sending…" : "Send invite email"}
					</Button>
					<Button
						type="button"
						variant="outline"
						className="w-full gap-2"
						disabled={busy}
						onClick={() => void runInvite(false)}
					>
						<HugeiconsIcon icon={Copy01Icon} className="size-4" />
						{busy ? "Creating link…" : "Copy invite link only"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

"use client"

import * as React from "react"
import { Copy01Icon, Mail01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { toast } from "sonner"

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
import { getOrpcMutationErrorMessage } from "@/core/lib/orpc-error-message"
import { useInviteApplicantMutation } from "@/features/commission-hearing/api/commission-hearing.hooks"

function toAbsoluteInviteUrl(inviteUrl: string): string {
	if (/^https?:\/\//i.test(inviteUrl)) return inviteUrl
	if (typeof window === "undefined") return inviteUrl
	return `${window.location.origin}${inviteUrl.startsWith("/") ? "" : "/"}${inviteUrl}`
}

export function CommissionHearingInviteDialog({
	hearingRoomId,
	applicantEmail,
	open,
	onOpenChange,
}: {
	hearingRoomId: string
	applicantEmail?: string | null
	open: boolean
	onOpenChange: (open: boolean) => void
}) {
	const inviteMut = useInviteApplicantMutation()
	const [recipientEmail, setRecipientEmail] = React.useState(applicantEmail ?? "")
	const [lastInviteUrl, setLastInviteUrl] = React.useState<string | null>(null)

	React.useEffect(() => {
		if (!open) return
		setLastInviteUrl(null)
		setRecipientEmail(applicantEmail ?? "")
	}, [applicantEmail, open])

	async function runInvite(sendEmail: boolean) {
		const email = recipientEmail.trim()
		if (!email) {
			toast.error("Enter the applicant's email.")
			return
		}
		try {
			const result = await inviteMut.mutateAsync({
				id: hearingRoomId,
				recipientEmail: email,
				sendEmail,
			})
			const inviteUrl = toAbsoluteInviteUrl(result.inviteUrl)
			setLastInviteUrl(inviteUrl)
			if (sendEmail) {
				toast.success(`Invite prepared for ${email}`)
			} else {
				await navigator.clipboard.writeText(inviteUrl)
				toast.success("Invite link copied to clipboard")
			}
		} catch (error) {
			toast.error(
				getOrpcMutationErrorMessage(
					error,
					sendEmail ? "Could not send applicant invite." : "Could not create invite link."
				)
			)
		}
	}

	async function copyLastLink() {
		if (!lastInviteUrl) return
		try {
			await navigator.clipboard.writeText(lastInviteUrl)
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
					<DialogTitle>Invite applicant</DialogTitle>
					<DialogDescription>
						Send or copy the applicant&apos;s dedicated commission hearing lobby link.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 py-1">
					<div className="space-y-2">
						<Label htmlFor="commission-hearing-invite-email">Applicant email</Label>
						<Input
							id="commission-hearing-invite-email"
							type="email"
							value={recipientEmail}
							onChange={event => setRecipientEmail(event.target.value)}
							placeholder="applicant@example.com"
							autoComplete="email"
						/>
					</div>

					{lastInviteUrl ? (
						<div className="space-y-2">
							<Label>Latest invite link</Label>
							<div className="flex gap-2">
								<Input readOnly value={lastInviteUrl} className="text-xs" />
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
						{busy ? "Preparing…" : "Send invite email"}
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

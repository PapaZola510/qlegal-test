"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/core/components/ui/alert-dialog"
import { Button } from "@/core/components/ui/button"
import { useCancelEnpOnboardingMutation } from "@/features/onboarding/api/profile-onboarding.hooks"

export function CancelEnpOnboardingButton({
	variant = "ghost",
	size = "sm",
	className,
	onSuccess,
}: {
	variant?: "ghost" | "outline" | "link"
	size?: "sm" | "default" | "lg"
	className?: string
	onSuccess?: () => void
}) {
	const router = useRouter()
	const cancel = useCancelEnpOnboardingMutation()
	const [open, setOpen] = React.useState(false)

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger
				render={
					<Button
						type="button"
						variant={variant}
						size={size}
						className={className}
						disabled={cancel.isPending}
					>
						Cancel ENP setup
					</Button>
				}
			/>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Cancel ENP setup?</AlertDialogTitle>
					<AlertDialogDescription>
						Your progress on attorney / ENP onboarding will be removed. You will stay on your client
						account and can start ENP setup again later from the dashboard.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep setup</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={cancel.isPending}
						onClick={() => {
							void cancel
								.mutateAsync()
								.then(() => {
									setOpen(false)
									toast.success("ENP setup cancelled. You are back on your client account.")
									onSuccess?.()
									router.push("/dashboard")
								})
								.catch(e => {
									const msg =
										e &&
										typeof e === "object" &&
										"message" in e &&
										typeof (e as { message: unknown }).message === "string"
											? (e as { message: string }).message
											: "Could not cancel ENP setup. Try again."
									toast.error(msg)
								})
						}}
					>
						{cancel.isPending ? "Cancelling…" : "Yes, cancel setup"}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	)
}

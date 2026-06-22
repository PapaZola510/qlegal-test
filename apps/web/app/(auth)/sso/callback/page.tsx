"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button, buttonVariants } from "@/core/components/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { useSyncLmsCourseCompletionMutation } from "@/features/onboarding/api/lms-training.hooks"

/** Draft §3 `redirectUri` target after QLearn redeems the one-time SSO code. */
export default function SsoCallbackPage() {
	const router = useRouter()
	const sync = useSyncLmsCourseCompletionMutation()
	const ran = React.useRef(false)

	React.useEffect(() => {
		if (ran.current) return
		ran.current = true
		void sync
			.mutateAsync(undefined)
			.then(r => {
				if ((r as { completed?: boolean }).completed) {
					toast.success("QLearn course synced — you can continue onboarding")
					router.replace("/onboarding")
					return
				}
				toast.message("Welcome back from QLearn. Sync again after you pass the course.")
			})
			.catch(() => {
				toast.message("Welcome back from QLearn")
			})
	}, [router, sync])

	return (
		<div className="mx-auto flex min-h-[50vh] w-full max-w-lg items-center px-4 py-12">
			<Card className="border-border/80 w-full shadow-md">
				<CardHeader>
					<CardTitle>Returned from QLearn</CardTitle>
					<CardDescription>
						If you finished the certification course, we&apos;ll sync your progress and send you
						back to onboarding.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-3">
					<Button
						type="button"
						disabled={sync.isPending}
						onClick={() =>
							void sync.mutateAsync(undefined).then(r => {
								if ((r as { completed?: boolean }).completed) {
									toast.success("Course complete")
									router.replace("/onboarding")
								} else {
									toast.message("Course not marked complete on QLearn yet")
								}
							})
						}
					>
						{sync.isPending ? "Syncing…" : "Sync course completion"}
					</Button>
					<Link href="/onboarding" className={buttonVariants({ variant: "outline" })}>
						Back to onboarding
					</Link>
				</CardContent>
			</Card>
		</div>
	)
}

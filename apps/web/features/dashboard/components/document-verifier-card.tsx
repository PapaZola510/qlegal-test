import { SecurityCheckFreeIcons } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { VerifyDocumentLink } from "@/features/document-verification/components/verify-document-link"

export function DocumentVerifierCard() {
	return (
		<Card className="border-border shadow-sm">
			<CardHeader>
				<div className="flex items-center gap-2.5">
					<span className="bg-muted text-muted-foreground inline-flex size-8 items-center justify-center rounded-md">
						<HugeiconsIcon icon={SecurityCheckFreeIcons} className="size-4" strokeWidth={2} />
					</span>
					<CardTitle className="text-base">Document verifier</CardTitle>
				</div>
				<CardDescription className="pl-[42px] leading-relaxed">
					Confirm a notarized PDF is authentic.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<VerifyDocumentLink variant="outline">Open document verifier</VerifyDocumentLink>
			</CardContent>
		</Card>
	)
}

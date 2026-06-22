import Link from "next/link"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"

export function ComplianceForbidden() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<Card className="max-w-md">
				<CardContent className="py-12 text-center">
					<p className="text-destructive mb-4 text-6xl font-bold">403</p>
					<h2 className="text-lg font-semibold">Access denied</h2>
					<p className="text-muted-foreground mt-2 text-sm">
						Compliance audit access requires an administrator account or an explicit data-sharing
						grant.
					</p>
					<div className="mt-6">
						<Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
							Return to dashboard
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

import Link from "next/link"

import { Button } from "@/core/components/ui/button"
import { Card, CardContent } from "@/core/components/ui/card"

export function AdminForbidden() {
	return (
		<div className="flex min-h-[60vh] items-center justify-center">
			<Card className="max-w-md">
				<CardContent className="py-12 text-center">
					<p className="text-destructive mb-4 text-6xl font-bold">403</p>
					<h2 className="text-lg font-semibold">Access Denied</h2>
					<p className="text-muted-foreground mt-2 text-sm">
						You do not have permission to access the admin area. This section is restricted to
						administrators only.
					</p>
					<div className="mt-6">
						<Button variant="outline" render={<Link href="/dashboard" />}>
							Return to Dashboard
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}

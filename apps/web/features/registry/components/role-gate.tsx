"use client"

import { Card, CardContent } from "@/core/components/ui/card"

interface RoleGateProps {
	role: string
}

const ROLE_LABELS: Record<string, string> = {
	enp: "ENP (Notary)",
	client: "Client",
	admin: "Admin",
	sub_org_admin: "Sub-org admin",
}

export function RoleGate({ role }: RoleGateProps) {
	const label = ROLE_LABELS[role] ?? role

	return (
		<Card>
			<CardContent className="py-12 text-center">
				<div className="text-destructive mx-auto mb-4 text-5xl">⛔</div>
				<h2 className="text-lg font-semibold">Access Restricted</h2>
				<p className="text-muted-foreground mt-1 text-sm">
					The Notarial Registry is only accessible to Electronic Notary Publics (ENP).
				</p>
				<p className="text-muted-foreground mt-2 text-xs">
					Your current role: <strong>{label}</strong>
				</p>
			</CardContent>
		</Card>
	)
}

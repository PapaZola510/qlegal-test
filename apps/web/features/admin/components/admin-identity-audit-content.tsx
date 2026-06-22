"use client"

import { Badge } from "@/core/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/core/components/ui/table"
import { FIXTURE_IDENTITY_AUDIT } from "@/features/admin/lib/fixtures"

const RESULT_BADGE: Record<string, "default" | "secondary" | "destructive"> = {
	passed: "default",
	pending: "secondary",
	failed: "destructive",
}

const VERIFICATION_LABELS: Record<string, string> = {
	government_id: "Government ID",
	biometric: "Biometric",
	liveness: "Liveness Check",
	otp: "OTP",
}

export function AdminIdentityAuditContent() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Identity Audit Trail</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Type</TableHead>
							<TableHead>Result</TableHead>
							<TableHead>Timestamp</TableHead>
							<TableHead>IP Address</TableHead>
							<TableHead>Notes</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{FIXTURE_IDENTITY_AUDIT.map(entry => (
							<TableRow key={entry.id}>
								<TableCell className="font-medium">{entry.userName}</TableCell>
								<TableCell className="text-sm">
									{VERIFICATION_LABELS[entry.verificationType]}
								</TableCell>
								<TableCell>
									<Badge variant={RESULT_BADGE[entry.result]}>{entry.result}</Badge>
								</TableCell>
								<TableCell className="text-muted-foreground text-sm">{entry.timestamp}</TableCell>
								<TableCell className="font-mono text-xs">{entry.ipAddress}</TableCell>
								<TableCell className="text-muted-foreground max-w-[200px] truncate text-xs">
									{entry.notes}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	)
}

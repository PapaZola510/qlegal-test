import { Card, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"

export function CompliancePlaceholderContent({ title }: { title: string }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent>
				<p className="text-muted-foreground text-sm">Compliance audit data view.</p>
			</CardContent>
		</Card>
	)
}

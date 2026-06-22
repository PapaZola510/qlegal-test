"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/core/components/ui/card"
import { cn } from "@/core/lib/utils"

interface EditableCardProps {
	title: string
	children: (editing: boolean) => React.ReactNode
	onSave?: () => void
	className?: string
}

export function EditableCard({ title, children, onSave, className }: EditableCardProps) {
	const [editing, setEditing] = React.useState(false)

	return (
		<Card className={cn(className)}>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardAction>
					{editing ? (
						<div className="flex gap-1.5">
							<Button variant="outline" size="xs" onClick={() => setEditing(false)}>
								Cancel
							</Button>
							<Button
								size="xs"
								onClick={() => {
									onSave?.()
									setEditing(false)
								}}
							>
								Save
							</Button>
						</div>
					) : (
						<Button variant="outline" size="xs" onClick={() => setEditing(true)}>
							Edit
						</Button>
					)}
				</CardAction>
			</CardHeader>
			<CardContent>{children(editing)}</CardContent>
		</Card>
	)
}

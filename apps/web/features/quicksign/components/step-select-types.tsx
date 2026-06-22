"use client"

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/core/components/ui/card"
import { EnpDocumentTypeMultiSelect } from "@/features/enp-document-types/components/enp-document-type-multi-select"

import { useMyEnpDocumentTypesQuery } from "../api/quicksign.hooks"

interface StepSelectTypesProps {
	selectedIds: string[]
	onChange: (ids: string[]) => void
}

export function StepSelectTypes({ selectedIds, onChange }: StepSelectTypesProps) {
	const documentTypesQ = useMyEnpDocumentTypesQuery()

	return (
		<Card className="mx-auto w-full max-w-lg">
			<CardHeader>
				<CardTitle>Document type(s)</CardTitle>
				<CardDescription>Choose one or more of your types. This controls pricing.</CardDescription>
			</CardHeader>
			<CardContent>
				<EnpDocumentTypeMultiSelect
					types={documentTypesQ.data}
					isLoading={documentTypesQ.isLoading}
					isError={documentTypesQ.isError}
					emptyMessage="You have no active document types yet."
					selectedIds={selectedIds}
					onSelectedIdsChange={onChange}
				/>
			</CardContent>
		</Card>
	)
}

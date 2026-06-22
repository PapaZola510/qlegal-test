"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/core/components/ui/select"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportSwornStatementAssetsLiabilitiesNetWorth } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultSwornStatementAssetsLiabilitiesNetWorth,
	type SwornStatementAssetsLiabilitiesNetWorthData,
	type SwornStatementBusinessInterestRow,
	type SwornStatementChildRow,
	type SwornStatementLiabilityRow,
	type SwornStatementPersonalPropertyRow,
	type SwornStatementRealPropertyRow,
	type SwornStatementRelativeRow,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:sworn-statement-assets-liabilities-net-worth"
const FILING_TYPE_OPTIONS = [
	{ value: "joint", label: "Joint Filing" },
	{ value: "separate", label: "Separate Filing" },
	{ value: "not-applicable", label: "Not Applicable" },
] as const

type FormData = SwornStatementAssetsLiabilitiesNetWorthData

type ChildFieldKey = keyof SwornStatementChildRow
type RealPropertyFieldKey = keyof SwornStatementRealPropertyRow
type PersonalPropertyFieldKey = keyof SwornStatementPersonalPropertyRow
type LiabilityFieldKey = keyof SwornStatementLiabilityRow
type BusinessInterestFieldKey = keyof SwornStatementBusinessInterestRow
type RelativeFieldKey = keyof SwornStatementRelativeRow

type RepeatableFieldKey =
	| ChildFieldKey
	| RealPropertyFieldKey
	| PersonalPropertyFieldKey
	| LiabilityFieldKey
	| BusinessInterestFieldKey
	| RelativeFieldKey

function blank(value: string, fallback = "_____________") {
	return value.trim() ? value : fallback
}

function Field({
	label,
	id,
	value,
	onChange,
	multiline = false,
	placeholder,
}: {
	label: string
	id: string
	value: string
	onChange: (value: string) => void
	multiline?: boolean
	placeholder?: string
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-xs font-medium">
				{label}
			</Label>
			{multiline ? (
				<Textarea
					id={id}
					value={value}
					onChange={e => onChange(e.target.value)}
					placeholder={placeholder}
					className="min-h-18 text-sm"
				/>
			) : (
				<Input
					id={id}
					value={value}
					onChange={e => onChange(e.target.value)}
					placeholder={placeholder}
					className="h-8 text-sm"
				/>
			)}
		</div>
	)
}

function SelectField({
	label,
	id,
	value,
	onChange,
	options,
}: {
	label: string
	id: string
	value: string
	onChange: (value: string) => void
	options: readonly { value: string; label: string }[]
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-xs font-medium">
				{label}
			</Label>
			<Select value={value} onValueChange={nextValue => onChange(nextValue ?? "")}>
				<SelectTrigger id={id} className="h-8 text-sm">
					<SelectValue>
						{options.find(option => option.value === value)?.label || "Select…"}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					{options.map(option => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	)
}

function RepeatableSection<T extends object>({
	title,
	description,
	rows,
	onChange,
	onAdd,
	onRemove,
	fields,
	rowLabel,
}: {
	title: string
	description?: string
	rows: T[]
	onChange: (index: number, key: Extract<keyof T, string>, value: string) => void
	onAdd: () => void
	onRemove: (index: number) => void
	fields: Array<{
		key: Extract<keyof T, string>
		label: string
		placeholder?: string
		multiline?: boolean
	}>
	rowLabel: string
}) {
	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
						{title}
					</p>
					{description ? (
						<p className="text-muted-foreground mt-1 text-[11px]">{description}</p>
					) : null}
				</div>
				<Button type="button" variant="outline" size="sm" onClick={onAdd}>
					+ Add
				</Button>
			</div>
			<div className="space-y-3">
				{rows.map((row, index) => (
					<div key={index} className="bg-background space-y-3 rounded-lg border p-3">
						<div className="flex items-center justify-between gap-2">
							<p className="text-muted-foreground text-xs font-medium">
								{rowLabel} {index + 1}
							</p>
							{rows.length > 1 ? (
								<Button type="button" variant="outline" size="sm" onClick={() => onRemove(index)}>
									Remove
								</Button>
							) : null}
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							{fields.map(field => (
								<Field
									key={String(field.key)}
									label={field.label}
									id={`${title}-${index}-${String(field.key)}`}
									value={String(row[field.key] ?? "")}
									onChange={value => onChange(index, field.key, value)}
									placeholder={field.placeholder}
									multiline={field.multiline}
								/>
							))}
						</div>
					</div>
				))}
			</div>
		</div>
	)
}

function DocumentPreview({ data }: { data: FormData }) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)

	const filingLabel =
		FILING_TYPE_OPTIONS.find(option => option.value === data.filingType)?.label || "Not Applicable"
	const childrenRows =
		data.householdChildren.length > 0
			? data.householdChildren
			: defaultSwornStatementAssetsLiabilitiesNetWorth.householdChildren
	const realProperties =
		data.realProperties.length > 0
			? data.realProperties
			: defaultSwornStatementAssetsLiabilitiesNetWorth.realProperties
	const personalProperties =
		data.personalProperties.length > 0
			? data.personalProperties
			: defaultSwornStatementAssetsLiabilitiesNetWorth.personalProperties
	const liabilities =
		data.liabilities.length > 0
			? data.liabilities
			: defaultSwornStatementAssetsLiabilitiesNetWorth.liabilities
	const businessInterests =
		data.businessInterests.length > 0
			? data.businessInterests
			: defaultSwornStatementAssetsLiabilitiesNetWorth.businessInterests
	const relatives =
		data.relativesInGovernmentService.length > 0
			? data.relativesInGovernmentService
			: defaultSwornStatementAssetsLiabilitiesNetWorth.relativesInGovernmentService

	return (
		<div
			id="legal-template-print-area"
			className="min-h-264 w-204 shrink-0 bg-white px-16 py-12 font-serif text-[9pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			<div className="mb-4 text-right text-[8pt] leading-tight">
				<div>Revised as of January 2015</div>
				<div>Per CSC Resolution No. 1500888</div>
				<div>Promulgated on January 23, 2015</div>
			</div>

			<div className="mb-4 text-center">
				<div className="text-[13pt] leading-tight font-bold uppercase">
					Sworn Statement of Assets, Liabilities and Net Worth
				</div>
				<div className="mt-1">
					As of <span className="underline">{b(data.asOfDate)}</span>
				</div>
				<div className="text-[8pt]">(Required by R.A. 6713)</div>
			</div>

			<div className="mb-4 text-center text-[8pt] italic">
				<div>
					Note: Husband and wife who are both public officials and employees may file the required
					statements jointly or separately.
				</div>
				<div>[ ] Joint Filing &nbsp;&nbsp; [ ] Separate Filing &nbsp;&nbsp; [ ] Not Applicable</div>
				<div className="mt-1 font-semibold not-italic">{filingLabel}</div>
			</div>

			<div className="mb-5 grid grid-cols-2 gap-6 text-[8pt]">
				<div className="space-y-2">
					<div className="grid grid-cols-[78px_1fr] items-end gap-2">
						<div className="font-bold uppercase">Declarant</div>
						<div className="grid grid-cols-3 gap-2">
							<div className="border-b border-black text-center">{b(data.declarantFamilyName)}</div>
							<div className="border-b border-black text-center">{b(data.declarantFirstName)}</div>
							<div className="border-b border-black text-center">
								{b(data.declarantMiddleInitial)}
							</div>
						</div>
					</div>
					<div className="ml-19.5 grid grid-cols-3 gap-2 text-center text-[7pt]">
						<div>(Family Name)</div>
						<div>(First Name)</div>
						<div>(M.I.)</div>
					</div>
					<div className="grid grid-cols-[78px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Address</div>
						<div className="space-y-1">
							<div className="border-b border-black">{b(data.declarantAgencyOffice)}</div>
							<div className="border-b border-black">{b(data.declarantOfficeAddress)}</div>
						</div>
					</div>
				</div>
				<div className="space-y-2">
					<div className="grid grid-cols-[72px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Position</div>
						<div className="border-b border-black">{b(data.declarantPosition)}</div>
					</div>
					<div className="grid grid-cols-[72px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Agency/Office</div>
						<div className="border-b border-black">{b(data.declarantAgencyOffice)}</div>
					</div>
					<div className="grid grid-cols-[72px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Office Address</div>
						<div className="border-b border-black">{b(data.declarantOfficeAddress)}</div>
					</div>
				</div>
			</div>

			<div className="mb-6 grid grid-cols-2 gap-6 text-[8pt]">
				<div className="space-y-2">
					<div className="grid grid-cols-[78px_1fr] items-end gap-2">
						<div className="font-bold uppercase">Spouse</div>
						<div className="grid grid-cols-3 gap-2">
							<div className="border-b border-black text-center">{b(data.spouseFamilyName)}</div>
							<div className="border-b border-black text-center">{b(data.spouseFirstName)}</div>
							<div className="border-b border-black text-center">{b(data.spouseMiddleInitial)}</div>
						</div>
					</div>
					<div className="ml-19.5 grid grid-cols-3 gap-2 text-center text-[7pt]">
						<div>(Family Name)</div>
						<div>(First Name)</div>
						<div>(M.I.)</div>
					</div>
				</div>
				<div className="space-y-2">
					<div className="grid grid-cols-[72px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Position</div>
						<div className="border-b border-black">{b(data.spousePosition)}</div>
					</div>
					<div className="grid grid-cols-[72px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Agency/Office</div>
						<div className="border-b border-black">{b(data.spouseAgencyOffice)}</div>
					</div>
					<div className="grid grid-cols-[72px_1fr] items-start gap-2">
						<div className="font-bold uppercase">Office Address</div>
						<div className="border-b border-black">{b(data.spouseOfficeAddress)}</div>
					</div>
				</div>
			</div>

			<div className="mb-5">
				<div className="mb-2 text-center text-[9pt] font-bold uppercase underline">
					Unmarried Children Below Eighteen (18) Years of Age Living in Declarant's Household
				</div>
				<table className="w-full border-collapse text-[8pt]">
					<thead>
						<tr>
							<th className="border border-black bg-gray-200 p-1">Name</th>
							<th className="border border-black bg-gray-200 p-1">Date of Birth</th>
							<th className="border border-black bg-gray-200 p-1">Age</th>
						</tr>
					</thead>
					<tbody>
						{childrenRows.map((row, index) => (
							<tr key={index}>
								<td className="border border-black p-1">{b(row.name, "")}</td>
								<td className="border border-black p-1">{b(row.dateOfBirth, "")}</td>
								<td className="border border-black p-1">{b(row.age, "")}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mb-2 text-center text-[9pt] font-bold uppercase underline">
				Assets, Liabilities and Net Worth
			</div>

			<div className="mb-5">
				<div className="mb-1 text-[9pt] font-bold">1. Assets</div>
				<div className="mb-2 text-[8pt] italic">a. Real Properties</div>
				<table className="w-full border-collapse text-[7pt]">
					<thead>
						<tr className="bg-gray-200">
							<th className="border border-black p-1">Description</th>
							<th className="border border-black p-1">Kind</th>
							<th className="border border-black p-1">Exact Location</th>
							<th className="border border-black p-1">Assessed Value</th>
							<th className="border border-black p-1">Current Fair Market Value</th>
							<th className="border border-black p-1">Year</th>
							<th className="border border-black p-1">Mode</th>
							<th className="border border-black p-1">Acquisition Cost</th>
						</tr>
					</thead>
					<tbody>
						{realProperties.map((row, index) => (
							<tr key={index}>
								<td className="border border-black p-1">{b(row.description, "")}</td>
								<td className="border border-black p-1">{b(row.kind, "")}</td>
								<td className="border border-black p-1">{b(row.exactLocation, "")}</td>
								<td className="border border-black p-1">{b(row.assessedValue, "")}</td>
								<td className="border border-black p-1">{b(row.currentFairMarketValue, "")}</td>
								<td className="border border-black p-1">{b(row.acquisitionYear, "")}</td>
								<td className="border border-black p-1">{b(row.acquisitionMode, "")}</td>
								<td className="border border-black p-1">{b(row.acquisitionCost, "")}</td>
							</tr>
						))}
					</tbody>
				</table>
				<div className="mt-1 text-right">
					Subtotal:{" "}
					<span className="inline-block min-w-20 border-b border-black">
						{b(data.totalAssets, "")}
					</span>
				</div>
			</div>

			<div className="mb-5">
				<div className="mb-2 text-[8pt] italic">b. Personal Properties</div>
				<table className="w-full border-collapse text-[8pt]">
					<thead>
						<tr className="bg-gray-200">
							<th className="border border-black p-1">Description</th>
							<th className="border border-black p-1">Year Acquired</th>
							<th className="border border-black p-1">Acquisition Cost/Amount</th>
						</tr>
					</thead>
					<tbody>
						{personalProperties.map((row, index) => (
							<tr key={index}>
								<td className="border border-black p-1">{b(row.description, "")}</td>
								<td className="border border-black p-1">{b(row.yearAcquired, "")}</td>
								<td className="border border-black p-1">{b(row.acquisitionCostAmount, "")}</td>
							</tr>
						))}
					</tbody>
				</table>
				<div className="mt-1 text-right">
					Subtotal:{" "}
					<span className="inline-block min-w-20 border-b border-black">
						{b(data.totalAssets, "")}
					</span>
				</div>
			</div>

			<div className="mb-5">
				<div className="mb-1 text-[9pt] font-bold">2. Liabilities</div>
				<table className="w-full border-collapse text-[8pt]">
					<thead>
						<tr className="bg-gray-200">
							<th className="border border-black p-1">Nature</th>
							<th className="border border-black p-1">Name of Creditors</th>
							<th className="border border-black p-1">Outstanding Balance</th>
						</tr>
					</thead>
					<tbody>
						{liabilities.map((row, index) => (
							<tr key={index}>
								<td className="border border-black p-1">{b(row.nature, "")}</td>
								<td className="border border-black p-1">{b(row.creditor, "")}</td>
								<td className="border border-black p-1">{b(row.outstandingBalance, "")}</td>
							</tr>
						))}
					</tbody>
				</table>
				<div className="mt-1 text-right">
					Total Liabilities:{" "}
					<span className="inline-block min-w-20 border-b border-black">
						{b(data.totalLiabilities, "")}
					</span>
				</div>
				<div className="mt-1 text-right font-semibold">
					Net Worth:{" "}
					<span className="inline-block min-w-28 border-b border-black">
						{b(data.netWorth, "")}
					</span>
				</div>
			</div>

			<div className="mb-5">
				<div className="mb-1 text-center text-[9pt] font-bold uppercase">
					Business Interests and Financial Connections
				</div>
				<table className="w-full border-collapse text-[7pt]">
					<thead>
						<tr className="bg-gray-200">
							<th className="border border-black p-1">Name of Entity/Business Enterprise</th>
							<th className="border border-black p-1">Business Address</th>
							<th className="border border-black p-1">
								Nature of Business Interest/Financial Connection
							</th>
							<th className="border border-black p-1">Date of Acquisition</th>
						</tr>
					</thead>
					<tbody>
						{businessInterests.map((row, index) => (
							<tr key={index}>
								<td className="border border-black p-1">{b(row.nameOfEntity, "")}</td>
								<td className="border border-black p-1">{b(row.businessAddress, "")}</td>
								<td className="border border-black p-1">{b(row.natureOfBusinessInterest, "")}</td>
								<td className="border border-black p-1">{b(row.dateOfAcquisition, "")}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mb-5">
				<div className="mb-1 text-center text-[9pt] font-bold uppercase">
					Relatives in the Government Service
				</div>
				<table className="w-full border-collapse text-[8pt]">
					<thead>
						<tr className="bg-gray-200">
							<th className="border border-black p-1">Name of Relative</th>
							<th className="border border-black p-1">Relationship</th>
							<th className="border border-black p-1">Position</th>
							<th className="border border-black p-1">Name of Agency/Office and Address</th>
						</tr>
					</thead>
					<tbody>
						{relatives.map((row, index) => (
							<tr key={index}>
								<td className="border border-black p-1">{b(row.name, "")}</td>
								<td className="border border-black p-1">{b(row.relationship, "")}</td>
								<td className="border border-black p-1">{b(row.position, "")}</td>
								<td className="border border-black p-1">{b(row.agencyOfficeAddress, "")}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mb-4 text-justify">
				I hereby certify that these are true and correct statements of my assets, liabilities, net
				worth, business interests and financial connections, including those of my spouse and
				unmarried children below eighteen (18) years of age living in my household, and that to the
				best of my knowledge, the above-enumerated are names of my relatives in the government
				within the fourth civil degree of consanguinity or affinity.
			</div>

			<div className="mb-4 text-justify">
				I hereby authorize the Ombudsman or his/her duly authorized representative to obtain and
				secure from all appropriate government agencies, including the Bureau of Internal Revenue
				such documents that may show my assets, liabilities, net worth, business interests and
				financial connections, to include those of my spouse and unmarried children below 18 years
				of age living with me in my household covering previous years to include the year I first
				assumed office in government.
			</div>

			<div className="mb-4">
				Date: <span className="underline">{b(data.statementDate)}</span>
			</div>

			<div className="mb-4 grid grid-cols-2 gap-8 text-[8pt]">
				<div>
					<div className="h-8 border-b border-black" />
					<div className="mt-1 text-center italic">(Signature of Declarant)</div>
					<div className="mt-2 space-y-0.5">
						<div>
							Government Issued ID: <span className="underline">{b(data.declarantGovIdType)}</span>
						</div>
						<div>
							ID No.: <span className="underline">{b(data.declarantGovIdNo)}</span>
						</div>
						<div>
							Date Issued: <span className="underline">{b(data.declarantGovIdDateIssued)}</span>
						</div>
					</div>
				</div>
				<div>
					<div className="h-8 border-b border-black" />
					<div className="mt-1 text-center italic">(Signature of Co-Declarant/Spouse)</div>
					<div className="mt-2 space-y-0.5">
						<div>
							Government Issued ID: <span className="underline">{b(data.spouseGovIdType)}</span>
						</div>
						<div>
							ID No.: <span className="underline">{b(data.spouseGovIdNo)}</span>
						</div>
						<div>
							Date Issued: <span className="underline">{b(data.spouseGovIdDateIssued)}</span>
						</div>
					</div>
				</div>
			</div>

			<div className="mt-5 text-[8pt] font-semibold">
				SUBSCRIBED AND SWORN to before me this{" "}
				<span className="underline">{b(data.subscribedDay, "__")}</span> day of{" "}
				<span className="underline">{b(data.subscribedMonth, "__")}</span>,{" "}
				<span className="underline">{b(data.subscribedYear, "____")}</span> at{" "}
				<span className="underline">{b(data.subscribedLocation)}</span>, affiant exhibiting to me
				the above-stated government issued identification card.
			</div>

			<div className="mt-8 grid grid-cols-2 gap-8 text-[8pt]">
				<div className="border-b border-black pt-6" />
				<div className="pt-6 text-center italic">(Person Administering Oath)</div>
			</div>
		</div>
	)
}

function createChildRow(): SwornStatementChildRow {
	return { name: "", dateOfBirth: "", age: "" }
}

function createRealPropertyRow(): SwornStatementRealPropertyRow {
	return {
		description: "",
		kind: "",
		exactLocation: "",
		assessedValue: "",
		currentFairMarketValue: "",
		acquisitionYear: "",
		acquisitionMode: "",
		acquisitionCost: "",
	}
}

function createPersonalPropertyRow(): SwornStatementPersonalPropertyRow {
	return { description: "", yearAcquired: "", acquisitionCostAmount: "" }
}

function createLiabilityRow(): SwornStatementLiabilityRow {
	return { nature: "", creditor: "", outstandingBalance: "" }
}

function createBusinessInterestRow(): SwornStatementBusinessInterestRow {
	return {
		nameOfEntity: "",
		businessAddress: "",
		natureOfBusinessInterest: "",
		dateOfAcquisition: "",
	}
}

function createRelativeRow(): SwornStatementRelativeRow {
	return { name: "", relationship: "", position: "", agencyOfficeAddress: "" }
}

export function SwornStatementAssetsLiabilitiesNetWorthEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<FormData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultSwornStatementAssetsLiabilitiesNetWorth,
						...(JSON.parse(saved) as Partial<FormData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultSwornStatementAssetsLiabilitiesNetWorth
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const setField =
		<
			K extends Exclude<
				keyof FormData,
				| "householdChildren"
				| "realProperties"
				| "personalProperties"
				| "liabilities"
				| "businessInterests"
				| "relativesInGovernmentService"
			>,
		>(
			key: K
		) =>
		(value: string) =>
			setData(prev => ({ ...prev, [key]: value }))

	const updateRow = <T extends object>(
		section: keyof Pick<
			FormData,
			| "householdChildren"
			| "realProperties"
			| "personalProperties"
			| "liabilities"
			| "businessInterests"
			| "relativesInGovernmentService"
		>,
		index: number,
		key: Extract<keyof T, string>,
		value: string
	) => {
		setData(prev => ({
			...prev,
			[section]: (prev[section] as unknown as T[]).map((row, rowIndex) =>
				rowIndex === index ? { ...row, [key]: value } : row
			),
		}))
	}

	const addRow = <T extends object>(
		section: keyof Pick<
			FormData,
			| "householdChildren"
			| "realProperties"
			| "personalProperties"
			| "liabilities"
			| "businessInterests"
			| "relativesInGovernmentService"
		>,
		factory: () => T
	) => {
		setData(prev => ({
			...prev,
			[section]: [...(prev[section] as unknown as T[]), factory()],
		}))
	}

	const removeRow = (
		section: keyof Pick<
			FormData,
			| "householdChildren"
			| "realProperties"
			| "personalProperties"
			| "liabilities"
			| "businessInterests"
			| "relativesInGovernmentService"
		>,
		index: number
	) => {
		setData(prev => ({
			...prev,
			[section]: (prev[section] as unknown as Array<Record<string, unknown>>).filter(
				(_, rowIndex) => rowIndex !== index
			),
		}))
	}

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportSwornStatementAssetsLiabilitiesNetWorth(data)
		} finally {
			setExporting(false)
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-3">
				<Button variant="outline" size="sm" onClick={onBack}>
					← Templates
				</Button>
				<div className="flex-1" />
				<Button variant="outline" size="sm" onClick={handleSave}>
					{saved ? "Saved ✓" : "Save Draft"}
				</Button>
				<Button size="sm" onClick={handleExport} disabled={exporting}>
					{exporting ? "Generating PDF…" : "Export PDF"}
				</Button>
			</div>

			<div className="flex gap-6" style={{ height: "calc(100vh - 140px)" }}>
				<div className="w-107.5 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field
							label="As Of Date"
							id="asOfDate"
							value={data.asOfDate}
							onChange={setField("asOfDate")}
							placeholder="January 1, 2026"
						/>
						<SelectField
							label="Filing Type"
							id="filingType"
							value={data.filingType}
							onChange={value =>
								setData(prev => ({ ...prev, filingType: value as FormData["filingType"] }))
							}
							options={FILING_TYPE_OPTIONS}
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
							Declarant
						</p>
						<div className="grid grid-cols-3 gap-3">
							<Field
								label="Family Name"
								id="declarantFamilyName"
								value={data.declarantFamilyName}
								onChange={setField("declarantFamilyName")}
							/>
							<Field
								label="First Name"
								id="declarantFirstName"
								value={data.declarantFirstName}
								onChange={setField("declarantFirstName")}
							/>
							<Field
								label="M.I."
								id="declarantMiddleInitial"
								value={data.declarantMiddleInitial}
								onChange={setField("declarantMiddleInitial")}
							/>
						</div>
						<Field
							label="Position"
							id="declarantPosition"
							value={data.declarantPosition}
							onChange={setField("declarantPosition")}
						/>
						<Field
							label="Agency/Office"
							id="declarantAgencyOffice"
							value={data.declarantAgencyOffice}
							onChange={setField("declarantAgencyOffice")}
						/>
						<Field
							label="Office Address"
							id="declarantOfficeAddress"
							value={data.declarantOfficeAddress}
							onChange={setField("declarantOfficeAddress")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
							Spouse
						</p>
						<div className="grid grid-cols-3 gap-3">
							<Field
								label="Family Name"
								id="spouseFamilyName"
								value={data.spouseFamilyName}
								onChange={setField("spouseFamilyName")}
							/>
							<Field
								label="First Name"
								id="spouseFirstName"
								value={data.spouseFirstName}
								onChange={setField("spouseFirstName")}
							/>
							<Field
								label="M.I."
								id="spouseMiddleInitial"
								value={data.spouseMiddleInitial}
								onChange={setField("spouseMiddleInitial")}
							/>
						</div>
						<Field
							label="Position"
							id="spousePosition"
							value={data.spousePosition}
							onChange={setField("spousePosition")}
						/>
						<Field
							label="Agency/Office"
							id="spouseAgencyOffice"
							value={data.spouseAgencyOffice}
							onChange={setField("spouseAgencyOffice")}
						/>
						<Field
							label="Office Address"
							id="spouseOfficeAddress"
							value={data.spouseOfficeAddress}
							onChange={setField("spouseOfficeAddress")}
							multiline
						/>
					</div>

					<Separator />

					<RepeatableSection
						title="Unmarried Children"
						description="Below 18 years of age living in the declarant's household."
						rowLabel="Child"
						rows={data.householdChildren}
						onChange={(index, key, value) =>
							updateRow<SwornStatementChildRow>("householdChildren", index, key, value)
						}
						onAdd={() => addRow<SwornStatementChildRow>("householdChildren", createChildRow)}
						onRemove={index => removeRow("householdChildren", index)}
						fields={[
							{ key: "name", label: "Name" },
							{ key: "dateOfBirth", label: "Date of Birth" },
							{ key: "age", label: "Age" },
						]}
					/>

					<Separator />

					<RepeatableSection
						title="Real Properties"
						rowLabel="Property"
						rows={data.realProperties}
						onChange={(index, key, value) =>
							updateRow<SwornStatementRealPropertyRow>("realProperties", index, key, value)
						}
						onAdd={() =>
							addRow<SwornStatementRealPropertyRow>("realProperties", createRealPropertyRow)
						}
						onRemove={index => removeRow("realProperties", index)}
						fields={[
							{ key: "description", label: "Description" },
							{ key: "kind", label: "Kind" },
							{ key: "exactLocation", label: "Exact Location" },
							{ key: "assessedValue", label: "Assessed Value" },
							{ key: "currentFairMarketValue", label: "Current Fair Market Value" },
							{ key: "acquisitionYear", label: "Year" },
							{ key: "acquisitionMode", label: "Mode" },
							{ key: "acquisitionCost", label: "Acquisition Cost" },
						]}
					/>

					<Separator />

					<RepeatableSection
						title="Personal Properties"
						rowLabel="Property"
						rows={data.personalProperties}
						onChange={(index, key, value) =>
							updateRow<SwornStatementPersonalPropertyRow>("personalProperties", index, key, value)
						}
						onAdd={() =>
							addRow<SwornStatementPersonalPropertyRow>(
								"personalProperties",
								createPersonalPropertyRow
							)
						}
						onRemove={index => removeRow("personalProperties", index)}
						fields={[
							{ key: "description", label: "Description" },
							{ key: "yearAcquired", label: "Year Acquired" },
							{ key: "acquisitionCostAmount", label: "Acquisition Cost/Amount" },
						]}
					/>

					<Separator />

					<RepeatableSection
						title="Liabilities"
						rowLabel="Liability"
						rows={data.liabilities}
						onChange={(index, key, value) =>
							updateRow<SwornStatementLiabilityRow>("liabilities", index, key, value)
						}
						onAdd={() => addRow<SwornStatementLiabilityRow>("liabilities", createLiabilityRow)}
						onRemove={index => removeRow("liabilities", index)}
						fields={[
							{ key: "nature", label: "Nature" },
							{ key: "creditor", label: "Name of Creditors" },
							{ key: "outstandingBalance", label: "Outstanding Balance" },
						]}
					/>

					<Separator />

					<RepeatableSection
						title="Business Interests"
						rowLabel="Interest"
						rows={data.businessInterests}
						onChange={(index, key, value) =>
							updateRow<SwornStatementBusinessInterestRow>("businessInterests", index, key, value)
						}
						onAdd={() =>
							addRow<SwornStatementBusinessInterestRow>(
								"businessInterests",
								createBusinessInterestRow
							)
						}
						onRemove={index => removeRow("businessInterests", index)}
						fields={[
							{ key: "nameOfEntity", label: "Name of Entity/Business Enterprise" },
							{ key: "businessAddress", label: "Business Address" },
							{
								key: "natureOfBusinessInterest",
								label: "Nature of Business Interest/Financial Connection",
							},
							{ key: "dateOfAcquisition", label: "Date of Acquisition" },
						]}
					/>

					<Separator />

					<RepeatableSection
						title="Relatives in Government Service"
						rowLabel="Relative"
						rows={data.relativesInGovernmentService}
						onChange={(index, key, value) =>
							updateRow<SwornStatementRelativeRow>(
								"relativesInGovernmentService",
								index,
								key,
								value
							)
						}
						onAdd={() =>
							addRow<SwornStatementRelativeRow>("relativesInGovernmentService", createRelativeRow)
						}
						onRemove={index => removeRow("relativesInGovernmentService", index)}
						fields={[
							{ key: "name", label: "Name of Relative" },
							{ key: "relationship", label: "Relationship" },
							{ key: "position", label: "Position" },
							{ key: "agencyOfficeAddress", label: "Name of Agency/Office and Address" },
						]}
					/>

					<Separator />

					<div className="space-y-3">
						<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
							Certification & Oath
						</p>
						<Field
							label="Statement Date"
							id="statementDate"
							value={data.statementDate}
							onChange={setField("statementDate")}
							placeholder="January 1, 2026"
						/>
						<Field
							label="Declarant ID Type"
							id="declarantGovIdType"
							value={data.declarantGovIdType}
							onChange={setField("declarantGovIdType")}
							placeholder="Passport / Driver's License"
						/>
						<Field
							label="Declarant ID No."
							id="declarantGovIdNo"
							value={data.declarantGovIdNo}
							onChange={setField("declarantGovIdNo")}
						/>
						<Field
							label="Declarant ID Date Issued"
							id="declarantGovIdDateIssued"
							value={data.declarantGovIdDateIssued}
							onChange={setField("declarantGovIdDateIssued")}
							placeholder="January 1, 2026"
						/>
						<Field
							label="Spouse ID Type"
							id="spouseGovIdType"
							value={data.spouseGovIdType}
							onChange={setField("spouseGovIdType")}
							placeholder="Passport / Driver's License"
						/>
						<Field
							label="Spouse ID No."
							id="spouseGovIdNo"
							value={data.spouseGovIdNo}
							onChange={setField("spouseGovIdNo")}
						/>
						<Field
							label="Spouse ID Date Issued"
							id="spouseGovIdDateIssued"
							value={data.spouseGovIdDateIssued}
							onChange={setField("spouseGovIdDateIssued")}
							placeholder="January 1, 2026"
						/>
						<Field
							label="Subscribed Day"
							id="subscribedDay"
							value={data.subscribedDay}
							onChange={setField("subscribedDay")}
						/>
						<Field
							label="Subscribed Month"
							id="subscribedMonth"
							value={data.subscribedMonth}
							onChange={setField("subscribedMonth")}
						/>
						<Field
							label="Subscribed Year"
							id="subscribedYear"
							value={data.subscribedYear}
							onChange={setField("subscribedYear")}
						/>
						<Field
							label="Subscribed Location"
							id="subscribedLocation"
							value={data.subscribedLocation}
							onChange={setField("subscribedLocation")}
							placeholder="City / Municipality"
						/>
						<Field
							label="Person Administering Oath"
							id="oathAdministeringName"
							value={data.oathAdministeringName}
							onChange={setField("oathAdministeringName")}
						/>
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					<div className="mb-3 flex items-center gap-2">
						<span className="text-muted-foreground text-xs">Document Preview</span>
						<span className="bg-muted rounded px-1.5 py-0.5 text-xs">Live</span>
					</div>
					<div className="overflow-auto rounded-lg border bg-gray-100 p-4">
						<div
							className="origin-top-left"
							style={{
								transform: "scale(0.72)",
								transformOrigin: "top left",
								width: "612pt",
								marginBottom: "-28%",
							}}
						>
							<DocumentPreview data={data} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

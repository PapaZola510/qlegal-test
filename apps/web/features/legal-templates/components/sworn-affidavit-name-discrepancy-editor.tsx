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
import { exportSwornAffidavitNameDiscrepancy } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultSwornAffidavitNameDiscrepancy,
	type SwornAffidavitNameDiscrepancyData,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:sworn-affidavit-name-discrepancy"

type LegacySwornAffidavitNameDiscrepancyData = Partial<SwornAffidavitNameDiscrepancyData> & {
	explanation2?: string
	explanation3?: string
}

type SwornAffidavitFieldKey = Exclude<keyof SwornAffidavitNameDiscrepancyData, "explanations">

function blank(val: string, placeholder = "_____________") {
	return val.trim() ? val : placeholder
}

function normalizeSwornAffidavitNameDiscrepancyData(
	raw: LegacySwornAffidavitNameDiscrepancyData
): SwornAffidavitNameDiscrepancyData {
	const { explanation2, explanation3, explanations, ...rest } = raw
	const normalizedExplanations = Array.isArray(explanations)
		? explanations.map(explanation => (typeof explanation === "string" ? explanation : ""))
		: [explanation2, explanation3].filter(
				(explanation): explanation is string =>
					typeof explanation === "string" && explanation.trim().length > 0
			)

	return {
		...defaultSwornAffidavitNameDiscrepancy,
		...rest,
		explanations: normalizedExplanations.length > 0 ? normalizedExplanations : [""],
	}
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
	onChange: (v: string) => void
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

function DocumentPreview({ data }: { data: SwornAffidavitNameDiscrepancyData }) {
	const b = (v: string, fb = "_____________") => blank(v, fb)
	const explanations = data.explanations.length > 0 ? data.explanations : [""]
	const namesItemNumber = explanations.length + 2
	const indemnityItemNumber = namesItemNumber + 1
	const closingItemNumber = namesItemNumber + 2

	return (
		<div
			id="legal-template-print-area"
			className="min-h-264 w-204 shrink-0 bg-white px-24 py-24 font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			{/* Header */}
			<div className="mb-1 text-[9pt]">Republic of the Philippines</div>
			<div className="text-[9pt]">
				City of <span className="underline">{b(data.city)}</span>
			</div>
			<div className="mb-6 text-[9pt]">
				<span className="underline">{b(data.province)}</span> ) S.S.
			</div>

			{/* Title */}
			<div className="mb-6 text-center text-[12pt] font-bold underline">
				AFFIDAVIT OF NAME DISCREPANCY
			</div>

			{/* Opening paragraph */}
			<p className="mb-4 text-justify">
				I, <span className="font-bold underline">{b(data.affiantName)}</span>, of legal age,{" "}
				<span className="underline">{data.civilStatus || "single/married"}</span>, Filipino citizen,
				residing at <span className="underline">{b(data.address)}</span>, after having duly sworn to
				in accordance with law, do hereby depose and say that:
			</p>

			{/* Items */}
			<div className="ml-8 space-y-4">
				{/* Item 1 */}
				<p className="text-justify">
					<span className="font-bold">1.</span>&nbsp; When I/He/She received the{" "}
					<span className="underline">{b(data.companyName, "Name of Stocks")}</span> Stock
					Certificate No. <span className="underline">{b(data.stockCertificateNo)}</span>,
					my/his/her name appeared as <span className="underline">{b(data.nameAppearedAs)}</span>,
					whereas in all my/his/her documents and other records{" "}
					<span className="underline">{b(data.recordsName)}</span>.
				</p>

				{explanations.map((explanation, index) => (
					<p key={index} className="text-justify">
						<span className="font-bold">{index + 2}.</span>&nbsp;{" "}
						<span className="underline">{b(explanation)}</span>
					</p>
				))}

				{/* Name variants item */}
				<p className="text-justify">
					<span className="font-bold">{namesItemNumber}.</span>&nbsp; I am executing this Affidavit
					to attest to the fact that the names{" "}
					<span className="underline">{b(data.name1, "Name1")}</span>,{" "}
					<span className="underline">{b(data.name2, "Name2")}</span>, and{" "}
					<span className="underline">{b(data.name3, "Name3")}</span>, refers to one and the same
					person.
				</p>

				{/* Indemnity item */}
				<p className="text-justify">
					<span className="font-bold">{indemnityItemNumber}.</span>&nbsp; I hereby further agree and
					undertake to hold free and harmless and to indemnify{" "}
					<span className="underline">{b(data.companyName, "Name of Stocks")}</span>, its stock
					transfer agent <span className="underline">____________________________</span>, and their
					respective directors, officers and employees, of any and all claims, damages, charges,
					expenses, and liabilities of whatever nature that may arise from or in connection with the
					processing of stock-related transactions.
				</p>

				{/* Closing item */}
				<p className="text-justify">
					<span className="font-bold">{closingItemNumber}.</span>&nbsp; Finally, I am executing this
					Affidavit to attest to the truth of the foregoing statements and for all legal intents and
					purposes it may serve.
				</p>
			</div>

			<div className="h-8" />

			{/* IN WITNESS WHEREOF */}
			<p className="mb-8 text-justify italic">
				IN WITNESS WHEREOF, I have hereunto affixed my signature this{" "}
				<span className="underline">{b(data.signDay, "____")}</span> day of{" "}
				<span className="underline">{b(data.signMonth, "_______")}</span>, 20
				<span className="underline">{b(data.signYear, "__")}</span> at{" "}
				<span className="underline">{b(data.signCity)}</span>.
			</p>

			{/* Affiant signature */}
			<div className="mb-1 flex justify-center">
				<div className="w-48 border-b border-black" />
			</div>
			<div className="mb-6 text-center text-[9pt]">Affiant</div>

			{/* Subscribed */}
			<p className="mb-4 text-justify text-[9pt]">
				SUBSCRIBED AND SWORN to before me this{" "}
				<span className="underline">{b(data.swornDate)}</span> at{" "}
				<span className="underline">{b(data.swornAt)}</span>, Philippines.
			</p>
		</div>
	)
}

export function SwornAffidavitNameDiscrepancyEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<SwornAffidavitNameDiscrepancyData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return normalizeSwornAffidavitNameDiscrepancyData(
						JSON.parse(saved) as LegacySwornAffidavitNameDiscrepancyData
					)
				}
			} catch {
				/* ignore */
			}
		}
		return defaultSwornAffidavitNameDiscrepancy
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)
	const explanationCount = data.explanations.length
	const nameVariantsItemNumber = explanationCount + 2

	const set = (key: SwornAffidavitFieldKey) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const setSelect = (key: SwornAffidavitFieldKey) => (value: string | null) =>
		setData(prev => ({ ...prev, [key]: value ?? "" }))

	const setExplanation = (index: number) => (value: string) =>
		setData(prev => ({
			...prev,
			explanations: prev.explanations.map((explanation, explanationIndex) =>
				explanationIndex === index ? value : explanation
			),
		}))

	const addExplanation = () =>
		setData(prev => ({ ...prev, explanations: [...prev.explanations, ""] }))

	const removeExplanation = (index: number) =>
		setData(prev => ({
			...prev,
			explanations:
				prev.explanations.length > 1
					? prev.explanations.filter((_, explanationIndex) => explanationIndex !== index)
					: prev.explanations,
		}))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportSwornAffidavitNameDiscrepancy(data)
		} finally {
			setExporting(false)
		}
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Toolbar */}
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
				{/* Form */}
				<div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Venue
						</p>
						<div className="space-y-3">
							<Field
								label="City"
								id="city"
								value={data.city}
								onChange={set("city")}
								placeholder="e.g. Manila"
							/>
							<Field
								label="Province / Region"
								id="province"
								value={data.province}
								onChange={set("province")}
								placeholder="e.g. Metro Manila"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Affiant Information
						</p>
						<div className="space-y-3">
							<Field
								label="Affiant Full Name"
								id="affiantName"
								value={data.affiantName}
								onChange={set("affiantName")}
								placeholder="Full legal name"
							/>
							<div className="space-y-1.5">
								<Label htmlFor="civilStatus" className="text-xs font-medium">
									Civil Status
								</Label>
								<Select value={data.civilStatus} onValueChange={setSelect("civilStatus")}>
									<SelectTrigger id="civilStatus" className="h-8 text-sm">
										<SelectValue>{data.civilStatus || "Select civil status"}</SelectValue>
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="single">Single</SelectItem>
										<SelectItem value="married">Married</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<Field
								label="Complete Address"
								id="address"
								value={data.address}
								onChange={set("address")}
								placeholder="Complete residential address"
								multiline
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Stock Details
						</p>
						<div className="space-y-3">
							<Field
								label="Company / Stock Name"
								id="companyName"
								value={data.companyName}
								onChange={set("companyName")}
								placeholder="e.g. ABC Corporation"
							/>
							<Field
								label="Certificate No."
								id="stockCertificateNo"
								value={data.stockCertificateNo}
								onChange={set("stockCertificateNo")}
								placeholder="Certificate number"
							/>
							<Field
								label="Name Appeared As (on certificate)"
								id="nameAppearedAs"
								value={data.nameAppearedAs}
								onChange={set("nameAppearedAs")}
								placeholder="Name as shown on certificate"
							/>
							<Field
								label="Name in All Records"
								id="recordsName"
								value={data.recordsName}
								onChange={set("recordsName")}
								placeholder="Correct name in all documents"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<div className="mb-3 flex items-center justify-between gap-3">
							<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
								Explanations
							</p>
							<Button
								variant="outline"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={addExplanation}
							>
								+ Add Explanation
							</Button>
						</div>
						<div className="space-y-3">
							{data.explanations.map((explanation, index) => (
								<div key={index} className="space-y-2 rounded-md border p-3">
									<div className="flex items-center justify-between gap-3">
										<span className="text-muted-foreground text-xs font-medium">
											Explanation {index + 2}
										</span>
										{data.explanations.length > 1 && (
											<button
												type="button"
												onClick={() => removeExplanation(index)}
												className="text-destructive text-xs hover:underline"
											>
												Remove
											</button>
										)}
									</div>
									<Field
										label={`Item ${index + 2}`}
										id={`explanation${index}`}
										value={explanation}
										onChange={setExplanation(index)}
										placeholder="Explain the discrepancy"
										multiline
									/>
								</div>
							))}
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Name Variants (Item {nameVariantsItemNumber})
						</p>
						<div className="space-y-3">
							<Field
								label="Name 1"
								id="name1"
								value={data.name1}
								onChange={set("name1")}
								placeholder="First name variant"
							/>
							<Field
								label="Name 2"
								id="name2"
								value={data.name2}
								onChange={set("name2")}
								placeholder="Second name variant"
							/>
							<Field
								label="Name 3"
								id="name3"
								value={data.name3}
								onChange={set("name3")}
								placeholder="Third name variant"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Signing Details
						</p>
						<div className="space-y-3">
							<Field
								label="Day"
								id="signDay"
								value={data.signDay}
								onChange={set("signDay")}
								placeholder="e.g. 12"
							/>
							<Field
								label="Month"
								id="signMonth"
								value={data.signMonth}
								onChange={set("signMonth")}
								placeholder="e.g. June"
							/>
							<Field
								label="Year (20__)"
								id="signYear"
								value={data.signYear}
								onChange={set("signYear")}
								placeholder="e.g. 26"
							/>
							<Field
								label="City / Location"
								id="signCity"
								value={data.signCity}
								onChange={set("signCity")}
								placeholder="e.g. Manila"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Sworn / Notarial
						</p>
						<div className="space-y-3">
							<Field
								label="Sworn Date"
								id="swornDate"
								value={data.swornDate}
								onChange={set("swornDate")}
								placeholder="e.g. June 12, 2026"
							/>
							<Field
								label="Sworn At"
								id="swornAt"
								value={data.swornAt}
								onChange={set("swornAt")}
								placeholder="e.g. City of Manila"
							/>
						</div>
					</div>
				</div>

				{/* Document preview */}
				<div className="flex-1 overflow-auto">
					<div className="mb-3 flex items-center gap-2">
						<span className="text-muted-foreground text-xs">Document Preview</span>
						<span className="bg-muted rounded px-1.5 py-0.5 text-xs">Live</span>
					</div>
					<div className="overflow-auto rounded-lg border bg-gray-100 p-4">
						<div
							className="origin-top-left"
							style={{
								transform: "scale(0.75)",
								transformOrigin: "top left",
								width: "612pt",
								marginBottom: "-25%",
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

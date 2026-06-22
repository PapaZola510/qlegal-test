"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Checkbox } from "@/core/components/ui/checkbox"
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
import { exportAffidavitOfUndertakingPsaBirthMarriageCertificate } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultAffidavitOfUndertakingPsaBirthMarriageCertificate,
	type AffidavitOfUndertakingPsaBirthMarriageCertificateData,
	type AffidavitOfUndertakingPsaCorrectionRow,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:affidavit-of-undertaking-psa-birth-marriage-certificate"

function blank(value: string, fallback = "_____________") {
	return value.trim() ? value : fallback
}

function Field({
	label,
	id,
	value,
	onChange,
	placeholder,
	multiline = false,
}: {
	label: string
	id: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	multiline?: boolean
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

function DocumentPreview({
	data,
}: {
	data: AffidavitOfUndertakingPsaBirthMarriageCertificateData
}) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)
	const rows =
		data.correctionRows.length > 0
			? data.correctionRows
			: defaultAffidavitOfUndertakingPsaBirthMarriageCertificate.correctionRows
	const hasFilledCorrectionRows = rows.some(
		row => row.category.trim() || row.incorrectEntry.trim() || row.correctEntry.trim()
	)
	const shouldShowCorrectionEntries = data.needsCorrectionEntries || hasFilledCorrectionRows
	const fullName = [
		data.affiantGivenName,
		data.affiantMiddleName,
		data.affiantSurname,
		data.affiantSuffix,
	]
		.filter(part => part.trim())
		.join(" ")

	return (
		<div
			id="legal-template-print-area"
			className="min-h-264 w-204 shrink-0 bg-white px-24 py-24 font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			<div className="mb-10 text-right text-[11pt] font-bold">ANNEX B</div>

			<div className="mb-5 text-[9pt]">
				<div>
					Republic of the Philippines) City of{" "}
					<span className="underline">{b(data.cityMunicipality)}</span>) S.S.
				</div>
			</div>

			<div className="mb-1 text-center text-[12pt] leading-tight font-bold">
				AFFIDAVIT OF UNDERTAKING
			</div>
			<div className="mb-6 text-center text-[12pt] leading-tight font-bold">
				To Submit PSA Copy of Birth/Marriage Certificate
			</div>

			<p className="mb-4 text-justify">
				I, <span className="underline">{b(fullName)}</span> [{b(data.affiantSurname, "Surname")},{" "}
				{b(data.affiantGivenName, "Given Name")}, {b(data.affiantMiddleName, "Middle Name")},{" "}
				{b(data.affiantSuffix, "Suffix")}], of legal age, Filipino citizen, and a resident of{" "}
				<span className="underline">{b(data.affiantAddress)}</span>, hereby depose and state that:
			</p>

			<div className="ml-8 space-y-4">
				<p className="text-justify">
					<span className="font-bold">1.</span> I am a{" "}
					<span className="underline">{b(data.applicantType)}</span> for the{" "}
					{b(data.barExaminationYear, "2026")} Bar Examinations;
				</p>

				<div className="text-justify">
					<p className="mb-2">
						<span className="font-bold">2.</span> The following documentary deficiency(ies) and/or
						discrepancy(ies) apply to me:
					</p>
					<p className="mb-2 ml-6">[Check all that are applicable]</p>
					<div className="ml-6 space-y-2">
						<label className="flex cursor-default items-start gap-2 text-justify">
							<Checkbox checked={data.noBirthRecord} readOnly className="mt-1 shrink-0" />
							<span>
								I have no record of birth with the Philippine Statistics Authority (PSA) and/or the
								Local Civil Registry (LCR).
							</span>
						</label>
						<label className="flex cursor-default items-start gap-2 text-justify">
							<Checkbox
								checked={data.recentlyMarriedNoMarriageCertificate}
								readOnly
								className="mt-1 shrink-0"
							/>
							<span>
								I recently got married and the PSA-issued copy of my Marriage Certificate is not yet
								available.
							</span>
						</label>
						<label className="flex cursor-default items-start gap-2 text-justify">
							<Checkbox checked={shouldShowCorrectionEntries} readOnly className="mt-1 shrink-0" />
							<span>My PSA-issued Birth/Marriage Certificate needs correction of entry(ies).</span>
						</label>
					</div>
				</div>

				{shouldShowCorrectionEntries && (
					<table className="ml-6 w-full border-collapse text-[9pt]">
						<thead>
							<tr>
								<th className="w-[32%] border border-black px-2 py-1 text-left">Category</th>
								<th className="w-[34%] border border-black px-2 py-1 text-left">Incorrect Entry</th>
								<th className="w-[34%] border border-black px-2 py-1 text-left">Correct Entry</th>
							</tr>
						</thead>
						<tbody>
							{rows.map((row, index) => (
								<tr key={index}>
									<td className="border border-black px-2 py-1">{row.category || " "}</td>
									<td className="border border-black px-2 py-1">{row.incorrectEntry || " "}</td>
									<td className="border border-black px-2 py-1">{row.correctEntry || " "}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				<p className="text-justify">
					<span className="font-bold">3.</span> Despite diligent efforts to comply with the
					application requirements for the {b(data.barExaminationYear, "2026")} Bar Examinations, I
					will not be able to submit the required PSA/LCR-issued document(s) within the prescribed
					period due to reasons not attributable to me;
				</p>

				<p className="text-justify">
					<span className="font-bold">4.</span> On{" "}
					<span className="underline">{b(data.filingDate)}</span>, I have filed with the{" "}
					<span className="underline">{b(data.filingOfficeType)}</span> of{" "}
					<span className="underline">{b(data.filingPlace)}</span> for the registration/correction
					of my Birth/Marriage Certificate, as evidenced by the attached proof of filing{" "}
					<span className="underline">{b(data.proofOfFilingDescription)}</span>;
				</p>

				<p className="text-justify">
					<span className="font-bold">5.</span> I UNDERTAKE to submit the issued/corrected PSA copy
					of my Birth/Marriage Certificate to the Office of the Bar Confidant by{" "}
					<span className="underline">{b(data.submitByDate)}</span> or once available; and
				</p>

				<p className="text-justify">
					<span className="font-bold">6.</span> I ACCEPT that failure to comply with the above
					undertaking shall be a ground for my disqualification from the{" "}
					{b(data.barExaminationYear, "2026")} Bar Examinations or the withholding of my admission
					to the Bar despite having passed the examinations.
				</p>
			</div>

			<p className="mt-8 mb-8 text-justify italic">Further affiant sayeth naught.</p>

			<p className="mb-8 text-justify">
				IN WITNESS WHEREOF, I hereby set my hand this{" "}
				<span className="underline">{b(data.witnessDay, "____")}</span> day of{" "}
				<span className="underline">{b(data.witnessMonth, "____________")}</span> 20
				<span className="underline">{b(data.witnessYear, "__")}</span> in{" "}
				<span className="underline">{b(data.witnessCityMunicipality)}</span>, Philippines.
			</p>

			<div className="mb-1 flex justify-center">
				<div className="w-64 border-b border-black" />
			</div>
			<div className="mb-8 text-center text-[9pt]">Affiant</div>

			<p className="mb-4 text-justify text-[9pt]">
				SUBSCRIBED and SWORN to before me this{" "}
				<span className="underline">{b(data.subscribedDay, "____")}</span> day of{" "}
				<span className="underline">{b(data.subscribedMonth, "____________")}</span> 20
				<span className="underline">{b(data.subscribedYear, "__")}</span> in{" "}
				<span className="underline">{b(data.subscribedCityMunicipality, "________________")}</span>,
				Philippines, affiant exhibiting their proof of identity{" "}
				<span className="underline">{b(data.idType, "____________")}</span> No.{" "}
				<span className="underline">{b(data.idNumber, "____________")}</span>.
			</p>
		</div>
	)
}

export function AffidavitOfUndertakingPsaBirthMarriageCertificateEditor({
	onBack,
}: {
	onBack: () => void
}) {
	const [data, setData] = React.useState<AffidavitOfUndertakingPsaBirthMarriageCertificateData>(
		() => {
			if (typeof window !== "undefined") {
				try {
					const saved = localStorage.getItem(DRAFT_KEY)
					if (saved) {
						return {
							...defaultAffidavitOfUndertakingPsaBirthMarriageCertificate,
							...(JSON.parse(
								saved
							) as Partial<AffidavitOfUndertakingPsaBirthMarriageCertificateData>),
						}
					}
				} catch {
					/* ignore */
				}
			}
			return defaultAffidavitOfUndertakingPsaBirthMarriageCertificate
		}
	)
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set =
		(key: keyof AffidavitOfUndertakingPsaBirthMarriageCertificateData) => (value: string) =>
			setData(prev => ({ ...prev, [key]: value }))

	const setCheckbox =
		(key: "noBirthRecord" | "recentlyMarriedNoMarriageCertificate" | "needsCorrectionEntries") =>
		(checked: boolean) =>
			setData(prev => ({ ...prev, [key]: checked }))

	const setRow =
		(index: number, key: keyof AffidavitOfUndertakingPsaCorrectionRow) => (value: string) =>
			setData(prev => ({
				...prev,
				needsCorrectionEntries: prev.needsCorrectionEntries || value.trim().length > 0,
				correctionRows: prev.correctionRows.map((row, i) =>
					i === index ? { ...row, [key]: value } : row
				),
			}))

	const addRow = () =>
		setData(prev => ({
			...prev,
			correctionRows: [
				...prev.correctionRows,
				{ category: "", incorrectEntry: "", correctEntry: "" },
			],
		}))

	const removeRow = (index: number) =>
		setData(prev => ({
			...prev,
			correctionRows:
				prev.correctionRows.length > 1
					? prev.correctionRows.filter((_, i) => i !== index)
					: prev.correctionRows,
		}))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		window.setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportAffidavitOfUndertakingPsaBirthMarriageCertificate(data)
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
				<div className="w-96 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field
							label="City/Municipality"
							id="cityMunicipality"
							value={data.cityMunicipality}
							onChange={set("cityMunicipality")}
						/>
						<Field
							label="Affiant Surname"
							id="affiantSurname"
							value={data.affiantSurname}
							onChange={set("affiantSurname")}
						/>
						<Field
							label="Affiant Given Name"
							id="affiantGivenName"
							value={data.affiantGivenName}
							onChange={set("affiantGivenName")}
						/>
						<Field
							label="Affiant Middle Name"
							id="affiantMiddleName"
							value={data.affiantMiddleName}
							onChange={set("affiantMiddleName")}
						/>
						<Field
							label="Affiant Suffix"
							id="affiantSuffix"
							value={data.affiantSuffix}
							onChange={set("affiantSuffix")}
							placeholder="Jr., Sr., III"
						/>
						<Field
							label="Affiant Address"
							id="affiantAddress"
							value={data.affiantAddress}
							onChange={set("affiantAddress")}
							multiline
						/>
						<Field
							label="Legal Age"
							id="affiantLegalAge"
							value={data.affiantLegalAge}
							onChange={set("affiantLegalAge")}
						/>
						<Field
							label="Citizenship"
							id="affiantCitizenship"
							value={data.affiantCitizenship}
							onChange={set("affiantCitizenship")}
						/>
						<div className="space-y-1.5">
							<Label className="text-xs font-medium">Applicant Type</Label>
							<Select
								value={data.applicantType}
								onValueChange={value =>
									setData(prev => ({ ...prev, applicantType: value ?? "New Applicant" }))
								}
							>
								<SelectTrigger className="h-8 text-sm">
									<SelectValue>{data.applicantType || "Select type"}</SelectValue>
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="New Applicant">New Applicant</SelectItem>
									<SelectItem value="Previous Taker">Previous Taker</SelectItem>
									<SelectItem value="Refresher">Refresher</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<Field
							label="Bar Examination Year"
							id="barExaminationYear"
							value={data.barExaminationYear}
							onChange={set("barExaminationYear")}
							placeholder="2026"
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<label className="flex items-start gap-2 text-sm">
							<Checkbox
								checked={data.noBirthRecord}
								onCheckedChange={checked => setCheckbox("noBirthRecord")(checked === true)}
							/>
							<span>No record of birth with PSA/LCR</span>
						</label>
						<label className="flex items-start gap-2 text-sm">
							<Checkbox
								checked={data.recentlyMarriedNoMarriageCertificate}
								onCheckedChange={checked =>
									setCheckbox("recentlyMarriedNoMarriageCertificate")(checked === true)
								}
							/>
							<span>Recently married; PSA marriage certificate not yet available</span>
						</label>
						<label className="flex items-start gap-2 text-sm">
							<Checkbox
								checked={data.needsCorrectionEntries}
								onCheckedChange={checked => setCheckbox("needsCorrectionEntries")(checked === true)}
							/>
							<span>PSA birth/marriage certificate needs correction</span>
						</label>
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="flex items-center justify-between gap-3">
							<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
								Correction Table
							</p>
							<Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={addRow}>
								+ Add Row
							</Button>
						</div>
						{data.correctionRows.map((row, index) => (
							<div key={index} className="space-y-2 rounded-md border p-3">
								<div className="flex items-center justify-between">
									<span className="text-muted-foreground text-xs font-medium">Row {index + 1}</span>
									{data.correctionRows.length > 1 && (
										<button
											type="button"
											className="text-destructive text-xs hover:underline"
											onClick={() => removeRow(index)}
										>
											Remove
										</button>
									)}
								</div>
								<Field
									label="Category"
									id={`category-${index}`}
									value={row.category}
									onChange={setRow(index, "category")}
									placeholder="e.g. First Name"
								/>
								<Field
									label="Incorrect Entry"
									id={`incorrect-${index}`}
									value={row.incorrectEntry}
									onChange={setRow(index, "incorrectEntry")}
								/>
								<Field
									label="Correct Entry"
									id={`correct-${index}`}
									value={row.correctEntry}
									onChange={setRow(index, "correctEntry")}
								/>
							</div>
						))}
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Filing Date"
							id="filingDate"
							value={data.filingDate}
							onChange={set("filingDate")}
							placeholder="e.g. June 10, 2026"
						/>
						<Field
							label="Filing Office Type"
							id="filingOfficeType"
							value={data.filingOfficeType}
							onChange={set("filingOfficeType")}
							placeholder="LCR / Court / Embassy"
						/>
						<Field
							label="Filing Place"
							id="filingPlace"
							value={data.filingPlace}
							onChange={set("filingPlace")}
							placeholder="City / Province"
						/>
						<Field
							label="Proof of Filing Description"
							id="proofOfFilingDescription"
							value={data.proofOfFilingDescription}
							onChange={set("proofOfFilingDescription")}
							placeholder="attached proof of filing"
							multiline
						/>
						<Field
							label="Submit By Date"
							id="submitByDate"
							value={data.submitByDate}
							onChange={set("submitByDate")}
							placeholder="October 13, 2026 (Tuesday)"
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Witness Day"
							id="witnessDay"
							value={data.witnessDay}
							onChange={set("witnessDay")}
							placeholder="__"
						/>
						<Field
							label="Witness Month"
							id="witnessMonth"
							value={data.witnessMonth}
							onChange={set("witnessMonth")}
							placeholder="Month"
						/>
						<Field
							label="Witness Year"
							id="witnessYear"
							value={data.witnessYear}
							onChange={set("witnessYear")}
							placeholder="__"
						/>
						<Field
							label="Witness City/Municipality"
							id="witnessCityMunicipality"
							value={data.witnessCityMunicipality}
							onChange={set("witnessCityMunicipality")}
						/>
						<Field
							label="Subscribed Day"
							id="subscribedDay"
							value={data.subscribedDay}
							onChange={set("subscribedDay")}
							placeholder="__"
						/>
						<Field
							label="Subscribed Month"
							id="subscribedMonth"
							value={data.subscribedMonth}
							onChange={set("subscribedMonth")}
							placeholder="Month"
						/>
						<Field
							label="Subscribed Year"
							id="subscribedYear"
							value={data.subscribedYear}
							onChange={set("subscribedYear")}
							placeholder="__"
						/>
						<Field
							label="Subscribed City/Municipality"
							id="subscribedCityMunicipality"
							value={data.subscribedCityMunicipality}
							onChange={set("subscribedCityMunicipality")}
						/>
						<Field
							label="ID Type"
							id="idType"
							value={data.idType}
							onChange={set("idType")}
							placeholder="Driver's License"
						/>
						<Field
							label="ID Number"
							id="idNumber"
							value={data.idNumber}
							onChange={set("idNumber")}
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

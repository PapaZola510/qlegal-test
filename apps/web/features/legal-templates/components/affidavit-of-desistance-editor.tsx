"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportAffidavitOfDesistance } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultAffidavitOfDesistance,
	type AffidavitOfDesistanceData,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:affidavit-of-desistance"

type DesistanceFieldKey = keyof AffidavitOfDesistanceData

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

function DocumentPreview({ data }: { data: AffidavitOfDesistanceData }) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)

	return (
		<div
			id="legal-template-print-area"
			className="min-h-264 w-204 shrink-0 bg-white px-20 py-16 font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			<div className="mb-7 text-[11pt] leading-tight">
				<div>REPUBLIC OF THE PHILIPPINES</div>
				<div>CITY/MUNICIPALITY OF {b(data.cityMunicipality)} ) S.S.</div>
			</div>

			<div className="mb-6 text-center text-[20pt] font-bold">AFFIDAVIT OF DESISTANCE</div>

			<p className="mb-4 text-justify text-[11pt]">
				I, <span className="font-bold uppercase">{b(data.affiantName)}</span>, of legal age,{" "}
				{b(data.citizenship, "Filipino")}
				and a resident of {b(data.address)}, after having duly sworn to in accordance with law
				hereby depose and state:
			</p>

			<div className="ml-6 space-y-4 text-[11pt]">
				<p className="text-justify">
					1. That I am the complaining witness for violation of {b(data.lawViolation)} and{" "}
					{b(data.offense)} against {b(data.respondentName)} in the case entitled "
					{b(data.caseTitle)}", with Criminal Case No. {b(data.criminalCaseNo)}, pending before
					Regional Trial Court, Branch No. {b(data.courtBranchNo)}, {b(data.courtLocation)}.
				</p>
				<p className="text-justify">2. {b(data.desistanceReason)}</p>
				<p className="text-justify">
					3. That I was never forced nor intimidated in order to execute this Affidavit of
					Desistance;
				</p>
				<p className="text-justify">4. {b(data.withdrawalStatement)}</p>
				<p className="text-justify">5. {b(data.dismissalRequest)}</p>
			</div>

			<p className="mt-8 mb-8 text-[12pt] italic">Further affiant sayeth naught.</p>

			<p className="mb-10 text-[11pt]">
				IN WITNESS WHEREOF, I hereby set my hand, this {b(data.witnessDay, "__")} day of{" "}
				{b(data.witnessMonthYear)} at the City/Municipality of {b(data.witnessCityMunicipality)}.
			</p>

			<div className="mb-10 text-center">
				<div className="text-[15pt] font-bold uppercase">{b(data.affiantName)}</div>
				<div className="text-[14pt]">{b(data.affiantRole, "Complaining Witness")}</div>
			</div>

			<p className="text-[11pt]">
				<span className="font-bold">SUBSCRIBED AND SWORN</span> to before me this, this{" "}
				{b(data.subscribedDay, "__")} day of {b(data.subscribedMonthYear)}, at the City/Municipality
				of {b(data.subscribedCityMunicipality)}. Affiant executing to me his {b(data.idType)}{" "}
				bearing number {b(data.idNumber)} as proof of his identity.
			</p>
		</div>
	)
}

export function AffidavitOfDesistanceEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<AffidavitOfDesistanceData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultAffidavitOfDesistance,
						...(JSON.parse(saved) as Partial<AffidavitOfDesistanceData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultAffidavitOfDesistance
	})

	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: DesistanceFieldKey) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportAffidavitOfDesistance(data)
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
				<div className="w-105 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field
							label="City/Municipality"
							id="cityMunicipality"
							value={data.cityMunicipality}
							onChange={set("cityMunicipality")}
						/>
						<Field
							label="Affiant Name"
							id="affiantName"
							value={data.affiantName}
							onChange={set("affiantName")}
						/>
						<Field
							label="Legal Age"
							id="legalAge"
							value={data.legalAge}
							onChange={set("legalAge")}
							placeholder="e.g. 30"
						/>
						<Field
							label="Citizenship"
							id="citizenship"
							value={data.citizenship}
							onChange={set("citizenship")}
							placeholder="Filipino"
						/>
						<Field
							label="Address"
							id="address"
							value={data.address}
							onChange={set("address")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Law Violation"
							id="lawViolation"
							value={data.lawViolation}
							onChange={set("lawViolation")}
						/>
						<Field label="Offense" id="offense" value={data.offense} onChange={set("offense")} />
						<Field
							label="Respondent Name"
							id="respondentName"
							value={data.respondentName}
							onChange={set("respondentName")}
						/>
						<Field
							label="Case Title"
							id="caseTitle"
							value={data.caseTitle}
							onChange={set("caseTitle")}
							multiline
						/>
						<Field
							label="Criminal Case No."
							id="criminalCaseNo"
							value={data.criminalCaseNo}
							onChange={set("criminalCaseNo")}
						/>
						<Field
							label="Court Branch No."
							id="courtBranchNo"
							value={data.courtBranchNo}
							onChange={set("courtBranchNo")}
						/>
						<Field
							label="Court Location"
							id="courtLocation"
							value={data.courtLocation}
							onChange={set("courtLocation")}
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Reason for Desistance (Paragraph 2)"
							id="desistanceReason"
							value={data.desistanceReason}
							onChange={set("desistanceReason")}
							multiline
						/>
						<Field
							label="Withdrawal Statement (Paragraph 4)"
							id="withdrawalStatement"
							value={data.withdrawalStatement}
							onChange={set("withdrawalStatement")}
							multiline
						/>
						<Field
							label="Dismissal Request (Paragraph 5)"
							id="dismissalRequest"
							value={data.dismissalRequest}
							onChange={set("dismissalRequest")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Witness Day"
							id="witnessDay"
							value={data.witnessDay}
							onChange={set("witnessDay")}
							placeholder="e.g. 12"
						/>
						<Field
							label="Witness Month/Year"
							id="witnessMonthYear"
							value={data.witnessMonthYear}
							onChange={set("witnessMonthYear")}
							placeholder="November 2017"
						/>
						<Field
							label="Witness City/Municipality"
							id="witnessCityMunicipality"
							value={data.witnessCityMunicipality}
							onChange={set("witnessCityMunicipality")}
						/>
						<Field
							label="Affiant Role"
							id="affiantRole"
							value={data.affiantRole}
							onChange={set("affiantRole")}
							placeholder="Complaining Witness"
						/>
						<Field
							label="Subscribed Day"
							id="subscribedDay"
							value={data.subscribedDay}
							onChange={set("subscribedDay")}
						/>
						<Field
							label="Subscribed Month/Year"
							id="subscribedMonthYear"
							value={data.subscribedMonthYear}
							onChange={set("subscribedMonthYear")}
							placeholder="November 2017"
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
								transform: "scale(0.74)",
								transformOrigin: "top left",
								width: "612pt",
								marginBottom: "-26%",
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

"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportJudicialAffidavit } from "@/features/legal-templates/lib/pdf-export"
import {
	type JudicialAffidavitData,
	defaultJudicialAffidavit,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:judicial-affidavit"

type FieldKey = keyof JudicialAffidavitData

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
					className="min-h-20 text-sm"
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

function DocumentPreview({ data }: { data: JudicialAffidavitData }) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-serif text-[10pt] leading-relaxed px-24 py-24 min-h-264 w-204 shrink-0 shadow-lg"
			style={{ fontFamily: "Courier New, Courier, monospace" }}
		>
			<p>REPUBLIC OF THE PHILIPPINES</p>
			<p>REGIONAL TRIAL COURT</p>
			<p>[Branch Number], [City/Province]</p>
			<p className="mb-5">{b(data.branchNumber, "Branch Number")}, {b(data.courtCityProvince, "City/Province")}</p>

			<p>[Case Title]</p>
			<p className="mb-5">{b(data.caseTitle, "Case Title")}</p>
			<p>[Case Number]</p>
			<p className="mb-5">{b(data.caseNumber, "Case Number")}</p>

			<p className="mb-5">JUDICIAL AFFIDAVIT OF {b(data.witnessName, "Name of Witness")}</p>

			<p className="mb-4 text-justify">
				I, {b(data.witnessName, "Name of Witness")}, of legal age, Filipino, {b(data.civilStatus, "civil status")}, and residing at {b(data.address, "complete address")}, after having been duly sworn to in accordance with law, depose and state that:
			</p>

			<p className="mb-2">PRELIMINARY STATEMENTS:</p>
			<ol className="mb-4 list-decimal pl-6 space-y-1">
				<li>I am a witness for the {b(data.partyName, "plaintiff/defendant/People of the Philippines")} in the above-captioned case.</li>
				<li>The purpose of this affidavit is to present my testimony in lieu of direct examination, pursuant to the Judicial Affidavit Rule.</li>
				<li>I am executing this affidavit freely and voluntarily, fully aware of its contents and of my obligation to tell the truth.</li>
			</ol>

			<p className="mb-2">QUESTIONS AND ANSWERS:</p>
			<div className="mb-4 whitespace-pre-wrap border border-black/30 p-2">{b(data.questionAnswers, "Set forth questions and corresponding answers.")}</div>

			<p className="mb-2">WITNESS'S ATTESTATION:</p>
			<p className="mb-4 text-justify">
				IN WITNESS WHEREOF, I attest that I have read this Judicial Affidavit and the same has been explained to me in a language/dialect that I fully understand. I further attest that I understand I can be charged with perjury if I make any false statements.
			</p>

			<p>(SIGNATURE OF WITNESS)</p>
			<p>{b(data.witnessSignatureName, "Name of Witness")}</p>
			<p className="mb-4">Affiant</p>

			<p className="mb-2">LAWYER'S ATTESTATION:</p>
			<p className="mb-2">I, {b(data.lawyerName, "Name of Lawyer")}, counsel for the {b(data.partyRepresented, "party")}, hereby certify and state that:</p>
			<ol className="mb-4 list-decimal pl-6 space-y-1">
				<li>I personally examined the witness, {b(data.witnessName, "Name of Witness")}.</li>
				<li>I explained to her/him the substance of the questions and answers recorded in this Judicial Affidavit.</li>
				<li>I informed her/him of the obligation to tell the truth and possible legal liabilities for false testimony.</li>
			</ol>

			<p>(SIGNATURE OF LAWYER)</p>
			<p>{b(data.lawyerName, "Name of Lawyer")}</p>
			<p>PTR No. {b(data.lawyerPtrNo, "____")}</p>
			<p>Roll of Attorneys No. {b(data.lawyerRollNo, "____")}</p>
			<p className="mb-4">{b(data.lawyerAddressContact, "Address and Contact Information")}</p>

			<p className="text-justify">
				SUBSCRIBED AND SWORN TO before me this {b(data.subscribedDay, "__")} day of {b(data.subscribedMonth, "________")}, 20{b(data.subscribedYear, "__")}, affiant exhibiting to me her/his {b(data.idProof, "competent proof of identity")}. 
			</p>
		</div>
	)
}

export function JudicialAffidavitEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<JudicialAffidavitData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultJudicialAffidavit,
						...(JSON.parse(saved) as Partial<JudicialAffidavitData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultJudicialAffidavit
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: FieldKey) => (value: string) => setData(prev => ({ ...prev, [key]: value }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportJudicialAffidavit(data)
		} finally {
			setExporting(false)
		}
	}

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center gap-3 flex-wrap">
				<Button variant="outline" size="sm" onClick={onBack}>← Templates</Button>
				<div className="flex-1" />
				<Button variant="outline" size="sm" onClick={handleSave}>{saved ? "Saved ✓" : "Save Draft"}</Button>
				<Button size="sm" onClick={handleExport} disabled={exporting}>{exporting ? "Generating PDF…" : "Export PDF"}</Button>
			</div>

			<div className="flex gap-6" style={{ height: "calc(100vh - 140px)" }}>
				<div className="w-96 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field label="Branch Number" id="branchNumber" value={data.branchNumber} onChange={set("branchNumber")} />
						<Field label="Court City/Province" id="courtCityProvince" value={data.courtCityProvince} onChange={set("courtCityProvince")} />
						<Field label="Case Title" id="caseTitle" value={data.caseTitle} onChange={set("caseTitle")} />
						<Field label="Case Number" id="caseNumber" value={data.caseNumber} onChange={set("caseNumber")} />
						<Field label="Witness Name" id="witnessName" value={data.witnessName} onChange={set("witnessName")} />
						<Field label="Civil Status" id="civilStatus" value={data.civilStatus} onChange={set("civilStatus")} />
						<Field label="Address" id="address" value={data.address} onChange={set("address")} multiline />
						<Field label="Party Name" id="partyName" value={data.partyName} onChange={set("partyName")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Questions and Answers" id="questionAnswers" value={data.questionAnswers} onChange={set("questionAnswers")} multiline />
						<Field label="Witness Signature Name" id="witnessSignatureName" value={data.witnessSignatureName} onChange={set("witnessSignatureName")} />
						<Field label="Lawyer Name" id="lawyerName" value={data.lawyerName} onChange={set("lawyerName")} />
						<Field label="Party Represented" id="partyRepresented" value={data.partyRepresented} onChange={set("partyRepresented")} />
						<Field label="Lawyer PTR No." id="lawyerPtrNo" value={data.lawyerPtrNo} onChange={set("lawyerPtrNo")} />
						<Field label="Lawyer Roll No." id="lawyerRollNo" value={data.lawyerRollNo} onChange={set("lawyerRollNo")} />
						<Field label="Lawyer Address / Contact" id="lawyerAddressContact" value={data.lawyerAddressContact} onChange={set("lawyerAddressContact")} multiline />
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Subscribed Day" id="subscribedDay" value={data.subscribedDay} onChange={set("subscribedDay")} />
						<Field label="Subscribed Month" id="subscribedMonth" value={data.subscribedMonth} onChange={set("subscribedMonth")} />
						<Field label="Subscribed Year (20__)" id="subscribedYear" value={data.subscribedYear} onChange={set("subscribedYear")} />
						<Field label="ID Proof" id="idProof" value={data.idProof} onChange={set("idProof")} />
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					<div className="flex items-center gap-2 mb-3">
						<span className="text-xs text-muted-foreground">Document Preview</span>
						<span className="text-xs bg-muted rounded px-1.5 py-0.5">Live</span>
					</div>
					<div className="overflow-auto rounded-lg border bg-gray-100 p-4">
						<div className="origin-top-left" style={{ transform: "scale(0.68)", transformOrigin: "top left", width: "612pt", marginBottom: "-55%" }}>
							<DocumentPreview data={data} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

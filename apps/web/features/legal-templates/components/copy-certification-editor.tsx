"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportCopyCertification } from "@/features/legal-templates/lib/pdf-export"
import {
	type CopyCertificationData,
	defaultCopyCertification,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:copy-certification"

type FieldKey = keyof CopyCertificationData

function blank(value: string | undefined, fallback = "_____________") {
	return value && value.trim() ? value : fallback
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

function DocumentPreview({ data }: { data: CopyCertificationData }) {
	const b = (v: string, fb = "_____________") => blank(v, fb)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-24 py-24 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-4 text-[18pt]">Standard Copy Certification Template</div>
			<div className="mb-2">REPUBLIC OF THE PHILIPPINES)</div>
			<div className="mb-4">CITY OF {b(data.city)} ) S.S.</div>
			<div className="mb-4 font-semibold">COPY CERTIFICATION</div>

			<p className="mb-4 text-justify">
				I, {b(data.notaryPublicName, "NAME OF NOTARY PUBLIC")}, a Notary Public in the City and Province of {b(data.cityProvince, "City/Province")}, do hereby depose and state:
			</p>

			<ol className="mb-6 list-decimal pl-6 space-y-1 text-justify">
				<li>That an original {b(data.documentName, "Name of Document")} issued on {b(data.issuingEntity, "Date Issued by Issuing Entity")} was presented to me on [Date Presented];</li>
				<li>That I have caused or supervised the copying of the said document {b(data.numberOfCopies, "[number]")} {data.numberOfCopies && parseInt(data.numberOfCopies) === 1 ? "copy" : "copies"};</li>
				<li>That I have compared the copy of said document with the original copy; and</li>
				<li>That I certify, after having determined, that the said copy is accurate and complete compared with the original document copy.</li>
			</ol>

			<p className="mb-4 text-justify">This certification is issued upon the request of {b(data.clientOwnerName, "Client/Owner Name")} for all legal purposes.</p>

			<p className="mb-6 text-justify">Given this {b(data.givenDay, "___")} day of {b(data.givenMonth, "__________")}, 20{b(data.givenYear, "__")} at {b(data.givenPlace, "_____________")}, Philippines.</p>

			<div className="mb-2">{b(data.signatureNotaryPublic, "Signature of Notary Public")}</div>
			<div className="mb-2">{b(data.printedNameNotaryPublic, "PRINTED NAME OF NOTARY PUBLIC")}</div>
			<div className="mb-2">Notary Public for {b(data.cityProvince, "City/Province")}</div>
			<div className="mb-2">Notarial Commission No. {b(data.notarialCommissionNumber, "Commission Number")}</div>
			<div className="mb-2">Until {b(data.commissionValidUntil, "December 31, 20__")}</div>
			<div className="mb-2">Roll of Attorneys No. {b(data.rollOfAttorneysNo, "Roll Number")}</div>
			<div className="mb-2">IBP No. {b(data.ibpNo, "Lifetime/Annual Number")} / {b(data.ibpDateChapter, "Date/Chapter")}</div>
			<div className="mb-2">PTR No. {b(data.ptrNo, "Number")} / {b(data.ptrDateLocation, "Date/Location")}</div>
			<div>MCLE Compliance No. {b(data.mcleComplianceNo, "Number")} / {b(data.mcleDate, "Date")}</div>
		</div>
	)
}

export function CopyCertificationEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<CopyCertificationData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultCopyCertification,
						...(JSON.parse(saved) as Partial<CopyCertificationData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultCopyCertification
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
			await exportCopyCertification(data)
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
				<Button size="sm" onClick={handleExport} disabled={exporting}>{exporting ? "Generating PDF..." : "Export PDF"}</Button>
			</div>

			<div className="flex gap-6" style={{ height: "calc(100vh - 140px)" }}>
				<div className="w-96 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field label="City" id="city" value={data.city} onChange={set("city")} />
						<Field label="Notary Public Name" id="notaryPublicName" value={data.notaryPublicName} onChange={set("notaryPublicName")} />
						<Field label="City/Province" id="cityProvince" value={data.cityProvince} onChange={set("cityProvince")} />
						<Field label="Document Name" id="documentName" value={data.documentName} onChange={set("documentName")} />
						<Field label="Issuing Entity / Date Issued" id="issuingEntity" value={data.issuingEntity} onChange={set("issuingEntity")} />
						<Field label="Number of Copies" id="numberOfCopies" value={data.numberOfCopies} onChange={set("numberOfCopies")} />
						<Field label="Client/Owner Name" id="clientOwnerName" value={data.clientOwnerName} onChange={set("clientOwnerName")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Given Day" id="givenDay" value={data.givenDay} onChange={set("givenDay")} />
						<Field label="Given Month" id="givenMonth" value={data.givenMonth} onChange={set("givenMonth")} />
						<Field label="Given Year (20__)" id="givenYear" value={data.givenYear} onChange={set("givenYear")} />
						<Field label="Given Place" id="givenPlace" value={data.givenPlace} onChange={set("givenPlace")} />
						<Field label="Signature Notary Public" id="signatureNotaryPublic" value={data.signatureNotaryPublic} onChange={set("signatureNotaryPublic")} />
						<Field label="Printed Name Notary Public" id="printedNameNotaryPublic" value={data.printedNameNotaryPublic} onChange={set("printedNameNotaryPublic")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Notarial Commission Number" id="notarialCommissionNumber" value={data.notarialCommissionNumber} onChange={set("notarialCommissionNumber")} />
						<Field label="Commission Valid Until" id="commissionValidUntil" value={data.commissionValidUntil} onChange={set("commissionValidUntil")} />
						<Field label="Roll of Attorneys No" id="rollOfAttorneysNo" value={data.rollOfAttorneysNo} onChange={set("rollOfAttorneysNo")} />
						<Field label="IBP No" id="ibpNo" value={data.ibpNo} onChange={set("ibpNo")} />
						<Field label="IBP Date/Chapter" id="ibpDateChapter" value={data.ibpDateChapter} onChange={set("ibpDateChapter")} />
						<Field label="PTR No" id="ptrNo" value={data.ptrNo} onChange={set("ptrNo")} />
						<Field label="PTR Date/Location" id="ptrDateLocation" value={data.ptrDateLocation} onChange={set("ptrDateLocation")} />
						<Field label="MCLE Compliance No" id="mcleComplianceNo" value={data.mcleComplianceNo} onChange={set("mcleComplianceNo")} />
						<Field label="MCLE Date" id="mcleDate" value={data.mcleDate} onChange={set("mcleDate")} />
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					<div className="flex items-center gap-2 mb-3">
						<span className="text-xs text-muted-foreground">Document Preview</span>
						<span className="text-xs bg-muted rounded px-1.5 py-0.5">Live</span>
					</div>
					<div className="overflow-auto rounded-lg border bg-gray-100 p-4">
						<div className="origin-top-left" style={{ transform: "scale(0.68)", transformOrigin: "top left", width: "612pt" }}>
							<DocumentPreview data={data} />
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}

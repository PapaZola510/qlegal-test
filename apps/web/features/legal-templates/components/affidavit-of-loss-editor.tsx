"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { cn } from "@/core/lib/utils"
import { exportAffidavitOfLoss } from "@/features/legal-templates/lib/pdf-export"
import { defaultAffidavitOfLoss, type AffidavitOfLossData } from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:affidavit-of-loss"

function blank(val: string, placeholder = "_____________") {
	return val.trim() ? val : placeholder
}

// ── Field component ───────────────────────────────────────────────────────────
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
					className="min-h-[72px] text-sm"
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

// ── Document preview ──────────────────────────────────────────────────────────
function DocumentPreview({ data }: { data: AffidavitOfLossData }) {
	const b = (v: string, fb = "_____________") => blank(v, fb)
	const idRows = [
		{ type: data.govId1Type, number: data.govId1Number, validUntil: data.govId1ValidUntil },
		{ type: data.govId2Type, number: data.govId2Number, validUntil: data.govId2ValidUntil },
		{ type: data.govId3Type, number: data.govId3Number, validUntil: data.govId3ValidUntil },
	]

	return (
		<div
			id="legal-template-print-area"
			className="min-h-[792pt] w-[612pt] shrink-0 bg-white px-[72pt] py-[72pt] font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			{/* Header */}
			<div className="text-[9pt]">
				<div className="font-bold">REPUBLIC OF THE PHILIPPINES</div>
				<div>CITY OF {b(data.city)} &nbsp;&nbsp;&nbsp;&nbsp; ) S.S.</div>
			</div>

			<div className="h-8" />

			{/* Title */}
			<div className="mb-6 text-center text-[12pt] font-bold underline">AFFIDAVIT OF LOSS</div>

			{/* Opening paragraph */}
			<p className="mb-4 text-justify">
				I, <span className="underline">{b(data.affiantName)}</span>, of legal age,{" "}
				<span className="underline">{b(data.legalAge, "__")}</span>, and residing at{" "}
				<span className="underline">{b(data.address)}</span> after having been duly sworn to
				according to law hereby depose and state:
			</p>

			{/* Items */}
			<div className="ml-8 space-y-3">
				<p className="text-justify">
					<span className="font-bold">1.</span>&nbsp; That I am the owner of a{" "}
					<span className="underline">{b(data.itemDescription)}</span>;
				</p>
				<p className="text-justify">
					<span className="font-bold">2.</span>&nbsp; That on the{" "}
					<span className="underline">{b(data.dateDay, "__")}</span>th of{" "}
					<span className="underline">{b(data.dateMonth, "_____________")}</span>, 20
					<span className="underline">{b(data.dateYear, "__")}</span>,{" "}
					<span className="underline">
						{b(
							data.lossCircumstances,
							"___________________________________________________________"
						)}
					</span>
					;
				</p>
				<p className="text-justify">
					<span className="font-bold">3.</span>&nbsp; That after diligent search{" "}
					<span className="underline">{b(data.searchDescription)}</span>, my{" "}
					<span className="underline">{b(data.itemType, "______________")}</span> was nowhere to be
					found anymore;
				</p>
				<p className="text-justify">
					<span className="font-bold">4.</span>&nbsp; That I am executing this affidavit in order to
					attest to the truth of the foregoing circumstances and for the purpose of reporting the
					loss to the <span className="underline">{b(data.reportingTo)}</span>.
				</p>
			</div>

			<div className="h-6" />

			{/* IN WITNESS WHEREOF */}
			<p className="mb-8 text-justify italic">
				IN WITNESS WHEREOF, I have hereunto set my hand this{" "}
				<span className="underline">{b(data.witnessDay, "___")}</span> day of{" "}
				<span className="underline">{b(data.witnessMonth, "_______")}</span>, 20
				<span className="underline">{b(data.witnessYear, "__")}</span> at the City of{" "}
				<span className="underline">{b(data.witnessCity, "_______________")}</span>.
			</p>

			{/* Signature lines */}
			<div className="mb-2 flex gap-8">
				<div className="flex-1 border-b border-black" />
				<div className="flex-1 border-b border-black" />
			</div>
			<div className="flex gap-8 mb-6">
				<div className="flex-1 text-[9pt]">{b(data.affiantLabelLeft, "Affiant")}</div>
				<div className="flex-1 text-[9pt]">{b(data.affiantLabelRight, "Affiant")}</div>
			</div>

			{/* Subscribed */}
			<p className="mb-4 text-justify text-[9pt]">
				SUBSCRIBED AND SWORN to before me this{" "}
				<span className="underline">{b(data.swornDay, "__")}</span> day of{" "}
				<span className="underline">{b(data.swornMonth, "_____________")}</span> 20
				<span className="underline">{b(data.swornYear, "__")}</span>, affiant exhibited a competent
				proof of their Identity:
			</p>

			{/* ID table header */}
			<div className="ml-4 mb-1 flex items-center gap-3 text-[9pt] font-bold">
				<span className="w-[220px]">Govt. Issued I.D.</span>
				<span className="w-[120px]">ID Number</span>
				<span className="w-[100px]">Valid Until</span>
			</div>

			{/* ID lines */}
			{idRows.map((row, i) => (
				<div key={i} className="ml-4 mb-4 flex items-center gap-3 text-[9pt]">
					<div className="w-[220px] border-b border-black pb-0.5">{b(row.type)}</div>
					<div className="w-[120px] border-b border-black pb-0.5">{b(row.number)}</div>
					<div className="w-[100px] border-b border-black pb-0.5">{b(row.validUntil)}</div>
				</div>
			))}
		</div>
	)
}

// ── Main editor ───────────────────────────────────────────────────────────────
export function AffidavitOfLossEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<AffidavitOfLossData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) return JSON.parse(saved) as AffidavitOfLossData
			} catch {
				/* ignore */
			}
		}
		return defaultAffidavitOfLoss
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: keyof AffidavitOfLossData) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportAffidavitOfLoss(data)
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
							Document Details
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
								label="Affiant Full Name"
								id="affiantName"
								value={data.affiantName}
								onChange={set("affiantName")}
								placeholder="Full legal name"
							/>
							<Field
								label="Legal Age"
								id="legalAge"
								value={data.legalAge}
								onChange={set("legalAge")}
								placeholder="e.g. 35"
							/>
							<Field
								label="Residential Address"
								id="address"
								value={data.address}
								onChange={set("address")}
								placeholder="Complete address"
								multiline
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Lost Item
						</p>
						<div className="space-y-3">
							<Field
								label="Item Description"
								id="itemDescription"
								value={data.itemDescription}
								onChange={set("itemDescription")}
								placeholder="e.g. Driver's License, Passport"
								multiline
							/>
							<Field
								label="Item Type"
								id="itemType"
								value={data.itemType}
								onChange={set("itemType")}
								placeholder="e.g. ID card, wallet"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Circumstances of Loss
						</p>
						<div className="space-y-3">
							<Field
								label="Day of Loss"
								id="dateDay"
								value={data.dateDay}
								onChange={set("dateDay")}
								placeholder="e.g. 15"
							/>
							<Field
								label="Month of Loss"
								id="dateMonth"
								value={data.dateMonth}
								onChange={set("dateMonth")}
								placeholder="e.g. June"
							/>
							<Field
								label="Year (20__)"
								id="dateYear"
								value={data.dateYear}
								onChange={set("dateYear")}
								placeholder="e.g. 25"
							/>
							<Field
								label="Loss Description"
								id="lossCircumstances"
								value={data.lossCircumstances}
								onChange={set("lossCircumstances")}
								placeholder="e.g. my Driver's License must have slipped from my pocket, or I left it in my drawer…"
								multiline
							/>
							<Field
								label="Search Description"
								id="searchDescription"
								value={data.searchDescription}
								onChange={set("searchDescription")}
								placeholder="Describe search efforts"
								multiline
							/>
							<Field
								label="Reporting To"
								id="reportingTo"
								value={data.reportingTo}
								onChange={set("reportingTo")}
								placeholder="e.g. issuing authority"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Signing Details
						</p>
						<div className="space-y-3">
							<Field label="Left Signature Label" id="affiantLabelLeft" value={data.affiantLabelLeft} onChange={set("affiantLabelLeft")} placeholder="e.g. Affiant" />
							<Field label="Right Signature Label" id="affiantLabelRight" value={data.affiantLabelRight} onChange={set("affiantLabelRight")} placeholder="e.g. Affiant" />
							<Field label="Day of Signing" id="witnessDay" value={data.witnessDay} onChange={set("witnessDay")} placeholder="e.g. 12" />
							<Field label="Month of Signing" id="witnessMonth" value={data.witnessMonth} onChange={set("witnessMonth")} placeholder="e.g. June" />
							<Field label="Year of Signing (20__)" id="witnessYear" value={data.witnessYear} onChange={set("witnessYear")} placeholder="e.g. 26" />
							<Field label="City of Signing" id="witnessCity" value={data.witnessCity} onChange={set("witnessCity")} placeholder="e.g. Manila" />
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Sworn Before Notary
						</p>
						<div className="space-y-3">
							<Field
								label="Sworn Day"
								id="swornDay"
								value={data.swornDay}
								onChange={set("swornDay")}
								placeholder="e.g. 12"
							/>
							<Field
								label="Sworn Month"
								id="swornMonth"
								value={data.swornMonth}
								onChange={set("swornMonth")}
								placeholder="e.g. June"
							/>
							<Field
								label="Sworn Year (20__)"
								id="swornYear"
								value={data.swornYear}
								onChange={set("swornYear")}
								placeholder="e.g. 26"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
							Government Issued IDs
						</p>
						<div className="space-y-3">
							<Field label="ID 1 Type" id="govId1Type" value={data.govId1Type} onChange={set("govId1Type")} placeholder="e.g. Driver's License" />
							<Field label="ID 1 Number" id="govId1Number" value={data.govId1Number} onChange={set("govId1Number")} placeholder="e.g. N01-23-456789" />
							<Field label="ID 1 Valid Until" id="govId1ValidUntil" value={data.govId1ValidUntil} onChange={set("govId1ValidUntil")} placeholder="e.g. 12/31/2027" />
							<Field label="ID 2 Type" id="govId2Type" value={data.govId2Type} onChange={set("govId2Type")} placeholder="Optional" />
							<Field label="ID 2 Number" id="govId2Number" value={data.govId2Number} onChange={set("govId2Number")} placeholder="Optional" />
							<Field label="ID 2 Valid Until" id="govId2ValidUntil" value={data.govId2ValidUntil} onChange={set("govId2ValidUntil")} placeholder="Optional" />
							<Field label="ID 3 Type" id="govId3Type" value={data.govId3Type} onChange={set("govId3Type")} placeholder="Optional" />
							<Field label="ID 3 Number" id="govId3Number" value={data.govId3Number} onChange={set("govId3Number")} placeholder="Optional" />
							<Field label="ID 3 Valid Until" id="govId3ValidUntil" value={data.govId3ValidUntil} onChange={set("govId3ValidUntil")} placeholder="Optional" />
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

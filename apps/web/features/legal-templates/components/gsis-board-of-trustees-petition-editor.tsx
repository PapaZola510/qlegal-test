"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportGsisBoardOfTrusteesPetition } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultGsisBoardOfTrusteesPetition,
	type GsisBoardOfTrusteesPetitionData,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:gsis-board-of-trustees-petition"

type FieldKey = keyof GsisBoardOfTrusteesPetitionData

function blank(value: string | null | undefined, fallback = "________________") {
	const safeValue = value ?? ""
	return safeValue.trim() ? safeValue : fallback
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

function Page({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="min-h-264 w-204 shrink-0 bg-white px-16 py-16 text-black shadow-lg"
			style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
		>
			{children}
		</div>
	)
}

function LineField({ value, width = "w-full" }: { value: string; width?: string }) {
	return (
		<div className={`border-b border-black pb-0.5 leading-none ${width}`}>{value || "\u00A0"}</div>
	)
}

function DocumentPreview({ data }: { data: GsisBoardOfTrusteesPetitionData }) {
	const factLines = [
		data.statementOfFacts1,
		data.statementOfFacts2,
		data.statementOfFacts3,
		data.statementOfFacts4,
		data.statementOfFacts5,
	]
	const argumentLines = [data.argumentsLine1, data.argumentsLine2, data.argumentsLine3, data.argumentsLine4]
	const hasCopyFurnished = [
		data.copyFurnishedLabel,
		data.copyFurnishedTitle,
		data.copyFurnishedOffice,
		data.copyFurnishedAddress,
	].some(value => (value ?? "").trim())

	return (
		<div className="space-y-6">
			<Page>
				<div className="text-center text-[9pt] leading-tight">
					<div>Republic of the Philippines</div>
					<div className="font-bold uppercase">Government Service Insurance System</div>
					<div>Metro Manila</div>
				</div>
				<div className="mt-10 text-center text-[11pt] font-bold">BOARD OF TRUSTEES</div>

				<div className="mt-12 grid grid-cols-[1.2fr_0.9fr] gap-6 text-[10pt]">
					<div>
						<div className="font-bold uppercase">
							IN THE MATTER OF {blank(data.caseTitle, "___________")}
						</div>
						<div className="mt-2 text-[8pt]">
							(Case Title from the Decision of the Committee on Claims)
						</div>
						<div className="mt-2 flex items-center gap-2 text-[8pt]">
							<span>dated</span>
							<div className="w-32 border-b border-black">
								{data.committeeDecisionDate || "\u00A0"}
							</div>
						</div>
						<div className="mt-4 text-center">
							{blank(data.petitionerName, "(Name of Petitioner)")},
						</div>
						<div className="text-[8pt]">(copy from COC Decision)</div>
						<div className="mt-4 text-center italic">Petitioner.</div>
					</div>
					<div className="pt-12 text-[10pt]">
						<div className="mt-6">GSIS Case No. {blank(data.gsisCaseNo, "____")}</div>
						<div className="mt-3 text-right text-[8pt]">
							[Case No. {blank(data.committeeCaseNo, "____")}]
						</div>
					</div>
				</div>

				<div className="mt-5 text-center text-[10pt]">
					x - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - x
				</div>
				<div className="mt-3 text-center text-[11pt] tracking-[0.35em] underline">PETITION</div>

				<div className="mt-10 text-center text-[12pt] font-bold">I. Timeliness of the Petition</div>
				<div className="mt-4 text-[10pt] leading-relaxed">
					{data.timelinessText ? (
						<p className="text-justify">{data.timelinessText}</p>
					) : (
						<div className="space-y-3">
							<LineField value="" />
							<LineField value="" />
						</div>
					)}
				</div>

				<div className="mt-12 text-center text-[12pt] font-bold">II. Statement of Facts</div>
				<div className="mt-8 space-y-5 text-[10pt]">
					{factLines.map((line, index) => (
						<div key={index} className="grid grid-cols-[24px_1fr] items-start gap-2">
							<div className="text-right">{index + 1}.</div>
							<div className="space-y-2">
								<LineField value={line} />
								<LineField value="" />
							</div>
						</div>
					))}
				</div>

				<div className="mt-10 text-center text-[11pt] font-bold">III. Arguments and Discussion</div>
				<div className="mt-8 space-y-5">
					{argumentLines.map((line, index) => (
						<LineField key={index} value={line} width="w-3/5" />
					))}
				</div>
			</Page>

			<Page>
				<div className="mt-2 text-center text-[18pt] font-bold">IV. Prayer</div>
				<div className="mt-10 min-h-24 text-[10pt] leading-relaxed">
					{data.prayerText ? (
						<p className="text-justify whitespace-pre-wrap">{data.prayerText}</p>
					) : null}
				</div>

				<div className="mt-10 w-36 border-b border-black text-center text-[9pt]">
					{data.datePlace || "(Date, Place)"}
				</div>

				<div className="mt-12 grid grid-cols-2 gap-8 text-center text-[9pt]">
					<div>
						<div className="border-b border-black">{data.signatoryName || "\u00A0"}</div>
						<div className="mt-1">(Name of Petitioner or counsel)</div>
					</div>
					<div>
						<div className="border-b border-black">{data.signatoryTitle || "\u00A0"}</div>
					</div>
				</div>

				<div className="mt-10 text-[10pt] font-bold underline">VERIFICATION / CERTIFICATION</div>
				<p className="mt-4 text-[10pt] leading-relaxed">
					I,{" "}
					<span className="inline-block min-w-44 border-b border-black px-1 text-center">
						{blank(data.verificationPetitionerName, "(Name of Petitioner)")}
					</span>
					, resident of{" "}
					<span className="inline-block min-w-44 border-b border-black px-1 text-center">
						{blank(data.verificationResidence)}
					</span>
					, of legal age, and after having been duly sworn to in accordance with law, hereby depose
					and state:
				</p>

				<div className="mt-6 space-y-2 pl-8 text-[10pt] leading-relaxed">
					<div className="grid grid-cols-[24px_1fr] gap-2">
						<div>1.</div>
						<div>That I am the petitioner in the above-titled case;</div>
					</div>
					<div className="grid grid-cols-[24px_1fr] gap-2">
						<div>2.</div>
						<div>That I caused the preparation and filing of the foregoing Petition;</div>
					</div>
					<div className="grid grid-cols-[24px_1fr] gap-2">
						<div>3.</div>
						<div>
							That I have read and fully understood the contents thereof and that the same are true
							and correct based on my personal knowledge and/or based on authentic records; and
						</div>
					</div>
					<div className="grid grid-cols-[24px_1fr] gap-2">
						<div>4.</div>
						<div>{blank(data.verificationStatement4)}</div>
					</div>
				</div>

				<p className="mt-8 text-[10pt] leading-relaxed">
					SUBSCRIBED AND SWORN TO BEFORE ME this{" "}
					<span className="inline-block min-w-12 border-b border-black px-1 text-center">
						{blank(data.subscribedDay, "____")}
					</span>{" "}
					day of{" "}
					<span className="inline-block min-w-16 border-b border-black px-1 text-center">
						{blank(data.subscribedMonth, "________")}
					</span>
					,{" "}
					<span className="inline-block min-w-12 border-b border-black px-1 text-center">
						{blank(data.subscribedYear, "2016")}
					</span>
					, affiant exhibiting to me his{" "}
					<span className="inline-block min-w-32 border-b border-black px-1 text-center">
						{blank(data.idDescription)}
					</span>{" "}
					with No.{" "}
					<span className="inline-block min-w-28 border-b border-black px-1 text-center">
						{blank(data.idNumber)}
					</span>
					.
				</p>

				{hasCopyFurnished ? (
					<div className="mt-14 text-[10pt]">
						<div>{blank(data.copyFurnishedLabel, "Copy furnished:")}</div>
						<div className="mt-4 text-[18pt] font-bold uppercase">{blank(data.copyFurnishedTitle, "COMMITTEE ON CLAIMS")}</div>
						<div className="mt-1">{blank(data.copyFurnishedOffice, "Government Service Insurance System")}</div>
						<div>{blank(data.copyFurnishedAddress, "Pasay City, Metro Manila")}</div>
					</div>
				) : null}
			</Page>
		</div>
	)
}

export function GsisBoardOfTrusteesPetitionEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<GsisBoardOfTrusteesPetitionData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultGsisBoardOfTrusteesPetition,
						...(JSON.parse(saved) as Partial<GsisBoardOfTrusteesPetitionData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultGsisBoardOfTrusteesPetition
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
			await exportGsisBoardOfTrusteesPetition(data)
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
					{exporting ? "Generating PDF..." : "Export PDF"}
				</Button>
			</div>

			<div className="flex gap-6" style={{ height: "calc(100vh - 140px)" }}>
				<div className="w-md shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field
							label="Case Title"
							id="caseTitle"
							value={data.caseTitle}
							onChange={set("caseTitle")}
						/>
						<Field
							label="Committee Decision Date"
							id="committeeDecisionDate"
							value={data.committeeDecisionDate}
							onChange={set("committeeDecisionDate")}
						/>
						<Field
							label="Petitioner Name"
							id="petitionerName"
							value={data.petitionerName}
							onChange={set("petitionerName")}
						/>
						<Field
							label="GSIS Case No."
							id="gsisCaseNo"
							value={data.gsisCaseNo}
							onChange={set("gsisCaseNo")}
						/>
						<Field
							label="Committee Case No."
							id="committeeCaseNo"
							value={data.committeeCaseNo}
							onChange={set("committeeCaseNo")}
						/>
						<Field
							label="Timeliness of Petition"
							id="timelinessText"
							value={data.timelinessText}
							onChange={set("timelinessText")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Statement of Facts 1"
							id="statementOfFacts1"
							value={data.statementOfFacts1}
							onChange={set("statementOfFacts1")}
						/>
						<Field
							label="Statement of Facts 2"
							id="statementOfFacts2"
							value={data.statementOfFacts2}
							onChange={set("statementOfFacts2")}
						/>
						<Field
							label="Statement of Facts 3"
							id="statementOfFacts3"
							value={data.statementOfFacts3}
							onChange={set("statementOfFacts3")}
						/>
						<Field
							label="Statement of Facts 4"
							id="statementOfFacts4"
							value={data.statementOfFacts4}
							onChange={set("statementOfFacts4")}
						/>
						<Field
							label="Statement of Facts 5"
							id="statementOfFacts5"
							value={data.statementOfFacts5}
							onChange={set("statementOfFacts5")}
						/>
						<Field
							label="Arguments Line 1"
							id="argumentsLine1"
							value={data.argumentsLine1}
							onChange={set("argumentsLine1")}
						/>
						<Field
							label="Arguments Line 2"
							id="argumentsLine2"
							value={data.argumentsLine2}
							onChange={set("argumentsLine2")}
						/>
						<Field
							label="Arguments Line 3"
							id="argumentsLine3"
							value={data.argumentsLine3}
							onChange={set("argumentsLine3")}
						/>
						<Field
							label="Arguments Line 4"
							id="argumentsLine4"
							value={data.argumentsLine4}
							onChange={set("argumentsLine4")}
						/>
						<Field
							label="Prayer"
							id="prayerText"
							value={data.prayerText}
							onChange={set("prayerText")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Date, Place"
							id="datePlace"
							value={data.datePlace}
							onChange={set("datePlace")}
						/>
						<Field
							label="Signatory Name"
							id="signatoryName"
							value={data.signatoryName}
							onChange={set("signatoryName")}
						/>
						<Field
							label="Signatory Title / Second Line"
							id="signatoryTitle"
							value={data.signatoryTitle}
							onChange={set("signatoryTitle")}
						/>
						<Field
							label="Verification Petitioner Name"
							id="verificationPetitionerName"
							value={data.verificationPetitionerName}
							onChange={set("verificationPetitionerName")}
						/>
						<Field
							label="Verification Residence"
							id="verificationResidence"
							value={data.verificationResidence}
							onChange={set("verificationResidence")}
						/>
						<Field
							label="Verification Legal Age"
							id="verificationLegalAge"
							value={data.verificationLegalAge}
							onChange={set("verificationLegalAge")}
						/>
						<Field
							label="Verification Paragraph 4"
							id="verificationStatement4"
							value={data.verificationStatement4}
							onChange={set("verificationStatement4")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Subscribed Day" id="subscribedDay" value={data.subscribedDay} onChange={set("subscribedDay")} />
						<Field label="Subscribed Month" id="subscribedMonth" value={data.subscribedMonth} onChange={set("subscribedMonth")} />
						<Field label="Subscribed Year" id="subscribedYear" value={data.subscribedYear} onChange={set("subscribedYear")} />
						<Field label="ID Description" id="idDescription" value={data.idDescription} onChange={set("idDescription")} />
						<Field label="ID Number" id="idNumber" value={data.idNumber} onChange={set("idNumber")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Copy Furnished Label" id="copyFurnishedLabel" value={data.copyFurnishedLabel} onChange={set("copyFurnishedLabel")} placeholder="Copy furnished:" />
						<Field label="Copy Furnished Title" id="copyFurnishedTitle" value={data.copyFurnishedTitle} onChange={set("copyFurnishedTitle")} placeholder="COMMITTEE ON CLAIMS" />
						<Field label="Copy Furnished Office" id="copyFurnishedOffice" value={data.copyFurnishedOffice} onChange={set("copyFurnishedOffice")} placeholder="Government Service Insurance System" />
						<Field label="Copy Furnished Address" id="copyFurnishedAddress" value={data.copyFurnishedAddress} onChange={set("copyFurnishedAddress")} placeholder="Pasay City, Metro Manila" />
					</div>
				</div>

				<div className="flex-1 overflow-auto">
					<div className="mb-3 flex items-center gap-2">
						<span className="text-muted-foreground text-xs">Document Preview</span>
						<span className="bg-muted rounded px-1.5 py-0.5 text-xs">Live</span>
					</div>
					<div className="overflow-auto rounded-lg border bg-gray-100 p-4">
						<div
							style={{
								transform: "scale(0.62)",
								transformOrigin: "top left",
								width: "816px",
								marginBottom: "-78%",
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

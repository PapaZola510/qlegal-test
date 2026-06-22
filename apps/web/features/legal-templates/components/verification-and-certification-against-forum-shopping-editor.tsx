"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportVerificationAndCertificationAgainstForumShopping } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultVerificationAndCertificationAgainstForumShopping,
	type VerificationAndCertificationAgainstForumShoppingData,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:verification-and-certification-against-forum-shopping"

type ForumShoppingFieldKey = keyof VerificationAndCertificationAgainstForumShoppingData

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

function DocumentPreview({ data }: { data: VerificationAndCertificationAgainstForumShoppingData }) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)

	return (
		<div
			id="legal-template-print-area"
			className="min-h-264 w-204 shrink-0 bg-white px-24 py-24 font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			<div className="mb-7 text-[9pt] leading-tight">
				<div>Republic of the Philippines)</div>
				<div>{b(data.city)}......................)S.S.</div>
			</div>

			<div className="mb-6 text-center text-[11pt] leading-tight font-bold">
				<div>VERIFICATION AND CERTIFICATION</div>
				<div>AGAINST FORUM SHOPPING</div>
			</div>

			<p className="mb-4 text-justify text-[10pt]">
				I, <span className="underline">{b(data.affiantName)}</span>, of legal age,{" "}
				<span className="underline">{b(data.civilStatus, "married/single")}</span> and a resident of{" "}
				<span className="underline">{b(data.address)}</span>, after having been duly sworn to in
				accordance with law hereby depose and say:
			</p>

			<div className="space-y-4 text-[10pt]">
				<p className="text-justify">{b(data.complaintDescription)}</p>
				<p className="text-justify">{b(data.noOtherActionStatement)}</p>
				<p className="text-justify">{b(data.undertakingStatement)}</p>
			</div>

			<p className="mt-8 text-justify text-[10pt]">
				<span className="font-bold">IN WITNESS WHEREOF</span>, I have hereunto affix my signature in
				this document this <span className="underline">{b(data.signatureDay, "____")}</span> day of{" "}
				<span className="underline">{b(data.signatureMonth, "____________")}</span>,{" "}
				<span className="underline">{b(data.signatureYear, "20__")}</span> here at{" "}
				<span className="underline">{b(data.signatureCity)}</span>, Philippines.
			</p>

			<div className="mt-10 mb-1 flex justify-center">
				<div className="w-44 border-b border-black" />
			</div>
			<div className="mb-8 text-center text-[9pt]">Affiant</div>

			<p className="mb-6 text-justify text-[9pt]">
				<span className="font-bold">SUBSCRIBED AND SWORN</span> to before me this{" "}
				<span className="underline">{b(data.subscribedDay, "____")}</span> day of{" "}
				<span className="underline">{b(data.subscribedMonth, "____________")}</span>,{" "}
				<span className="underline">{b(data.subscribedYear, "20__")}</span> at {b(data.city)}. The
				affiant exhibited to me his/her competent proof of identity{" "}
				<span className="underline">{b(data.idType, "competent proof of identity")}</span>{" "}
				<span className="underline">{b(data.idNumber, "____________")}</span>.
			</p>
		</div>
	)
}

export function VerificationAndCertificationAgainstForumShoppingEditor({
	onBack,
}: {
	onBack: () => void
}) {
	const [data, setData] = React.useState<VerificationAndCertificationAgainstForumShoppingData>(
		() => {
			if (typeof window !== "undefined") {
				try {
					const saved = localStorage.getItem(DRAFT_KEY)
					if (saved) {
						return {
							...defaultVerificationAndCertificationAgainstForumShopping,
							...(JSON.parse(
								saved
							) as Partial<VerificationAndCertificationAgainstForumShoppingData>),
						}
					}
				} catch {
					/* ignore */
				}
			}
			return defaultVerificationAndCertificationAgainstForumShopping
		}
	)

	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: ForumShoppingFieldKey) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportVerificationAndCertificationAgainstForumShopping(data)
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
						<Field label="City" id="city" value={data.city} onChange={set("city")} />
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
						/>
						<Field
							label="Civil Status"
							id="civilStatus"
							value={data.civilStatus}
							onChange={set("civilStatus")}
							placeholder="married/single"
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
							label="Paragraph 1"
							id="complaintDescription"
							value={data.complaintDescription}
							onChange={set("complaintDescription")}
							multiline
						/>
						<Field
							label="Paragraph 2"
							id="noOtherActionStatement"
							value={data.noOtherActionStatement}
							onChange={set("noOtherActionStatement")}
							multiline
						/>
						<Field
							label="Paragraph 3"
							id="undertakingStatement"
							value={data.undertakingStatement}
							onChange={set("undertakingStatement")}
							multiline
						/>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field
							label="Signature Day"
							id="signatureDay"
							value={data.signatureDay}
							onChange={set("signatureDay")}
						/>
						<Field
							label="Signature Month"
							id="signatureMonth"
							value={data.signatureMonth}
							onChange={set("signatureMonth")}
						/>
						<Field
							label="Signature Year"
							id="signatureYear"
							value={data.signatureYear}
							onChange={set("signatureYear")}
							placeholder="20__"
						/>
						<Field
							label="Signature City"
							id="signatureCity"
							value={data.signatureCity}
							onChange={set("signatureCity")}
						/>
						<Field
							label="Subscribed Day"
							id="subscribedDay"
							value={data.subscribedDay}
							onChange={set("subscribedDay")}
						/>
						<Field
							label="Subscribed Month"
							id="subscribedMonth"
							value={data.subscribedMonth}
							onChange={set("subscribedMonth")}
						/>
						<Field
							label="Subscribed Year"
							id="subscribedYear"
							value={data.subscribedYear}
							onChange={set("subscribedYear")}
							placeholder="20__"
						/>
						<Field label="ID Type" id="idType" value={data.idType} onChange={set("idType")} />
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

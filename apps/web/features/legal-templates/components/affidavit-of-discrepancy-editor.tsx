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
import { exportAffidavitOfDiscrepancy } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultAffidavitOfDiscrepancy,
	type AffidavitOfDiscrepancyData,
	type DiscrepancyDocument,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:affidavit-of-discrepancy"
function blank(val: string, placeholder = "_____________") {
	return val.trim() ? val : placeholder
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

function DocumentPreview({ data }: { data: AffidavitOfDiscrepancyData }) {
	const b = (v: string, fb = "_____________") => blank(v, fb)
	const dtype = b(data.discrepancyType, "[discrepancy type]")
	const docs =
		data.documents.length > 0
			? data.documents
			: [{ type: "", issuedOn: "", issuedAt: "", valueShown: "" }]
	const closingNum = docs.length + 1
	const execNum = docs.length + 2

	return (
		<div
			id="legal-template-print-area"
			className="min-h-[792pt] w-[612pt] shrink-0 bg-white px-[72pt] py-[72pt] font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			{/* Title */}
			<div className="text-center text-[12pt] font-bold underline">AFFIDAVIT OF DISCREPANCY</div>
			<div className="mb-6 text-center text-[11pt] font-bold">(ONE AND THE SAME PERSON)</div>

			{/* Opening */}
			<p className="mb-4 text-justify">
				I, <span className="underline">{b(data.affiantName)}</span>. Filipino,{" "}
				{data.civilStatus === "married" ? (
					<>
						single/married to <span className="underline">{b(data.spouseName)}</span>
					</>
				) : (
					"single"
				)}{" "}
				of legal age, with address at <span className="underline">{b(data.address)}</span>, after
				having been duly sworn to in accordance with law hereby depose and say:
			</p>

			{/* Dynamic document items */}
			<div className="ml-8 space-y-4">
				{docs.map((doc, i) => (
					<p key={i} className="text-justify">
						<span className="font-bold">{i + 1})</span>&nbsp;{" "}
						{i === 0 ? "The " : "On the other hand, in the "}
						<span className="underline">{b(doc.type)}</span> issued on{" "}
						<span className="underline">{b(doc.issuedOn)}</span> at{" "}
						<span className="underline">{b(doc.issuedAt)}</span>
						{i === 0 ? (
							<>
								{" "}
								indicates my <span className="underline">{dtype}</span> as{" "}
								<span className="underline">{b(doc.valueShown)}</span>.
							</>
						) : (
							<>
								, my <span className="underline">{dtype}</span> is indicated as{" "}
								<span className="underline">{b(doc.valueShown)}</span>.
							</>
						)}
					</p>
				))}

				<p>
					<span className="font-bold">{closingNum})</span>&nbsp; Both names/documents pertain to one
					and the same person.
				</p>

				<p className="text-justify">
					<span className="font-bold">{execNum})</span>&nbsp; I am executing this affidavit to
					attest to the truth and for whatever legal purposes it may serve.
				</p>
			</div>

			<div className="h-8" />

			{/* IN WITNESS WHEREOF */}
			<p className="mb-8 text-justify italic">
				IN WITNESS WHEREOF, I hereby affix my signature this{" "}
				<span className="underline">{b(data.signatureDate)}</span> at the{" "}
				<span className="underline">{b(data.signatureCity)}</span>.
			</p>

			{/* Signature */}
			<div className="mb-1 flex justify-center">
				<div className="w-64 border-b border-black" />
			</div>
			<div className="mb-6 text-center text-[9pt]">Signature of Affiant over Printed Name</div>

			{/* Venue brackets */}
			<div className="mb-4 space-y-1 text-[9pt]">
				<div className="flex items-center gap-2">
					<div className="w-36 border-b border-black" />
					<span> ) </span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-36 border-b border-black" />
					<span> ) S.S.</span>
				</div>
				<div className="flex items-center gap-2">
					<div className="w-36 border-b border-black" />
					<span> ) </span>
				</div>
			</div>

			{/* Subscribed */}
			<p className="mb-4 text-justify text-[9pt]">
				SUBSCRIBED AND SWORN to before me this{" "}
				<span className="underline">{b(data.swornDate)}</span> at the{" "}
				<span className="underline">{b(data.swornAt)}</span>, affiant having exhibited to me his/
				her <span className="underline">{b(data.passportNo)}</span> passport no.{" "}
				<span className="underline">{b(data.passportIssuedIn)}</span> issued in{" "}
				<span className="underline">{b(data.passportIssuedOn)}</span> on{" "}
				<span className="underline">{b(data.validUntil)}</span> and valid until{" "}
				<span className="underline">{b(data.validUntil)}</span>.
			</p>

			{/* Footer */}
			<div className="flex justify-between text-[9pt]">
				<div className="space-y-1">
					<div>
						Date: <span className="underline">{b(data.notaryDate, "___________")}</span>
					</div>
					<div>
						Service No.: <span className="underline">{b(data.serviceNo, "_______")}</span>
					</div>
					<div>
						O.R. No.: <span className="underline">{b(data.orNo, "_______")}</span>
					</div>
					<div>
						Fee Paid: <span className="underline">{b(data.feePaid, "_______")}</span>
					</div>
				</div>
				<div className="text-right">
					<div className="font-bold">Consul of the Republic of the Philippines</div>
				</div>
			</div>
		</div>
	)
}

export function AffidavitOfDiscrepancyEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<AffidavitOfDiscrepancyData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) return JSON.parse(saved) as AffidavitOfDiscrepancyData
			} catch {
				/* ignore */
			}
		}
		return defaultAffidavitOfDiscrepancy
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: keyof AffidavitOfDiscrepancyData) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const setSelect = (key: keyof AffidavitOfDiscrepancyData) => (value: string | null) =>
		setData(prev => ({ ...prev, [key]: value ?? "" }))

	const setDoc = (index: number, field: keyof DiscrepancyDocument) => (value: string) =>
		setData(prev => {
			const docs = prev.documents.map((d, i) => (i === index ? { ...d, [field]: value } : d))
			return { ...prev, documents: docs }
		})

	const addDoc = () =>
		setData(prev => ({
			...prev,
			documents: [...prev.documents, { type: "", issuedOn: "", issuedAt: "", valueShown: "" }],
		}))

	const removeDoc = (index: number) =>
		setData(prev => ({ ...prev, documents: prev.documents.filter((_, i) => i !== index) }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportAffidavitOfDiscrepancy(data)
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
					{/* ── Discrepancy Type ── */}
					<div className="border-primary/30 bg-primary/5 space-y-2 rounded-lg border-2 p-3">
						<p className="text-primary text-xs font-bold tracking-wide uppercase">
							Discrepancy Type
						</p>
						<Select value={data.discrepancyType} onValueChange={setSelect("discrepancyType")}>
							<SelectTrigger className="h-8 bg-white text-sm">
								<SelectValue>{data.discrepancyType || "Select type…"}</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="first name">First Name</SelectItem>
								<SelectItem value="middle name">Middle Name</SelectItem>
								<SelectItem value="last name / surname">Last Name / Surname</SelectItem>
								<SelectItem value="full name">Full Name</SelectItem>
								<SelectItem value="date of birth">Date of Birth</SelectItem>
								<SelectItem value="place of birth">Place of Birth</SelectItem>
								<SelectItem value="civil status">Civil Status</SelectItem>
							</SelectContent>
						</Select>
						<Input
							value={data.discrepancyType}
							onChange={e => set("discrepancyType")(e.target.value)}
							placeholder="Or type custom e.g. maiden name…"
							className="h-8 text-sm"
						/>
					</div>

					<Separator />

					{/* ── Affiant ── */}
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
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="single">Single</SelectItem>
										<SelectItem value="married">Married</SelectItem>
									</SelectContent>
								</Select>
							</div>
							{data.civilStatus === "married" && (
								<Field
									label="Spouse Name"
									id="spouseName"
									value={data.spouseName}
									onChange={set("spouseName")}
									placeholder="Spouse's full name"
								/>
							)}
							<Field
								label="Address"
								id="address"
								value={data.address}
								onChange={set("address")}
								placeholder="Complete address"
								multiline
							/>
						</div>
					</div>

					<Separator />

					{/* ── Documents ── */}
					<div>
						<div className="mb-3 flex items-center justify-between">
							<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
								Documents ({data.documents.length})
							</p>
							<Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={addDoc}>
								+ Add Document
							</Button>
						</div>
						<div className="space-y-4">
							{data.documents.map((doc, i) => (
								<div key={i} className="space-y-2 rounded-md border p-3">
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground text-xs font-medium">
											Document {i + 1}
										</span>
										{data.documents.length > 1 && (
											<button
												type="button"
												onClick={() => removeDoc(i)}
												className="text-destructive text-xs hover:underline"
											>
												Remove
											</button>
										)}
									</div>
									<Field
										label="Document Type"
										id={`doc${i}type`}
										value={doc.type}
										onChange={setDoc(i, "type")}
										placeholder="e.g. Birth Certificate"
									/>
									<Field
										label="Issued On"
										id={`doc${i}issuedOn`}
										value={doc.issuedOn}
										onChange={setDoc(i, "issuedOn")}
										placeholder="e.g. January 1, 2000"
									/>
									<Field
										label="Issued At"
										id={`doc${i}issuedAt`}
										value={doc.issuedAt}
										onChange={setDoc(i, "issuedAt")}
										placeholder="e.g. City of Manila"
									/>
									<Field
										label="Value as Shown"
										id={`doc${i}value`}
										value={doc.valueShown}
										onChange={setDoc(i, "valueShown")}
										placeholder="e.g. Juan C. dela Cruz"
									/>
								</div>
							))}
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Signing Details
						</p>
						<div className="space-y-3">
							<Field
								label="Signature Date"
								id="signatureDate"
								value={data.signatureDate}
								onChange={set("signatureDate")}
								placeholder="e.g. June 12, 2026"
							/>
							<Field
								label="Signed at City/Location"
								id="signatureCity"
								value={data.signatureCity}
								onChange={set("signatureCity")}
								placeholder="e.g. City of Manila"
							/>
						</div>
					</div>
					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Subscribed / Sworn
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
							<Field
								label="Passport No."
								id="passportNo"
								value={data.passportNo}
								onChange={set("passportNo")}
								placeholder="e.g. P1234567A"
							/>
							<Field
								label="Passport Issued In"
								id="passportIssuedIn"
								value={data.passportIssuedIn}
								onChange={set("passportIssuedIn")}
								placeholder="e.g. Philippines"
							/>
							<Field
								label="Passport Issued On"
								id="passportIssuedOn"
								value={data.passportIssuedOn}
								onChange={set("passportIssuedOn")}
								placeholder="e.g. January 5, 2020"
							/>
							<Field
								label="Valid Until"
								id="validUntil"
								value={data.validUntil}
								onChange={set("validUntil")}
								placeholder="e.g. January 4, 2030"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Consulate / Notary
						</p>
						<div className="space-y-3">
							<Field
								label="Date"
								id="notaryDate"
								value={data.notaryDate}
								onChange={set("notaryDate")}
								placeholder="e.g. June 12, 2026"
							/>
							<Field
								label="Service No."
								id="serviceNo"
								value={data.serviceNo}
								onChange={set("serviceNo")}
								placeholder="e.g. 001"
							/>
							<Field
								label="O.R. No."
								id="orNo"
								value={data.orNo}
								onChange={set("orNo")}
								placeholder="e.g. 12345"
							/>
							<Field
								label="Fee Paid"
								id="feePaid"
								value={data.feePaid}
								onChange={set("feePaid")}
								placeholder="e.g. PHP 500.00"
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

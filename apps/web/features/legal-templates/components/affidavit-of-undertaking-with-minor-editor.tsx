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
import { exportAffidavitOfUndertakingWithMinor } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultAffidavitOfUndertakingWithMinor,
	type AffidavitOfUndertakingWithMinorData,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:affidavit-of-undertaking-with-minor"

const CIVIL_STATUS_OPTIONS = ["single", "married", "widowed", "divorced", "separated"]

type MinorFieldKey = keyof AffidavitOfUndertakingWithMinorData

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

function DocumentPreview({ data }: { data: AffidavitOfUndertakingWithMinorData }) {
	const b = (v: string, fb = "_____________") => blank(v, fb)

	const companionDisplay = (() => {
		const firstStatus = data.companionLines[0]?.civilStatus ?? ""
		const allSameStatus =
			data.companionLines.length > 0 &&
			data.companionLines.every(line => (line.civilStatus ?? "") === firstStatus)

		if (allSameStatus) {
			return (
				<>
					{data.companionLines.map((line, idx) => (
						<span key={idx}>
							{idx > 0 && " and "}
							<span className="underline">{b(line.name)}</span>
						</span>
					))}
					, <span className="underline">{b(firstStatus, "single")}</span>
				</>
			)
		}

		return data.companionLines.map((line, idx) => (
			<span key={idx}>
				{idx > 0 && " and "}
				<span className="underline">{b(line.name)}</span>,{" "}
				<span className="underline">{b(line.civilStatus, "single")}</span>
			</span>
		))
	})()

	return (
		<div
			id="legal-template-print-area"
			className="min-h-[792pt] w-[612pt] shrink-0 bg-white px-[72pt] py-[72pt] font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			<div className="mb-8 text-center">
				<div className="text-[12pt] font-bold">Republic of the Philippines</div>
			</div>

			<p className="mb-4 text-justify">
				I/We {companionDisplay} of legal age,{" "}
				<span className="underline">{b(data.companionLegalAge, "__")}</span>, and residing at{" "}
				<span className="underline">{b(data.companionAddress)}</span>, after having been sworn to in
				accordance with the law do hereby depose and state that:
			</p>

			<div className="ml-5 space-y-3">
				<p className="text-justify">
					<span className="font-bold">1.</span> That I/am/we are the companion of minor{" "}
					<span className="underline">{b(data.minorFirstName)}</span>{" "}
					<span className="underline">{b(data.minorLastName, "(name of minor)")}</span> who together
					with me/us will travel to <span className="underline">{b(data.travelCountry)}</span> (date
					of travel) for the purpose of{" "}
					<span className="underline">{b(data.travelPurpose, "(country)")}</span> on{" "}
					<span className="underline">{b(data.travelDateStart)}</span>.
				</p>
				<p className="text-justify">
					<span className="font-bold">2.</span> That said minor is the child of{" "}
					<span className="underline">{b(data.minorParentFirstName)}</span>{" "}
					<span className="underline">{b(data.minorParentLastName, "(name of parent(s))")}</span>{" "}
					who gave their full consent and permission to me as companion of their daughter/son.
				</p>
				<p className="text-justify">
					<span className="font-bold">3.</span> That I am/We are the{" "}
					<span className="underline">{b(data.minorRelationship)}</span> of the said minor;
				</p>
				<p className="text-justify">
					<span className="font-bold">4.</span> That I/We hereby undertake and affirm that I/We
					together with the minor will return to the Philippines as soon as we finish the duration
					of our <span className="underline">{b(data.returnDate, "(purpose of travel)")}</span> in{" "}
					<span className="underline">{b(data.returnCountry, "Philippines")}</span>.
				</p>
				<p className="text-justify">
					<span className="font-bold">5.</span> That I/We assume full responsibility over the
					minor's safety and welfare during the entire duration of our travel and stay at (place
					where minor(s) is to stay) and hold the staff, officers and/or any employee of DSWB Field
					Office MIMAROPA free and harmless from all and any liability arising from the processing
					of this application.
				</p>
				<p className="text-justify">
					<span className="font-bold">6.</span> That this affidavit was executed for the purpose of
					attesting to the truth of the foregoing facts and for whatever legal purpose it may serve.
				</p>
			</div>

			<div className="h-6" />

			<p className="mb-6">
				IN WITNESS WHEREOF, I have hereunto set my hand this{" "}
				<span className="underline">{b(data.signatureDay, "___")}</span> th day of{" "}
				<span className="underline">{b(data.signatureMonth, "_______")}</span>, 20
				<span className="underline">{b(data.signatureYear, "__")}</span> in{" "}
				<span className="underline">{b(data.signatureLocation, "_____________")}</span>,
				Philippines.
			</p>

			<div className="h-8" />

			<div className="mb-8 text-center">
				<div className="mx-auto w-48 border-b border-black" />
				<div className="font-bold">AFFIANT</div>
			</div>

			<div className="h-4" />

			<p className="text-justify">
				SUBSCRIBE AND SWORN TO before me this___ in day of____, 20____ in{" "}
				<span className="underline">{b(data.subscribedLocation, "Philippines")}</span>. Affiant
				exhibited to me his/her <span className="underline">{b(data.governmentIdType, "ID")}</span>{" "}
				No. <span className="underline">{b(data.governmentIdNumber, "_____")}</span>, issued on{" "}
				<span className="underline">{b(data.governmentIdDate, "_____")}</span> thereon as proof of
				her identity.
			</p>
		</div>
	)
}

export function AffidavitOfUndertakingWithMinorEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<AffidavitOfUndertakingWithMinorData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultAffidavitOfUndertakingWithMinor,
						...(JSON.parse(saved) as Partial<AffidavitOfUndertakingWithMinorData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultAffidavitOfUndertakingWithMinor
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: MinorFieldKey) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportAffidavitOfUndertakingWithMinor(data)
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
					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Companion
						</p>
						<div className="ml-5 space-y-3">
							{data.companionLines.map((line, idx) => (
								<div key={idx} className="flex gap-3">
									<div className="flex-1 space-y-2">
										<Field
											label={`Companion ${idx + 1} Name`}
											id={`companion-name-${idx}`}
											value={line.name}
											onChange={val => {
												const updated = [...data.companionLines]
												updated[idx]!.name = val
												setData(prev => ({ ...prev, companionLines: updated }))
											}}
											placeholder="Full name"
										/>
										<div className="space-y-1.5">
											<Label htmlFor={`companion-status-${idx}`} className="text-xs font-medium">
												Civil Status
											</Label>
											<Select
												value={line.civilStatus}
												onValueChange={val => {
													const updated = [...data.companionLines]
													updated[idx]!.civilStatus = val ?? ""
													setData(prev => ({ ...prev, companionLines: updated }))
												}}
											>
												<SelectTrigger id={`companion-status-${idx}`} className="h-8 text-sm">
													<SelectValue>
														{line.civilStatus
															? line.civilStatus.charAt(0).toUpperCase() + line.civilStatus.slice(1)
															: "Select status"}
													</SelectValue>
												</SelectTrigger>
												<SelectContent>
													{CIVIL_STATUS_OPTIONS.map(status => (
														<SelectItem key={status} value={status}>
															{status.charAt(0).toUpperCase() + status.slice(1)}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
									</div>
									<div className="flex gap-2 pt-6">
										{data.companionLines.length > 1 && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													setData(prev => ({
														...prev,
														companionLines: prev.companionLines.filter((_, i) => i !== idx),
													}))
												}}
											>
												Remove
											</Button>
										)}
									</div>
								</div>
							))}
							<Button
								variant="outline"
								size="sm"
								onClick={() => {
									setData(prev => ({
										...prev,
										companionLines: [...prev.companionLines, { name: "", civilStatus: "single" }],
									}))
								}}
							>
								+ Add Companion
							</Button>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Shared Details
						</p>
						<div className="space-y-3">
							<Field
								label="Legal Age"
								id="companionLegalAge"
								value={data.companionLegalAge}
								onChange={set("companionLegalAge")}
								placeholder="e.g. 30"
							/>
							<Field
								label="Address"
								id="companionAddress"
								value={data.companionAddress}
								onChange={set("companionAddress")}
								placeholder="Complete address"
								multiline
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Minor
						</p>
						<div className="space-y-3">
							<Field
								label="Minor First Name"
								id="minorFirstName"
								value={data.minorFirstName}
								onChange={set("minorFirstName")}
								placeholder="First name"
							/>
							<Field
								label="Minor Last Name"
								id="minorLastName"
								value={data.minorLastName}
								onChange={set("minorLastName")}
								placeholder="Last name"
							/>
							<Field
								label="Relationship to Minor"
								id="minorRelationship"
								value={data.minorRelationship}
								onChange={set("minorRelationship")}
								placeholder="e.g. parent, aunt, uncle"
							/>
							<Field
								label="Parent First Name"
								id="minorParentFirstName"
								value={data.minorParentFirstName}
								onChange={set("minorParentFirstName")}
								placeholder="Parent's first name"
							/>
							<Field
								label="Parent Last Name"
								id="minorParentLastName"
								value={data.minorParentLastName}
								onChange={set("minorParentLastName")}
								placeholder="Parent's last name"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Travel Details
						</p>
						<div className="space-y-3">
							<Field
								label="Travel Country"
								id="travelCountry"
								value={data.travelCountry}
								onChange={set("travelCountry")}
								placeholder="e.g. USA, Japan"
							/>
							<Field
								label="Travel Date"
								id="travelDateStart"
								value={data.travelDateStart}
								onChange={set("travelDateStart")}
								placeholder="e.g. June 15, 2026"
							/>
							<Field
								label="Purpose of Travel"
								id="travelPurpose"
								value={data.travelPurpose}
								onChange={set("travelPurpose")}
								placeholder="e.g. vacation, study"
								multiline
							/>
							<Field
								label="Expected Return Date"
								id="returnDate"
								value={data.returnDate}
								onChange={set("returnDate")}
								placeholder="e.g. July 30, 2026"
							/>
							<Field
								label="Return Country"
								id="returnCountry"
								value={data.returnCountry}
								onChange={set("returnCountry")}
								placeholder="Usually Philippines"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Signature Details
						</p>
						<div className="space-y-3">
							<Field
								label="Signature Day"
								id="signatureDay"
								value={data.signatureDay}
								onChange={set("signatureDay")}
								placeholder="e.g. 12"
							/>
							<Field
								label="Signature Month"
								id="signatureMonth"
								value={data.signatureMonth}
								onChange={set("signatureMonth")}
								placeholder="e.g. June"
							/>
							<Field
								label="Signature Year"
								id="signatureYear"
								value={data.signatureYear}
								onChange={set("signatureYear")}
								placeholder="e.g. 26"
							/>
							<Field
								label="Signature Location"
								id="signatureLocation"
								value={data.signatureLocation}
								onChange={set("signatureLocation")}
								placeholder="e.g. Manila"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Notary Details
						</p>
						<div className="space-y-3">
							<Field
								label="Subscribed Day"
								id="subscribedDay"
								value={data.subscribedDay}
								onChange={set("subscribedDay")}
								placeholder="e.g. 12"
							/>
							<Field
								label="Subscribed Month"
								id="subscribedMonth"
								value={data.subscribedMonth}
								onChange={set("subscribedMonth")}
								placeholder="e.g. June"
							/>
							<Field
								label="Subscribed Year"
								id="subscribedYear"
								value={data.subscribedYear}
								onChange={set("subscribedYear")}
								placeholder="e.g. 26"
							/>
							<Field
								label="Subscribed Location"
								id="subscribedLocation"
								value={data.subscribedLocation}
								onChange={set("subscribedLocation")}
								placeholder="e.g. Manila"
							/>
							<Field
								label="Government ID Type"
								id="governmentIdType"
								value={data.governmentIdType}
								onChange={set("governmentIdType")}
								placeholder="e.g. Passport, Driver License"
							/>
							<Field
								label="Government ID Number"
								id="governmentIdNumber"
								value={data.governmentIdNumber}
								onChange={set("governmentIdNumber")}
								placeholder="ID Number"
							/>
							<Field
								label="ID Issued Date"
								id="governmentIdDate"
								value={data.governmentIdDate}
								onChange={set("governmentIdDate")}
								placeholder="Date"
							/>
						</div>
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

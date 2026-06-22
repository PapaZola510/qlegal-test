"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportAffidavitOfUndertaking } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultAffidavitOfUndertaking,
	type AffidavitOfUndertakingData,
	type UndertakingPaymentRow,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:affidavit-of-undertaking"

type UndertakingFieldKey = Exclude<
	keyof AffidavitOfUndertakingData,
	"personNames" | "paymentRows" | "personsMode"
>

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

function DocumentPreview({ data }: { data: AffidavitOfUndertakingData }) {
	const b = (v: string, fb = "_____________") => blank(v, fb)
	const persons = data.personNames.length > 0 ? data.personNames : [""]
	const rows =
		data.paymentRows.length > 0 ? data.paymentRows : [{ name: "", amount: "", paymentDue: "" }]

	return (
		<div
			id="legal-template-print-area"
			className="min-h-[792pt] w-[612pt] shrink-0 bg-white px-[72pt] py-[72pt] font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			<div className="text-[9pt] leading-tight font-bold">
				<div>LUC FORM NO. 2</div>
				<div>SERIES OF 2002</div>
			</div>

			<div className="h-6" />

			<div className="text-[9pt] leading-tight">
				<div>REPUBLIC OF THE PHILIPPINES</div>
				<div>MUNICIPALITY OF {b(data.municipality)}</div>
				<div>PROVINCE OF {b(data.province)} ) S.S.</div>
			</div>

			<div className="h-8" />

			<div className="mb-6 text-[12pt] font-bold">AFFIDAVIT OF UNDERTAKING</div>

			<p className="mb-4 text-justify">
				I, <span className="underline">{b(data.affiantName)}</span>, of legal age, citizen of the{" "}
				<span className="underline">{b(data.citizenship, "Philippines")}</span>,{" "}
				<span className="underline">{b(data.civilStatus, "single")}</span>
				{data.civilStatus === "married" && data.spouseName.trim() ? (
					<>
						{" "}
						to <span className="underline">{b(data.spouseName)}</span>
					</>
				) : null}
				, with residence address at <span className="underline">{b(data.address)}</span>, having
				been duly sworn in accordance with law, hereby depose and say that:
			</p>

			<div className="ml-5 space-y-3">
				<p className="text-justify">
					<span className="font-bold">1.</span> I am the owner/authorized representative of the
					owner(s) of the <span className="underline">{b(data.parcelCount, "____")}</span> parcel(s)
					of land subject to an application for conversion.
				</p>
				<p className="text-justify">
					<span className="font-bold">2.</span> The land subject of my application for conversion
					has no vertical or horizontal development of any kind that is related to any
					non-agricultural use.
				</p>
				<p className="text-justify">
					<span className="font-bold">3.</span> I undertake to post a bond to guarantee the present
					status of the land and my obligations under this application.
				</p>
			</div>

			<div className="h-4" />

			<div className="text-justify">
				<div>
					<span className="font-bold">4.</span> The total number of farmers, agricultural lessees,
					share tenants, farmworkers, actual tillers, occupants, or others directly working on the
					land is:
				</div>
				<div className="mt-1">[ {data.personsMode === "none" ? "x" : " "} ] None</div>
				<div>
					[ {data.personsMode === "with-persons" ? "x" : " "} ]{" "}
					<span className="underline">{b(data.personsCount, "_____")}</span> persons. Their names
					are:
				</div>
			</div>

			{data.personsMode === "with-persons" && (
				<div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
					{persons.map((name, i) => (
						<div key={i} className="min-h-5 border-b border-black text-[9pt]">
							{name.trim() || " "}
						</div>
					))}
				</div>
			)}

			<div className="h-4" />

			<div className="mb-2 text-justify">
				<span className="font-bold">5.</span> I/we paid (or undertake to pay) disturbance
				compensation to the following persons at the following amounts and schedule of payments:
			</div>

			<table className="w-full border-collapse text-[9pt]">
				<thead>
					<tr>
						<th className="border border-black px-2 py-1 text-left">NAME</th>
						<th className="border border-black px-2 py-1 text-left">Amount</th>
						<th className="border border-black px-2 py-1 text-left">Payment Due</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row, i) => (
						<tr key={i}>
							<td className="border border-black px-2 py-1">{row.name || " "}</td>
							<td className="border border-black px-2 py-1">{row.amount || " "}</td>
							<td className="border border-black px-2 py-1">{row.paymentDue || " "}</td>
						</tr>
					))}
				</tbody>
			</table>

			<div className="h-6" />

			<div className="space-y-3 text-justify">
				<p>
					<span className="font-bold">6.</span> I/we erected{" "}
					<span className="underline">{b(data.billboardCount, "_______")}</span> (number) of
					billboard(s) and undertake not to remove, deface, nor destroy said billboard(s), and that
					I/we shall repair or replace the same when damaged, until after the approving authority
					disposes of the application with finality.
				</p>
				<p>
					<span className="font-bold">7.</span> I/we have not commenced any action or filed any
					claim involving the land subject of my/our application for conversion in any court,
					tribunal or quasi-judicial agency. To the best of my/our knowledge, no such other action
					or claim is pending therein. I/we have knowledge of any controversy or proceeding
					involving the said parcel of land(s) or the rights of person over its possession and
					entitlement to its fruits or rights thereto as beneficiary, the determination of which is
					filed before any tribunal, court, the DAR or any other agency.
				</p>
				<p>
					<span className="font-bold">8.</span> With this instrument, I/we authorize the DAR to
					forfeit the bond in paragraph "3" of this affidavit the moment the DAR finds, upon proper
					notice, that there is development within the area, undertaken either before or after the
					filing of the present conversion application that is related to any non-agricultural use
					before the issuance of a conversion order.
				</p>
			</div>

			<div className="h-5" />

			<p className="mb-6">
				IN WITNESS WHEREOF, we hereunto affix our signatures on the date and in the place indicated
				below.
			</p>

			<div className="mb-8 flex justify-end">
				<div className="w-[220px] text-[9pt]">
					<div className="mb-1 border-b border-black" />
					<div>LANDOWNER/APPLICANT</div>
					<div>
						TIN: <span className="underline">{b(data.applicantTin, "__________________")}</span>
					</div>
					<div>
						CTC No.: <span className="underline">{b(data.applicantCtcNo, "______________")}</span>
					</div>
					<div>
						Place: <span className="underline">{b(data.applicantPlace, "________________")}</span>
					</div>
					<div>
						Date: <span className="underline">{b(data.applicantDate, "_________________")}</span>
					</div>
				</div>
			</div>

			<div className="text-[9pt] leading-relaxed">
				<div>REPUBLIC OF THE PHILIPPINES)</div>
				<div>
					<span className="underline">
						{b(data.subscribedPlace, "____________________________")}
					</span>
					) S.S.
				</div>
				<div className="h-4" />
				<div>
					SUBSCRIBED AND SWORN TO BEFORE ME, this day of{" "}
					<span className="underline">{b(data.subscribedDay, "____________")}</span> in
				</div>
				<div>
					<span className="underline">{b(data.subscribedPlace, "________________")}</span>, affiant
					exhibiting to me his/her Community Tax Certificate No. issued on
				</div>
				<div>
					<span className="underline">{b(data.ctcIssuedOn, "________________")}</span> 20
					<span className="underline">{b(data.ctcIssuedYear, "____")}</span> at{" "}
					<span className="underline">{b(data.ctcIssuedAt, "__________________________")}</span>.
				</div>
			</div>
		</div>
	)
}

export function AffidavitOfUndertakingEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<AffidavitOfUndertakingData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultAffidavitOfUndertaking,
						...(JSON.parse(saved) as Partial<AffidavitOfUndertakingData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultAffidavitOfUndertaking
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: UndertakingFieldKey) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const setPersonsMode = (mode: "none" | "with-persons") =>
		setData(prev => ({ ...prev, personsMode: mode }))

	const setPersonName = (index: number) => (value: string) =>
		setData(prev => ({
			...prev,
			personNames: prev.personNames.map((name, i) => (i === index ? value : name)),
		}))

	const addPersonLine = () => setData(prev => ({ ...prev, personNames: [...prev.personNames, ""] }))

	const removePersonLine = (index: number) =>
		setData(prev => ({
			...prev,
			personNames:
				prev.personNames.length > 1
					? prev.personNames.filter((_, i) => i !== index)
					: prev.personNames,
		}))

	const setPaymentRow = (index: number, key: keyof UndertakingPaymentRow) => (value: string) =>
		setData(prev => ({
			...prev,
			paymentRows: prev.paymentRows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
		}))

	const addPaymentRow = () =>
		setData(prev => ({
			...prev,
			paymentRows: [...prev.paymentRows, { name: "", amount: "", paymentDue: "" }],
		}))

	const removePaymentRow = (index: number) =>
		setData(prev => ({
			...prev,
			paymentRows:
				prev.paymentRows.length > 1
					? prev.paymentRows.filter((_, i) => i !== index)
					: prev.paymentRows,
		}))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportAffidavitOfUndertaking(data)
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
				<div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Venue
						</p>
						<div className="space-y-3">
							<Field
								label="Municipality"
								id="municipality"
								value={data.municipality}
								onChange={set("municipality")}
								placeholder="e.g. San Jose"
							/>
							<Field
								label="Province"
								id="province"
								value={data.province}
								onChange={set("province")}
								placeholder="e.g. Batangas"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Affiant
						</p>
						<div className="space-y-3">
							<Field
								label="Full Name"
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
								placeholder="e.g. 45"
							/>
							<Field
								label="Citizenship"
								id="citizenship"
								value={data.citizenship}
								onChange={set("citizenship")}
								placeholder="e.g. Filipino"
							/>
							<Field
								label="Civil Status"
								id="civilStatus"
								value={data.civilStatus}
								onChange={set("civilStatus")}
								placeholder="single or married"
							/>
							<Field
								label="Spouse Name (if married)"
								id="spouseName"
								value={data.spouseName}
								onChange={set("spouseName")}
								placeholder="Spouse full name"
							/>
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

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Application Details
						</p>
						<div className="space-y-3">
							<Field
								label="No. of Parcels"
								id="parcelCount"
								value={data.parcelCount}
								onChange={set("parcelCount")}
								placeholder="e.g. 1"
							/>
						</div>
					</div>

					<Separator />

					<div>
						<div className="mb-3 flex items-center justify-between gap-3">
							<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
								Item 4 - Occupants
							</p>
							<Button
								variant="outline"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={addPersonLine}
							>
								+ Add Line
							</Button>
						</div>

						<div className="mb-3 flex gap-2">
							<Button
								type="button"
								variant={data.personsMode === "none" ? "default" : "outline"}
								size="sm"
								onClick={() => setPersonsMode("none")}
							>
								None
							</Button>
							<Button
								type="button"
								variant={data.personsMode === "with-persons" ? "default" : "outline"}
								size="sm"
								onClick={() => setPersonsMode("with-persons")}
							>
								With Persons
							</Button>
						</div>

						<Field
							label="Persons Count"
							id="personsCount"
							value={data.personsCount}
							onChange={set("personsCount")}
							placeholder="e.g. 12"
						/>

						<div className="mt-3 space-y-2">
							{data.personNames.map((name, index) => (
								<div key={index} className="flex items-end gap-2">
									<div className="flex-1">
										<Field
											label={`Line ${index + 1}`}
											id={`personName${index}`}
											value={name}
											onChange={setPersonName(index)}
											placeholder="Person name"
										/>
									</div>
									{data.personNames.length > 1 && (
										<Button
											type="button"
											size="sm"
											variant="outline"
											onClick={() => removePersonLine(index)}
										>
											Remove
										</Button>
									)}
								</div>
							))}
						</div>
					</div>

					<Separator />

					<div>
						<div className="mb-3 flex items-center justify-between gap-3">
							<p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
								Item 5 - Payment Schedule
							</p>
							<Button
								variant="outline"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={addPaymentRow}
							>
								+ Add Row
							</Button>
						</div>

						<div className="space-y-3">
							{data.paymentRows.map((row, index) => (
								<div key={index} className="space-y-2 rounded-md border p-3">
									<div className="flex items-center justify-between">
										<span className="text-muted-foreground text-xs font-medium">
											Row {index + 1}
										</span>
										{data.paymentRows.length > 1 && (
											<button
												type="button"
												onClick={() => removePaymentRow(index)}
												className="text-destructive text-xs hover:underline"
											>
												Remove
											</button>
										)}
									</div>
									<Field
										label="Name"
										id={`payName${index}`}
										value={row.name}
										onChange={setPaymentRow(index, "name")}
										placeholder="Person name"
									/>
									<Field
										label="Amount"
										id={`payAmount${index}`}
										value={row.amount}
										onChange={setPaymentRow(index, "amount")}
										placeholder="e.g. PHP 10,000"
									/>
									<Field
										label="Payment Due"
										id={`payDue${index}`}
										value={row.paymentDue}
										onChange={setPaymentRow(index, "paymentDue")}
										placeholder="e.g. July 30, 2026"
									/>
								</div>
							))}
						</div>
					</div>

					<Separator />

					<div>
						<p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">
							Items 6 to 8 / Signing
						</p>
						<div className="space-y-3">
							<Field
								label="No. of Billboards (Item 6)"
								id="billboardCount"
								value={data.billboardCount}
								onChange={set("billboardCount")}
								placeholder="e.g. 2"
							/>
							<Field
								label="Applicant TIN"
								id="applicantTin"
								value={data.applicantTin}
								onChange={set("applicantTin")}
								placeholder="TIN"
							/>
							<Field
								label="Applicant CTC No."
								id="applicantCtcNo"
								value={data.applicantCtcNo}
								onChange={set("applicantCtcNo")}
								placeholder="CTC Number"
							/>
							<Field
								label="Applicant Place"
								id="applicantPlace"
								value={data.applicantPlace}
								onChange={set("applicantPlace")}
								placeholder="Place"
							/>
							<Field
								label="Applicant Date"
								id="applicantDate"
								value={data.applicantDate}
								onChange={set("applicantDate")}
								placeholder="Date"
							/>
							<Field
								label="Subscribed Day"
								id="subscribedDay"
								value={data.subscribedDay}
								onChange={set("subscribedDay")}
								placeholder="e.g. June 12"
							/>
							<Field
								label="Subscribed Place"
								id="subscribedPlace"
								value={data.subscribedPlace}
								onChange={set("subscribedPlace")}
								placeholder="e.g. Manila"
							/>
							<Field
								label="CTC Issued On"
								id="ctcIssuedOn"
								value={data.ctcIssuedOn}
								onChange={set("ctcIssuedOn")}
								placeholder="e.g. Jan 1"
							/>
							<Field
								label="CTC Issued Year (20__)"
								id="ctcIssuedYear"
								value={data.ctcIssuedYear}
								onChange={set("ctcIssuedYear")}
								placeholder="e.g. 26"
							/>
							<Field
								label="CTC Issued At"
								id="ctcIssuedAt"
								value={data.ctcIssuedAt}
								onChange={set("ctcIssuedAt")}
								placeholder="Place of issue"
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

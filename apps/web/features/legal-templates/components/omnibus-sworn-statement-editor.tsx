"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Checkbox } from "@/core/components/ui/checkbox"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportOmnibusSwornStatement } from "@/features/legal-templates/lib/pdf-export"
import {
	type OmnibusSwornStatementData,
	defaultOmnibusSwornStatement,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:omnibus-sworn-statement"

type FieldKey = keyof OmnibusSwornStatementData

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

function DocumentPreview({ data }: { data: OmnibusSwornStatementData }) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)
	const u = (value: string, fallback = "_____________") => (
		<span className="underline">{b(value, fallback)}</span>
	)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-24 py-24 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<h1 className="mb-8 text-[22pt] font-bold">Omnibus Sworn Statement</h1>

			<p>REPUBLIC OF THE PHILIPPINES )</p>
			<p className="mb-5">CITY/MUNICIPALITY OF {u(data.cityMunicipality, "_______")} ) S.S.</p>

			<p className="mb-4 font-bold">AFFIDAVIT</p>

			<p className="mb-5 text-justify">
				I, {u(data.affiantName, "Name of Affiant")}, of legal age, {u(data.civilStatus, "Civil Status")}, {u(data.nationality, "Nationality")}, and residing at {u(data.affiantAddress, "Address of Affiant")}, after having been duly sworn in accordance with law, do hereby depose and state that:
			</p>

			<ol className="list-decimal pl-6 space-y-4 text-justify">
				<li>
					Select one, delete the other:
					<div className="mt-2 space-y-2 pl-4">
						{data.showClause1SoleProprietorship ? (
							<p><em>If a sole proprietorship:</em> I am the sole proprietor of {u(data.bidderName, "Name of Bidder")} with office address at {u(data.bidderAddress, "Address of Bidder")};</p>
						) : null}
						{data.showClause1Entity ? (
							<p><em>If a partnership, corporation, cooperative, or joint venture:</em> I am the duly authorized and designated representative of {u(data.bidderName, "Name of Bidder")} with office address at {u(data.bidderAddress, "Address of Bidder")};</p>
						) : null}
					</div>
				</li>
				<li>
					Select one, delete the other:
					<div className="mt-2 space-y-2 pl-4">
						{data.showClause2SoleProprietorship ? (
							<p><em>If a sole proprietorship:</em> As the owner and sole proprietor of {u(data.bidderName, "Name of Bidder")}, I have full power and authority to represent it in the bidding for {u(data.projectName, "Name of the Project")} of {u(data.procuringEntity, "Name of the Procuring Entity")};</p>
						) : null}
						{data.showClause2Entity ? (
							<p><em>If a partnership, corporation, cooperative, or joint venture:</em> I am granted full power and authority to represent {u(data.bidderName, "Name of Bidder")} in the bidding as shown in the attached authority document;</p>
						) : null}
					</div>
				</li>
				<li>
					{u(data.bidderName, "Name of Bidder")} is not blacklisted or barred from bidding by the Government of the Philippines or any agency, office, corporation, or local government unit.
				</li>
				<li>
					Each of the documents submitted in satisfaction of the bidding requirements is an authentic copy of the original, complete, and all statements and information provided therein are true and correct;
				</li>
				<li>
					{u(data.bidderName, "Name of Bidder")} is authorizing the Head of the Procuring Entity or its duly authorized representative(s) to verify all the documents submitted;
				</li>
				<li>
					Select one, delete the rest:
					<div className="mt-2 space-y-2 pl-4">
						{data.showClause6SoleProprietorship ? (
							<p><em>If a sole proprietorship:</em> I am not related to the Head of the Procuring Entity, members of the BAC, the Technical Working Group, and the BAC Secretariat, by consanguinity or affinity up to the third civil degree;</p>
						) : null}
						{data.showClause6Partnership ? (
							<p><em>If a partnership or cooperative:</em> None of the officers and members of {u(data.bidderName, "Name of Bidder")} is related to the Head of the Procuring Entity, members of the BAC, the Technical Working Group, and the BAC Secretariat, by consanguinity or affinity up to the third civil degree;</p>
						) : null}
						{data.showClause6Corporation ? (
							<p><em>If a corporation or joint venture:</em> None of the officers, directors, and controlling stockholders of {u(data.bidderName, "Name of Bidder")} is related to the Head of the Procuring Entity, members of the BAC, the Technical Working Group, and the BAC Secretariat, by consanguinity or affinity up to the third civil degree;</p>
						) : null}
					</div>
				</li>
				<li>
					{u(data.bidderName, "Name of Bidder")} complies with existing labor laws and standards; and
				</li>
				<li>
					{u(data.bidderName, "Name of Bidder")} is aware of and has undertaken the following responsibilities as a Bidder:
					<ol className="mt-2 list-decimal pl-6 space-y-1">
						<li>Carefully examine all of the Bidding Documents;</li>
						<li>Acknowledge all conditions, local or otherwise, affecting the implementation of the Contract;</li>
						<li>Made an estimate of the facilities available and needed for the contract to be bid, if any; and</li>
						<li>Inquire or secure Supplemental/Bid Bulletin(s) issued for the {u(data.projectName, "Name of the Project")}.</li>
					</ol>
				</li>
			</ol>

			<p className="mt-12 mb-10 text-justify">
				IN WITNESS WHEREOF, I have hereunto set my hand this {u(data.witnessDay, "__")} day of {u(data.witnessMonth, "____")}, 20{u(data.witnessYear, "__")} at {u(data.witnessPlace, "____________")}, Philippines.
			</p>

			<div className="mt-10 flex justify-end">
				<div className="w-72 text-center">
					<div className="border-b border-black" />
					<div>{u(data.authorizedSignatory, "Bidder's Representative/Authorized Signatory")}</div>
				</div>
			</div>
		</div>
	)
}

export function OmnibusSwornStatementEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<OmnibusSwornStatementData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					const parsed = JSON.parse(saved) as Partial<OmnibusSwornStatementData>
					return {
						...defaultOmnibusSwornStatement,
						...parsed,
						showClause1SoleProprietorship: Boolean(parsed.showClause1SoleProprietorship ?? defaultOmnibusSwornStatement.showClause1SoleProprietorship),
						showClause1Entity: Boolean(parsed.showClause1Entity ?? defaultOmnibusSwornStatement.showClause1Entity),
						showClause2SoleProprietorship: Boolean(parsed.showClause2SoleProprietorship ?? defaultOmnibusSwornStatement.showClause2SoleProprietorship),
						showClause2Entity: Boolean(parsed.showClause2Entity ?? defaultOmnibusSwornStatement.showClause2Entity),
						showClause6SoleProprietorship: Boolean(parsed.showClause6SoleProprietorship ?? defaultOmnibusSwornStatement.showClause6SoleProprietorship),
						showClause6Partnership: Boolean(parsed.showClause6Partnership ?? defaultOmnibusSwornStatement.showClause6Partnership),
						showClause6Corporation: Boolean(parsed.showClause6Corporation ?? defaultOmnibusSwornStatement.showClause6Corporation),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultOmnibusSwornStatement
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: FieldKey) => (value: string) => setData(prev => ({ ...prev, [key]: value }))
	const setToggle = (
		key:
			| "showClause1SoleProprietorship"
			| "showClause1Entity"
			| "showClause2SoleProprietorship"
			| "showClause2Entity"
			| "showClause6SoleProprietorship"
			| "showClause6Partnership"
			| "showClause6Corporation"
	) => (checked: boolean) => setData(prev => ({ ...prev, [key]: checked }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportOmnibusSwornStatement(data)
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
						<Field label="City / Municipality" id="cityMunicipality" value={data.cityMunicipality} onChange={set("cityMunicipality")} />
						<Field label="Affiant Name" id="affiantName" value={data.affiantName} onChange={set("affiantName")} />
						<Field label="Civil Status" id="civilStatus" value={data.civilStatus} onChange={set("civilStatus")} />
						<Field label="Nationality" id="nationality" value={data.nationality} onChange={set("nationality")} />
						<Field label="Affiant Address" id="affiantAddress" value={data.affiantAddress} onChange={set("affiantAddress")} multiline />
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Bidder Name" id="bidderName" value={data.bidderName} onChange={set("bidderName")} />
						<Field label="Bidder Address" id="bidderAddress" value={data.bidderAddress} onChange={set("bidderAddress")} multiline />
						<Field label="Project Name" id="projectName" value={data.projectName} onChange={set("projectName")} />
						<Field label="Procuring Entity" id="procuringEntity" value={data.procuringEntity} onChange={set("procuringEntity")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clause Options Visibility</p>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause1SoleProprietorship)} onCheckedChange={v => setToggle("showClause1SoleProprietorship")(v === true)} /><span>Show Clause 1 - Sole Proprietorship</span></label>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause1Entity)} onCheckedChange={v => setToggle("showClause1Entity")(v === true)} /><span>Show Clause 1 - Partnership/Corporation</span></label>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause2SoleProprietorship)} onCheckedChange={v => setToggle("showClause2SoleProprietorship")(v === true)} /><span>Show Clause 2 - Sole Proprietorship</span></label>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause2Entity)} onCheckedChange={v => setToggle("showClause2Entity")(v === true)} /><span>Show Clause 2 - Partnership/Corporation</span></label>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause6SoleProprietorship)} onCheckedChange={v => setToggle("showClause6SoleProprietorship")(v === true)} /><span>Show Clause 6 - Sole Proprietorship</span></label>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause6Partnership)} onCheckedChange={v => setToggle("showClause6Partnership")(v === true)} /><span>Show Clause 6 - Partnership/Cooperative</span></label>
						<label className="flex items-center gap-2 text-sm"><Checkbox checked={Boolean(data.showClause6Corporation)} onCheckedChange={v => setToggle("showClause6Corporation")(v === true)} /><span>Show Clause 6 - Corporation/Joint Venture</span></label>
					</div>

					<Separator />

					<div className="space-y-3">
						<Field label="Witness Day" id="witnessDay" value={data.witnessDay} onChange={set("witnessDay")} />
						<Field label="Witness Month" id="witnessMonth" value={data.witnessMonth} onChange={set("witnessMonth")} />
						<Field label="Witness Year (20__)" id="witnessYear" value={data.witnessYear} onChange={set("witnessYear")} />
						<Field label="Witness Place" id="witnessPlace" value={data.witnessPlace} onChange={set("witnessPlace")} />
						<Field label="Authorized Signatory Label" id="authorizedSignatory" value={data.authorizedSignatory} onChange={set("authorizedSignatory")} />
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

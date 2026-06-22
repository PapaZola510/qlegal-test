"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportSpecialPowerOfAttorney } from "@/features/legal-templates/lib/pdf-export"
import {
	type SpecialPowerOfAttorneyData,
	defaultSpecialPowerOfAttorney,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:special-power-of-attorney"

type FieldKey = keyof SpecialPowerOfAttorneyData

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

function DocumentPreview({ data }: { data: SpecialPowerOfAttorneyData }) {
	const b = (v: string | undefined, fb = "_____________") => blank(v, fb)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-24 py-24 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-6 text-center font-bold">SPECIAL POWER OF ATTORNEY</div>

			<p className="mb-4">KNOW ALL MEN BY THESE PRESENTS:</p>

			<p className="mb-4 text-justify">
				WE, {b(data.principalName)}, {data.principalMaritalStatus}, of legal age, with residence and postal address at {b(data.principalResidence)}, {b(data.principalPostalAddress)}, do hereby APPOINT our true and legal representative to act for and in our name and stead and to perform the following acts:
			</p>

			<p className="mb-4 text-justify">
				1. To ask for sale, and come to an agreement with the prospective buyer and therefor and therefor to receive payment from the sale of our property more particularly described as follows: {b(data.propertyDescription)}
			</p>

			<p className="mb-4 text-justify">
				HEREBY GRANTING unto our representative full power and authority to execute and perform every act necessary to render effective the power to {b(data.powersGranted)}, as though we ourselves, have so performed, and HEREBY APPROVING ALL that he may do by virtue hereof with full right of substitution of his person and revocation of this instrument.
			</p>

			<p className="mb-6 text-justify">
				IN WITNESS WHEREOF, WE HAVE HEREUNTO SET OUR HANDS THIS {b(data.executionDay)} DAY OF {b(data.executionMonth).toUpperCase()}, 20{b(data.executionYear)} AT {b(data.executionPlace).toUpperCase()}.
			</p>

			<div className="grid grid-cols-2 gap-12 mb-6">
				<div>
					<div className="mb-2">___________________________</div>
					<div>{b(data.principalName)}</div>
					<div>(Name of Principal)</div>
				</div>
			</div>

			<p className="mb-4">___________________________</p>
			<p className="mb-4">{b(data.agentName)}</p>
			<p className="mb-6">(Name of Agent/Attorney-in-Fact)</p>

			<div className="border-t-2 border-black pt-4">
				<div className="text-center font-bold mb-2">Republic of the Philippines</div>
				<div className="text-center mb-4">{b(data.cityProvince)}</div>
				<div className="mb-4">BEFORE ME, personally appeared:</div>

				<div className="mb-4">
					<div className="mb-2">Name                          CTC Number                    Date/Place Issued</div>
				</div>

				<p className="text-justify mb-4">
					Known to me and to me known to be the same persons who executed the foregoing instrument and acknowledged to me that the same is their free and voluntary act and deed.
				</p>

				<p className="text-justify">
					WITNESS MY HAND AND SEAL, on the date and place first above written.
				</p>

				<div className="mt-6 mb-2">{b(data.notaryName)}</div>
				<div className="mb-4">Notary Public for {b(data.cityProvince)}</div>
				<div>Notarial Commission No. {b(data.notaryCommissionNo)}</div>
				<div>Until {b(data.notaryCommissionValidUntil)}</div>
				<div>Roll of Attorneys No. {b(data.rollOfAttorneysNo)}</div>
				<div>IBP No. {b(data.ibpNo)} / {b(data.ibpDateChapter)}</div>
				<div>PTR No. {b(data.ptrNo)} / {b(data.ptrDateLocation)}</div>
				<div>MCLE Compliance No. {b(data.mcleNo)} / {b(data.mcleDate)}</div>
			</div>
		</div>
	)
}

export function SpecialPowerOfAttorneyEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<SpecialPowerOfAttorneyData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultSpecialPowerOfAttorney,
						...(JSON.parse(saved) as Partial<SpecialPowerOfAttorneyData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultSpecialPowerOfAttorney
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: FieldKey) => (value: string) => {
		setData(prev => {
			const updated = { ...prev, [key]: value }
			if (typeof window !== "undefined") {
				localStorage.setItem(DRAFT_KEY, JSON.stringify(updated))
			}
			return updated
		})
	}

	const handleSave = () => {
		if (typeof window !== "undefined") {
			localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		}
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportSpecialPowerOfAttorney(data)
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
				<div className="space-y-3">
					<div className="font-semibold">Principal Information</div>
					<Field label="Principal Name" id="principalName" value={data.principalName} onChange={set("principalName")} />
					<Field label="Age" id="principalAge" value={data.principalAge} onChange={set("principalAge")} />
					<Field label="Residence" id="principalResidence" value={data.principalResidence} onChange={set("principalResidence")} />
					<Field label="Postal Address" id="principalPostalAddress" value={data.principalPostalAddress} onChange={set("principalPostalAddress")} />
					<Field label="Marital Status" id="principalMaritalStatus" value={data.principalMaritalStatus} onChange={set("principalMaritalStatus")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Agent/Attorney-in-Fact Information</div>
					<Field label="Agent Name" id="agentName" value={data.agentName} onChange={set("agentName")} />
					<Field label="Agent Postal Address" id="agentPostalAddress" value={data.agentPostalAddress} onChange={set("agentPostalAddress")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Powers & Purpose</div>
					<Field label="Powers Granted" id="powersGranted" value={data.powersGranted} onChange={set("powersGranted")} multiline />
					<Field label="Property Description" id="propertyDescription" value={data.propertyDescription} onChange={set("propertyDescription")} multiline />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Execution Details</div>
					<Field label="Execution Day" id="executionDay" value={data.executionDay} onChange={set("executionDay")} />
					<Field label="Execution Month" id="executionMonth" value={data.executionMonth} onChange={set("executionMonth")} />
					<Field label="Execution Year" id="executionYear" value={data.executionYear} onChange={set("executionYear")} />
					<Field label="Execution Place" id="executionPlace" value={data.executionPlace} onChange={set("executionPlace")} />
					<Field label="City/Province" id="cityProvince" value={data.cityProvince} onChange={set("cityProvince")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Notary Information</div>
					<Field label="Notary Name" id="notaryName" value={data.notaryName} onChange={set("notaryName")} />
					<Field label="Commission Number" id="notaryCommissionNo" value={data.notaryCommissionNo} onChange={set("notaryCommissionNo")} />
					<Field label="Commission Valid Until" id="notaryCommissionValidUntil" value={data.notaryCommissionValidUntil} onChange={set("notaryCommissionValidUntil")} />
					<Field label="Roll of Attorneys No." id="rollOfAttorneysNo" value={data.rollOfAttorneysNo} onChange={set("rollOfAttorneysNo")} />
					<Field label="IBP No." id="ibpNo" value={data.ibpNo} onChange={set("ibpNo")} />
					<Field label="IBP Date/Chapter" id="ibpDateChapter" value={data.ibpDateChapter} onChange={set("ibpDateChapter")} />
					<Field label="PTR No." id="ptrNo" value={data.ptrNo} onChange={set("ptrNo")} />
					<Field label="PTR Date/Location" id="ptrDateLocation" value={data.ptrDateLocation} onChange={set("ptrDateLocation")} />
					<Field label="MCLE No." id="mcleNo" value={data.mcleNo} onChange={set("mcleNo")} />
					<Field label="MCLE Date" id="mcleDate" value={data.mcleDate} onChange={set("mcleDate")} />
				</div>

				</div>

				<div className="flex-1 overflow-y-auto border-l">
					<div
						className="bg-gray-100 p-4 inline-block origin-top-left"
						style={{ transform: "scale(0.68)", transformOrigin: "top left", marginRight: "-32%" }}
					>
						<DocumentPreview data={data} />
					</div>
				</div>
			</div>
		</div>
	)
}

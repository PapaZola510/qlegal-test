"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportDeedOfDonation } from "@/features/legal-templates/lib/pdf-export"
import {
	type DeedOfDonationData,
	defaultDeedOfDonation,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:deed-of-donation"

type FieldKey = keyof DeedOfDonationData

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

function DocumentPreview({ data }: { data: DeedOfDonationData }) {
	const b = (v: string | undefined, fb = "_____________") => blank(v, fb)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-24 py-24 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-6 text-center font-bold">DEED OF DONATION</div>

			<p className="mb-4">KNOW ALL MEN BY THESE PRESENTS:</p>

			<p className="mb-4 text-justify">
				This DEED OF DONATION, made and executed into by and among:
			</p>

			<p className="mb-4 text-justify">
				{b(data.donorName)}, (Name of Registered Owner/Donor) ({data.donorCivilStatus}) of legal age, Filipino, and residents of ({b(data.donorAddress)}) (address), hereinafter referred to as the DONOR;
			</p>

			<p className="mb-4 text-justify">
				- and -
			</p>

			<p className="mb-4 text-justify">
				{b(data.doneeeName)}, (Name of DONEE) ({data.doneneCivilStatus}) of legal age, Filipino, and residents of ({b(data.doneeAddress)}) (address), hereinafter referred to as the DONEE;
			</p>

			<p className="mb-6 font-bold text-justify">WITNESSETH: THAT</p>

			<p className="mb-4 text-justify">
				The DONOR is the registered owner of a parcel of land located in {b(data.propertyLocation)}, more particularly described as follows:
			</p>

			<p className="mb-4 text-justify">
				TCT No. {b(data.propertyTCT)}
			</p>

			<p className="mb-4 text-justify">
				{b(data.technicalDescription)}
			</p>

			<p className="mb-4 text-justify">
				For and in consideration of the love and affection which the DONOR has for the DONEE who is {b(data.donationPurpose)}, said DONOR by these presents does hereby RECEIVE AND ACCEPT the gift and donation made in his favor by the DONOR, who is (relationship to Donor) and hereby express his appreciation and gratitude for the kindness and generosity of the DONOR.
			</p>

			<p className="mb-6 text-justify">
				IN WITNESS WHEREOF, the parties to this Deed of Donation have hereunto set their hand on {b(data.executionDay)} in {b(data.executionPlace)}.
			</p>

			<div className="grid grid-cols-2 gap-12 mb-6">
				<div>
					<div className="mb-2">___________________________</div>
					<div>{b(data.donorName)}</div>
					<div>Donor</div>
				</div>
				<div>
					<div className="mb-2">___________________________</div>
					<div>{b(data.doneeeName)}</div>
					<div>Donee</div>
				</div>
			</div>

			<div className="mb-6">
				<div className="mb-2">Signed in the presence of:</div>
				<div className="grid grid-cols-2 gap-12">
					<div>
						<div className="mb-2">___________________________</div>
						<div>{b(data.witness1Name)}</div>
						<div>Witness</div>
					</div>
					<div>
						<div className="mb-2">___________________________</div>
						<div>{b(data.witness2Name)}</div>
						<div>Witness</div>
					</div>
				</div>
			</div>

			<div className="border-t-2 border-black pt-4">
				<div className="text-center font-bold mb-2">ACKNOWLEDGMENT</div>
				<div className="text-center mb-4">(REPUBLIC OF THE PHILIPPINES)</div>
				<div className="text-center mb-4">{b(data.propertyCityProvince)} ) SS.</div>
				<div className="text-justify mb-4">
					BEFORE ME, a Notary Public for and in {b(data.executionCity)} on {b(data.executionDay)} personally appeared the following:
				</div>

				<div className="mb-4">
					<div className="mb-2">Name                          Government ID                    Date/Place Issued</div>
				</div>

				<p className="text-justify mb-4">
					all known to me and to me known to be the same persons who executed the foregoing instrument and they acknowledged to me that the same is their free and voluntary act and deed. This instrument, consisting of __________ page/s, including the page on which this acknowledgment is written, signed by the parties and their instrumental witnesses and sealed with my notarial seal. IN WITNESS WHEREOF, I have hereunto set my hand the day, year and place above written.
				</p>

				<div className="mt-6 mb-2">{b(data.notaryName)}</div>
				<div className="mb-4">Notary Public for {b(data.propertyCityProvince)}</div>
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

export function DeedOfDonationEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<DeedOfDonationData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultDeedOfDonation,
						...(JSON.parse(saved) as Partial<DeedOfDonationData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultDeedOfDonation
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
			await exportDeedOfDonation(data)
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
					<div className="font-semibold">Donor Information</div>
					<Field label="Donor Name" id="donorName" value={data.donorName} onChange={set("donorName")} />
					<Field label="Donor Address" id="donorAddress" value={data.donorAddress} onChange={set("donorAddress")} />
					<Field label="Donor Civil Status" id="donorCivilStatus" value={data.donorCivilStatus} onChange={set("donorCivilStatus")} />
					<Field label="Donor TCT" id="donorTCT" value={data.donorTCT} onChange={set("donorTCT")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Donee Information</div>
					<Field label="Donee Name" id="doneeeName" value={data.doneeeName} onChange={set("doneeeName")} />
					<Field label="Donee Address" id="doneeAddress" value={data.doneeAddress} onChange={set("doneeAddress")} />
					<Field label="Donee Civil Status" id="doneneCivilStatus" value={data.doneneCivilStatus} onChange={set("doneneCivilStatus")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Property Information</div>
					<Field label="Property Location" id="propertyLocation" value={data.propertyLocation} onChange={set("propertyLocation")} />
					<Field label="City/Province" id="propertyCityProvince" value={data.propertyCityProvince} onChange={set("propertyCityProvince")} />
					<Field label="TCT Number" id="propertyTCT" value={data.propertyTCT} onChange={set("propertyTCT")} />
					<Field label="Technical Description" id="technicalDescription" value={data.technicalDescription} onChange={set("technicalDescription")} multiline />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Donation Purpose</div>
					<Field label="Donation Purpose" id="donationPurpose" value={data.donationPurpose} onChange={set("donationPurpose")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Execution Details</div>
					<Field label="Execution Day" id="executionDay" value={data.executionDay} onChange={set("executionDay")} />
					<Field label="Execution Month" id="executionMonth" value={data.executionMonth} onChange={set("executionMonth")} />
					<Field label="Execution Year" id="executionYear" value={data.executionYear} onChange={set("executionYear")} />
					<Field label="Execution Place" id="executionPlace" value={data.executionPlace} onChange={set("executionPlace")} />
					<Field label="Execution City" id="executionCity" value={data.executionCity} onChange={set("executionCity")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Witness Information</div>
					<Field label="Witness 1 Name" id="witness1Name" value={data.witness1Name} onChange={set("witness1Name")} />
					<Field label="Witness 2 Name" id="witness2Name" value={data.witness2Name} onChange={set("witness2Name")} />
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

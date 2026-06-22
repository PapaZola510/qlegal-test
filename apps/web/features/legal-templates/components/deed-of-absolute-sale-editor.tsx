"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportDeedOfAbsoluteSale } from "@/features/legal-templates/lib/pdf-export"
import {
	type DeedOfAbsoluteSaleData,
	defaultDeedOfAbsoluteSale,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:deed-of-absolute-sale"

type FieldKey = keyof DeedOfAbsoluteSaleData

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

function DocumentPreview({ data }: { data: DeedOfAbsoluteSaleData }) {
	const b = (v: string | undefined, fb = "_____________") => blank(v, fb)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-24 py-24 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-6 text-center font-bold">DEED OF ABSOLUTE SALE</div>

			<p className="mb-4 text-justify">
				KNOW ALL MEN BY THESE PRESENTS: This Deed of Absolute Sale is made and executed by: {b(data.sellerName)}, {b(data.sellerAge)} years of legal age, {data.sellerMaritalStatus}, Filipino, and residing at {b(data.sellerAddress)} (hereinafter referred to as the SELLER); AND - {b(data.buyerName)}, {b(data.buyerAge)} years of legal age, {data.buyerMaritalStatus}, Filipino, and residing at {b(data.buyerAddress)} (hereinafter referred to as the BUYER).
			</p>

			<p className="mb-4 font-bold">WITNESSETH: That the SELLER is the registered owner of a certain parcel of land together with all the improvements found therein, as evidenced by Transfer Certificate of Title (TCT) No. {b(data.propertyTCT)} situated in {b(data.propertyLocation)}, Philippines, and more particularly described as follows, to wit: {b(data.propertyImprovements)}, situated in {b("")}, Bounded on the {b("")}, containing an area of {b(data.propertyArea)} {data.propertyAreaUnit} including all the existing improvements erected thereon.</p>

			<p className="mb-4 text-justify">
				That for and in consideration of the sum of {b(data.price)}, receipt in full is hereby acknowledged by the entire satisfaction. The SELLER/s do hereby SELL, TRANSFER and CONVEY, unto the said BUYER/s, their heirs and assigns, the above-described parcel of lot, with all the improvements found thereon. That the SELLER/s hereby warrants that the title over the land above described, with full right to dispose of the same, free from all liens and encumbrances, and that henceforth, full right of ownership and possession of the whole property shall pertain to the buyers.
			</p>

			<p className="mb-6 text-justify">
				IN WITNESS WHEREOF, I have hereunto signed this deed of absolute sale, this {b(data.transactionDay)} day of {b(data.transactionMonth)}, 20{b(data.transactionYear)} at {b(data.transactionPlace)}, {b(data.transactionCity)}.
			</p>

			<div className="mb-6">
				<div className="mb-2">{b(data.sellerName)}</div>
				<div className="mb-2">SELLER</div>
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
				<div className="text-center mb-4">___________________________SS. BEFORE ME, A Notary Public in the City of {b(data.transactionCity)}, this {b(data.transactionDay)} day of {b(data.transactionMonth)}, 20{b(data.transactionYear)}, personally appeared the following: Name Proof of Identity Date/Place Issued known to me to be the same persons who executed the foregoing instrument and they acknowledged to me that the same is their free and voluntary act and deed.</div>
				<p className="text-justify">
					IN WITNESS WHEREOF, I have hereunto set my hand the day, year and place above written.
				</p>
				<div className="mt-4 mb-2">{b(data.notaryName)}</div>
				<div className="mb-4">Notary Public for {b(data.transactionCity)}</div>
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

export function DeedOfAbsoluteSaleEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<DeedOfAbsoluteSaleData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultDeedOfAbsoluteSale,
						...(JSON.parse(saved) as Partial<DeedOfAbsoluteSaleData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultDeedOfAbsoluteSale
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
			await exportDeedOfAbsoluteSale(data)
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
					<div className="font-semibold">Seller Information</div>
					<Field label="Seller Name" id="sellerName" value={data.sellerName} onChange={set("sellerName")} />
					<Field label="Seller Age" id="sellerAge" value={data.sellerAge} onChange={set("sellerAge")} />
					<Field label="Seller Marital Status" id="sellerMaritalStatus" value={data.sellerMaritalStatus} onChange={set("sellerMaritalStatus")} />
					<Field label="Seller Address" id="sellerAddress" value={data.sellerAddress} onChange={set("sellerAddress")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Buyer Information</div>
					<Field label="Buyer Name" id="buyerName" value={data.buyerName} onChange={set("buyerName")} />
					<Field label="Buyer Age" id="buyerAge" value={data.buyerAge} onChange={set("buyerAge")} />
					<Field label="Buyer Marital Status" id="buyerMaritalStatus" value={data.buyerMaritalStatus} onChange={set("buyerMaritalStatus")} />
					<Field label="Buyer Address" id="buyerAddress" value={data.buyerAddress} onChange={set("buyerAddress")} />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Property Information</div>
					<Field label="TCT Number" id="propertyTCT" value={data.propertyTCT} onChange={set("propertyTCT")} />
					<Field label="Property Location" id="propertyLocation" value={data.propertyLocation} onChange={set("propertyLocation")} />
					<Field label="Area" id="propertyArea" value={data.propertyArea} onChange={set("propertyArea")} />
					<Field label="Area Unit" id="propertyAreaUnit" value={data.propertyAreaUnit} onChange={set("propertyAreaUnit")} />
					<Field label="Property Improvements" id="propertyImprovements" value={data.propertyImprovements} onChange={set("propertyImprovements")} multiline />
				</div>

				<Separator />

				<div className="space-y-3">
					<div className="font-semibold">Transaction Details</div>
					<Field label="Price/Consideration" id="price" value={data.price} onChange={set("price")} />
					<Field label="Transaction Day" id="transactionDay" value={data.transactionDay} onChange={set("transactionDay")} />
					<Field label="Transaction Month" id="transactionMonth" value={data.transactionMonth} onChange={set("transactionMonth")} />
					<Field label="Transaction Year" id="transactionYear" value={data.transactionYear} onChange={set("transactionYear")} />
					<Field label="Transaction Place" id="transactionPlace" value={data.transactionPlace} onChange={set("transactionPlace")} />
					<Field label="Transaction City" id="transactionCity" value={data.transactionCity} onChange={set("transactionCity")} />
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

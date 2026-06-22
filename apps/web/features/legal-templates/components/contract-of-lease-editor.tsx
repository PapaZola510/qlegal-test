"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { exportContractOfLease } from "@/features/legal-templates/lib/pdf-export"
import {
	type ContractOfLeaseData,
	defaultContractOfLease,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:contract-of-lease"

type FieldKey = keyof ContractOfLeaseData

function blank(value: string | undefined, fallback = "_____________") {
	return value && value.trim() ? value : fallback
}

function Field({
	label,
	id,
	value,
	onChange,
	placeholder,
}: {
	label: string
	id: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
}) {
	return (
		<div className="space-y-1.5">
			<Label htmlFor={id} className="text-xs font-medium">
				{label}
			</Label>
			<Input
				id={id}
				value={value}
				onChange={e => onChange(e.target.value)}
				placeholder={placeholder}
				className="h-8 text-sm"
			/>
		</div>
	)
}

function DocumentPreview({ data }: { data: ContractOfLeaseData }) {
	const b = (v: string | undefined, fb = "_____________") => blank(v, fb)

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-20 py-20 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-2">Republic of the Philippines) {b(data.city)} )</div>
			<div className="mb-10">s.s.</div>

			<div className="mb-8 text-center font-bold">CONTRACT OF LEASE</div>

			<p className="mb-6 text-center">KNOW ALL MEN BY THESE PRESENTS:</p>

			<p className="mb-4 text-justify">
				This CONTRACT OF LEASE, made and entered into this {b(data.contractDay, "___")} day of {b(data.contractMonth)}, {b(data.contractYear)} at the City of {b(data.contractCity)}, by and between: {b(data.lessorName)}, of legal age, {b(data.lessorCivilStatus)}, and residing at {b(data.lessorAddress)}, and hereinafter referred to as the LESSOR,
			</p>

			<p className="mb-4 text-center">-and-</p>

			<p className="mb-4 text-justify">
				{b(data.lesseeName)}, also of legal age, {b(data.lesseeCivilStatus)} and residing at {b(data.lesseeAddress)}, and hereinafter referred to as the LESSEE,
			</p>

			<p className="mb-4 text-center">WITNESSETH: That</p>

			<p className="mb-4 text-justify">
				WHEREAS, the LESSOR is the registered and absolute owner of a house and lot situated at {b(data.propertyAddress)};
			</p>
			<p className="mb-4 text-justify">
				WHEREAS, the LESSEE is willing to lease said property from the LESSOR under the following terms and conditions:
			</p>

			<ol className="mb-6 list-decimal pl-6 space-y-2 text-justify">
				<li>
					That the lease shall be for a period of one year from {b(data.leaseStartDate)} up to {b(data.leaseEndDate)};
				</li>
				<li>
					That the LESSEE shall pay a monthly rental of {b(data.monthlyRent)}, Philippine Currency, payable every {b(data.rentDueDay)} day of the month;
				</li>
				<li>
					That the LESSEE upon signing pays {b(data.depositAmount)} pesos, representing two (2) months deposit and one (1) month advance.
				</li>
				<li>
					That electric and water bills shall be for the account of the LESSEE.
				</li>
				<li>
					That the leased premises shall be devoted exclusively for residential purposes only.
				</li>
				<li>
					That all improvements introduced on the premises shall require prior consent of the LESSOR.
				</li>
				<li>
					That any expenses for repair arising from damage caused by the LESSEE shall be shouldered by the LESSEE.
				</li>
				<li>
					That the leased premises shall not be subleased to any other person or entity without written consent and approval of the LESSOR.
				</li>
				<li>
					That if said premises is not surrendered to the LESSOR at the expiration of the lease contract, the LESSEE shall be responsible to the LESSOR for all damages.
				</li>
				<li>
					That the LESSEE shall return the leased premises at expiration in as good condition as reasonable wear and tear will permit.
				</li>
				<li>
					That in case the LESSEE has arrears in rental payments and is unable to pay said arrears before vacating, the LESSOR may take possession of tenant property to offset arrears.
				</li>
				<li>
					That in case the leased premises is abandoned, vacated or deserted for one (1) week, the LESSOR may enter and repossess the premises without prejudice to legal action.
				</li>
				<li>
					That the LESSOR reserves the right to increase the rental rate by ten percent (10%) per year after one (1) year and the contract is renewed by mutual agreement.
				</li>
				<li>
					That the LESSEE is obliged to observe cleanliness and maintain peaceful condition inside and outside the premises.
				</li>
				<li>
					That the LESSEE warrants that all provisions of this contract were read and understood.
				</li>
			</ol>

			<p className="mb-8 text-justify">
				IN WITNESS WHEREOF, the parties have hereunto set their hands this {b(data.witnessDay, "___")} day of {b(data.witnessMonth)}, {b(data.witnessYear)} at the City of {b(data.witnessCity)}, Philippines.
			</p>

			<div className="mb-8 grid grid-cols-2 gap-12 text-center">
				<div>
					<div className="mb-2 border-b border-black pb-1">{b(data.lesseeSignatureName, "Signature of Lessee")}</div>
				</div>
				<div>
					<div className="mb-2 border-b border-black pb-1">{b(data.lessorSignatureName, "Signature of Lessor")}</div>
				</div>
			</div>

			<div className="mb-4 text-center">SIGNED IN THE PRESENCE OF:</div>
			<div className="mb-8 grid grid-cols-2 gap-12">
				<div className="border-b border-black pb-1 text-center">{b(data.witness1Name)}</div>
				<div className="border-b border-black pb-1 text-center">{b(data.witness2Name)}</div>
			</div>

			<div className="pt-4">
				<div className="mb-2">REPUBLIC OF THE PHILIPPINES)</div>
				<div className="mb-4">{b(data.notaryCity)} ) S.S.</div>
				<div className="mb-4 text-center font-semibold">ACKNOWLEDGEMENT</div>
				<p className="text-justify">
					BEFORE ME, a Notary Public for and in {b(data.notaryCity)}, this {b(data.ackDay, "___")} day of {b(data.ackMonth)}, 20{b(data.ackYear, "__")}, personally came and appeared {b(data.idPresentedBy)} showing a competent proof of identification: {b(data.idType)} {b(data.idNumber)} valid until {b(data.idValidUntil)}, known to me and to me known to be the same person who executed the foregoing instrument and acknowledged that the same is his free and voluntary act and deed.
				</p>
				<div className="mt-6">WITNESS MY HAND AND SEAL....................</div>
			</div>
		</div>
	)
}

export function ContractOfLeaseEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<ContractOfLeaseData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultContractOfLease,
						...(JSON.parse(saved) as Partial<ContractOfLeaseData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultContractOfLease
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
			await exportContractOfLease(data)
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
					{saved ? "Saved" : "Save Draft"}
				</Button>
				<Button size="sm" onClick={handleExport} disabled={exporting}>
					{exporting ? "Generating PDF..." : "Export PDF"}
				</Button>
			</div>

			<div className="flex gap-6" style={{ height: "calc(100vh - 140px)" }}>
				<div className="w-80 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<div className="font-semibold">Parties</div>
						<Field label="City (header)" id="city" value={data.city} onChange={set("city")} />
						<Field label="Lessor Name" id="lessorName" value={data.lessorName} onChange={set("lessorName")} />
						<Field label="Lessor Age" id="lessorAge" value={data.lessorAge} onChange={set("lessorAge")} />
						<Field label="Lessor Civil Status" id="lessorCivilStatus" value={data.lessorCivilStatus} onChange={set("lessorCivilStatus")} />
						<Field label="Lessor Address" id="lessorAddress" value={data.lessorAddress} onChange={set("lessorAddress")} />
						<Field label="Lessee Name" id="lesseeName" value={data.lesseeName} onChange={set("lesseeName")} />
						<Field label="Lessee Age" id="lesseeAge" value={data.lesseeAge} onChange={set("lesseeAge")} />
						<Field label="Lessee Civil Status" id="lesseeCivilStatus" value={data.lesseeCivilStatus} onChange={set("lesseeCivilStatus")} />
						<Field label="Lessee Address" id="lesseeAddress" value={data.lesseeAddress} onChange={set("lesseeAddress")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Lease Terms</div>
						<Field label="Contract Day" id="contractDay" value={data.contractDay} onChange={set("contractDay")} />
						<Field label="Contract Month" id="contractMonth" value={data.contractMonth} onChange={set("contractMonth")} />
						<Field label="Contract Year" id="contractYear" value={data.contractYear} onChange={set("contractYear")} />
						<Field label="Contract City" id="contractCity" value={data.contractCity} onChange={set("contractCity")} />
						<Field label="Property Address" id="propertyAddress" value={data.propertyAddress} onChange={set("propertyAddress")} />
						<Field label="Lease Start Date" id="leaseStartDate" value={data.leaseStartDate} onChange={set("leaseStartDate")} />
						<Field label="Lease End Date" id="leaseEndDate" value={data.leaseEndDate} onChange={set("leaseEndDate")} />
						<Field label="Monthly Rent" id="monthlyRent" value={data.monthlyRent} onChange={set("monthlyRent")} />
						<Field label="Rent Due Day" id="rentDueDay" value={data.rentDueDay} onChange={set("rentDueDay")} />
						<Field label="Deposit Amount" id="depositAmount" value={data.depositAmount} onChange={set("depositAmount")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Signatures and Witnesses</div>
						<Field label="Witness Day" id="witnessDay" value={data.witnessDay} onChange={set("witnessDay")} />
						<Field label="Witness Month" id="witnessMonth" value={data.witnessMonth} onChange={set("witnessMonth")} />
						<Field label="Witness Year" id="witnessYear" value={data.witnessYear} onChange={set("witnessYear")} />
						<Field label="Witness City" id="witnessCity" value={data.witnessCity} onChange={set("witnessCity")} />
						<Field label="Lessee Signature Label" id="lesseeSignatureName" value={data.lesseeSignatureName} onChange={set("lesseeSignatureName")} />
						<Field label="Lessor Signature Label" id="lessorSignatureName" value={data.lessorSignatureName} onChange={set("lessorSignatureName")} />
						<Field label="Witness 1 Name" id="witness1Name" value={data.witness1Name} onChange={set("witness1Name")} />
						<Field label="Witness 2 Name" id="witness2Name" value={data.witness2Name} onChange={set("witness2Name")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Acknowledgement</div>
						<Field label="Notary City" id="notaryCity" value={data.notaryCity} onChange={set("notaryCity")} />
						<Field label="Ack Day" id="ackDay" value={data.ackDay} onChange={set("ackDay")} />
						<Field label="Ack Month" id="ackMonth" value={data.ackMonth} onChange={set("ackMonth")} />
						<Field label="Ack Year (2 digits)" id="ackYear" value={data.ackYear} onChange={set("ackYear")} />
						<Field label="ID Presented By" id="idPresentedBy" value={data.idPresentedBy} onChange={set("idPresentedBy")} />
						<Field label="ID Type" id="idType" value={data.idType} onChange={set("idType")} />
						<Field label="ID Number" id="idNumber" value={data.idNumber} onChange={set("idNumber")} />
						<Field label="ID Valid Until" id="idValidUntil" value={data.idValidUntil} onChange={set("idValidUntil")} />
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

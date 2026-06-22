"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportRealEstateMortgage } from "@/features/legal-templates/lib/pdf-export"
import {
	type RealEstateMortgageData,
	defaultRealEstateMortgage,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:real-estate-mortgage"

type FieldKey = keyof RealEstateMortgageData

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

function DocumentPreview({ data }: { data: RealEstateMortgageData }) {
	const b = (v: string | undefined, fb = "_____________") => blank(v, fb)
	const line = "____________________________________________________________"

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[10pt] leading-relaxed px-20 py-20 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-6 text-center font-bold">REAL ESTATE MORTGAGE</div>

			<p className="mb-4">KNOW ALL MEN BY THESE PRESENTS:</p>
			<p className="mb-4 text-justify">
				This REAL ESTATE MORTGAGE (REM), made and executed in {b(data.executionPlace)},
				Philippines, by and between:
			</p>

			<div className="mb-1 text-center">{line}</div>
			<p className="mb-3 text-center text-[8pt]">
				(State the full name of the mortgagor/borrower if natural person; if juridical entity,
				state full name and authorized signatory)
			</p>
			<p className="mb-4 text-justify">
				{b(data.mortgagorName)}, of legal age, single/married to {b(data.mortgagorSpouseName)},
				Filipino/doing business within the Philippines, and with residence/principal address at
				{b(data.mortgagorAddress)}, hereinafter referred to as the MORTGAGOR/BORROWER,
			</p>
			<p className="mb-4 text-justify">
				(If the mortgagor/borrower has an authorized representative, a Special Power of
				Attorney/Board Resolution/Secretary's Certificate must be attached as Annex "____")
			</p>
			<p className="mb-4 text-justify">
				-and-
			</p>

			<div className="mb-1 text-center">{line}</div>
			<p className="mb-3 text-center text-[8pt]">
				(State the full name of the mortgagee/lender if natural person; if juridical entity,
				state full name and authorized signatory)
			</p>
			<p className="mb-4 text-justify">
				{b(data.mortgageeName)}, of legal age, single/married to {b(data.mortgageeSpouseName)},
				Filipino/doing business within the Philippines, and with residence/principal address at
				{b(data.mortgageeAddress)}, hereinafter referred to as the MORTGAGEE/LENDER,
			</p>
			<p className="mb-4 text-justify">
				(If the mortgagee/lender has an authorized representative, a Special Power of
				Attorney/Board Resolution/Secretary's Certificate must be attached as Annex "____")
			</p>

			<p className="mb-4 text-center font-bold">WITNESSETH THAT:</p>
			<p className="mb-4 text-justify">
				This agreement is entered into by the parties for the purpose of obtaining a loan in the
				sum of {b(data.loanAmountWords)} PESOS ({b(data.loanAmountFigures)}), Philippine currency,
				to be paid by the MORTGAGOR/BORROWER, who hereby by way of MORTGAGE, unto the said
				MORTGAGEE/LENDER, his/her/their heirs and assigns, that certain parcel of land, together
				with all buildings and improvements thereon, situated in {b(data.propertyLocation)},
				more particularly described as follows:
			</p>
			<p className="mb-2 text-center font-semibold">TCT NO. {b(data.propertyTctCctNo)}</p>
			<p className="mb-2 text-center text-[8pt]">
				(TECHNICAL DESCRIPTION OF THE PROPERTY - indicate Lot No., Block No., Plan No. for Land
				Properties/Unit Description for Condominium/Parking Units)
			</p>
			<p className="mb-4 whitespace-pre-line text-justify">
				{b(
					data.propertyDescription,
					`${line}\n${line}\n${line}\n${line}\n${line}\n${line}\n${line}\n${line}`
				)}
			</p>
			<p className="mb-4 text-justify">
				of which real property, the MORTGAGOR is the registered owner in accordance with the
				provisions of the Presidential Decree No. 1529 (PD 1529) or the Property Registration
				Decree, as evidenced by Original/Transfer/Condominium (OCT/TCT/CCT) No.
				{b(data.propertyTctCctNo)}, registered at the Register of Deeds of
				{b(data.registeredDeedsOffice)}, with an area of {b(data.propertyAreaSqm)} SQUARE METERS
				(____ sq. m.);
			</p>
			<p className="mb-4 text-justify">
				WHEREAS, the MORTGAGOR/BORROWER shall not dispose or transfer the said parcel of land
				without the knowledge and consent of the MORTGAGEE/LENDER;
			</p>
			<p className="mb-4 text-justify">
				WHEREAS, in the event of default by the MORTGAGOR/BORROWER, the obligation to pay the
				above-mentioned consideration shall be payable with interest. Failure to pay shall subject
				the MORTGAGEE/LENDER to file a Petition for Extrajudicial or Judicial Foreclosure of
				Mortgage in accordance with the provisions of Act 3135 and/or the Rules of Court;
			</p>
			<p className="mb-4 text-justify">
				PROVIDED, HOWEVER, that if the MORTGAGOR/BORROWER shall pay or cause to be paid to said
				MORTGAGEE/LENDER, his/her/their heirs or assigns, the sum of {b(data.loanAmountFigures)}
				PESOS ({b(data.loanAmountWords)}), to be paid within a period of
				{b(data.paymentPeriodYears)} years/months and after execution of this REAL ESTATE
				MORTGAGE, together with interest thereon at the rate of {b(data.interestRate)} percent
				(____%) per annum/month, then this mortgage shall be discharged and of no effect;
			</p>
			<p className="mb-4 text-justify">
				OTHERWISE, this REM shall remain in full force and shall be enforceable in the manner
				provided for by law.
			</p>
			<p className="mb-6 text-justify">
				IN WITNESS WHEREOF, I have hereunto set my hand this {b(data.executionDay)} day of
				{b(data.executionMonthYear)}, 20____, in {b(data.executionCity)}, Philippines.
			</p>

			<div className="mb-8 grid grid-cols-2 gap-12">
				<div>
					<div className="mb-1 border-b border-black">{b(data.mortgagorSignatureName)}</div>
					<div className="text-xs">(Full name and signature of the Mortgagor/Borrower)</div>
				</div>
				<div>
					<div className="mb-1 border-b border-black">{b(data.mortgageeSignatureName)}</div>
					<div className="text-xs">(Full name and signature of the Mortgagee/Lender)</div>
				</div>
			</div>

			<div className="mb-8 text-center">With marital consent.</div>
			<div className="mb-8 grid grid-cols-2 gap-12">
				<div>
					<div className="mb-1 border-b border-black">{b(data.mortgagorSpouseName)}</div>
					<div className="text-xs">(Full name and signature of Mortgagor's/Borrower's Spouse)</div>
				</div>
				<div>
					<div className="mb-1 border-b border-black">{b(data.mortgageeSpouseName)}</div>
					<div className="text-xs">(Full name and signature of Mortgagee's/Lender's Spouse)</div>
				</div>
			</div>

			<div className="mb-4 text-center">SIGNED IN THE PRESENCE OF:</div>
			<div className="mb-8 grid grid-cols-2 gap-12">
				<div className="border-b border-black">{b(data.witness1Name)}</div>
				<div className="border-b border-black">{b(data.witness2Name)}</div>
			</div>

			<div className="border-t border-black pt-4">
				<div className="mb-3 text-center font-bold">ACKNOWLEDGMENT</div>
				<p className="mb-3">REPUBLIC OF THE PHILIPPINES )</p>
				<p className="mb-4">{b(data.notaryCityProvince)} ) S.S.</p>
				<p className="mb-4 text-justify">
					BEFORE ME, a Notary Public for and in {b(data.notaryCityProvince)}, this
					{b(data.ackDay)} day of {b(data.ackMonthYear)}, personally appeared:
				</p>
				<p className="mb-1">Name | Proof of Identity | Date and Place Issued</p>
				<p className="mb-1">{b(data.ackIdName1)} | {b(data.ackIdDetails1)} | _____________</p>
				<p className="mb-4">{b(data.ackIdName2)} | {b(data.ackIdDetails2)} | _____________</p>
				<p className="text-justify">
					Known to me to be the same persons who executed the foregoing instrument, and
					acknowledged that the same is/are his/her/their free act and voluntary deed.
				</p>
				<p className="mt-4 text-justify">
					This instrument consisting of _________ (___) pages, including wherein this
					acknowledgment is written, has been signed by the parties and their instrumental
					witnesses on each and every page and on the space provided for their signature, and
					relates to _____________ (_____) parcels of land.
				</p>
				<p className="mt-4 text-justify">
					WITNESS MY HAND AND SEAL, at {b(data.notaryCityProvince)}, on this ______ day of
					__________, 20_____.
				</p>
			</div>
		</div>
	)
}

export function RealEstateMortgageEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<RealEstateMortgageData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultRealEstateMortgage,
						...(JSON.parse(saved) as Partial<RealEstateMortgageData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultRealEstateMortgage
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
			await exportRealEstateMortgage(data)
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
						<div className="font-semibold">Mortgagor Details</div>
						<Field label="Mortgagor Name" id="mortgagorName" value={data.mortgagorName} onChange={set("mortgagorName")} />
						<Field label="Civil Status" id="mortgagorCivilStatus" value={data.mortgagorCivilStatus} onChange={set("mortgagorCivilStatus")} />
						<Field label="Address" id="mortgagorAddress" value={data.mortgagorAddress} onChange={set("mortgagorAddress")} multiline />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Mortgagee Details</div>
						<Field label="Mortgagee Name" id="mortgageeName" value={data.mortgageeName} onChange={set("mortgageeName")} />
						<Field label="Civil Status" id="mortgageeCivilStatus" value={data.mortgageeCivilStatus} onChange={set("mortgageeCivilStatus")} />
						<Field label="Address" id="mortgageeAddress" value={data.mortgageeAddress} onChange={set("mortgageeAddress")} multiline />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Loan and Property</div>
						<Field label="Execution Place" id="executionPlace" value={data.executionPlace} onChange={set("executionPlace")} />
						<Field label="Loan Amount (Words)" id="loanAmountWords" value={data.loanAmountWords} onChange={set("loanAmountWords")} multiline />
						<Field label="Loan Amount (Figures)" id="loanAmountFigures" value={data.loanAmountFigures} onChange={set("loanAmountFigures")} />
						<Field label="Property Location" id="propertyLocation" value={data.propertyLocation} onChange={set("propertyLocation")} />
						<Field label="TCT/CCT No." id="propertyTctCctNo" value={data.propertyTctCctNo} onChange={set("propertyTctCctNo")} />
						<Field label="Property Description" id="propertyDescription" value={data.propertyDescription} onChange={set("propertyDescription")} multiline />
						<Field label="Register of Deeds Office" id="registeredDeedsOffice" value={data.registeredDeedsOffice} onChange={set("registeredDeedsOffice")} />
						<Field label="Area (sq. m.)" id="propertyAreaSqm" value={data.propertyAreaSqm} onChange={set("propertyAreaSqm")} />
						<Field label="Interest Rate" id="interestRate" value={data.interestRate} onChange={set("interestRate")} />
						<Field label="Payment Period (years)" id="paymentPeriodYears" value={data.paymentPeriodYears} onChange={set("paymentPeriodYears")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Execution and Signatures</div>
						<Field label="Execution Day" id="executionDay" value={data.executionDay} onChange={set("executionDay")} />
						<Field label="Execution Month/Year" id="executionMonthYear" value={data.executionMonthYear} onChange={set("executionMonthYear")} />
						<Field label="Execution City" id="executionCity" value={data.executionCity} onChange={set("executionCity")} />
						<Field label="Mortgagor Signatory" id="mortgagorSignatureName" value={data.mortgagorSignatureName} onChange={set("mortgagorSignatureName")} />
						<Field label="Mortgagee Signatory" id="mortgageeSignatureName" value={data.mortgageeSignatureName} onChange={set("mortgageeSignatureName")} />
						<Field label="Mortgagor Spouse" id="mortgagorSpouseName" value={data.mortgagorSpouseName} onChange={set("mortgagorSpouseName")} />
						<Field label="Mortgagee Spouse" id="mortgageeSpouseName" value={data.mortgageeSpouseName} onChange={set("mortgageeSpouseName")} />
						<Field label="Witness 1" id="witness1Name" value={data.witness1Name} onChange={set("witness1Name")} />
						<Field label="Witness 2" id="witness2Name" value={data.witness2Name} onChange={set("witness2Name")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Acknowledgment</div>
						<Field label="Notary City/Province" id="notaryCityProvince" value={data.notaryCityProvince} onChange={set("notaryCityProvince")} />
						<Field label="Acknowledgment Day" id="ackDay" value={data.ackDay} onChange={set("ackDay")} />
						<Field label="Acknowledgment Month/Year" id="ackMonthYear" value={data.ackMonthYear} onChange={set("ackMonthYear")} />
						<Field label="Appearing Party 1" id="ackIdName1" value={data.ackIdName1} onChange={set("ackIdName1")} />
						<Field label="Proof of Identity 1" id="ackIdDetails1" value={data.ackIdDetails1} onChange={set("ackIdDetails1")} />
						<Field label="Appearing Party 2" id="ackIdName2" value={data.ackIdName2} onChange={set("ackIdName2")} />
						<Field label="Proof of Identity 2" id="ackIdDetails2" value={data.ackIdDetails2} onChange={set("ackIdDetails2")} />
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

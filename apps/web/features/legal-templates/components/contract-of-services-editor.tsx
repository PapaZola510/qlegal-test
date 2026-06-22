"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportContractOfServices } from "@/features/legal-templates/lib/pdf-export"
import {
	type ContractOfServicesData,
	defaultContractOfServices,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:contract-of-services"

type FieldKey = keyof ContractOfServicesData

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

function DocumentPreview({ data }: { data: ContractOfServicesData }) {
	const b = (v: string | undefined, fb = "_____________") => blank(v, fb)
	const line = "____________________________________________________________"

	return (
		<div
			id="legal-template-print-area"
			className="bg-white text-black font-sans text-[9pt] leading-tight px-16 py-16 min-h-264 w-204 shrink-0 shadow-lg"
		>
			<div className="mb-3 text-center font-bold">CONTRACT OF SERVICES</div>
			<p className="mb-1">KNOW ALL MEN BY THESE PRESENTS:</p>
			<p className="mb-2 text-justify">
				This Contract of Services ("Contract") made and executed by and between:
			</p>

			<p className="mb-1 text-justify">
				{b(data.serviceProviderName)}, a corporation duly organized and existing under Philippine
				laws, with business address at {b(data.serviceProviderAddress)}, represented by its
				{b(data.serviceProviderRepresentative)};
			</p>
			<p className="mb-2 text-center">-and-</p>
			<p className="mb-1 text-justify">
				{b(data.clientName)}, a corporation organized and existing under Philippine laws with
				office address at {b(data.clientAddress)}, represented by its
				{b(data.clientRepresentative)} ("CLIENT").
			</p>
			<p className="mb-3 text-xs text-justify">
				(Each of XCORP and the CLIENT shall be referred to as a "Party"; and collectively as the
				"Parties").
			</p>

			<p className="mb-1 font-semibold">RECITALS:</p>
			<p className="mb-1 text-justify">
				A. {b(data.serviceProviderName)} with Certificate of Filing of Amended Articles of
				Incorporation/Company Registration No. ____ issued by Securities and Exchange Commission
				Main Office on _____ is an independent service provider with substantial capital, equipment,
				and expertise, engaged in {b(data.serviceDescription)} services; and
			</p>
			<p className="mb-3 text-justify">
				B. The CLIENT, relying on the representations of {b(data.serviceProviderName)} and in need
				of the Services, has accepted XCORP's offer to supply the service requirements of the CLIENT
				under the terms and conditions specified hereunder.
			</p>

			<p className="mb-2 text-justify">
				NOW, THEREFORE, for and in consideration of the foregoing premises and the terms and
				conditions hereunder set forth, the parties hereto agree as follows:
			</p>

			<ol className="mb-4 list-decimal space-y-1.5 pl-5 text-justify text-xs">
				<li>
					<span className="font-semibold">Scope of Work</span> — The CLIENT hereby engages {b(data.serviceProviderName)} to provide the CLIENT, within ten (10) days from receipt of request or execution of this Contract, the services identified in Annex "A", as required by the CLIENT in the areas of clerical, technical, professional, and similar services, including but not limited to: {b(data.scopeOfWork)} (the "Services").
				</li>
				<li>
					<span className="font-semibold">Qualification</span> — {b(data.serviceProviderName)} shall assign personnel who possess the necessary skills and qualifications as required by the CLIENT ("Personnel") for the performance of the Services.{data.qualificationPersonnel.trim() ? ` ${data.qualificationPersonnel}` : ""}
				</li>
				<li>
					<span className="font-semibold">Place of Work</span> — The Personnel's regular place of work will be at {b(data.workLocation)}. XCORP Personnel may only be assigned to work at other locations upon the approval of XCORP.
				</li>
				<li>
					<span className="font-semibold">Supplies, Tools and Equipment</span> — {b(data.serviceProviderName)} shall provide the necessary standard supplies, tools, equipment, and other facilities to be used by its Personnel assigned to the CLIENT, which shall be maintained by XCORP in good working condition for the duration of the Contract.
				</li>
				<li>
					<span className="font-semibold">Consideration</span> — For and in consideration of the Services to be rendered by {b(data.serviceProviderName)}, the CLIENT shall pay XCORP the billing rates as provided in the "Monthly Billing Rates" attached as Annex "B" and made an integral part of this Contract. The rates quoted include government mandatory contribution and Administrative Service Fee of {b(data.advanceAdminFeePercent)}%. Value Added Tax (VAT). The rates, however, shall be subject to proportionate wage increase in the minimum wage, wage rates, wage related benefits, mandatory government contributions, tax rates, other fees and the additional costs incidental to any change in billing procedures subsequently imposed by CLIENT. The CLIENT shall have a non-extendible period of 15 days from receipt of any invoice showing any unpaid charges for billing adjustment, failing which, the billing shall be considered final.
				</li>
				<li>
					<span className="font-semibold">Cash Advance/Reimbursement</span> — Should the Personnel need to travel within or outside Metro Cebu in the performance of the Services to the CLIENT, XCORP may advance the travel expense subject to reimbursement by CLIENT, provided that the CLIENT will send a written request for the required travel at least five (5) days prior to travel. The Personnel's travel expense in the form of cash advances and/or reimbursement shall be charged ten percent (10%) interest and must be reimbursed by the CLIENT within sixty (60) days after the travel.{data.personnelTravel.trim() ? ` ${data.personnelTravel}` : ""}
				</li>
				<li>
					<span className="font-semibold">Mode of Payment</span> — All bills shall be paid within fifteen (15) calendar days from receipt thereof. Bills unpaid after fifteen (15) calendar days shall automatically earn interest at the monthly rate provided herein as part of the billing. A fraction of a month shall be considered as one month. Non-payment of bills for two (2) consecutive months or more shall be a support for XCORP to terminate the Contract.
				</li>
				<li>
					<span className="font-semibold">Overtime and Services Rendered on Holidays</span> — For services rendered over and above the eight (8) hour regular working time and/or during night shift/rest day/holiday/rest day, XCORP shall charge overtime{data.overtimeRateMultiplier.trim() ? ` at ${data.overtimeRateMultiplier}x rate` : ""}, night differential and holiday pay as the case may be at rates as allowed under applicable government rules and regulations and other laws of the Republic of the Philippines. XSERV shall be in charge of monitoring of the service in question by its Personnel.{data.holidayWorkDescription.trim() ? ` ${data.holidayWorkDescription}` : ""}
				</li>
				<li>
					<span className="font-semibold">Benefits under Labor Code and Special Laws</span> — Entitlement of the Personnel under labor laws and other special laws, shall be included in XCORP's billing, which shall be billed to the CLIENT when the employees concerned become entitled to such benefit as provided for under the law. XCORP shall, at the end of each billing period, submit to CLIENT an affidavit to the effect that it has paid all of its Personnel assigned to CLIENT all their compensation and/or benefits, if any, for such period in accordance with the labor laws.{data.benefitsDescription.trim() ? ` ${data.benefitsDescription}` : ""}
				</li>
				<li>
					<span className="font-semibold">Posting of Bond</span> — The CLIENT may require {b(data.serviceProviderName)} to furnish a bond{data.bondAmount.trim() ? ` of ${data.bondAmount}` : ""}, renewable every year, on condition that the bond shall answer for the wages due XCORP Personnel should XCORP fail to pay the same.
				</li>
				<li>
					<span className="font-semibold">No Employer-Employee Relationship</span> — XCORP warrants that it is an independent contractor duly registered with the Department of Labor and Employment. It is expressly understood that there is NO EMPLOYER-EMPLOYEE RELATIONSHIP between the CLIENT and the Personnel and that XCORP as the employer shall be solely responsible for the claims and/or demands of the Personnel.
				</li>
			</ol>

			<p className="mb-4 text-justify">
				IN WITNESS WHEREOF, the Parties, through their duly authorized representative, have
				hereunto set their hands on {b(data.effectivityDay)} at the {b(data.effectivityCity)},
				Philippines.
			</p>

			<div className="mb-6 grid grid-cols-2 gap-8 text-xs">
				<div>
					<div className="mb-1 border-b border-black">{b(data.providerSignatoryName)}</div>
					<div className="mb-3">{b(data.serviceProviderName)}</div>
					<div>By:</div>
					<div className="mt-3 border-b border-black">{b(data.serviceProviderRepresentative)}</div>
				</div>
				<div>
					<div className="mb-1 border-b border-black">{b(data.clientSignatoryName)}</div>
					<div className="mb-3">{b(data.clientName)}</div>
					<div>By:</div>
					<div className="mt-3 border-b border-black">{b(data.clientRepresentative)}</div>
				</div>
			</div>

			<p className="mb-4 text-center text-xs">SIGNED IN THE PRESENCE OF:</p>
			<div className="mb-6 grid grid-cols-2 gap-8 text-xs">
				<div className="border-b border-black">{b(data.providerWitnessName)}</div>
				<div className="border-b border-black">{b(data.clientWitnessName)}</div>
			</div>

			<div className="mt-6 border-t pt-4 text-xs">
				<p className="mb-2 text-center font-semibold">ACKNOWLEDGMENT</p>
				<p>REPUBLIC OF THE PHILIPPINES )</p>
				<p className="mb-2">{b(data.notaryCityProvince)} ) S.S.</p>
				<p className="mb-2">
					BEFORE ME, a Notary Public for and in {b(data.notaryCityProvince)}, on this {b(data.ackDay)} day of {b(data.ackMonthYear)}, personally appeared:
				</p>
				<div className="mb-2 grid grid-cols-3 gap-2 font-semibold">
					<span>Name</span>
					<span>Proof of Identity</span>
					<span>Type of Proof Presented</span>
				</div>
				<div className="mb-4 grid grid-cols-3 gap-2">
					<span>{b(data.personName)}</span>
					<span>{b(data.proofOfIdentity)}</span>
					<span>{b(data.typeOfProofPresented)}</span>
				</div>
				<p className="mb-4 text-justify">
					Known to me and to me known to be the same persons who executed the foregoing instrument
					and they acknowledged to me that the same is their free and voluntary act and deed as well
					as of the corporations which they represent and that they are duly authorized to do the same.
				</p>
				<p>
					WITNESS MY HAND AND OFFICIAL SEAL the last day of the day, month and year first above written.
				</p>
			</div>
		</div>
	)
}


export function ContractOfServicesEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<ContractOfServicesData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultContractOfServices,
						...(JSON.parse(saved) as Partial<ContractOfServicesData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultContractOfServices
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
			await exportContractOfServices(data)
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
						<div className="font-semibold">Service Provider</div>
						<Field label="Provider Name (XCORP)" id="serviceProviderName" value={data.serviceProviderName} onChange={set("serviceProviderName")} />
						<Field label="Provider Address" id="serviceProviderAddress" value={data.serviceProviderAddress} onChange={set("serviceProviderAddress")} multiline />
						<Field label="Provider Representative" id="serviceProviderRepresentative" value={data.serviceProviderRepresentative} onChange={set("serviceProviderRepresentative")} />
						<Field label="Provider Representative Spouse" id="serviceProviderRepresentativeSpouseName" value={data.serviceProviderRepresentativeSpouseName} onChange={set("serviceProviderRepresentativeSpouseName")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Client</div>
						<Field label="Client Name" id="clientName" value={data.clientName} onChange={set("clientName")} />
						<Field label="Client Address" id="clientAddress" value={data.clientAddress} onChange={set("clientAddress")} multiline />
						<Field label="Client Representative" id="clientRepresentative" value={data.clientRepresentative} onChange={set("clientRepresentative")} />
						<Field label="Client Representative Spouse" id="clientRepresentativeSpouseName" value={data.clientRepresentativeSpouseName} onChange={set("clientRepresentativeSpouseName")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Services</div>
						<Field label="Service Description" id="serviceDescription" value={data.serviceDescription} onChange={set("serviceDescription")} multiline />
						<Field label="Scope of Work (Term 1)" id="scopeOfWork" value={data.scopeOfWork} onChange={set("scopeOfWork")} multiline />
						<Field label="Work Location" id="workLocation" value={data.workLocation} onChange={set("workLocation")} />
						<Field label="Qualification/Personnel (Term 2)" id="qualificationPersonnel" value={data.qualificationPersonnel} onChange={set("qualificationPersonnel")} multiline />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Billing & Compensation</div>
						<Field label="Monthly Billing Rate" id="monthlyBillingRate" value={data.monthlyBillingRate} onChange={set("monthlyBillingRate")} />
						<Field label="Billing Due (days)" id="billingDueDays" value={data.billingDueDays} onChange={set("billingDueDays")} />
						<Field label="Tax Rate (%)" id="taxRatePercent" value={data.taxRatePercent} onChange={set("taxRatePercent")} />
						<Field label="Admin Fee (%)" id="advanceAdminFeePercent" value={data.advanceAdminFeePercent} onChange={set("advanceAdminFeePercent")} />
						<Field label="Late Interest (% per month)" id="lateInterestPercentPerMonth" value={data.lateInterestPercentPerMonth} onChange={set("lateInterestPercentPerMonth")} />
						<Field label="Overday Rate" id="overdayRate" value={data.overdayRate} onChange={set("overdayRate")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Additional Terms</div>
						<Field label="Overtime Rate Multiplier" id="overtimeRateMultiplier" value={data.overtimeRateMultiplier} onChange={set("overtimeRateMultiplier")} />
						<Field label="Holiday Work Description" id="holidayWorkDescription" value={data.holidayWorkDescription} onChange={set("holidayWorkDescription")} multiline />
						<Field label="Benefits Description" id="benefitsDescription" value={data.benefitsDescription} onChange={set("benefitsDescription")} multiline />
						<Field label="Bond Amount" id="bondAmount" value={data.bondAmount} onChange={set("bondAmount")} />
						<Field label="Personnel Travel Details" id="personnelTravel" value={data.personnelTravel} onChange={set("personnelTravel")} multiline />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Execution & Signatures</div>
							<Field label="Execution Day" id="effectivityDay" value={data.effectivityDay} onChange={set("effectivityDay")} />
							<Field label="Execution Month/Year" id="effectivityMonthYear" value={data.effectivityMonthYear} onChange={set("effectivityMonthYear")} />
							<Field label="Execution City" id="effectivityCity" value={data.effectivityCity} onChange={set("effectivityCity")} />
						<Field label="Provider Signatory" id="providerSignatoryName" value={data.providerSignatoryName} onChange={set("providerSignatoryName")} />
						<Field label="Client Signatory" id="clientSignatoryName" value={data.clientSignatoryName} onChange={set("clientSignatoryName")} />
						<Field label="Provider Witness" id="providerWitnessName" value={data.providerWitnessName} onChange={set("providerWitnessName")} />
						<Field label="Client Witness" id="clientWitnessName" value={data.clientWitnessName} onChange={set("clientWitnessName")} />
					</div>

					<Separator />

					<div className="space-y-3">
						<div className="font-semibold">Acknowledgment</div>
						<Field label="Notary City/Province" id="notaryCityProvince" value={data.notaryCityProvince} onChange={set("notaryCityProvince")} />
						<Field label="Acknowledgment Day" id="ackDay" value={data.ackDay} onChange={set("ackDay")} />
						<Field label="Acknowledgment Month/Year" id="ackMonthYear" value={data.ackMonthYear} onChange={set("ackMonthYear")} />
							<Field label="Person Name 1" id="personName" value={data.personName} onChange={set("personName")} />
							<Field label="Proof of Identity 1" id="proofOfIdentity" value={data.proofOfIdentity} onChange={set("proofOfIdentity")} />
							<Field label="Type of Proof Presented 1" id="typeOfProofPresented" value={data.typeOfProofPresented} onChange={set("typeOfProofPresented")} />
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

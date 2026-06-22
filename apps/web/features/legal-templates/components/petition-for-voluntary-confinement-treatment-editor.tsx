"use client"

import * as React from "react"

import { Button } from "@/core/components/ui/button"
import { Input } from "@/core/components/ui/input"
import { Label } from "@/core/components/ui/label"
import { Separator } from "@/core/components/ui/separator"
import { Textarea } from "@/core/components/ui/textarea"
import { exportPetitionForVoluntaryConfinementTreatment } from "@/features/legal-templates/lib/pdf-export"
import {
	defaultPetitionForVoluntaryConfinementTreatment,
	type PetitionForVoluntaryConfinementTreatmentData,
} from "@/features/legal-templates/types"

const DRAFT_KEY = "qlegal:legal-template:petition-for-voluntary-confinement-treatment"

type PetitionFieldKey = keyof PetitionForVoluntaryConfinementTreatmentData

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
					className="min-h-18 text-sm"
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

function Page({ children }: { children: React.ReactNode }) {
	return (
		<div
			className="min-h-264 w-204 shrink-0 bg-white px-24 py-24 font-serif text-[10pt] leading-relaxed text-black shadow-lg"
			style={{ fontFamily: "Times New Roman, Times, serif" }}
		>
			{children}
		</div>
	)
}

function DocumentPreview({ data }: { data: PetitionForVoluntaryConfinementTreatmentData }) {
	const b = (value: string, fallback = "_____________") => blank(value, fallback)

	return (
		<div className="space-y-6">
			<Page>
				<div className="mb-6 text-right text-[11pt] font-bold">Annex “D”</div>
				<div className="mb-8 text-center text-[9pt] leading-tight font-bold">
					<div>Republic of the Philippines National Capital Judicial Region</div>
					<div>Regional Trial Court Branch {b(data.branch)}</div>
				</div>
				<div className="mb-8 grid grid-cols-2 gap-8 text-[10pt]">
					<div>
						<div className="font-bold italic">IN THE MATTER OF VOLUNTARY</div>
						<div className="text-center font-bold italic">Confinement for Treatment</div>
						<div className="mt-10 font-bold">DANGEROUS DRUGS BOARD</div>
						<div className="text-center italic">Petitioner</div>
						<div className="mt-8">x - - - - - - - - - - - - - - - - - - - - x</div>
					</div>
					<div>
						<div className="font-bold">SP No. {b(data.spNo, "__________")}</div>
						<div className="font-bold italic">For: Voluntary Submission of a</div>
						<div className="font-bold italic">Drug Dependent to</div>
						<div className="font-bold italic">Confinement, Treatment and</div>
						<div className="font-bold italic">Rehabilitation pursuant</div>
						<div className="font-bold italic">to Section 54, Article VIII of</div>
						<div className="font-bold italic">R.A. 9165</div>
					</div>
				</div>
				<div className="mb-8 text-center text-[18pt] font-bold">PETITION</div>
				<p className="mb-8 text-center">
					COME NOW the Petitioner, Dangerous Drugs Board (DDB for brevity) and unto this Honorable
					Court most respectfully AVER:
				</p>
				<div className="mb-4 text-[16pt] font-bold">NATURE OF THE PETITION</div>
				<p className="mb-8 ml-8 text-justify">
					1. This Petition is for the voluntary confinement for treatment and rehabilitation of a
					drug dependent pursuant to Section 54, Article VIII of RA 9165, otherwise known as the
					“Comprehensive Dangerous Drugs Act of 2002”; and Board Regulation No. 3, Series of 2007 in
					relation to Section 19, Rule 141 of the Rules of Court, exempting government entities from
					paying fees;
				</p>
				<div className="mb-4 text-[16pt] font-bold">THE PETITIONER</div>
				<p className="mb-5 ml-8 text-justify">
					2. The Dangerous Drugs Board is a government agency under the Office of the President
					created pursuant to Section 79, Article IX of RA 9165, otherwise known as “Comprehensive
					Dangerous Drugs Act of 2002”, with office address located at the 3rd Floor, DDB-PDEA
					Building, NIA Northside Road, National Government Center, East Triangle, Diliman, Quezon
					City, represented herein by its Executive Director,{" "}
					<span className="underline">{b(data.executiveDirectorName)}</span> while{" "}
					<span className="underline">
						{b(data.drugDependentName, "the drug dependent subject of this Petition")}
					</span>{" "}
					is a Filipino, minor, legal age, single/married with residence and postal address at{" "}
					<span className="underline">{b(data.dependentResidence)}</span>;
				</p>
				<p className="ml-8 text-justify">
					3. That under Section 54 of the Act, all applications for voluntary confinement for
					treatment and rehabilitation shall be filed with the Dangerous Drugs Board (DDB) or any of
					its duly authorized representatives, who, after determining that the applicant is a drug
					dependent, shall bring forth the said application of any person determined to be drug
					dependent on dangerous drugs thru a petition of the Board to the Regional Trial Court of
					the province or city where the applicant resides;
				</p>
			</Page>
			<Page>
				<p className="mb-5 ml-8 text-justify">
					4. That on <span className="underline">{b(data.applicationDate)}</span>, DDB received the
					application of{" "}
					<span className="underline">{b(data.drugDependentName, "(Name of Drug Dependent)")}</span>
					, copy of which is hereto attached as ANNEX “A” and upon receipt thereof, issued an Order
					directing the applicant to undergo drug dependency examination to be conducted by any DOH
					accredited physician;
				</p>
				<p className="mb-5 ml-8 text-justify">
					5. That on <span className="underline">{b(data.examinationDate)}</span>, DDB received the
					result of the drug dependency examination of subject applicant conducted by{" "}
					<span className="underline">{b(data.doctorName)}</span>, a DOH accredited physician and a
					Certification attesting to the fact that{" "}
					<span className="underline">{b(data.drugDependentName)}</span> is a drug dependent needing
					immediate confinement for treatment and rehabilitation at the{" "}
					<span className="underline">
						{b(data.rehabCenterName, "(Name of Government Rehabilitation Center)")}
					</span>{" "}
					located at{" "}
					<span className="underline">
						{b(data.rehabCenterAddress, "(Address of the Rehabilitation Center)")}
					</span>
					;
				</p>
				<p className="mb-8 ml-8 text-justify">
					6. That pending the issuance by the Court of a Commitment Order, said drug dependent has
					been placed for temporary confinement of not more than fifteen (15) days at the{" "}
					<span className="underline">{b(data.temporaryConfinementFacility)}</span> and shall be
					released therefrom and committed to the designated rehabilitation center immediately upon
					receipt of the Commitment Order from the Court hearing the Petition;
				</p>
				<p className="mb-6 text-justify">
					WHEREFORE, premises considered, it is most respectfully prayed of this Honorable Court
					(after notice and hearing) that an Order be issued directing{" "}
					<span className="underline">{b(data.drugDependentName, "Name of Drug Dependent")}</span>{" "}
					to be confined for treatment and rehabilitation at the{" "}
					<span className="underline">{b(data.rehabCenterName)}</span>.
				</p>
				<p className="mb-10">
					QUEZON CITY for <span className="underline">{b(data.petitionMonth)}</span> this{" "}
					<span className="underline">{b(data.petitionDay)}</span> day of{" "}
					<span className="underline">{b(data.petitionYear, "20__")}</span>.
				</p>
				<div className="mt-8 text-center">
					<div className="mb-6">DANGEROUS DRUGS BOARD:</div>
					<div className="font-bold uppercase">{b(data.executiveDirectorName)}</div>
					<div>Executive Director</div>
					<div className="mt-8">By:</div>
					<div className="mx-auto mt-4 w-56 border-b border-black" />
					<div>Atty. {b(data.attorneyName)}</div>
					<div className="italic">Chief, Legal Division</div>
					<div className="mt-8">By:</div>
					<div className="mx-auto mt-4 w-56 border-b border-black" />
					<div>{b(data.representativeName)}</div>
					<div className="italic">Duly Authorized Representative</div>
				</div>
			</Page>
			<Page>
				<div className="mb-8 text-[18pt] leading-tight font-bold">
					VERIFICATION / CERTIFICATION OF NON-FORUM SHOPPING
				</div>
				<p className="mb-6 text-justify">
					I, <span className="underline">{b(data.verificationAffiantName)}</span>, Filipino,{" "}
					<span className="underline">{b(data.verificationLegalAge, "of legal age")}</span>, the
					Executive Director / duly authorized representative of the Dangerous Drugs Board, after
					having been duly sworn to in accordance to law, hereby depose and state:
				</p>
				<div className="ml-8 space-y-6 text-justify">
					<p>
						1. That I am the Petitioner in this Petition for Voluntary Submission of a drug
						dependent to confinement, treatment and rehabilitation;
					</p>
					<p>
						2. That I caused the preparation and filing of the foregoing Petition and found that all
						the allegations therein are true and correct according to my own knowledge and belief;
					</p>
					<p>
						3. I hereby certify that I have not commenced any action involving the same issue before
						any Court, tribunal or quasi-judicial agency and, to the best of my knowledge, no such
						action or claim is pending therein. If I hereafter learned that the same or similar
						action or claim has been filed or pending therein, I undertake to inform this Honorable
						Court of said fact within five (5) days therefrom.
					</p>
				</div>
				<div className="mt-16 mb-1 flex justify-end">
					<div className="w-48 border-b border-black" />
				</div>
				<div className="flex justify-end mt-16 mb-1"><div className="w-48 border-b border-black" /></div>
				<div className="text-right mr-8 mb-8">Affiant / Petitioner</div>
				<p className="text-[9pt] text-justify mb-8">SUBSCRIBED and sworn to before me this <span className="underline">{b(data.subscribedDay, "____")}</span> day of <span className="underline">{b(data.subscribedMonth, "____________")}</span>, <span className="underline">{b(data.subscribedYear, "20__")}</span>, affiant / Petitioner exhibited to me his/her Community Tax Certificate No. <span className="underline">{b(data.verificationCtcNo)}</span>, issued on <span className="underline">{b(data.verificationCtcIssuedOn)}</span> at <span className="underline">{b(data.verificationCtcIssuedAt)}</span>.</p>
			</Page>
		</div>
	)
}

export function PetitionForVoluntaryConfinementTreatmentEditor({ onBack }: { onBack: () => void }) {
	const [data, setData] = React.useState<PetitionForVoluntaryConfinementTreatmentData>(() => {
		if (typeof window !== "undefined") {
			try {
				const saved = localStorage.getItem(DRAFT_KEY)
				if (saved) {
					return {
						...defaultPetitionForVoluntaryConfinementTreatment,
						...(JSON.parse(saved) as Partial<PetitionForVoluntaryConfinementTreatmentData>),
					}
				}
			} catch {
				/* ignore */
			}
		}
		return defaultPetitionForVoluntaryConfinementTreatment
	})
	const [exporting, setExporting] = React.useState(false)
	const [saved, setSaved] = React.useState(false)

	const set = (key: PetitionFieldKey) => (value: string) =>
		setData(prev => ({ ...prev, [key]: value }))

	const handleSave = () => {
		localStorage.setItem(DRAFT_KEY, JSON.stringify(data))
		setSaved(true)
		setTimeout(() => setSaved(false), 2000)
	}

	const handleExport = async () => {
		setExporting(true)
		try {
			await exportPetitionForVoluntaryConfinementTreatment(data)
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
				<div className="w-105 shrink-0 space-y-4 overflow-y-auto pr-2">
					<div className="space-y-3">
						<Field label="RTC Branch" id="branch" value={data.branch} onChange={set("branch")} />
						<Field label="SP No." id="spNo" value={data.spNo} onChange={set("spNo")} />
						<Field
							label="Executive Director"
							id="executiveDirectorName"
							value={data.executiveDirectorName}
							onChange={set("executiveDirectorName")}
						/>
						<Field
							label="Name of Drug Dependent"
							id="drugDependentName"
							value={data.drugDependentName}
							onChange={set("drugDependentName")}
						/>
						<Field
							label="Dependent Residence"
							id="dependentResidence"
							value={data.dependentResidence}
							onChange={set("dependentResidence")}
							multiline
						/>
						<Field
							label="Application Date"
							id="applicationDate"
							value={data.applicationDate}
							onChange={set("applicationDate")}
						/>
						<Field
							label="Examination Date"
							id="examinationDate"
							value={data.examinationDate}
							onChange={set("examinationDate")}
						/>
						<Field
							label="Doctor Name"
							id="doctorName"
							value={data.doctorName}
							onChange={set("doctorName")}
						/>
						<Field
							label="Rehabilitation Center"
							id="rehabCenterName"
							value={data.rehabCenterName}
							onChange={set("rehabCenterName")}
						/>
						<Field
							label="Rehabilitation Center Address"
							id="rehabCenterAddress"
							value={data.rehabCenterAddress}
							onChange={set("rehabCenterAddress")}
							multiline
						/>
						<Field
							label="Temporary Confinement Facility"
							id="temporaryConfinementFacility"
							value={data.temporaryConfinementFacility}
							onChange={set("temporaryConfinementFacility")}
						/>
					</div>
					<Separator />
					<div className="space-y-3">
						<Field
							label="Petition Month"
							id="petitionMonth"
							value={data.petitionMonth}
							onChange={set("petitionMonth")}
						/>
						<Field
							label="Petition Day"
							id="petitionDay"
							value={data.petitionDay}
							onChange={set("petitionDay")}
						/>
						<Field
							label="Petition Year"
							id="petitionYear"
							value={data.petitionYear}
							onChange={set("petitionYear")}
							placeholder="20__"
						/>
						<Field
							label="Attorney Name"
							id="attorneyName"
							value={data.attorneyName}
							onChange={set("attorneyName")}
						/>
						<Field
							label="Representative Name"
							id="representativeName"
							value={data.representativeName}
							onChange={set("representativeName")}
						/>
					</div>
					<Separator />
					<div className="space-y-3">
						<Field label="Verification Affiant Name" id="verificationAffiantName" value={data.verificationAffiantName} onChange={set("verificationAffiantName")} />
						<Field label="Verification Legal Age" id="verificationLegalAge" value={data.verificationLegalAge} onChange={set("verificationLegalAge")} />
						<Field label="Subscribed Day" id="subscribedDay" value={data.subscribedDay} onChange={set("subscribedDay")} />
						<Field label="Subscribed Month" id="subscribedMonth" value={data.subscribedMonth} onChange={set("subscribedMonth")} />
						<Field label="Subscribed Year" id="subscribedYear" value={data.subscribedYear} onChange={set("subscribedYear")} placeholder="20__" />
						<Field label="CTC No." id="verificationCtcNo" value={data.verificationCtcNo} onChange={set("verificationCtcNo")} />
						<Field label="CTC Issued On" id="verificationCtcIssuedOn" value={data.verificationCtcIssuedOn} onChange={set("verificationCtcIssuedOn")} />
						<Field label="CTC Issued At" id="verificationCtcIssuedAt" value={data.verificationCtcIssuedAt} onChange={set("verificationCtcIssuedAt")} />
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
								transform: "scale(0.62)",
								transformOrigin: "top left",
								width: "612pt",
								marginBottom: "-80%",
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

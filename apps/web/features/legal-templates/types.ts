export type TemplateId =
	| "affidavit-of-loss"
	| "affidavit-of-discrepancy"
	| "sworn-affidavit-name-discrepancy"
	| "judicial-affidavit"
	| "affidavit-of-undertaking"
	| "affidavit-of-undertaking-with-minor"
	| "affidavit-of-undertaking-psa-birth-marriage-certificate"
	| "omnibus-sworn-statement"
	| "copy-certification"
	| "verification-and-certification-against-forum-shopping"
	| "petition-for-voluntary-confinement-treatment"
	| "gsis-board-of-trustees-petition"
	| "sworn-statement-assets-liabilities-net-worth"
	| "affidavit-of-desistance"
	| "deed-of-absolute-sale"
	| "special-power-of-attorney"
	| "deed-of-donation"
	| "contract-of-lease"
	| "real-estate-mortgage"
	| "contract-of-services"

export interface TemplateInfo {
	id: TemplateId
	title: string
	description: string
}

export const LEGAL_TEMPLATES: TemplateInfo[] = [
	{
		id: "affidavit-of-loss",
		title: "Affidavit of Loss",
		description:
			"Used to declare the loss of an important document or item and to report it to the appropriate authority.",
	},
	{
		id: "affidavit-of-discrepancy",
		title: "Affidavit of Discrepancy",
		description:
			"Declares that two documents with discrepant information pertain to one and the same person.",
	},
	{
		id: "sworn-affidavit-name-discrepancy",
		title: "Affidavit of Name Discrepancy (Stocks)",
		description:
			"Attests that different name variations in records and stock documents refer to one and the same person.",
	},
	{
		id: "judicial-affidavit",
		title: "Judicial Affidavit (Affirmation or Oath)",
		description:
			"Judicial affidavit format with witness attestation, lawyer attestation, and oath section for court submission.",
	},
	{
		id: "affidavit-of-undertaking",
		title: "Affidavit of Undertaking (LUC Form No. 2)",
		description:
			"Template for land conversion undertaking with dynamic occupant lines and compensation schedule rows.",
	},
	{
		id: "affidavit-of-undertaking-with-minor",
		title: "Affidavit of Undertaking with Minor",
		description: "Affidavit for a companion undertaking responsibility for a minor during travel.",
	},
	{
		id: "affidavit-of-undertaking-psa-birth-marriage-certificate",
		title: "Affidavit of Undertaking to Submit PSA Copy of Birth/Marriage Certificate",
		description:
			"Affidavit for bar examinees who need to explain PSA birth or marriage certificate deficiencies and commit to submit corrected documents.",
	},
	{
		id: "omnibus-sworn-statement",
		title: "Omnibus Sworn Statement",
		description:
			"Procurement omnibus sworn statement template with bidder declarations and authorized signatory section.",
	},
	{
		id: "copy-certification",
		title: "Copy Certification",
		description:
			"Standard copy certification template for notarial attestation of conformity with an original document.",
	},
	{
		id: "verification-and-certification-against-forum-shopping",
		title: "Verification and Certification Against Forum Shopping",
		description:
			"Verification and certification for administrative complaints confirming truthfulness and non-forum shopping.",
	},
	{
		id: "petition-for-voluntary-confinement-treatment",
		title: "Petition for Voluntary Confinement for Treatment",
		description:
			"Annex D petition for voluntary submission of a drug dependent to confinement, treatment, and rehabilitation with verification page.",
	},
	{
		id: "gsis-board-of-trustees-petition",
		title: "GSIS Board of Trustees Petition",
		description:
			"Petition template for GSIS Board of Trustees review with statement of facts, arguments, prayer, and verification/certification page.",
	},
	{
		id: "sworn-statement-assets-liabilities-net-worth",
		title: "Sworn Statement of Assets, Liabilities and Net Worth",
		description:
			"Required statement of assets, liabilities, net worth, business interests, and relatives in government service.",
	},
	{
		id: "affidavit-of-desistance",
		title: "Affidavit of Desistance",
		description:
			"Affidavit for voluntary withdrawal of a criminal complaint and request for dismissal.",
	},
	{
		id: "deed-of-absolute-sale",
		title: "Deed of Absolute Sale",
		description:
			"Deed for the absolute sale and transfer of real property with seller and buyer information, property details, and notarial acknowledgment.",
	},
	{
		id: "special-power-of-attorney",
		title: "Special Power of Attorney",
		description:
			"SPA document granting specific powers to an agent/attorney-in-fact to act on behalf of the principal for designated purposes.",
	},
	{
		id: "deed-of-donation",
		title: "Deed of Donation",
		description:
			"Deed for the donation of real property with donor and donee information, property details, love and affection consideration, and notarial acknowledgment.",
	},
	{
		id: "contract-of-lease",
		title: "Contract of Lease",
		description:
			"Lease agreement for residential property with lessor/lessee details, rental terms, conditions, and acknowledgment.",
	},
	{
		id: "real-estate-mortgage",
		title: "Real Estate Mortgage",
		description:
			"Mortgage agreement template covering mortgagor/mortgagee details, loan terms, collateral property description, and acknowledgment.",
	},
	{
		id: "contract-of-services",
		title: "Contract of Services",
		description:
			"Service contract template for client-provider engagements with scope, billing terms, compliance clauses, and acknowledgment.",
	},
]

export interface AffidavitOfDesistanceData {
	cityMunicipality: string
	affiantName: string
	legalAge: string
	citizenship: string
	address: string
	lawViolation: string
	offense: string
	respondentName: string
	caseTitle: string
	criminalCaseNo: string
	courtBranchNo: string
	courtLocation: string
	desistanceReason: string
	withdrawalStatement: string
	dismissalRequest: string
	witnessDay: string
	witnessMonthYear: string
	witnessCityMunicipality: string
	affiantRole: string
	subscribedDay: string
	subscribedMonthYear: string
	subscribedCityMunicipality: string
	idType: string
	idNumber: string
}

export interface JudicialAffidavitData {
	branchNumber: string
	courtCityProvince: string
	caseTitle: string
	caseNumber: string
	witnessName: string
	civilStatus: string
	address: string
	partyName: string
	questionAnswers: string
	witnessSignatureName: string
	lawyerName: string
	partyRepresented: string
	lawyerPtrNo: string
	lawyerRollNo: string
	lawyerAddressContact: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	idProof: string
}

export const defaultJudicialAffidavit: JudicialAffidavitData = {
	branchNumber: "",
	courtCityProvince: "",
	caseTitle: "",
	caseNumber: "",
	witnessName: "",
	civilStatus: "single",
	address: "",
	partyName: "plaintiff/defendant/People of the Philippines",
	questionAnswers: "Q1: [Question]\nA1: [Answer]\n\nQ2: [Question]\nA2: [Answer]",
	witnessSignatureName: "",
	lawyerName: "",
	partyRepresented: "",
	lawyerPtrNo: "",
	lawyerRollNo: "",
	lawyerAddressContact: "",
	subscribedDay: "",
	subscribedMonth: "",
	subscribedYear: "",
	idProof: "competent proof of identity",
}

export interface OmnibusSwornStatementData {
	cityMunicipality: string
	affiantName: string
	civilStatus: string
	nationality: string
	affiantAddress: string
	bidderName: string
	bidderAddress: string
	projectName: string
	procuringEntity: string
	showClause1SoleProprietorship: boolean
	showClause1Entity: boolean
	showClause2SoleProprietorship: boolean
	showClause2Entity: boolean
	showClause6SoleProprietorship: boolean
	showClause6Partnership: boolean
	showClause6Corporation: boolean
	witnessDay: string
	witnessMonth: string
	witnessYear: string
	witnessPlace: string
	authorizedSignatory: string
}

export interface CopyCertificationData {
	city: string
	notaryPublicName: string
	cityProvince: string
	documentName: string
	issuingEntity: string
	numberOfCopies: string
	clientOwnerName: string
	givenDay: string
	givenMonth: string
	givenYear: string
	givenPlace: string
	signatureNotaryPublic: string
	printedNameNotaryPublic: string
	notarialCommissionNumber: string
	commissionValidUntil: string
	rollOfAttorneysNo: string
	ibpNo: string
	ibpDateChapter: string
	ptrNo: string
	ptrDateLocation: string
	mcleComplianceNo: string
	mcleDate: string
}

export const defaultCopyCertification: CopyCertificationData = {
	city: "",
	notaryPublicName: "",
	cityProvince: "",
	documentName: "",
	issuingEntity: "",
	numberOfCopies: "",
	clientOwnerName: "",
	givenDay: "",
	givenMonth: "",
	givenYear: "",
	givenPlace: "",
	signatureNotaryPublic: "",
	printedNameNotaryPublic: "",
	notarialCommissionNumber: "",
	commissionValidUntil: "",
	rollOfAttorneysNo: "",
	ibpNo: "",
	ibpDateChapter: "",
	ptrNo: "",
	ptrDateLocation: "",
	mcleComplianceNo: "",
	mcleDate: "",
}

export const defaultOmnibusSwornStatement: OmnibusSwornStatementData = {
	cityMunicipality: "",
	affiantName: "",
	civilStatus: "single",
	nationality: "Filipino",
	affiantAddress: "",
	bidderName: "",
	bidderAddress: "",
	projectName: "",
	procuringEntity: "",
	showClause1SoleProprietorship: true,
	showClause1Entity: true,
	showClause2SoleProprietorship: true,
	showClause2Entity: true,
	showClause6SoleProprietorship: true,
	showClause6Partnership: true,
	showClause6Corporation: true,
	witnessDay: "",
	witnessMonth: "",
	witnessYear: "",
	witnessPlace: "",
	authorizedSignatory: "Bidder's Representative/Authorized Signatory",
}

export const defaultAffidavitOfDesistance: AffidavitOfDesistanceData = {
	cityMunicipality: "",
	affiantName: "",
	legalAge: "",
	citizenship: "Filipino",
	address: "",
	lawViolation: "Republic Act 10591",
	offense: "Attempted Murder",
	respondentName: "",
	caseTitle: "",
	criminalCaseNo: "",
	courtBranchNo: "",
	courtLocation: "",
	desistanceReason:
		"That after my sober and soul searching assessment and analysis of the incident, I realized that at the time I filed my complaint, I have not yet talked to the accused regarding his actions to me. But because of his repentance and fervent remorse about what he had done to me and not to mention his good deeds to my late mother, I am now forgiving accused and just avail of amicable settlement which we already had made;",
	withdrawalStatement:
		"That through this Affidavit, I am informing the assigned Public Prosecutor in this case that I am withdrawing my complaint.",
	dismissalRequest:
		"That I likewise request the Regional Trial Court to dismiss with prejudice the said criminal case, and I further manifest under oath that I am now desisting from pursuing or testifying against him in Court or in any other government entity or agency in connection with any possible criminal case against him.",
	witnessDay: "",
	witnessMonthYear: "",
	witnessCityMunicipality: "",
	affiantRole: "Complaining Witness",
	subscribedDay: "",
	subscribedMonthYear: "",
	subscribedCityMunicipality: "",
	idType: "Driver's License",
	idNumber: "",
}

export interface VerificationAndCertificationAgainstForumShoppingData {
	city: string
	affiantName: string
	legalAge: string
	civilStatus: string
	address: string
	complaintDescription: string
	noOtherActionStatement: string
	undertakingStatement: string
	signatureDay: string
	signatureMonth: string
	signatureYear: string
	signatureCity: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	idType: string
	idNumber: string
}

export const defaultVerificationAndCertificationAgainstForumShopping: VerificationAndCertificationAgainstForumShoppingData = {
	city: "Quezon City",
	affiantName: "",
	legalAge: "",
	civilStatus: "single",
	address: "",
	complaintDescription:
		"That I am the complainant in the above-entitled administrative case, and I have caused the preparation of the foregoing formal charge and affidavit; I have read and understood its content and the same are true and correct to my own personal knowledge and based on authentic records.",
	noOtherActionStatement:
		"That I have not commenced any other case/action or proceeding involving the same issues before this office, the different People's Law Enforcement Board of other Cities/Municipalities, the NAPOLCOM or other PNP administrative and disciplinary authority/machinery, and that to the best of my knowledge no such action or other Cities/Municipalities, the NAPOLCOM or the PNP administrative and disciplinary authority/machinery.",
	undertakingStatement:
		"That if I should thereafter learn a similar action or proceedings has been filed or is pending before this office, the different People's Law Enforcement Board of other Cities/Municipalities, the NAPOLCOM or other PNP administrative/disciplinary authority/machinery I undertake to promptly inform the said office/agencies of that fact within five (5) days therefrom.",
	signatureDay: "",
	signatureMonth: "",
	signatureYear: "",
	signatureCity: "Quezon City, Metro Manila",
	subscribedDay: "",
	subscribedMonth: "",
	subscribedYear: "",
	idType: "competent proof of identity",
	idNumber: "",
}

export interface PetitionForVoluntaryConfinementTreatmentData {
	branch: string
	spNo: string
	executiveDirectorName: string
	drugDependentName: string
	dependentResidence: string
	applicationDate: string
	examinationDate: string
	doctorName: string
	rehabCenterName: string
	rehabCenterAddress: string
	temporaryConfinementFacility: string
	petitionMonth: string
	petitionDay: string
	petitionYear: string
	attorneyName: string
	representativeName: string
	verificationAffiantName: string
	verificationLegalAge: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	verificationCtcNo: string
	verificationCtcIssuedOn: string
	verificationCtcIssuedAt: string
}

export const defaultPetitionForVoluntaryConfinementTreatment: PetitionForVoluntaryConfinementTreatmentData = {
	branch: "",
	spNo: "",
	executiveDirectorName: "Undersecretary EDGAR C. GALVANTE",
	drugDependentName: "",
	dependentResidence: "",
	applicationDate: "",
	examinationDate: "",
	doctorName: "",
	rehabCenterName: "",
	rehabCenterAddress: "",
	temporaryConfinementFacility: "",
	petitionMonth: "",
	petitionDay: "",
	petitionYear: "",
	attorneyName: "",
	representativeName: "",
	verificationAffiantName: "",
	verificationLegalAge: "",
	subscribedDay: "",
	subscribedMonth: "",
	subscribedYear: "",
	verificationCtcNo: "",
	verificationCtcIssuedOn: "",
	verificationCtcIssuedAt: "",
}

export interface GsisBoardOfTrusteesPetitionData {
	caseTitle: string
	committeeDecisionDate: string
	petitionerName: string
	gsisCaseNo: string
	committeeCaseNo: string
	timelinessText: string
	statementOfFacts1: string
	statementOfFacts2: string
	statementOfFacts3: string
	statementOfFacts4: string
	statementOfFacts5: string
	argumentsLine1: string
	argumentsLine2: string
	argumentsLine3: string
	argumentsLine4: string
	prayerText: string
	datePlace: string
	signatoryName: string
	signatoryTitle: string
	verificationPetitionerName: string
	verificationResidence: string
	verificationLegalAge: string
	verificationStatement4: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	idDescription: string
	idNumber: string
	copyFurnishedLabel: string
	copyFurnishedTitle: string
	copyFurnishedOffice: string
	copyFurnishedAddress: string
}

export const defaultGsisBoardOfTrusteesPetition: GsisBoardOfTrusteesPetitionData = {
	caseTitle: "",
	committeeDecisionDate: "",
	petitionerName: "",
	gsisCaseNo: "",
	committeeCaseNo: "",
	timelinessText: "",
	statementOfFacts1: "",
	statementOfFacts2: "",
	statementOfFacts3: "",
	statementOfFacts4: "",
	statementOfFacts5: "",
	argumentsLine1: "",
	argumentsLine2: "",
	argumentsLine3: "",
	argumentsLine4: "",
	prayerText: "",
	datePlace: "",
	signatoryName: "",
	signatoryTitle: "",
	verificationPetitionerName: "",
	verificationResidence: "",
	verificationLegalAge: "",
	verificationStatement4:
		"That no similar action has been filed or is pending before the Supreme Court, the Court of Appeals, or any other court, tribunal, or agency and that should there be any, I undertake to promptly inform such fact to this Honorable Board within five (5) days from knowledge.",
	subscribedDay: "",
	subscribedMonth: "",
	subscribedYear: "2016",
	idDescription: "",
	idNumber: "",
	copyFurnishedLabel: "Copy furnished:",
	copyFurnishedTitle: "COMMITTEE ON CLAIMS",
	copyFurnishedOffice: "Government Service Insurance System",
	copyFurnishedAddress: "Pasay City, Metro Manila",
}

export interface SwornStatementChildRow {
	name: string
	dateOfBirth: string
	age: string
}

export interface SwornStatementRealPropertyRow {
	description: string
	kind: string
	exactLocation: string
	assessedValue: string
	currentFairMarketValue: string
	acquisitionYear: string
	acquisitionMode: string
	acquisitionCost: string
}

export interface SwornStatementPersonalPropertyRow {
	description: string
	yearAcquired: string
	acquisitionCostAmount: string
}

export interface SwornStatementLiabilityRow {
	nature: string
	creditor: string
	outstandingBalance: string
}

export interface SwornStatementBusinessInterestRow {
	nameOfEntity: string
	businessAddress: string
	natureOfBusinessInterest: string
	dateOfAcquisition: string
}

export interface SwornStatementRelativeRow {
	name: string
	relationship: string
	position: string
	agencyOfficeAddress: string
}

export interface SwornStatementAssetsLiabilitiesNetWorthData {
	asOfDate: string
	filingType: "joint" | "separate" | "not-applicable"
	declarantFamilyName: string
	declarantFirstName: string
	declarantMiddleInitial: string
	declarantPosition: string
	declarantAgencyOffice: string
	declarantOfficeAddress: string
	spouseFamilyName: string
	spouseFirstName: string
	spouseMiddleInitial: string
	spousePosition: string
	spouseAgencyOffice: string
	spouseOfficeAddress: string
	householdChildren: SwornStatementChildRow[]
	realProperties: SwornStatementRealPropertyRow[]
	personalProperties: SwornStatementPersonalPropertyRow[]
	totalAssets: string
	liabilities: SwornStatementLiabilityRow[]
	totalLiabilities: string
	netWorth: string
	businessInterests: SwornStatementBusinessInterestRow[]
	relativesInGovernmentService: SwornStatementRelativeRow[]
	statementDate: string
	declarantGovIdType: string
	declarantGovIdNo: string
	declarantGovIdDateIssued: string
	spouseGovIdType: string
	spouseGovIdNo: string
	spouseGovIdDateIssued: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	subscribedLocation: string
	oathAdministeringName: string
}

export const defaultSwornStatementAssetsLiabilitiesNetWorth: SwornStatementAssetsLiabilitiesNetWorthData =
	{
		asOfDate: "",
		filingType: "not-applicable",
		declarantFamilyName: "",
		declarantFirstName: "",
		declarantMiddleInitial: "",
		declarantPosition: "",
		declarantAgencyOffice: "",
		declarantOfficeAddress: "",
		spouseFamilyName: "",
		spouseFirstName: "",
		spouseMiddleInitial: "",
		spousePosition: "",
		spouseAgencyOffice: "",
		spouseOfficeAddress: "",
		householdChildren: [
			{ name: "", dateOfBirth: "", age: "" },
			{ name: "", dateOfBirth: "", age: "" },
			{ name: "", dateOfBirth: "", age: "" },
			{ name: "", dateOfBirth: "", age: "" },
		],
		realProperties: [
			{
				description: "",
				kind: "",
				exactLocation: "",
				assessedValue: "",
				currentFairMarketValue: "",
				acquisitionYear: "",
				acquisitionMode: "",
				acquisitionCost: "",
			},
			{
				description: "",
				kind: "",
				exactLocation: "",
				assessedValue: "",
				currentFairMarketValue: "",
				acquisitionYear: "",
				acquisitionMode: "",
				acquisitionCost: "",
			},
		],
		personalProperties: [
			{ description: "", yearAcquired: "", acquisitionCostAmount: "" },
			{ description: "", yearAcquired: "", acquisitionCostAmount: "" },
			{ description: "", yearAcquired: "", acquisitionCostAmount: "" },
			{ description: "", yearAcquired: "", acquisitionCostAmount: "" },
		],
		totalAssets: "",
		liabilities: [
			{ nature: "", creditor: "", outstandingBalance: "" },
			{ nature: "", creditor: "", outstandingBalance: "" },
			{ nature: "", creditor: "", outstandingBalance: "" },
			{ nature: "", creditor: "", outstandingBalance: "" },
		],
		totalLiabilities: "",
		netWorth: "",
		businessInterests: [
			{
				nameOfEntity: "",
				businessAddress: "",
				natureOfBusinessInterest: "",
				dateOfAcquisition: "",
			},
			{
				nameOfEntity: "",
				businessAddress: "",
				natureOfBusinessInterest: "",
				dateOfAcquisition: "",
			},
			{
				nameOfEntity: "",
				businessAddress: "",
				natureOfBusinessInterest: "",
				dateOfAcquisition: "",
			},
			{
				nameOfEntity: "",
				businessAddress: "",
				natureOfBusinessInterest: "",
				dateOfAcquisition: "",
			},
		],
		relativesInGovernmentService: [
			{ name: "", relationship: "", position: "", agencyOfficeAddress: "" },
			{ name: "", relationship: "", position: "", agencyOfficeAddress: "" },
			{ name: "", relationship: "", position: "", agencyOfficeAddress: "" },
			{ name: "", relationship: "", position: "", agencyOfficeAddress: "" },
		],
		statementDate: "",
		declarantGovIdType: "",
		declarantGovIdNo: "",
		declarantGovIdDateIssued: "",
		spouseGovIdType: "",
		spouseGovIdNo: "",
		spouseGovIdDateIssued: "",
		subscribedDay: "",
		subscribedMonth: "",
		subscribedYear: "",
		subscribedLocation: "",
		oathAdministeringName: "",
	}

export interface CompanionLine {
	name: string
	civilStatus: string
}

export interface AffidavitOfUndertakingWithMinorData {
	companionLines: CompanionLine[]
	companionAddress: string
	companionLegalAge: string
	minorFirstName: string
	minorLastName: string
	minorRelationship: string
	minorParentFirstName: string
	minorParentLastName: string
	travelCountry: string
	travelDateStart: string
	travelPurpose: string
	returnDate: string
	returnCountry: string
	signatureDay: string
	signatureMonth: string
	signatureYear: string
	signatureLocation: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	subscribedLocation: string
	governmentIdType: string
	governmentIdNumber: string
	governmentIdDate: string
	docNo: string
	pageNo: string
	bookNo: string
	seriesOf: string
}

export const defaultAffidavitOfUndertakingWithMinor: AffidavitOfUndertakingWithMinorData = {
	companionLines: [{ name: "", civilStatus: "single" }],
	companionAddress: "",
	companionLegalAge: "",
	minorFirstName: "",
	minorLastName: "",
	minorRelationship: "",
	minorParentFirstName: "",
	minorParentLastName: "",
	travelCountry: "",
	travelDateStart: "",
	travelPurpose: "",
	returnDate: "",
	returnCountry: "Philippines",
	signatureDay: "",
	signatureMonth: "",
	signatureYear: "",
	signatureLocation: "",
	subscribedDay: "",
	subscribedMonth: "",
	subscribedYear: "",
	subscribedLocation: "",
	governmentIdType: "",
	governmentIdNumber: "",
	governmentIdDate: "",
	docNo: "",
	pageNo: "",
	bookNo: "",
	seriesOf: "",
}

export interface AffidavitOfUndertakingPsaCorrectionRow {
	category: string
	incorrectEntry: string
	correctEntry: string
}

export interface AffidavitOfUndertakingPsaBirthMarriageCertificateData {
	cityMunicipality: string
	affiantSurname: string
	affiantGivenName: string
	affiantMiddleName: string
	affiantSuffix: string
	affiantAddress: string
	affiantLegalAge: string
	affiantCitizenship: string
	applicantType: string
	barExaminationYear: string
	noBirthRecord: boolean
	recentlyMarriedNoMarriageCertificate: boolean
	needsCorrectionEntries: boolean
	correctionRows: AffidavitOfUndertakingPsaCorrectionRow[]
	filingDate: string
	filingOfficeType: string
	filingPlace: string
	proofOfFilingDescription: string
	submitByDate: string
	witnessDay: string
	witnessMonth: string
	witnessYear: string
	witnessCityMunicipality: string
	subscribedDay: string
	subscribedMonth: string
	subscribedYear: string
	subscribedCityMunicipality: string
	idType: string
	idNumber: string
}

export const defaultAffidavitOfUndertakingPsaBirthMarriageCertificate: AffidavitOfUndertakingPsaBirthMarriageCertificateData = {
	cityMunicipality: "",
	affiantSurname: "",
	affiantGivenName: "",
	affiantMiddleName: "",
	affiantSuffix: "",
	affiantAddress: "",
	affiantLegalAge: "",
	affiantCitizenship: "Filipino",
	applicantType: "New Applicant",
	barExaminationYear: "2026",
	noBirthRecord: false,
	recentlyMarriedNoMarriageCertificate: false,
	needsCorrectionEntries: false,
	correctionRows: [
		{ category: "", incorrectEntry: "", correctEntry: "" },
		{ category: "", incorrectEntry: "", correctEntry: "" },
		{ category: "", incorrectEntry: "", correctEntry: "" },
		{ category: "", incorrectEntry: "", correctEntry: "" },
	],
	filingDate: "",
	filingOfficeType: "LCR",
	filingPlace: "",
	proofOfFilingDescription: "attached proof of filing",
	submitByDate: "October 13, 2026 (Tuesday)",
	witnessDay: "",
	witnessMonth: "",
	witnessYear: "",
	witnessCityMunicipality: "",
	subscribedDay: "",
	subscribedMonth: "",
	subscribedYear: "",
	subscribedCityMunicipality: "",
	idType: "Driver's License",
	idNumber: "",
}

export interface UndertakingPaymentRow {
	name: string
	amount: string
	paymentDue: string
}

export interface AffidavitOfUndertakingData {
	municipality: string
	province: string
	affiantName: string
	legalAge: string
	citizenship: string
	civilStatus: string
	spouseName: string
	address: string
	parcelCount: string
	personsMode: "none" | "with-persons"
	personsCount: string
	personNames: string[]
	paymentRows: UndertakingPaymentRow[]
	billboardCount: string
	applicantTin: string
	applicantCtcNo: string
	applicantPlace: string
	applicantDate: string
	subscribedDay: string
	subscribedPlace: string
	ctcIssuedOn: string
	ctcIssuedYear: string
	ctcIssuedAt: string
}

export const defaultAffidavitOfUndertaking: AffidavitOfUndertakingData = {
	municipality: "",
	province: "",
	affiantName: "",
	legalAge: "",
	citizenship: "",
	civilStatus: "single",
	spouseName: "",
	address: "",
	parcelCount: "",
	personsMode: "none",
	personsCount: "",
	personNames: [""],
	paymentRows: [
		{ name: "", amount: "", paymentDue: "" },
		{ name: "", amount: "", paymentDue: "" },
		{ name: "", amount: "", paymentDue: "" },
	],
	billboardCount: "",
	applicantTin: "",
	applicantCtcNo: "",
	applicantPlace: "",
	applicantDate: "",
	subscribedDay: "",
	subscribedPlace: "",
	ctcIssuedOn: "",
	ctcIssuedYear: "",
	ctcIssuedAt: "",
}

// Affidavit of Loss
export interface AffidavitOfLossData {
	city: string
	affiantName: string
	affiantLabelLeft: string
	affiantLabelRight: string
	legalAge: string
	address: string
	itemDescription: string
	dateDay: string
	dateMonth: string
	dateYear: string
	numberOfItems: string
	itemType: string
	lossCircumstances: string
	searchDescription: string
	reportingTo: string
	witnessDay: string
	witnessMonth: string
	witnessYear: string
	witnessCity: string
	// Notarial details
	swornDay: string
	swornMonth: string
	swornYear: string
	govId1Type: string
	govId1Number: string
	govId1ValidUntil: string
	govId2Type: string
	govId2Number: string
	govId2ValidUntil: string
	govId3Type: string
	govId3Number: string
	govId3ValidUntil: string
	docNo: string
	pageNo: string
	bookNo: string
	seriesOf: string
}

export const defaultAffidavitOfLoss: AffidavitOfLossData = {
	city: "",
	affiantName: "",
	affiantLabelLeft: "Affiant",
	affiantLabelRight: "Affiant",
	legalAge: "",
	address: "",
	itemDescription: "",
	dateDay: "",
	dateMonth: "",
	dateYear: "",
	numberOfItems: "",
	itemType: "",
	lossCircumstances: "",
	searchDescription: "",
	reportingTo: "",
	witnessDay: "",
	witnessMonth: "",
	witnessYear: "",
	witnessCity: "",
	swornDay: "",
	swornMonth: "",
	swornYear: "",
	govId1Type: "",
	govId1Number: "",
	govId1ValidUntil: "",
	govId2Type: "",
	govId2Number: "",
	govId2ValidUntil: "",
	govId3Type: "",
	govId3Number: "",
	govId3ValidUntil: "",
	docNo: "",
	pageNo: "",
	bookNo: "",
	seriesOf: "",
}

// Affidavit of Discrepancy
export interface DiscrepancyDocument {
	type: string
	issuedOn: string
	issuedAt: string
	valueShown: string
}

export interface AffidavitOfDiscrepancyData {
	affiantName: string
	civilStatus: string
	spouseName: string
	address: string
	discrepancyType: string
	documents: DiscrepancyDocument[]
	signatureDate: string
	signatureCity: string
	jurisdiction1: string
	jurisdiction2: string
	jurisdiction3: string
	swornDate: string
	swornAt: string
	passportNo: string
	passportIssuedIn: string
	passportIssuedOn: string
	validUntil: string
	notaryDate: string
	serviceNo: string
	orNo: string
	feePaid: string
}

export const defaultAffidavitOfDiscrepancy: AffidavitOfDiscrepancyData = {
	affiantName: "",
	civilStatus: "single",
	spouseName: "",
	address: "",
	discrepancyType: "",
	documents: [
		{ type: "", issuedOn: "", issuedAt: "", valueShown: "" },
		{ type: "", issuedOn: "", issuedAt: "", valueShown: "" },
	],
	signatureDate: "",
	signatureCity: "",
	jurisdiction1: "",
	jurisdiction2: "",
	jurisdiction3: "",
	swornDate: "",
	swornAt: "",
	passportNo: "",
	passportIssuedIn: "",
	passportIssuedOn: "",
	validUntil: "",
	notaryDate: "",
	serviceNo: "",
	orNo: "",
	feePaid: "",
}

// Sworn Affidavit of Name Discrepancy
export interface SwornAffidavitNameDiscrepancyData {
	city: string
	province: string
	affiantName: string
	civilStatus: string
	address: string
	stockCertificateNo: string
	nameAppearedAs: string
	recordsName: string
	explanations: string[]
	name1: string
	name2: string
	name3: string
	companyName: string
	signDay: string
	signMonth: string
	signYear: string
	signCity: string
	swornDate: string
	swornAt: string
	docNo: string
	pageNo: string
	bookNo: string
	seriesOf: string
}

export const defaultSwornAffidavitNameDiscrepancy: SwornAffidavitNameDiscrepancyData = {
	city: "",
	province: "",
	affiantName: "",
	civilStatus: "single",
	address: "",
	stockCertificateNo: "",
	nameAppearedAs: "",
	recordsName: "",
	explanations: [""],
	name1: "",
	name2: "",
	name3: "",
	companyName: "",
	signDay: "",
	signMonth: "",
	signYear: "",
	signCity: "",
	swornDate: "",
	swornAt: "",
	docNo: "",
	pageNo: "",
	bookNo: "",
	seriesOf: "",
}

// Deed of Absolute Sale
export interface DeedOfAbsoluteSaleData {
	sellerName: string
	sellerAge: string
	sellerMaritalStatus: string
	sellerAddress: string
	buyerName: string
	buyerAge: string
	buyerMaritalStatus: string
	buyerAddress: string
	propertyTCT: string
	propertyLocation: string
	propertyArea: string
	propertyAreaUnit: string
	propertyImprovements: string
	price: string
	witness1Name: string
	witness2Name: string
	transactionDay: string
	transactionMonth: string
	transactionYear: string
	transactionPlace: string
	transactionCity: string
	notaryName: string
	notaryCommissionNo: string
	notaryCommissionValidUntil: string
	rollOfAttorneysNo: string
	ibpNo: string
	ibpDateChapter: string
	ptrNo: string
	ptrDateLocation: string
	mcleNo: string
	mcleDate: string
}

export const defaultDeedOfAbsoluteSale: DeedOfAbsoluteSaleData = {
	sellerName: "",
	sellerAge: "",
	sellerMaritalStatus: "single",
	sellerAddress: "",
	buyerName: "",
	buyerAge: "",
	buyerMaritalStatus: "single",
	buyerAddress: "",
	propertyTCT: "",
	propertyLocation: "",
	propertyArea: "",
	propertyAreaUnit: "SQM",
	propertyImprovements: "",
	price: "",
	witness1Name: "",
	witness2Name: "",
	transactionDay: "",
	transactionMonth: "",
	transactionYear: "",
	transactionPlace: "",
	transactionCity: "Philippines",
	notaryName: "",
	notaryCommissionNo: "",
	notaryCommissionValidUntil: "",
	rollOfAttorneysNo: "",
	ibpNo: "",
	ibpDateChapter: "",
	ptrNo: "",
	ptrDateLocation: "",
	mcleNo: "",
	mcleDate: "",
}

// Special Power of Attorney
export interface SpecialPowerOfAttorneyData {
	principalName: string
	principalAge: string
	principalResidence: string
	principalPostalAddress: string
	principalMaritalStatus: string
	agentName: string
	agentPostalAddress: string
	powersGranted: string
	propertyDescription: string
	executionDay: string
	executionMonth: string
	executionYear: string
	executionPlace: string
	cityProvince: string
	notaryName: string
	notaryCommissionNo: string
	notaryCommissionValidUntil: string
	rollOfAttorneysNo: string
	ibpNo: string
	ibpDateChapter: string
	ptrNo: string
	ptrDateLocation: string
	mcleNo: string
	mcleDate: string
}

export const defaultSpecialPowerOfAttorney: SpecialPowerOfAttorneyData = {
	principalName: "",
	principalAge: "",
	principalResidence: "",
	principalPostalAddress: "",
	principalMaritalStatus: "single",
	agentName: "",
	agentPostalAddress: "",
	powersGranted: "to execute and perform every act necessary to render effective the power to sell the foregoing properties",
	propertyDescription: "property more particularly described as follows:",
	executionDay: "",
	executionMonth: "",
	executionYear: "",
	executionPlace: "",
	cityProvince: "",
	notaryName: "",
	notaryCommissionNo: "",
	notaryCommissionValidUntil: "",
	rollOfAttorneysNo: "",
	ibpNo: "",
	ibpDateChapter: "",
	ptrNo: "",
	ptrDateLocation: "",
	mcleNo: "",
	mcleDate: "",
}

// Deed of Donation
export interface DeedOfDonationData {
	donorName: string
	donorAddress: string
	donorCivilStatus: string
	donorTCT: string
	doneeeName: string
	doneeAddress: string
	doneneCivilStatus: string
	propertyLocation: string
	propertyCityProvince: string
	propertyTCT: string
	technicalDescription: string
	donationPurpose: string
	executionDay: string
	executionMonth: string
	executionYear: string
	executionPlace: string
	executionCity: string
	witness1Name: string
	witness2Name: string
	notaryName: string
	notaryCommissionNo: string
	notaryCommissionValidUntil: string
	rollOfAttorneysNo: string
	ibpNo: string
	ibpDateChapter: string
	ptrNo: string
	ptrDateLocation: string
	mcleNo: string
	mcleDate: string
}

export const defaultDeedOfDonation: DeedOfDonationData = {
	donorName: "",
	donorAddress: "",
	donorCivilStatus: "single",
	donorTCT: "",
	doneeeName: "",
	doneeAddress: "",
	doneneCivilStatus: "single",
	propertyLocation: "",
	propertyCityProvince: "",
	propertyTCT: "",
	technicalDescription: "",
	donationPurpose: "love and affection",
	executionDay: "",
	executionMonth: "",
	executionYear: "",
	executionPlace: "",
	executionCity: "Philippines",
	witness1Name: "",
	witness2Name: "",
	notaryName: "",
	notaryCommissionNo: "",
	notaryCommissionValidUntil: "",
	rollOfAttorneysNo: "",
	ibpNo: "",
	ibpDateChapter: "",
	ptrNo: "",
	ptrDateLocation: "",
	mcleNo: "",
	mcleDate: "",
}

// Contract of Lease
export interface ContractOfLeaseData {
	city: string
	lessorName: string
	lessorAge: string
	lessorCivilStatus: string
	lessorAddress: string
	lesseeName: string
	lesseeAge: string
	lesseeCivilStatus: string
	lesseeAddress: string
	contractDay: string
	contractMonth: string
	contractYear: string
	contractCity: string
	propertyAddress: string
	leaseStartDate: string
	leaseEndDate: string
	monthlyRent: string
	rentDueDay: string
	depositAmount: string
	witnessDay: string
	witnessMonth: string
	witnessYear: string
	witnessCity: string
	lesseeSignatureName: string
	lessorSignatureName: string
	witness1Name: string
	witness2Name: string
	notaryCity: string
	ackDay: string
	ackMonth: string
	ackYear: string
	idPresentedBy: string
	idType: string
	idNumber: string
	idValidUntil: string
}

export const defaultContractOfLease: ContractOfLeaseData = {
	city: "",
	lessorName: "",
	lessorAge: "",
	lessorCivilStatus: "married",
	lessorAddress: "",
	lesseeName: "",
	lesseeAge: "",
	lesseeCivilStatus: "married",
	lesseeAddress: "",
	contractDay: "",
	contractMonth: "August",
	contractYear: "",
	contractCity: "Makati",
	propertyAddress: "",
	leaseStartDate: "",
	leaseEndDate: "",
	monthlyRent: "",
	rentDueDay: "",
	depositAmount: "",
	witnessDay: "",
	witnessMonth: "",
	witnessYear: "",
	witnessCity: "",
	lesseeSignatureName: "Signature of Lessee",
	lessorSignatureName: "Signature of Lessor",
	witness1Name: "",
	witness2Name: "",
	notaryCity: "",
	ackDay: "",
	ackMonth: "",
	ackYear: "",
	idPresentedBy: "LESSOR/LESSEE",
	idType: "",
	idNumber: "",
	idValidUntil: "",
}

// Real Estate Mortgage
export interface RealEstateMortgageData {
	executionPlace: string
	mortgagorName: string
	mortgagorCivilStatus: string
	mortgagorAddress: string
	mortgageeName: string
	mortgageeCivilStatus: string
	mortgageeAddress: string
	loanAmountWords: string
	loanAmountFigures: string
	propertyLocation: string
	propertyTctCctNo: string
	propertyDescription: string
	registeredDeedsOffice: string
	propertyAreaSqm: string
	interestRate: string
	paymentPeriodYears: string
	executionDay: string
	executionMonthYear: string
	executionCity: string
	mortgagorSignatureName: string
	mortgageeSignatureName: string
	mortgagorSpouseName: string
	mortgageeSpouseName: string
	witness1Name: string
	witness2Name: string
	notaryCityProvince: string
	ackDay: string
	ackMonthYear: string
	ackIdName1: string
	ackIdDetails1: string
	ackIdName2: string
	ackIdDetails2: string
}

export const defaultRealEstateMortgage: RealEstateMortgageData = {
	executionPlace: "",
	mortgagorName: "",
	mortgagorCivilStatus: "single",
	mortgagorAddress: "",
	mortgageeName: "",
	mortgageeCivilStatus: "single",
	mortgageeAddress: "",
	loanAmountWords: "",
	loanAmountFigures: "",
	propertyLocation: "",
	propertyTctCctNo: "",
	propertyDescription: "",
	registeredDeedsOffice: "",
	propertyAreaSqm: "",
	interestRate: "",
	paymentPeriodYears: "",
	executionDay: "",
	executionMonthYear: "",
	executionCity: "",
	mortgagorSignatureName: "",
	mortgageeSignatureName: "",
	mortgagorSpouseName: "",
	mortgageeSpouseName: "",
	witness1Name: "",
	witness2Name: "",
	notaryCityProvince: "",
	ackDay: "",
	ackMonthYear: "",
	ackIdName1: "",
	ackIdDetails1: "",
	ackIdName2: "",
	ackIdDetails2: "",
}

// Contract of Services
export interface ContractOfServicesData {
	serviceProviderName: string
	serviceProviderAddress: string
	serviceProviderRepresentative: string
	serviceProviderRepresentativeSpouseName: string
	clientName: string
	clientAddress: string
	clientRepresentative: string
	clientRepresentativeSpouseName: string
	serviceDescription: string
	workLocation: string
	scopeOfWork: string
	qualificationPersonnel: string
	monthlyBillingRate: string
	billingDueDays: string
	taxRatePercent: string
	advanceAdminFeePercent: string
	lateInterestPercentPerMonth: string
	overdayRate: string
	overtimeRateMultiplier: string
	holidayWorkDescription: string
	benefitsDescription: string
	bondAmount: string
	personnelTravel: string
	effectivityDay: string
	effectivityMonthYear: string
	effectivityCity: string
	providerSignatoryName: string
	clientSignatoryName: string
	providerWitnessName: string
	clientWitnessName: string
	notaryCityProvince: string
	ackDay: string
	ackMonthYear: string
	personName: string
	proofOfIdentity: string
	typeOfProofPresented: string
}

export const defaultContractOfServices: ContractOfServicesData = {
	serviceProviderName: "XCORP",
	serviceProviderAddress: "",
	serviceProviderRepresentative: "",
	serviceProviderRepresentativeSpouseName: "",
	clientName: "CLIENT",
	clientAddress: "",
	clientRepresentative: "",
	clientRepresentativeSpouseName: "",
	serviceDescription: "the business",
	workLocation: "",
	scopeOfWork: "",
	qualificationPersonnel: "",
	monthlyBillingRate: "",
	billingDueDays: "15",
	taxRatePercent: "12",
	advanceAdminFeePercent: "10",
	lateInterestPercentPerMonth: "2",
	overdayRate: "",
	overtimeRateMultiplier: "1.5",
	holidayWorkDescription: "",
	benefitsDescription: "",
	bondAmount: "",
	personnelTravel: "",
	effectivityDay: "",
	effectivityMonthYear: "",
	effectivityCity: "",
	providerSignatoryName: "",
	clientSignatoryName: "",
	providerWitnessName: "",
	clientWitnessName: "",
	notaryCityProvince: "",
	ackDay: "",
	ackMonthYear: "",
	personName: "",
	proofOfIdentity: "",
	typeOfProofPresented: "",
}

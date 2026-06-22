"use client"

export type ContractAiTab = "upload" | "analyze" | "chat" | "generate" | "summary"

export interface AnalysisResult {
	summary: string
	risks: RiskItem[]
	keyTerms: KeyTerm[]
}

export interface RiskItem {
	id: string
	severity: "high" | "medium" | "low"
	title: string
	description: string
	clause: string
}

export interface KeyTerm {
	id: string
	term: string
	value: string
	section: string
}

export interface AiChatMessage {
	id: string
	role: "user" | "assistant"
	text: string
	timestamp: string
}

export interface GenerateTemplate {
	id: string
	name: string
	description: string
	category: string
}

export interface PostNotarizationSummary {
	documentTitle: string
	notarizationType: string
	parties: string[]
	notaryName: string
	dateNotarized: string
	registryNo: string
	aiSummary: string
	keyObligations: string[]
}

export const FIXTURE_ANALYSIS: AnalysisResult = {
	summary:
		"This is a standard Deed of Absolute Sale for a residential property in Makati City. The document transfers ownership from the vendor (Juan Dela Cruz) to the vendee (Carmen Lim) for a consideration of PHP 5,000,000. The deed includes standard warranties and representations. Overall, the document follows typical Philippine real estate conveyance patterns with a few clauses that warrant attention.",
	risks: [
		{
			id: "r-1",
			severity: "high",
			title: "Missing escalation clause",
			description:
				"No escalation or dispute resolution mechanism is defined. If disagreements arise post-sale, there is no contractual path to mediation or arbitration before litigation.",
			clause: "Section 8 — General Provisions",
		},
		{
			id: "r-2",
			severity: "medium",
			title: "Ambiguous boundary description",
			description:
				"The lot boundary references survey plan PSU-12345, which has not been attached as an annex. Without it, boundaries may be disputed.",
			clause: "Section 2 — Property Description",
		},
		{
			id: "r-3",
			severity: "low",
			title: "No force majeure clause",
			description:
				"The contract lacks a force majeure provision, which may expose both parties to liability during unforeseen events affecting transfer.",
			clause: "N/A",
		},
	],
	keyTerms: [
		{ id: "kt-1", term: "Purchase Price", value: "PHP 5,000,000.00", section: "Section 3" },
		{ id: "kt-2", term: "Earnest Money", value: "PHP 500,000.00", section: "Section 3.1" },
		{ id: "kt-3", term: "Transfer Tax Responsibility", value: "Vendee", section: "Section 5" },
		{ id: "kt-4", term: "Warranty Period", value: "1 year from closing", section: "Section 7" },
		{
			id: "kt-5",
			term: "Governing Law",
			value: "Republic of the Philippines",
			section: "Section 9",
		},
	],
}

export const FIXTURE_AI_CHAT: AiChatMessage[] = [
	{
		id: "ai-1",
		role: "user",
		text: "What are the main obligations of the vendee under this deed?",
		timestamp: "11:00 AM",
	},
	{
		id: "ai-2",
		role: "assistant",
		text: "Based on my analysis, the vendee (Carmen Lim) has the following main obligations:\n\n1. **Payment of consideration** — PHP 5,000,000 total, with PHP 500,000 earnest money due upon signing.\n2. **Transfer taxes** — The vendee bears responsibility for all transfer taxes, documentary stamps, and registration fees (Section 5).\n3. **Property acceptance** — Accept the property in its current condition as described in Section 2.\n4. **Title transfer** — Coordinate with the Registry of Deeds within 30 days of closing for title transfer.",
		timestamp: "11:00 AM",
	},
	{
		id: "ai-3",
		role: "user",
		text: "Is the earnest money refundable if the sale falls through?",
		timestamp: "11:02 AM",
	},
	{
		id: "ai-4",
		role: "assistant",
		text: "The deed does not explicitly address refundability of earnest money. Under Philippine civil law (Article 1482 of the Civil Code), earnest money is generally considered part of the purchase price and constitutes proof of the perfection of the contract. This means:\n\n- If the **vendee** defaults, the vendor may retain the earnest money as liquidated damages.\n- If the **vendor** defaults, the vendee may demand return of the earnest money plus damages.\n\nI recommend adding an explicit clause defining the conditions under which the earnest money is refundable to avoid ambiguity.",
		timestamp: "11:02 AM",
	},
]

export const FIXTURE_TEMPLATES: GenerateTemplate[] = [
	{
		id: "tpl-1",
		name: "Deed of Absolute Sale",
		description: "Standard deed for real property transfer",
		category: "Real Estate",
	},
	{
		id: "tpl-2",
		name: "Special Power of Attorney",
		description: "Grant authority to act on behalf of principal",
		category: "Authorization",
	},
	{
		id: "tpl-3",
		name: "Affidavit of Loss",
		description: "Sworn statement for lost documents or items",
		category: "Affidavit",
	},
	{
		id: "tpl-4",
		name: "Contract of Lease",
		description: "Lease agreement for residential or commercial property",
		category: "Real Estate",
	},
	{
		id: "tpl-5",
		name: "Non-Disclosure Agreement",
		description: "Confidentiality agreement between parties",
		category: "Business",
	},
]

export const FIXTURE_POST_NOTARIZATION: PostNotarizationSummary = {
	documentTitle: "Deed of Absolute Sale — Lot 15, Makati City",
	notarizationType: "Acknowledgment",
	parties: ["Juan Dela Cruz (Vendor)", "Carmen Lim (Vendee)"],
	notaryName: "Atty. Maria Cruz, ENP",
	dateNotarized: "April 30, 2026",
	registryNo: "2026-009",
	aiSummary:
		"The notarized Deed of Absolute Sale transfers ownership of a residential lot in Makati City from Juan Dela Cruz to Carmen Lim. The consideration is PHP 5,000,000 with an earnest money of PHP 500,000. Both parties appeared before the notary public and acknowledged the document as their free and voluntary act. The document has been entered into the electronic notarial registry and synchronized with the Supreme Court e-Notarial system.",
	keyObligations: [
		"Vendee to pay remaining balance of PHP 4,500,000 within 30 days",
		"Vendee to process title transfer at Registry of Deeds",
		"Vendor to surrender physical possession within 15 days of full payment",
		"Vendee to pay all transfer taxes and registration fees",
	],
}

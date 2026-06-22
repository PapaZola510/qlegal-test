const now = new Date().toISOString()

export const mockAiGenerateResult = {
	id: "ai_gen_001",
	content: `DEED OF ABSOLUTE SALE\n\nKNOW ALL MEN BY THESE PRESENTS:\n\nThis Deed of Absolute Sale is entered into by and between:\n\nVENDOR: [Party A], of legal age, Filipino, and residing at [Address];\nVENDEE: [Party B], of legal age, Filipino, and residing at [Address];\n\nWITNESSETH:\n\nThat for and in consideration of the sum of PESOS: [Amount] (PHP [Amount]), receipt of which is hereby acknowledged, the VENDOR does hereby SELL, TRANSFER, and CONVEY unto the VENDEE the following described property:\n\n[Property Description]\n\nIN WITNESS WHEREOF, the parties have hereunto set their hands this [Date] at [Place].`,
	templateType: "deed_of_sale",
	tokensUsed: 342,
	createdAt: now,
	updatedAt: now,
}

export const mockAiAnalysisResult = {
	id: "ai_analysis_001",
	fileObjectId: "00000000-0000-4000-8000-000000000001",
	analysisType: "compliance",
	summary:
		"The document is largely compliant with notarial requirements. Two minor issues were identified regarding seal placement and witness acknowledgment.",
	findings: [
		{
			category: "Notarial Seal",
			severity: "warning" as const,
			description: "Notarial seal is present but positioned outside the designated area on page 2.",
			suggestion: "Reposition the seal within the acknowledgment section.",
		},
		{
			category: "Witness Signatures",
			severity: "critical" as const,
			description:
				"Only one instrumental witness signature found; Philippine law requires at least two.",
			suggestion: "Add a second instrumental witness signature before notarization.",
		},
		{
			category: "Document Formatting",
			severity: "info" as const,
			description: "Document uses standard formatting consistent with SC Circular requirements.",
			suggestion: null,
		},
	],
	overallScore: 72,
	createdAt: now,
	updatedAt: now,
}

export const mockAiChatHistory = [
	{
		role: "user" as const,
		content: "What are the requirements for notarizing a deed of sale?",
		timestamp: now,
	},
	{
		role: "assistant" as const,
		content:
			"To notarize a deed of sale in the Philippines, you need:\n\n1. The original deed signed by all parties\n2. Valid government-issued IDs of all signatories\n3. Community Tax Certificates (cedulas)\n4. At least two instrumental witnesses\n5. Transfer Certificate of Title or relevant property documents\n6. Tax Declaration and real property tax receipts\n\nThe signatories must personally appear before the notary public.",
		timestamp: now,
	},
]

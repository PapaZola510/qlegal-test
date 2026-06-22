/** Sample values for DocOnChain / Supreme Court electronic notarial seal fields. */
export const NOTARIAL_FIELD_HINTS = {
	rollNumber: "94942",
	rollDate: "5 June 2018",
	commissionNumber: "0771-25",
	commissionExpiry: "2026-12-31",
	ptrNumber: "6034312",
	ptrLocation: "Mandaluyong City",
	ptrDate: "09/30/2025",
	ibpNumber: "583375",
	ibpDate: "Dec 18, 2024 (for 2025)",
	mclePeriod: "MCLE Exempt — Admitted to the Bar on 24 January 2025",
	mcleNumber: "",
	mcleDate: "",
	/** Full exempt note is kept in profile; the seal exports a compact `Exempt & MM/DD/YYYY` line. */
	officeAddress: "Uranus St Dreamland Subdv Namayan Mandaluyong City",
	residentialAddress: "123 Rizal St., Barangay 1, Legazpi City",
	commissionArea: "Mandaluyong City",
} as const

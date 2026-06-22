import {
	buildDoconchainDocumentStampJson,
	formatDcCommissionValidUntil,
	formatDcMcleComplianceNote,
	formatDcPtrOrMcleDate,
	formatDcRollDate,
	formatEnpSealName,
	isMcleExemptNote,
	parseAdmissionDateFromExemptNote,
	parseValidUntilFromMcleNote,
	resolveDoconchainMcleStampFields,
	truncateSealField,
} from "./build-doconchain-document-stamp"

describe("DocOnChain seal date formatting", () => {
	it("formats roll date for profile storage (not sent on seal footer)", () => {
		expect(formatDcRollDate(new Date("2018-06-05T12:00:00.000Z"))).toBe("5 June 2018")
	})

	it("formats commission validity for seal footer (YYYY-MM-DD)", () => {
		expect(formatDcCommissionValidUntil(new Date("2025-03-13T12:00:00.000Z"))).toBe("2025-03-13")
	})

	it("formats PTR / MCLE dates for seal footer (MM/DD/YYYY)", () => {
		expect(formatDcPtrOrMcleDate(new Date("2025-09-30T12:00:00.000Z"))).toBe("09/30/2025")
		expect(formatDcPtrOrMcleDate(new Date("2024-06-12T12:00:00.000Z"))).toBe("06/12/2024")
	})

	it("formats MCLE compliance note for MCLE_no_period", () => {
		expect(formatDcMcleComplianceNote("Valid until 12/30/2026")).toBe("Valid until 12/30/2026")
		expect(formatDcMcleComplianceNote("2026-12-30")).toBe("Valid until 12/30/2026")
	})

	it("detects MCLE exempt notes", () => {
		expect(isMcleExemptNote("MCLE Exempt — Admitted to the Bar on 24 January 2025")).toBe(true)
		expect(isMcleExemptNote("Valid until 12/30/2026")).toBe(false)
	})

	it("uses MCLE note only when exempt", () => {
		expect(
			resolveDoconchainMcleStampFields({
				mcleNo: "1234567",
				mclePeriod: "MCLE Exempt — Admitted to the Bar on 24 January 2025",
				mcleDate: new Date("2026-09-03T12:00:00.000Z"),
			})
		).toEqual({
			MCLE_no: "Exempt",
			MCLE_no_date: "09/03/2026",
			MCLE_no_date_valid: "09/03/2026",
			MCLE_no_date_until: "01/24/2025",
			MCLE_no_period: "Valid until 01/24/2025",
		})
	})

	it("parses valid-until date from MCLE compliance note", () => {
		expect(parseValidUntilFromMcleNote("Valid until 12/30/2026")).toBe("12/30/2026")
	})

	it("parses admission date from exempt note", () => {
		expect(
			parseAdmissionDateFromExemptNote("MCLE Exempt — Admitted to the Bar on 24 January 2025")
		).toEqual(new Date("2025-01-24T12:00:00.000Z"))
	})

	it("truncates long seal fields", () => {
		expect(truncateSealField("abcdefghijklmnopqrstuvwxyz", 20)).toBe("abcdefghijklmnopqrs…")
	})

	it("builds accepted seal footer from ENP profile fields", () => {
		const json = buildDoconchainDocumentStampJson(
			{
				prefix: "Atty.",
				firstName: "Jocelyn",
				lastName: "Isanan Racho",
				suffix: null,
				email: "attyjocelyn@gmail.com",
				rollNo: "94942",
				rollDate: new Date("2018-06-05T12:00:00.000Z"),
				npnCommissionNo: "0771-25",
				commissionValidUntil: new Date("2025-03-13T12:00:00.000Z"),
				ptrNo: "6034312",
				ptrLocation: "Mandaluyong City",
				ptrDate: new Date("2025-09-30T12:00:00.000Z"),
				ibpNo: "583375",
				ibpDate: "Dec 18, 2024 (for 2025)",
				mcleNo: "123456",
				mclePeriod: "Valid until 12/30/2026",
				mcleDate: new Date("2025-09-30T12:00:00.000Z"),
				notaryAddress: "Uranus St Dreamland, Mandaluyong City",
			},
			{ sessionMode: "in_person" }
		)
		const stamp = JSON.parse(json) as {
			seal: { enp_name: string; enp_role_number: string }
			notary_info: Record<string, string>
		}
		expect(
			formatEnpSealName({
				prefix: "Atty.",
				firstName: "Jocelyn",
				lastName: "Isanan Racho",
				suffix: null,
			})
		).toBe("Jocelyn Isanan Racho")
		expect(stamp.seal.enp_name).toBe("Jocelyn Isanan Racho")
		expect(stamp.seal.enp_role_number).toBe("94942")
		expect(stamp.notary_info.atty_name).toBe("Jocelyn Isanan Racho")
		expect(stamp.notary_info.roll_no).toBe("94942")
		expect(stamp.notary_info.roll_no_date).toBe("")
		expect(stamp.notary_info.commission_no_valid_until).toBe("2025-03-13")
		expect(stamp.notary_info.IBP_no_date).toBe("")
		expect(stamp.notary_info.email_address).toBe("attyjocelyn@gmail.com")
		expect(stamp.notary_info.business_address).toBe("Uranus St Dreamland, Mandaluyong City")
		expect(stamp.notary_info.email).toBe("attyjocelyn@gmail.com")
		expect(stamp.notary_info.address).toBe("Uranus St Dreamland, Mandaluyong City")
		expect(stamp.notary_info.PTR_no_date).toBe("09/30/2025")
		expect(stamp.notary_info.MCLE_no).toBe("123456")
		expect(stamp.notary_info.MCLE_no_date_valid).toBe("09/30/2025")
		expect(stamp.notary_info.MCLE_no_date_until).toBe("12/30/2026")
		expect(stamp.notary_info.MCLE_no_period).toBe("Valid until 12/30/2026")
		expect(stamp.notary_info.mode_of_notarization).toBe("IEN")
	})

	it("omits roll/IBP dates and uses compact MCLE for exempt ENP", () => {
		const json = buildDoconchainDocumentStampJson(
			{
				prefix: "Atty.",
				firstName: "Mavis",
				lastName: "Montesor",
				suffix: null,
				email: "mavismontesor@gmail.com",
				rollNo: "12341",
				rollDate: new Date("2026-10-10T12:00:00.000Z"),
				npnCommissionNo: "0771-25",
				commissionValidUntil: new Date("2027-03-13T12:00:00.000Z"),
				ptrNo: "6034312",
				ptrLocation: "Mandaluyong City",
				ptrDate: new Date("2026-09-30T12:00:00.000Z"),
				ibpNo: "583375",
				ibpDate: "Dec 18, 2024 (for 2025)",
				mcleNo: "1234567",
				mclePeriod: "MCLE Exempt — Admitted to the Bar on 24 January 2025",
				mcleDate: new Date("2026-09-03T12:00:00.000Z"),
				notaryAddress: "DOSC Legazpi",
			},
			{ sessionMode: "remote" }
		)
		const stamp = JSON.parse(json) as { notary_info: Record<string, string> }
		expect(stamp.notary_info.email_address).toBe("mavismontesor@gmail.com")
		expect(stamp.notary_info.business_address).toBe("DOSC Legazpi")
		expect(stamp.notary_info.roll_no_date).toBe("")
		expect(stamp.notary_info.IBP_no_date).toBe("")
		expect(stamp.notary_info.MCLE_no).toBe("Exempt")
		expect(stamp.notary_info.MCLE_no_date_valid).toBe("09/03/2026")
		expect(stamp.notary_info.MCLE_no_date_until).toBe("01/24/2025")
		expect(stamp.notary_info.MCLE_no_period).toBe("Valid until 01/24/2025")
		expect(stamp.notary_info.mode_of_notarization).toBe("REN")
	})
})
